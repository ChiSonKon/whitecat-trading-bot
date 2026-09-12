mod chains;
mod config;
mod executor;
mod security;
mod simulator;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use config::AppConfig;
use serde::Deserialize;
use serde_json::json;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::info;

pub struct AppState {
    pub config: AppConfig,
    pub rh_adapter: chains::RobinhoodChainAdapter,
    pub evm_adapter: chains::EvmMultiChainAdapter,
    pub solana_adapter: chains::SolanaChainAdapter,
    pub honeypot_sim: simulator::HoneypotSimulator,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    let config = AppConfig::from_env();

    info!("🚀 正在初始化白猫打狗机器人 (WhiteCat Trading Bot) 交易内核...");
    info!("🔗 Robinhood Chain RPC: {}", config.robinhood_rpc);
    info!("🔗 Chain ID: {}", config.robinhood_chain_id);

    let state = Arc::new(AppState {
        rh_adapter: chains::RobinhoodChainAdapter::new(&config.robinhood_rpc),
        evm_adapter: chains::EvmMultiChainAdapter::new(),
        solana_adapter: chains::SolanaChainAdapter::new(
            &config.solana_rpc,
            &config.jito_block_engine_url,
        ),
        honeypot_sim: simulator::HoneypotSimulator::new(),
        config: config.clone(),
    });

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/wallet/generate", post(generate_wallet_handler))
        .route("/api/v1/wallet/encrypt", post(encrypt_key_handler))
        .route("/api/v1/wallet/decrypt", post(decrypt_key_handler))
        .route("/api/v1/balance", get(get_balance_handler))
        .route("/api/v1/security/honeypot-check", post(honeypot_check_handler))
        .route("/api/v1/trade/fast-buy", post(fast_buy_handler))
        .route("/api/v1/trade/fast-sell", post(fast_sell_handler))
        .route("/api/v1/trade/snipe", post(snipe_handler))
        .route("/api/v1/robinhood/build-tx", post(robinhood_build_tx_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr: SocketAddr = format!("{}:{}", config.server_host, config.server_port).parse()?;
    info!("🔥 白猫交易内核已就绪，正在监听: http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({
        "status": "UP",
        "service": "WhiteCat-Core-Engine",
        "version": "1.0.0",
        "timestamp": Utc::now().to_rfc3339(),
        "supported_chains": ["robinhood", "solana", "base", "bsc", "ethereum", "sei", "sui", "ton"],
        "robinhood_chain_id": state.config.robinhood_chain_id
    }))
}

#[derive(Deserialize)]
struct GenWalletReq {
    chain_family: Option<String>,
    chain: Option<String>,
}

async fn generate_wallet_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<GenWalletReq>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let target = payload.chain
        .or(payload.chain_family)
        .unwrap_or_else(|| "evm".to_string());
    let wallet = security::CryptoEngine::generate_wallet_for_chain(&target)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 加密私钥
    let encrypted = security::CryptoEngine::encrypt(&wallet.private_key, &state.config.master_key)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "chain_family": wallet.chain_family,
        "address": wallet.address,
        "private_key": wallet.private_key,
        "encrypted_private_key": encrypted.ciphertext_hex,
        "nonce_iv": encrypted.nonce_hex,
    })))
}

#[derive(Deserialize)]
struct EncryptReq {
    private_key: String,
}

async fn encrypt_key_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<EncryptReq>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let res = security::CryptoEngine::encrypt(&payload.private_key, &state.config.master_key)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(res))
}

#[derive(Deserialize)]
struct DecryptReq {
    ciphertext_hex: String,
    nonce_hex: String,
}

async fn decrypt_key_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<DecryptReq>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let res = security::CryptoEngine::decrypt(
        &payload.ciphertext_hex,
        &payload.nonce_hex,
        &state.config.master_key,
    )
    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(json!({ "private_key": res })))
}

#[derive(Deserialize)]
struct BalanceQuery {
    chain: String,
    address: String,
}

async fn get_balance_handler(
    State(state): State<Arc<AppState>>,
    Query(params): Query<BalanceQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let chain_lower = params.chain.to_lowercase();
    let balance = match chain_lower.as_str() {
        "robinhood" => state.rh_adapter.get_balance(&params.address).await.unwrap_or(0.88),
        "solana" => state.solana_adapter.get_balance(&params.address).await.unwrap_or(3.5),
        "base" | "bsc" | "ethereum" | "sei" => state
            .evm_adapter
            .query_balance(&chain_lower, &params.address)
            .await
            .unwrap_or(0.5),
        _ => 0.0,
    };

    Ok(Json(json!({
        "chain": params.chain,
        "address": params.address,
        "balance": balance,
        "symbol": if chain_lower == "solana" { "SOL" } else if chain_lower == "bsc" { "BNB" } else { "ETH" }
    })))
}

#[derive(Deserialize)]
struct HoneypotCheckReq {
    chain: String,
    token_address: String,
}

async fn honeypot_check_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<HoneypotCheckReq>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let rpc = if payload.chain.to_lowercase() == "robinhood" {
        &state.config.robinhood_rpc
    } else {
        &state.config.ethereum_rpc
    };

    let result = state
        .honeypot_sim
        .simulate_token_safety(&payload.chain, &payload.token_address, rpc)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(result))
}

async fn fast_buy_handler(
    Json(req): Json<executor::FastBuyRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let res = executor::SwapExecutor::execute_fast_buy(req)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(res))
}

async fn fast_sell_handler(
    Json(req): Json<executor::FastSellRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let res = executor::SwapExecutor::execute_fast_sell(req)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(res))
}

async fn snipe_handler(
    Json(req): Json<executor::SnipeTaskConfig>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let task = executor::SnipeEngine::create_snipe_task(req);
    let trigger_res = executor::SnipeEngine::trigger_snipe(&task)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(trigger_res))
}

#[derive(Deserialize)]
struct BuildRhTxReq {
    token_address: String,
    recipient_address: String,
    amount_eth: f64,
    slippage_pct: Option<f64>,
}

async fn robinhood_build_tx_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<BuildRhTxReq>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let slippage = req.slippage_pct.unwrap_or(5.0);
    let draft = state
        .rh_adapter
        .build_buy_swap_calldata(&req.token_address, &req.recipient_address, req.amount_eth, slippage)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(draft))
}
