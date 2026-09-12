use serde::{Deserialize, Serialize};
use std::error::Error;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnipeTaskConfig {
    pub task_id: Option<String>,
    pub user_id: i64,
    pub chain: String,
    pub token_address: String,
    pub snipe_type: String, // "LIQUIDITY" (开盘加池) or "METHOD_ID" (指定函数调用开盘)
    pub method_id: Option<String>, // 如 0x8f32d59b
    pub amount_native: f64,
    pub tip_priority_gwei: f64,
    pub auto_tp_pct: Option<f64>, // 自动止盈百分比
    pub auto_sl_pct: Option<f64>, // 自动止损百分比
    pub multi_wallet_blast: bool, // 是否联合 3~5 个钱包同块开火
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnipeTriggerResult {
    pub task_id: String,
    pub token_address: String,
    pub triggered_event: String,
    pub broadcast_status: String,
    pub tx_hashes: Vec<String>,
    pub execution_latency_ms: u64,
}

pub struct SnipeEngine;

impl SnipeEngine {
    /// 注册并监听开盘狙击
    pub fn create_snipe_task(mut config: SnipeTaskConfig) -> SnipeTaskConfig {
        if config.task_id.is_none() {
            config.task_id = Some(Uuid::new_v4().to_string());
        }
        config
    }

    /// 模拟触发狙击开火
    pub async fn trigger_snipe(config: &SnipeTaskConfig) -> Result<SnipeTriggerResult, Box<dyn Error + Send + Sync>> {
        let start = std::time::Instant::now();
        tokio::time::sleep(tokio::time::Duration::from_millis(8)).await;

        let mut tx_hashes = Vec::new();
        let shots = if config.multi_wallet_blast { 3 } else { 1 };
        for _ in 0..shots {
            tx_hashes.push(format!("0x{:0>64x}", rand::random::<u128>()));
        }

        Ok(SnipeTriggerResult {
            task_id: config.task_id.clone().unwrap_or_default(),
            token_address: config.token_address.clone(),
            triggered_event: format!("Detected {}", config.snipe_type),
            broadcast_status: "SENT_TO_SEQUENCER".to_string(),
            tx_hashes,
            execution_latency_ms: start.elapsed().as_millis() as u64,
        })
    }
}
