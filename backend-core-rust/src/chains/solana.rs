use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::error::Error;

#[allow(dead_code)]
pub const SOLANA_JITO_TIP_ACCOUNTS: &[&str] = &[
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaSwapRequest {
    pub user_public_key: String,
    pub input_mint: String,
    pub output_mint: String,
    pub amount_sol: f64,
    pub slippage_bps: u32,
    pub use_jito_anti_mev: bool,
    pub jito_tip_lamports: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaSwapResult {
    pub tx_signature: String,
    pub route_used: String,
    pub input_amount: f64,
    pub estimated_output: f64,
    pub jito_bundled: bool,
}

#[allow(dead_code)]
pub struct SolanaChainAdapter {
    rpc_url: String,
    jito_engine_url: String,
    http_client: Client,
}

impl SolanaChainAdapter {
    pub fn new(rpc_url: &str, jito_url: &str) -> Self {
        Self {
            rpc_url: rpc_url.to_string(),
            jito_engine_url: jito_url.to_string(),
            http_client: Client::builder().build().unwrap_or_default(),
        }
    }

    /// 查询账户 SOL 余额
    pub async fn get_balance(&self, pubkey: &str) -> Result<f64, Box<dyn Error + Send + Sync>> {
        let payload = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBalance",
            "params": [pubkey]
        });

        let resp = self.http_client.post(&self.rpc_url).json(&payload).send().await?;
        let res_json: serde_json::Value = resp.json().await?;
        let lamports = res_json["result"]["value"].as_u64().unwrap_or(0);
        Ok((lamports as f64) / 1e9)
    }

    /// 模拟 Jupiter / Raydium 极速交换并包装 Jito Tip Bundle
    pub async fn prepare_swap(&self, req: &SolanaSwapRequest) -> Result<SolanaSwapResult, Box<dyn Error + Send + Sync>> {
        let simulated_output = req.amount_sol * 12500.0; // 模拟兑换汇率
        let sig = format!("5Kq...{}", &req.output_mint[..6]);

        Ok(SolanaSwapResult {
            tx_signature: sig,
            route_used: "Raydium CP-Swap / Jupiter V6".to_string(),
            input_amount: req.amount_sol,
            estimated_output: simulated_output,
            jito_bundled: req.use_jito_anti_mev,
        })
    }
}
