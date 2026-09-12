use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveTonNetworkConfig {
    pub chain: String, // "sui" or "ton"
    pub rpc_url: String,
    pub dex_router: String,
}

#[allow(dead_code)]
pub struct SuiTonAdapter;

impl SuiTonAdapter {
    pub fn get_default_config(chain: &str) -> MoveTonNetworkConfig {
        match chain {
            "sui" => MoveTonNetworkConfig {
                chain: "sui".to_string(),
                rpc_url: "https://fullnode.mainnet.sui.io:443".to_string(),
                dex_router: "Cetus / Turbos Router".to_string(),
            },
            "ton" => MoveTonNetworkConfig {
                chain: "ton".to_string(),
                rpc_url: "https://toncenter.com/api/v2/jsonRPC".to_string(),
                dex_router: "STON.fi / DeDust Router".to_string(),
            },
            _ => MoveTonNetworkConfig {
                chain: chain.to_string(),
                rpc_url: "".to_string(),
                dex_router: "".to_string(),
            },
        }
    }
}
