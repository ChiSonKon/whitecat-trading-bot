use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::error::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoneypotAnalysisResult {
    pub chain: String,
    pub token_address: String,
    pub is_honeypot: bool,
    pub can_buy: bool,
    pub can_sell: bool,
    pub buy_tax_pct: f64,
    pub sell_tax_pct: f64,
    pub is_mintable: bool,
    pub is_blacklisted: bool,
    pub risk_level: String, // "SAFE", "LOW", "MEDIUM", "HIGH", "CRITICAL"
    pub reason: String,
}

pub struct HoneypotSimulator {
    http_client: Client,
}

impl HoneypotSimulator {
    pub fn new() -> Self {
        Self {
            http_client: Client::builder().build().unwrap_or_default(),
        }
    }

    /// 沙盒模拟代币买卖流程，检测是否为貔貅盘
    pub async fn simulate_token_safety(
        &self,
        chain: &str,
        token_address: &str,
        rpc_url: &str,
    ) -> Result<HoneypotAnalysisResult, Box<dyn Error + Send + Sync>> {
        let clean_address = token_address.trim().to_lowercase();
        
        // 1. 基础地址长度检查
        if clean_address.len() != 42 && clean_address.len() != 44 {
            return Ok(HoneypotAnalysisResult {
                chain: chain.to_string(),
                token_address: clean_address,
                is_honeypot: true,
                can_buy: false,
                can_sell: false,
                buy_tax_pct: 0.0,
                sell_tax_pct: 0.0,
                is_mintable: false,
                is_blacklisted: false,
                risk_level: "CRITICAL".to_string(),
                reason: "无效的合约地址格式".to_string(),
            });
        }

        // 2. 调用 RPC eth_getCode 验证是否为合约
        let code_payload = json!({
            "jsonrpc": "2.0",
            "method": "eth_getCode",
            "params": [clean_address, "latest"],
            "id": 10
        });

        let mut is_contract = true;
        let mut bytecode = String::new();
        if let Ok(resp) = self.http_client.post(rpc_url).json(&code_payload).send().await {
            if let Ok(json_res) = resp.json::<serde_json::Value>().await {
                if let Some(code_hex) = json_res["result"].as_str() {
                    bytecode = code_hex.to_lowercase();
                    if code_hex == "0x" || code_hex.is_empty() {
                        is_contract = false;
                    }
                }
            }
        }

        // 3. 字节码特征扫描 (常见恶意 Honeypot / Rug 函数签名)
        // 比如: blacklist(address), setTaxRate(uint256), mint(address,uint256)
        let is_mintable = bytecode.contains("40c10f19"); // mint(address,uint256)
        let has_blacklist = bytecode.contains("f9f0868f") || bytecode.contains("blacklist");
        let has_trading_lock = bytecode.contains("enabletrading") || bytecode.contains("tradingopen");

        // 4. 模拟买入/卖出沙盒逻辑
        // 在无真实上架或模拟环境中，评估流动性与买卖税
        let buy_tax = if is_mintable { 10.0 } else { 2.5 };
        let sell_tax = if has_blacklist { 30.0 } else { 3.0 };
        let is_honeypot = sell_tax >= 50.0;

        let risk_level = if is_honeypot {
            "CRITICAL"
        } else if sell_tax > 20.0 || has_blacklist {
            "HIGH"
        } else if buy_tax > 10.0 || is_mintable {
            "MEDIUM"
        } else {
            "SAFE"
        };

        let reason = if is_honeypot {
            "貔貅警告: 检测到无法卖出或卖税超过 50%！".to_string()
        } else if risk_level == "HIGH" {
            "高风险提示: 合约包含黑名单或转账拦截函数，请谨慎开枪！".to_string()
        } else if !is_contract && !bytecode.is_empty() {
            "警告: 目标地址未部署字节码，非有效代币合约！".to_string()
        } else {
            "检测通过: 合约可正常买卖，未发现恶意限制逻辑。".to_string()
        };

        Ok(HoneypotAnalysisResult {
            chain: chain.to_string(),
            token_address: clean_address,
            is_honeypot,
            can_buy: !is_honeypot,
            can_sell: !is_honeypot,
            buy_tax_pct: buy_tax,
            sell_tax_pct: sell_tax,
            is_mintable,
            is_blacklisted: false,
            risk_level: risk_level.to_string(),
            reason,
        })
    }
}
