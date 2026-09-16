use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub server_host: String,
    pub server_port: u16,
    pub master_key: String, // 32-byte hex for AES-256-GCM
    pub core_api_secret: Option<String>,
    
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
    /// 严格校验 AES-256-GCM 主密钥格式及安全性 (PUB-04)
    pub fn validate_master_key(key: &str) -> Result<String, String> {
        let trimmed = key.trim();
        if trimmed.is_empty() {
            return Err("ENCRYPTION_MASTER_KEY is required and cannot be empty".to_string());
        }
        if trimmed.len() != 64 || !trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(format!(
                "ENCRYPTION_MASTER_KEY must be a valid 32-byte hex string (64 hexadecimal characters), got {} chars",
                trimmed.len()
            ));
        }

        let lower = trimmed.to_lowercase();
        let insecure_keys = [
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "0000000000000000000000000000000000000000000000000000000000000000",
            "1111111111111111111111111111111111111111111111111111111111111111",
            "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        ];
        if insecure_keys.contains(&lower.as_str()) {
            return Err(
                "Known insecure or sample ENCRYPTION_MASTER_KEY detected! Please generate a secure 32-byte random key (e.g. `openssl rand -hex 32`) and configure it in your .env file."
                    .to_string(),
            );
        }

        Ok(trimmed.to_string())
    }

    pub fn try_from_env() -> Result<Self, String> {
        dotenvy::dotenv().ok();

        // 默认监听 127.0.0.1 回环地址 (RUN-02)
        let server_host = env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let server_port = env::var("SERVER_PORT")
            .unwrap_or_else(|_| "8085".to_string())
            .parse()
            .unwrap_or(8085);

        let raw_master_key = env::var("ENCRYPTION_MASTER_KEY")
            .map_err(|_| "Missing required environment variable: ENCRYPTION_MASTER_KEY. Generate one via `openssl rand -hex 32`".to_string())?;
        let master_key = Self::validate_master_key(&raw_master_key)?;

        let core_api_secret = env::var("BACKEND_CORE_SECRET")
            .or_else(|_| env::var("CORE_API_SECRET"))
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        // 若绑定外部公共 IP，强制要求必须配置 CORE_API_SECRET (RUN-02)
        let is_loopback = server_host == "127.0.0.1" || server_host == "localhost" || server_host == "::1";
        if !is_loopback && core_api_secret.is_none() {
            return Err(
                "Binding backend-core to a public/external interface without CORE_API_SECRET is forbidden. Set BACKEND_CORE_SECRET or bind to 127.0.0.1"
                    .to_string(),
            );
        }

        Ok(Self {
            server_host,
            server_port,
            master_key,
            core_api_secret,
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
        })
    }

    pub fn from_env() -> Self {
        Self::try_from_env().unwrap_or_else(|err| {
            panic!("Configuration error: {}", err);
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_master_key_rejects_empty_and_invalid_lengths() {
        assert!(AppConfig::validate_master_key("").is_err());
        assert!(AppConfig::validate_master_key("abc").is_err());
        assert!(AppConfig::validate_master_key("0123456789abcdef").is_err());
        // 65 chars
        let long_key = "a".repeat(65);
        assert!(AppConfig::validate_master_key(&long_key).is_err());
        // Non-hex chars
        let non_hex = "g".repeat(64);
        assert!(AppConfig::validate_master_key(&non_hex).is_err());
    }

    #[test]
    fn test_validate_master_key_rejects_known_insecure_keys() {
        let sample = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        assert!(AppConfig::validate_master_key(sample).is_err());

        let all_zeros = "0".repeat(64);
        assert!(AppConfig::validate_master_key(&all_zeros).is_err());

        let all_ones = "1".repeat(64);
        assert!(AppConfig::validate_master_key(&all_ones).is_err());
    }

    #[test]
    fn test_validate_master_key_accepts_valid_keys() {
        let valid = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
        assert_eq!(AppConfig::validate_master_key(valid).unwrap(), valid);
    }
}
