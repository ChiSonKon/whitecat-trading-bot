use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use bip39::{Language, Mnemonic};
use k256::ecdsa::SigningKey;
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};
use std::error::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedWallet {
    pub chain_family: String, // "evm" or "solana"
    pub address: String,
    pub private_key: String,
    pub mnemonic: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedSecret {
    pub ciphertext_hex: String,
    pub nonce_hex: String,
}

pub struct CryptoEngine;

impl CryptoEngine {
    /// AES-256-GCM 加密私钥
    pub fn encrypt(plaintext: &str, master_key_hex: &str) -> Result<EncryptedSecret, Box<dyn Error + Send + Sync>> {
        let key_bytes = hex::decode(master_key_hex)?;
        if key_bytes.len() != 32 {
            return Err("Master key must be 32 bytes (64 hex characters)".into());
        }
        let cipher = Aes256Gcm::new_from_slice(&key_bytes)?;
        
        // 生成 12 字节加密 Nonce (IV)
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| format!("Encryption failed: {}", e))?;

        Ok(EncryptedSecret {
            ciphertext_hex: hex::encode(ciphertext),
            nonce_hex: hex::encode(nonce_bytes),
        })
    }

    /// AES-256-GCM 解密私钥
    pub fn decrypt(
        ciphertext_hex: &str,
        nonce_hex: &str,
        master_key_hex: &str,
    ) -> Result<String, Box<dyn Error + Send + Sync>> {
        let key_bytes = hex::decode(master_key_hex)?;
        if key_bytes.len() != 32 {
            return Err("Master key must be 32 bytes".into());
        }
        let cipher = Aes256Gcm::new_from_slice(&key_bytes)?;
        let nonce_bytes = hex::decode(nonce_hex)?;
        if nonce_bytes.len() != 12 {
            return Err("Nonce must be 12 bytes".into());
        }
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = hex::decode(ciphertext_hex)?;

        let decrypted_bytes = cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| format!("Decryption failed: {}", e))?;

        Ok(String::from_utf8(decrypted_bytes)?)
    }

    /// 生成标准 12 词 BIP-39 助记词
    #[allow(dead_code)]
    pub fn generate_mnemonic() -> Result<String, Box<dyn Error + Send + Sync>> {
        let mut entropy = [0u8; 16];
        OsRng.fill_bytes(&mut entropy);
        let mnemonic = Mnemonic::from_entropy_in(Language::English, &entropy)?;
        Ok(mnemonic.to_string())
    }

    /// 生成标准 EVM 独立钱包 (用于 Robinhood Chain, Base, ETH, BSC 等)
    pub fn generate_evm_wallet() -> Result<GeneratedWallet, Box<dyn Error + Send + Sync>> {
        let signing_key = SigningKey::random(&mut OsRng);
        let private_key_hex = hex::encode(signing_key.to_bytes());
        
        // 推导公钥并计算以太坊地址
        let verifying_key = signing_key.verifying_key();
        let encoded_point = verifying_key.to_encoded_point(false);
        let pubkey_bytes = &encoded_point.as_bytes()[1..]; // 去除未压缩前缀 0x04

        let mut hasher = Keccak256::new();
        hasher.update(pubkey_bytes);
        let hash = hasher.finalize();
        let raw_addr = &hash[12..]; // 取后 20 字节
        let address = format!("0x{}", hex::encode(raw_addr));

        Ok(GeneratedWallet {
            chain_family: "evm".to_string(),
            address,
            private_key: format!("0x{}", private_key_hex),
            mnemonic: None,
        })
    }

    /// 生成标准 Solana 独立钱包
    pub fn generate_solana_wallet() -> Result<GeneratedWallet, Box<dyn Error + Send + Sync>> {
        let mut csprng = rand::rngs::OsRng;
        let signing_key = ed25519_dalek::SigningKey::generate(&mut csprng);
        let verifying_key = signing_key.verifying_key();
        
        let pubkey_base58 = bs58::encode(verifying_key.as_bytes()).into_string();
        let privkey_base58 = bs58::encode(signing_key.to_bytes()).into_string();

        Ok(GeneratedWallet {
            chain_family: "solana".to_string(),
            address: pubkey_base58,
            private_key: privkey_base58,
            mnemonic: None,
        })
    }

    /// 生成标准 Sui 独立钱包 (Ed25519, Blake2b-256 哈希推导 32 字节地址, 0x + 64位十六进制)
    pub fn generate_sui_wallet() -> Result<GeneratedWallet, Box<dyn Error + Send + Sync>> {
        let mut csprng = rand::rngs::OsRng;
        let signing_key = ed25519_dalek::SigningKey::generate(&mut csprng);
        let verifying_key = signing_key.verifying_key();
        let pubkey_bytes = verifying_key.as_bytes();

        // Sui Ed25519 方案标识位 0x00
        // address = blake2b256([0x00, pubkey])
        use blake2::digest::consts::U32;
        use blake2::{Blake2b, Digest};
        type Blake2b256 = Blake2b<U32>;

        let mut hasher = Blake2b256::new();
        hasher.update(&[0x00]);
        hasher.update(pubkey_bytes);
        let hash = hasher.finalize();
        let address = format!("0x{}", hex::encode(hash));

        // Sui 私钥标准 Bech32 格式: "suiprivkey1..."
        // 编码 [0x00] + 32字节私钥
        let mut key_data = vec![0x00u8];
        key_data.extend_from_slice(signing_key.to_bytes().as_slice());
        let privkey_bech32 = bech32::encode::<bech32::Bech32>(
            bech32::Hrp::parse("suiprivkey")?,
            &key_data
        )?;

        Ok(GeneratedWallet {
            chain_family: "sui".to_string(),
            address,
            private_key: privkey_bech32,
            mnemonic: None,
        })
    }

    /// 生成标准 TON 独立钱包 (Ed25519, User-Friendly 友好格式 48 位 Base64URL, UQ... 非可弹地址)
    pub fn generate_ton_wallet() -> Result<GeneratedWallet, Box<dyn Error + Send + Sync>> {
        let mut csprng = rand::rngs::OsRng;
        let signing_key = ed25519_dalek::SigningKey::generate(&mut csprng);
        let verifying_key = signing_key.verifying_key();
        let pubkey_bytes = verifying_key.as_bytes();

        // 计算 32 字节 Account ID (SHA-256)
        let mut sha256 = sha2::Sha256::new();
        sha256.update(pubkey_bytes);
        let account_id = sha256.finalize();

        // TON User-Friendly 非可弹地址 (0x51: non-bounceable + basechain 0x00 + 32 字节 hash)
        let mut raw_data = Vec::with_capacity(36);
        raw_data.push(0x51u8); // non-bounceable, mainnet
        raw_data.push(0x00u8); // workchain 0
        raw_data.extend_from_slice(&account_id);

        // 计算 2 字节 CRC16-CCITT (poly 0x1021)
        let mut crc: u16 = 0;
        for &byte in &raw_data {
            crc ^= (byte as u16) << 8;
            for _ in 0..8 {
                if (crc & 0x8000) != 0 {
                    crc = (crc << 1) ^ 0x1021;
                } else {
                    crc <<= 1;
                }
            }
        }
        raw_data.push((crc >> 8) as u8);
        raw_data.push((crc & 0xff) as u8);

        use base64::prelude::*;
        let address = BASE64_URL_SAFE_NO_PAD.encode(&raw_data);
        let private_key = format!("0x{}", hex::encode(signing_key.to_bytes()));

        Ok(GeneratedWallet {
            chain_family: "ton".to_string(),
            address,
            private_key,
            mnemonic: None,
        })
    }

    /// 生成标准 Aptos 独立钱包 (Ed25519, Sha3-256([pubkey, 0x00]) 推导 32 字节地址, 0x + 64位十六进制)
    pub fn generate_aptos_wallet() -> Result<GeneratedWallet, Box<dyn Error + Send + Sync>> {
        let mut csprng = rand::rngs::OsRng;
        let signing_key = ed25519_dalek::SigningKey::generate(&mut csprng);
        let verifying_key = signing_key.verifying_key();
        let pubkey_bytes = verifying_key.as_bytes();

        use sha3::{Digest, Sha3_256};
        let mut hasher = Sha3_256::new();
        hasher.update(pubkey_bytes);
        hasher.update(&[0x00]); // 单私钥 Ed25519 方案后缀 0x00
        let hash = hasher.finalize();
        let address = format!("0x{}", hex::encode(hash));
        let private_key = format!("0x{}", hex::encode(signing_key.to_bytes()));

        Ok(GeneratedWallet {
            chain_family: "aptos".to_string(),
            address,
            private_key,
            mnemonic: None,
        })
    }

    /// 根据目标链或链家族智能推导并生成原生格式钱包
    pub fn generate_wallet_for_chain(chain_or_family: &str) -> Result<GeneratedWallet, Box<dyn Error + Send + Sync>> {
        let c = chain_or_family.to_lowercase();
        match c.as_str() {
            "solana" => Self::generate_solana_wallet(),
            "sui" => Self::generate_sui_wallet(),
            "ton" => Self::generate_ton_wallet(),
            "aptos" => Self::generate_aptos_wallet(),
            // EVM 系列包含 robinhood, bsc, base, ethereum, xlayer, sei 等
            _ => Self::generate_evm_wallet(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sui_wallet_format() {
        let wallet = CryptoEngine::generate_sui_wallet().expect("Sui wallet gen failed");
        assert_eq!(wallet.chain_family, "sui");
        assert!(wallet.address.starts_with("0x"), "Sui address must start with 0x");
        assert_eq!(wallet.address.len(), 66, "Sui address must be 0x + 64 hex chars (66 total)");
        assert!(wallet.private_key.starts_with("suiprivkey1"), "Sui private key must be bech32 starting with suiprivkey1");
    }

    #[test]
    fn test_ton_wallet_format() {
        let wallet = CryptoEngine::generate_ton_wallet().expect("TON wallet gen failed");
        assert_eq!(wallet.chain_family, "ton");
        assert!(wallet.address.starts_with("UQ"), "TON user-friendly address must start with UQ (non-bounceable)");
        assert_eq!(wallet.address.len(), 48, "TON user-friendly address must be 48 chars");
    }

    #[test]
    fn test_aptos_wallet_format() {
        let wallet = CryptoEngine::generate_aptos_wallet().expect("Aptos wallet gen failed");
        assert_eq!(wallet.chain_family, "aptos");
        assert!(wallet.address.starts_with("0x"), "Aptos address must start with 0x");
        assert_eq!(wallet.address.len(), 66, "Aptos address must be 0x + 64 hex chars (66 total)");
    }

    #[test]
    fn test_evm_wallet_format() {
        let wallet = CryptoEngine::generate_evm_wallet().expect("EVM wallet gen failed");
        assert_eq!(wallet.chain_family, "evm");
        assert!(wallet.address.starts_with("0x"), "EVM address must start with 0x");
        assert_eq!(wallet.address.len(), 42, "EVM address must be 0x + 40 hex chars (42 total)");
    }

    #[test]
    fn test_chain_routing() {
        let sui = CryptoEngine::generate_wallet_for_chain("sui").unwrap();
        assert_eq!(sui.chain_family, "sui");
        assert_eq!(sui.address.len(), 66);

        let ton = CryptoEngine::generate_wallet_for_chain("ton").unwrap();
        assert_eq!(ton.chain_family, "ton");
        assert!(ton.address.starts_with("UQ"));

        let aptos = CryptoEngine::generate_wallet_for_chain("aptos").unwrap();
        assert_eq!(aptos.chain_family, "aptos");
        assert_eq!(aptos.address.len(), 66);

        let sol = CryptoEngine::generate_wallet_for_chain("solana").unwrap();
        assert_eq!(sol.chain_family, "solana");
        assert!(!sol.address.starts_with("0x"));

        let rh = CryptoEngine::generate_wallet_for_chain("robinhood").unwrap();
        assert_eq!(rh.chain_family, "evm");
        assert_eq!(rh.address.len(), 42);
    }
}
