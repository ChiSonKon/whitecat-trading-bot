use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::error::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmNetworkInfo {
    pub chain_id: u64,
    pub name: String,
    pub symbol: String,
    pub rpc_url: String,
    pub mev_rpc_url: Option<String>,
    pub router_address: String,
    pub wrapped_native: String,
}

pub struct EvmMultiChainAdapter {
    networks: HashMap<String, EvmNetworkInfo>,
    http_client: Client,
}

impl EvmMultiChainAdapter {
    pub fn new() -> Self {
        let mut networks = HashMap::new();

        networks.insert(
            "base".to_string(),
            EvmNetworkInfo {
                chain_id: 8453,
                name: "Base".to_string(),
                symbol: "ETH".to_string(),
                rpc_url: "https://mainnet.base.org".to_string(),
                mev_rpc_url: Some("https://base.mev-share.flashbots.net".to_string()),
                router_address: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24".to_string(), // Uniswap V2 Router Base
                wrapped_native: "0x4200000000000000000000000000000000000006".to_string(),
            },
        );

        networks.insert(
            "bsc".to_string(),
            EvmNetworkInfo {
                chain_id: 56,
                name: "BNB Smart Chain".to_string(),
                symbol: "BNB".to_string(),
                rpc_url: "https://bsc-dataseed.binance.org".to_string(),
                mev_rpc_url: Some("https://bsc-builder.48.club".to_string()),
                router_address: "0x10ED43C718714eb63d5aA57B78B54704E256024E".to_string(), // PancakeSwap V2 Router
                wrapped_native: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c".to_string(),
            },
        );

        networks.insert(
            "ethereum".to_string(),
            EvmNetworkInfo {
                chain_id: 1,
                name: "Ethereum".to_string(),
                symbol: "ETH".to_string(),
                rpc_url: "https://eth.llamarpc.com".to_string(),
                mev_rpc_url: Some("https://rpc.flashbots.net".to_string()),
                router_address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D".to_string(), // Uniswap V2
                wrapped_native: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".to_string(),
            },
        );

        networks.insert(
            "sei".to_string(),
            EvmNetworkInfo {
                chain_id: 1329,
                name: "Sei EVM".to_string(),
                symbol: "SEI".to_string(),
                rpc_url: "https://evm-rpc.sei-apis.com".to_string(),
                mev_rpc_url: None,
                router_address: "0x1234567890123456789012345678901234567890".to_string(),
                wrapped_native: "0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1".to_string(),
            },
        );

        Self {
            networks,
            http_client: Client::builder().build().unwrap_or_default(),
        }
    }

    pub fn get_network(&self, chain: &str) -> Option<&EvmNetworkInfo> {
        self.networks.get(chain)
    }

    pub async fn query_balance(&self, chain: &str, address: &str) -> Result<f64, Box<dyn Error + Send + Sync>> {
        let net = self.networks.get(chain).ok_or("Unsupported EVM chain")?;
        let payload = json!({
            "jsonrpc": "2.0",
            "method": "eth_getBalance",
            "params": [address, "latest"],
            "id": 1
        });

        let resp = self.http_client.post(&net.rpc_url).json(&payload).send().await?;
        let res_json: serde_json::Value = resp.json().await?;
        let hex_val = res_json["result"].as_str().unwrap_or("0x0");
        let trimmed = hex_val.trim_start_matches("0x");
        let wei = u128::from_str_radix(if trimmed.is_empty() { "0" } else { trimmed }, 16)?;
        Ok((wei as f64) / 1e18)
    }
}
