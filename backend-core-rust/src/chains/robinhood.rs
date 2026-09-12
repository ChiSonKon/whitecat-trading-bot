use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::error::Error;
use std::time::{SystemTime, UNIX_EPOCH};

pub const ROBINHOOD_CHAIN_ID: u64 = 4663;
pub const ROBINHOOD_CANONICAL_WETH: &str = "0x4200000000000000000000000000000000000006";
pub const ROBINHOOD_UNISWAP_V2_ROUTER: &str = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GasFeeEstimate {
    pub base_fee_gwei: f64,
    pub priority_fee_gwei: f64,
    pub max_fee_gwei: f64,
    pub block_number: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RobinhoodSwapTxDraft {
    pub chain_id: u64,
    pub router_address: String,
    pub to: String,
    pub value_wei: String,
    pub calldata_hex: String,
    pub gas_limit: u64,
    pub max_fee_per_gas_gwei: f64,
    pub max_priority_fee_per_gas_gwei: f64,
    pub description: String,
}

#[derive(Debug, Clone)]
pub struct RobinhoodChainAdapter {
    rpc_url: String,
    http_client: Client,
}

impl RobinhoodChainAdapter {
    pub fn new(rpc_url: &str) -> Self {
        Self {
            rpc_url: rpc_url.to_string(),
            http_client: Client::builder()
                .pool_max_idle_per_host(50)
                .tcp_nodelay(true)
                .build()
                .unwrap_or_default(),
        }
    }

    /// 获取 Robinhood Chain 最新区块高度
    pub async fn get_block_number(&self) -> Result<u64, Box<dyn Error + Send + Sync>> {
        let payload = json!({
            "jsonrpc": "2.0",
            "method": "eth_blockNumber",
            "params": [],
            "id": 1
        });

        let resp = self.http_client.post(&self.rpc_url).json(&payload).send().await?;
        let res_json: serde_json::Value = resp.json().await?;
        let hex_str = res_json["result"]
            .as_str()
            .ok_or_else(|| format!("Invalid RPC response: {:?}", res_json))?;
        
        let trimmed = hex_str.trim_start_matches("0x");
        let block_num = u64::from_str_radix(trimmed, 16)?;
        Ok(block_num)
    }

    /// 查询地址 ETH 原生余额
    pub async fn get_balance(&self, address: &str) -> Result<f64, Box<dyn Error + Send + Sync>> {
        let payload = json!({
            "jsonrpc": "2.0",
            "method": "eth_getBalance",
            "params": [address, "latest"],
            "id": 2
        });

        let resp = self.http_client.post(&self.rpc_url).json(&payload).send().await?;
        let res_json: serde_json::Value = resp.json().await?;
        let hex_val = res_json["result"].as_str().unwrap_or("0x0");
        let trimmed = hex_val.trim_start_matches("0x");
        let wei = u128::from_str_radix(if trimmed.is_empty() { "0" } else { trimmed }, 16)?;
        let eth = (wei as f64) / 1e18;
        Ok(eth)
    }

    /// 计算 250ms FCFS 抢跑最优 EIP-1559 费率
    pub async fn estimate_fcfs_fees(&self, priority_tier: &str) -> Result<GasFeeEstimate, Box<dyn Error + Send + Sync>> {
        let block = self.get_block_number().await.unwrap_or(100000);
        let base_fee_gwei = 0.05; // Robinhood Orbit 典型 BaseFee ~ 0.05 Gwei
        
        let priority_fee_gwei = match priority_tier {
            "ultra" => 0.5,
            "turbo" => 0.2,
            "fast" => 0.1,
            _ => 0.05,
        };

        let max_fee_gwei = base_fee_gwei * 2.0 + priority_fee_gwei;

        Ok(GasFeeEstimate {
            base_fee_gwei,
            priority_fee_gwei,
            max_fee_gwei,
            block_number: block,
        })
    }

    /// 构造 swapExactETHForTokens 快捷买入 Calldata (Uniswap V2 ABI)
    /// selector: 0x7ff36ab5
    pub fn build_buy_swap_calldata(
        &self,
        token_address: &str,
        recipient_address: &str,
        amount_eth: f64,
        _slippage_pct: f64,
    ) -> Result<RobinhoodSwapTxDraft, Box<dyn Error + Send + Sync>> {
        let clean_token = token_address.trim_start_matches("0x").to_lowercase();
        let clean_recipient = recipient_address.trim_start_matches("0x").to_lowercase();
        let clean_weth = ROBINHOOD_CANONICAL_WETH.trim_start_matches("0x").to_lowercase();

        let wei_amount = (amount_eth * 1e18) as u128;
        let now_sec = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
        let deadline = now_sec + 300; // 5分钟有效

        // 构造 ABI 编码
        // swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)
        let method_selector = "7ff36ab5";
        let amount_out_min_hex = format!("{:0>64x}", 0); // 最小获得设为 0 或按滑点计算
        let offset_path = format!("{:0>64x}", 128);       // path 偏移量 4 * 32 = 128 字节
        let to_hex = format!("{:0>64}", clean_recipient);
        let deadline_hex = format!("{:0>64x}", deadline);
        let path_len_hex = format!("{:0>64x}", 2);
        let path_weth_hex = format!("{:0>64}", clean_weth);
        let path_token_hex = format!("{:0>64}", clean_token);

        let calldata = format!(
            "0x{}{}{}{}{}{}{}{}",
            method_selector,
            amount_out_min_hex,
            offset_path,
            to_hex,
            deadline_hex,
            path_len_hex,
            path_weth_hex,
            path_token_hex
        );

        Ok(RobinhoodSwapTxDraft {
            chain_id: ROBINHOOD_CHAIN_ID,
            router_address: ROBINHOOD_UNISWAP_V2_ROUTER.to_string(),
            to: ROBINHOOD_UNISWAP_V2_ROUTER.to_string(),
            value_wei: wei_amount.to_string(),
            calldata_hex: calldata,
            gas_limit: 250000,
            max_fee_per_gas_gwei: 0.2,
            max_priority_fee_per_gas_gwei: 0.1,
            description: format!("Robinhood Swap: Buy {} ETH of 0x{}", amount_eth, &clean_token[..6]),
        })
    }

    /// 构造 swapExactTokensForETH 快捷卖出 Calldata
    /// selector: 0x18cbafe5
    pub fn build_sell_swap_calldata(
        &self,
        token_address: &str,
        recipient_address: &str,
        token_amount_raw: u128,
        min_eth_out_wei: u128,
    ) -> Result<RobinhoodSwapTxDraft, Box<dyn Error + Send + Sync>> {
        let clean_token = token_address.trim_start_matches("0x").to_lowercase();
        let clean_recipient = recipient_address.trim_start_matches("0x").to_lowercase();
        let clean_weth = ROBINHOOD_CANONICAL_WETH.trim_start_matches("0x").to_lowercase();

        let now_sec = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
        let deadline = now_sec + 300;

        // swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)
        let method_selector = "18cbafe5";
        let amount_in_hex = format!("{:0>64x}", token_amount_raw);
        let amount_out_min_hex = format!("{:0>64x}", min_eth_out_wei);
        let offset_path = format!("{:0>64x}", 160); // 5 * 32 = 160 字节
        let to_hex = format!("{:0>64}", clean_recipient);
        let deadline_hex = format!("{:0>64x}", deadline);
        let path_len_hex = format!("{:0>64x}", 2);
        let path_token_hex = format!("{:0>64}", clean_token);
        let path_weth_hex = format!("{:0>64}", clean_weth);

        let calldata = format!(
            "0x{}{}{}{}{}{}{}{}{}",
            method_selector,
            amount_in_hex,
            amount_out_min_hex,
            offset_path,
            to_hex,
            deadline_hex,
            path_len_hex,
            path_token_hex,
            path_weth_hex
        );

        Ok(RobinhoodSwapTxDraft {
            chain_id: ROBINHOOD_CHAIN_ID,
            router_address: ROBINHOOD_UNISWAP_V2_ROUTER.to_string(),
            to: ROBINHOOD_UNISWAP_V2_ROUTER.to_string(),
            value_wei: "0".to_string(),
            calldata_hex: calldata,
            gas_limit: 250000,
            max_fee_per_gas_gwei: 0.2,
            max_priority_fee_per_gas_gwei: 0.1,
            description: format!("Robinhood Swap: Sell tokens for ETH back to recipient"),
        })
    }

    /// 极速广播 Raw Transaction 到 Robinhood Orbit 排序器
    pub async fn broadcast_raw_tx(&self, signed_tx_hex: &str) -> Result<String, Box<dyn Error + Send + Sync>> {
        let payload = json!({
            "jsonrpc": "2.0",
            "method": "eth_sendRawTransaction",
            "params": [signed_tx_hex],
            "id": 99
        });

        let resp = self.http_client.post(&self.rpc_url).json(&payload).send().await?;
        let res_json: serde_json::Value = resp.json().await?;
        
        if let Some(err) = res_json.get("error") {
            return Err(format!("Sequencer rejected transaction: {:?}", err).into());
        }

        let tx_hash = res_json["result"]
            .as_str()
            .ok_or_else(|| format!("Invalid response from sequencer: {:?}", res_json))?;

        Ok(tx_hash.to_string())
    }
}
