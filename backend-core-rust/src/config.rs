use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub server_host: String,
    pub server_port: u16,
    pub master_key: String, // 32-byte hex for AES-256-GCM
    
    // RPC Endpoints
    pub robinhood_rpc: String,
    pub robinhood_chain_id: u64,
    pub ethereum_rpc: String,
    pub base_rpc: String,
    pub bsc_rpc: String,
    pub solana_rpc: String,
    pub jito_block_engine_url: String,
    
    // Performance Defaults
    pub default_slippage_pct: f64,
    pub max_priority_fee_gwei: f64,
}

impl AppConfig {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();
        Self {
            server_host: env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            server_port: env::var("SERVER_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .unwrap_or(8080),
            master_key: env::var("ENCRYPTION_MASTER_KEY")
                .unwrap_or_else(|_| "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_string()),
            robinhood_rpc: env::var("ROBINHOOD_RPC")
                .unwrap_or_else(|_| "https://rpc.mainnet.chain.robinhood.com".to_string()),
            robinhood_chain_id: 4663,
            ethereum_rpc: env::var("ETHEREUM_RPC")
                .unwrap_or_else(|_| "https://eth.llamarpc.com".to_string()),
            base_rpc: env::var("BASE_RPC")
                .unwrap_or_else(|_| "https://mainnet.base.org".to_string()),
            bsc_rpc: env::var("BSC_RPC")
                .unwrap_or_else(|_| "https://bsc-dataseed.binance.org".to_string()),
            solana_rpc: env::var("SOLANA_RPC")
                .unwrap_or_else(|_| "https://api.mainnet-beta.solana.com".to_string()),
            jito_block_engine_url: env::var("JITO_BLOCK_ENGINE_URL")
                .unwrap_or_else(|_| "https://mainnet.block-engine.jito.wtf".to_string()),
            default_slippage_pct: 5.0,
            max_priority_fee_gwei: 5.0,
        }
    }
}
