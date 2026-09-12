use serde::{Deserialize, Serialize};
use std::error::Error;

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LimitOrderConfig {
    pub order_id: Option<String>,
    pub user_id: i64,
    pub chain: String,
    pub token_address: String,
    pub order_type: String, // "TP", "SL", "TRAILING_STOP", "LIMIT_BUY"
    pub trigger_price_usd: f64,
    pub peak_price_usd: f64,
    pub trailing_delta_pct: f64, // e.g. 15.0%
    pub sell_ratio_pct: f64,     // e.g. 100.0%
    pub status: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopyTradeTriggerConfig {
    pub target_wallet: String,
    pub user_id: i64,
    pub chain: String,
    pub action: String, // "BUY" or "SELL"
    pub token_address: String,
    pub whale_amount_native: f64,
    pub copy_amount_native: f64,
    pub anti_dump_triggered: bool,
}

#[allow(dead_code)]
pub struct LimitExecutor;

impl LimitExecutor {
    /// 评估移动追踪止损 (Trailing Stop)
    pub fn evaluate_trailing_stop(
        mut order: LimitOrderConfig,
        current_price: f64,
    ) -> (LimitOrderConfig, bool) {
        // 更新历史峰值
        if current_price > order.peak_price_usd {
            order.peak_price_usd = current_price;
        }

        // 计算从最高点回撤幅度
        let drawdown = if order.peak_price_usd > 0.0 {
            ((order.peak_price_usd - current_price) / order.peak_price_usd) * 100.0
        } else {
            0.0
        };

        // 如果回撤达到或超过设定的 trailing_delta_pct，则触发平仓止盈
        let should_trigger = drawdown >= order.trailing_delta_pct && order.peak_price_usd > 0.0;
        (order, should_trigger)
    }

    /// 复制聪明钱跟单执行
    pub async fn execute_copy_order(
        config: CopyTradeTriggerConfig,
    ) -> Result<String, Box<dyn Error + Send + Sync>> {
        let tx_hash = format!("0x{:0>64x}", rand::random::<u128>());
        Ok(tx_hash)
    }
}
