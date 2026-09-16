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
    let config = AppConfig::try_from_env()?;

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

fn verify_wallet_auth(headers: &axum::http::HeaderMap, state: &AppState) -> Result<(), (StatusCode, String)> {
    if let Some(ref secret) = state.config.core_api_secret {
        let auth_header = headers.get("authorization").and_then(|v| v.to_str().ok());
        let x_token = headers.get("x-backend-token").and_then(|v| v.to_str().ok());

        let is_valid = if let Some(ah) = auth_header {
            if let Some(token) = ah.strip_prefix("Bearer ") {
                token.trim() == secret
            } else {
                ah.trim() == secret
            }
        } else if let Some(xt) = x_token {
            xt.trim() == secret
        } else {
            false
        };

        if !is_valid {
            return Err((StatusCode::UNAUTHORIZED, "Unauthorized: Invalid or missing core API secret".to_string()));
        }
    }
    Ok(())
}

#[derive(Deserialize)]
struct GenWalletReq {
    chain_family: Option<String>,
    chain: Option<String>,
}

async fn generate_wallet_handler(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<GenWalletReq>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    verify_wallet_auth(&headers, &state)?;

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
    headers: axum::http::HeaderMap,
    Json(payload): Json<EncryptReq>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    verify_wallet_auth(&headers, &state)?;

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
    headers: axum::http::HeaderMap,
    Json(payload): Json<DecryptReq>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    verify_wallet_auth(&headers, &state)?;

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
    // ARC-AUDIT P0: do not inspect ARC contracts on Ethereum or label them SAFE.
    if payload.chain.eq_ignore_ascii_case("arc") {
        return Err((StatusCode::SERVICE_UNAVAILABLE, "ARC security verification is unavailable".to_string()));
    }
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
    if req.chain.eq_ignore_ascii_case("arc") {
        return Err((StatusCode::SERVICE_UNAVAILABLE, "ARC execution is disabled pending release verification".to_string()));
    }
    let res = executor::SwapExecutor::execute_fast_buy(req)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(res))
}

async fn fast_sell_handler(
    Json(req): Json<executor::FastSellRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if req.chain.eq_ignore_ascii_case("arc") {
        return Err((StatusCode::SERVICE_UNAVAILABLE, "ARC execution is disabled pending release verification".to_string()));
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderMap;

    fn create_test_state(secret: Option<String>) -> AppState {
        AppState {
            config: AppConfig {
                server_host: "127.0.0.1".to_string(),
                server_port: 8085,
                master_key: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90".to_string(),
                core_api_secret: secret,
                robinhood_rpc: "https://rpc.mainnet.chain.robinhood.com".to_string(),
                robinhood_chain_id: 4663,
                ethereum_rpc: "https://eth.llamarpc.com".to_string(),
                base_rpc: "https://mainnet.base.org".to_string(),
                bsc_rpc: "https://bsc-dataseed.binance.org".to_string(),
                solana_rpc: "https://api.mainnet-beta.solana.com".to_string(),
                jito_block_engine_url: "https://mainnet.block-engine.jito.wtf".to_string(),
                default_slippage_pct: 5.0,
                max_priority_fee_gwei: 5.0,
            },
            rh_adapter: chains::RobinhoodChainAdapter::new("https://rpc.mainnet.chain.robinhood.com"),
            evm_adapter: chains::EvmMultiChainAdapter::new(),
            solana_adapter: chains::SolanaChainAdapter::new(
                "https://api.mainnet-beta.solana.com",
                "https://mainnet.block-engine.jito.wtf",
            ),
            honeypot_sim: simulator::HoneypotSimulator::new(),
        }
    }

    #[test]
    fn test_verify_wallet_auth_when_no_secret_configured() {
        let state = create_test_state(None);
        let headers = HeaderMap::new();
        assert!(verify_wallet_auth(&headers, &state).is_ok());
    }

    #[test]
    fn test_verify_wallet_auth_rejects_missing_or_invalid_secret() {
        let state = create_test_state(Some("super-secure-backend-token".to_string()));
        let mut headers = HeaderMap::new();

        // 1. Missing header -> 401
        let err = verify_wallet_auth(&headers, &state).unwrap_err();
        assert_eq!(err.0, StatusCode::UNAUTHORIZED);

        // 2. Wrong Bearer token -> 401
        headers.insert("authorization", "Bearer wrong-token".parse().unwrap());
        let err = verify_wallet_auth(&headers, &state).unwrap_err();
        assert_eq!(err.0, StatusCode::UNAUTHORIZED);

        // 3. Wrong x-backend-token -> 401
        headers.remove("authorization");
        headers.insert("x-backend-token", "wrong-token".parse().unwrap());
        let err = verify_wallet_auth(&headers, &state).unwrap_err();
        assert_eq!(err.0, StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn test_verify_wallet_auth_accepts_valid_secret() {
        let state = create_test_state(Some("super-secure-backend-token".to_string()));

        // 1. Valid Bearer token
        let mut headers = HeaderMap::new();
        headers.insert("authorization", "Bearer super-secure-backend-token".parse().unwrap());
        assert!(verify_wallet_auth(&headers, &state).is_ok());

        // 2. Valid raw Authorization token
        let mut headers2 = HeaderMap::new();
        headers2.insert("authorization", "super-secure-backend-token".parse().unwrap());
        assert!(verify_wallet_auth(&headers2, &state).is_ok());

        // 3. Valid x-backend-token header
        let mut headers3 = HeaderMap::new();
        headers3.insert("x-backend-token", "super-secure-backend-token".parse().unwrap());
        assert!(verify_wallet_auth(&headers3, &state).is_ok());
    }
}
