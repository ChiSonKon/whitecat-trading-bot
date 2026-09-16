# 🐱 WhiteCat Multi-Chain Trading Bot & MCP AI Agent Ecosystem

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.78+-orange.svg?logo=rust)](https://www.rust-lang.org/)
[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8.svg?logo=go)](https://go.dev/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram_Bot-grammY-2CA5E0.svg?logo=telegram)](https://grammy.dev/)
[![MCP Standard](https://img.shields.io/badge/Protocol-Model%20Context%20Protocol%20(MCP)-purple.svg)](https://modelcontextprotocol.io/)
[![Multi-Chain](https://img.shields.io/badge/Chains-11%20Chains%20Supported-brightgreen.svg)](#-supported-blockchains)
[![Tests](https://img.shields.io/badge/Tests-38%2F38%20Passed-success.svg)](#-security--risk-control)
[![Anti-MEV](https://img.shields.io/badge/Security-Anti--MEV%20%26%20Honeypot%20Shield-red.svg)](#-institutional-grade-risk-control)

**High-speed, Institutional-grade Telegram Trading Bot & Autonomous AI Agent MCP Server for Meme Coins, DEX Aggregation, and On-Chain Sniping.**  
*Commercial-grade 1:1 reproduction of @PinkPunkTradingBot with world-first native support for Robinhood Chain (Arbitrum Orbit L2) and Arc Chain (5042).*

[English](./README.md) | [简体中文](./README_zh.md)

> 🤖 **Public Demo Bot (演示产品)**: [@wctibot](https://t.me/wctibot)  
> ⚠️ **Important Product Notice**: `@wctibot` is strictly an official public **Demo Prototype (演示产品)** for feature demonstration, community UX evaluation, and AI agent testing. For production, commercial trading, and asset custody, please self-host your own bot instance using the source code and your own private credentials.

> ⚡ **Engineering Revelation & Attribution**: This entire project was reverse-engineered and reconstructed 1:1 by combining advanced AI reasoning with the groundbreaking **Telegram Bot MCP (Model Context Protocol)** engine from [**WhiteCat TG Assistant Commercial Edition (tg-sender-releases)**](https://github.com/ChiSonKon/tg-sender-releases). If you are building, reverse-engineering, probing, or automating Telegram bots, multi-account marketing, and Web3 community growth, make sure to explore the foundational powerhouse 👉 [**ChiSonKon/tg-sender-releases**](https://github.com/ChiSonKon/tg-sender-releases) ⭐

</div>

---

## 📌 Table of Contents

- [Behind the Scenes: Replicated with TG Assistant MCP](#-behind-the-scenes-replicated-with-whitecat-tg-assistant-mcp)
- [Overview](#-overview)
- [Key Features](#-key-features)
- [Supported Blockchains](#-supported-blockchains)
- [Model Context Protocol (MCP) Integration](#-model-context-protocol-mcp-integration)
- [System Architecture](#-system-architecture)
- [Directory Structure](#-directory-structure)
- [Quick Start](#-quick-start)
- [Security & Risk Control](#-security--risk-control)
- [Internationalization (i18n)](#-internationalization-i18n)
- [Search Keywords & SEO Topics](#-search-keywords--topics)
- [Collaborators & Team](#-collaborators--team)
- [License](#-license)

---

## 🔮 Behind the Scenes: Replicated with WhiteCat TG Assistant MCP

Many developers ask: *How was a top-tier commercial trading bot like @PinkPunkTradingBot thoroughly deconstructed, reverse-engineered, and rebuilt 1:1 into this production-grade multi-chain bot in record time?*

**The secret weapon behind this engineering breakthrough is [WhiteCat TG Assistant Commercial Edition (tg-sender-releases)](https://github.com/ChiSonKon/tg-sender-releases)!**

### 🌟 Key Reverse-Engineering Capabilities
1. 🤖 **Native Telegram Bot MCP Probing (`tg_probe_bot_features`)**:
   - Manually reverse-engineering Telegram bots typically takes weeks of tedious packet inspection, manual inline button clicking, and callback data mapping.
   - With the native Telegram Bot MCP server built into `tg-sender-releases`, our AI agent acted as an autonomous crawler. It systematically probed and mapped all deep interactive menus, callback payloads, transaction state machines, and multi-chain routing logic—generating the foundational schemas for this repository automatically!
2. 🧬 **Community & Ecosystem Intelligence (`tg_analyze_group_ecosystem`)**:
   - Analyzed top alpha caller groups and whale chat ecosystems to uncover real trader pain points, optimal gas priority settings, and slippage tolerances, enabling our 250ms FCFS sniping optimization.
   - Leveraged user classification and safety checks to design robust anti-dump heuristics.
3. 🚀 **Enterprise Telegram Marketing & Automation Suite**:
   - Beyond bot inspection, `tg-sender-releases` provides the market's leading Telegram growth infrastructure: multi-account anti-ban matrix, ultra-fast targeted member scraping, automated force-invites, smart bulk messaging, and automated account warmup.

> 🔥 **Must-Visit Project**: Whether you're building Web3 Telegram bots, auditing competitors, or seeking massive Telegram user acquisition and community growth, you owe it to yourself to check out the foundational software:  
> 👉 **[Explore WhiteCat TG Assistant Commercial Edition (tg-sender-releases)](https://github.com/ChiSonKon/tg-sender-releases)** ⭐ Give it a star and supercharge your Telegram operations!

---

## 📖 Overview

**WhiteCat Trading Bot** is an open-source, production-ready on-chain trading terminal and multi-agent infrastructure designed for crypto traders and AI engineers. It combines the lightning execution speed of a **Rust trading core (< 15ms broadcast latency)**, the intuitive interactive UX of a **TypeScript/grammY Telegram gateway**, and the real-time vigilance of a **Go risk sentry**.

In addition to full-suite Telegram trading features (sniping, copy-trading, limit orders, referral rewards), WhiteCat pioneers native **Model Context Protocol (MCP)** integration. Any AI Agent running in Claude Desktop, Cursor, Antigravity, Cline, Windsurf, or custom LLM frameworks can seamlessly connect via STDIO or HTTP/SSE to query token markets, audit honeypots, and execute automated multi-chain trades under granular user-defined security guardrails.

---

## 🌟 Key Features

- ⚡ **Sub-15ms Execution**: Rust asynchronous execution pipeline with pre-warmed RPC connection pooling and hardware-accelerated transaction serialization.
- 🌐 **11-Chain Matrix**: Seamless trading across Arc Chain, Robinhood Chain, Solana, Base, BSC, Sui, TON / Gram, Ethereum, Sei, XLayer, and Aptos.
- 📡 **Group Chat CA Sniffer & ASCII Radar**: Full-spectrum regex penetration across EVM (42-hex), Solana (strict Base58), Sui (Move/ObjectID), and TON / Gram non-bounceable addresses. Outputs group-safe Monospace ASCII radar cards with zero privacy/balance leakage, paired with 1-click DeepLinks (`https://t.me/wctibot?start=trade_<token>_<chain>`).
- ⛽ **Turbo EVM Gas Engine & Nonce Serialization**: Dynamic latest-block `baseFeePerGas` fetching with +35% Turbo pricing and strict `EvmNonceManager.reset` recovery, achieving confirmed execution within 2.66s without mempool stalling.
- 🤖 **Native MCP AI Agent Server**: Exposes 16 standard tools for AI assistants with dual-transport support (STDIO & SSE).
- 🔥 **Meme Radar & Anti-Rug Engine**: Multi-chain real-time meme discovery, funded wallet cluster analysis (penetrating insider rat positions), smart-money vs. KOL pump trap detection, and dev reputation scoring.
- 🎯 **Instant CA Recognition**: Send any Contract Address or Move TypeTag to Telegram to instantly view token metrics, honeypot safety audit, and launch 1-click buy/sell console.
- 🛡 **Anti-MEV & Anti-Rug Guard**: Jito MEV bundles on Solana, private mempool relays on EVM, and pre-execution bytecode simulation to block 100% of honeypot traps and malicious sell taxes.
- 👥 **Whale & Smart Money Copy-Trading**: Real-time mempool tracking with customizable copy ratios, slippage bounds, and emergency anti-dump protection.
- 📈 **Limit & Trailing Stop Orders**: On-chain trailing stop-loss (TSL), take-profit (TP), and automated buy-the-dip triggers.
- 🎁 **Multi-Tier Referral Commission**: Built-in 3-tier commission distribution system with instant on-chain payout claims.
- 🌍 **11 Native Languages**: Full i18n support across 11 languages with zero truncation.

---

## 🌐 Supported Blockchains

| Chain | Virtual Machine | Primary DEX / Router | MEV / Fast Route | Special Features |
| :--- | :--- | :--- | :--- | :--- |
| **Arc Chain** | EVM (Circle Arc) | Uniswap V3 | BaseFee + 35% Turbo | ★ **Verified on-chain (Chain ID: 5042)**, 18-decimal native USDC |
| **Robinhood Chain** | Arbitrum Orbit L2 (EVM) | Uniswap V2 / V3 | 250ms FCFS direct sequencer | ★ **World-first native support (Chain ID: 4663)** |
| **Solana** | SVM | Raydium, Jupiter | Jito Bundle Relay | Sub-second sniping, Anti-MEV sandwich protection |
| **Binance Smart Chain (BSC)** | EVM | PancakeSwap V2 / V3 | BSC MEV Private RPC | High-frequency meme coin trading |
| **Base** | EVM (OP Stack) | Uniswap V3, Aerodrome | Flashbots Builder | Coinbase L2 ecosystem trending pairs |
| **Sui** | Move VM | Bluefin 7k Aggregator, Cetus | Sui Multi-Node Failover | Move TypeTag short-key mapping, 0-balance intercept |
| **TON / Gram** | TVM | DeDust, STON.fi | Native TON RPC | The Open Network / Gram ecosystem. *Swaps currently safely disabled pending router rollout.* |
| **Ethereum** | EVM | Uniswap V2 / V3 | Flashbots Protect | Blue-chip tokens & deep liquidity routing |
| **Sei** | Sei EVM | DragonSwap | Turbo Block Engine | Sub-second finality trading |
| **XLayer** | Polygon CDK L2 | OKX DEX Aggregator | OKX Private Relay | OKX L2 native bridge integration |
| **Aptos** | Move VM | Liquidswap, Pontem | Aptos REST Node | High-throughput Move smart contracts |

---

## 🤖 Model Context Protocol (MCP) Integration

WhiteCat is equipped with a production-grade **Model Context Protocol (MCP)** server conforming to the open standard released by Anthropic.

### 1. Dual Transport Architecture
- **STDIO Transport**: Ideal for local AI IDEs and desktop clients (Claude Desktop, Cursor, Antigravity, Cline, Windsurf).
- **HTTP / SSE Transport**: Permanent 24/7 background service (default port `38088`, endpoint `/sse`) for remote AI agents, multi-agent swarms, and cloud webhooks.

### 2. Available MCP Tools (16 Standard Tools)

| Tool Name | Category | Description |
| :--- | :--- | :--- |
| `whitecat_get_account_info` | Account | Query active trading chain, wallet addresses, balances, and AI safety settings. |
| `whitecat_switch_chain` | Control | Dynamically switch active trading chain across all 10 supported networks. |
| `whitecat_get_balance` | Query | Check real-time native coin & SPL/ERC-20 token balances for any address. |
| `whitecat_query_token_market` | Market | Fetch real-time token price (USD & Native), liquidity, 24h volume, and DexScreener stats. |
| `whitecat_check_token_security` | Risk | Comprehensive honeypot audit, buy/sell tax inspection, mintability, and blacklists. |
| `whitecat_fast_buy` | Trade | Execute lightning buy order with slippage protection and balance validation. |
| `whitecat_fast_sell` | Trade | Sell tokens by percentage (25%, 50%, 100%) or exact token units. |
| `whitecat_transfer` | Wallet | Transfer native gas tokens to specified recipient address with signature verification. |
| `whitecat_list_limit_orders` | Limit Order | List active limit buy and stop-loss/take-profit orders. |
| `whitecat_create_limit_order` | Limit Order | Place automated limit order triggered at target price. |
| `whitecat_cancel_limit_order` | Limit Order | Cancel existing pending limit order. |
| `whitecat_list_copy_targets` | Copy Trade | Retrieve monitored smart-money and whale wallet targets. |
| `whitecat_add_copy_target` | Copy Trade | Register new smart-money wallet address for automated mirroring. |
| `whitecat_get_transactions` | History | Retrieve transaction history with direct blockchain explorer transaction URLs. |
| `whitecat_scan_meme_radar` | Radar | Multi-chain meme radar scan with smart-money density, liquidity depth, and composite scoring. |
| `whitecat_audit_wallet_clusters` | Sentry | Linked wallet clustering (source funding trace), detecting coordinated insider/dev rat positions & KOL trap dumps. |

### 3. Quick Connection Guide

#### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "whitecat-trading-bot": {
      "command": "node",
      "args": [
        "/path/to/whitecat-trading-bot/bot-gateway-ts/dist/mcp/index.js",
        "--user=YOUR_TELEGRAM_USER_ID",
        "--token=YOUR_MCP_SECRET_TOKEN"
      ],
      "env": {
        "WHITECAT_USER_ID": "YOUR_TELEGRAM_USER_ID",
        "WHITECAT_MCP_TOKEN": "YOUR_MCP_SECRET_TOKEN"
      }
    }
  }
}
```

#### Cursor / Antigravity (`mcp.json`)
```json
{
  "mcpServers": {
    "whitecat-bot": {
      "url": "http://127.0.0.1:38088/sse",
      "transport": "sse",
      "headers": {
        "x-whitecat-user-id": "YOUR_TELEGRAM_USER_ID",
        "x-whitecat-token": "YOUR_MCP_SECRET_TOKEN"
      }
    }
  }
}
```

### 4. Telegram In-Bot AI Safety Guardrails
Access the control panel anytime via `/mcp` or the **🤖 MCP Agent** button:
- 🔑 **Dynamic Token Issuance**: One-click regeneration and revocation of MCP authorization tokens.
- 🛡 **Autonomous Trading Kill-Switch**: Toggle AI trading permissions. When disabled, the agent is restricted to read-only market research and honeypot auditing.
- ⚠️ **Per-Trade Safety Cap**: Enforce hard ceiling on single trade size (e.g. max 0.5 SOL/BNB) to prevent accidental runaways or loop triggers.

---

## 🔥 Meme Radar & Linked Wallet Cluster Sentry

WhiteCat incorporates a production-grade **Meme Radar & Anti-Rug Penetration Engine** (`src/services/memeRadarService.ts`), bringing institutional on-chain intelligence to retail traders and autonomous AI agents:

1. 🎯 **Multi-Factor Quant Scoring (0–100 pts)**:
   - Evaluates early liquidity ratio, 5-minute transaction velocity, and optimal breakout market-cap sweet spot ($20k–$150k).
   - Dynamically rewards smart money accumulation while heavily penalizing dev dumping, blacklisted tax traps, and insider concentration.
2. 🧬 **Linked Wallet Clustering (Anti-Rat / Insider Sybil)**:
   - Traces top holder funding genealogy (identifying the common native funding source address).
   - Penetrates sybil disguises where multiple ostensibly separate addresses are in fact controlled by the same deployer or coordinated cabal (`linkedHoldRate`).
3. 🪤 **Smart Degen vs. KOL Pump Trap Detector**:
   - Differentiates authentic organic accumulation (high smart money, low marketing noise) from paid KOL exit liquidity traps (`smartDegenCount <= 1 && renownedKolCount > 0`).
4. 👨‍💻 **Deployer Reputation & Historical Graduation Rate**:
   - Audits developer's historical launch track record, bonding curve graduation rate, and current holding status (`HOLDING` vs `EXITED`).
5. 📱 **Telegram Radar Board & 1-Click Sniping**:
   - Access via `/radar`, `/hot`, or the Telegram inline button **🔥 爆点雷达**. Displays top live hot tokens with composite scores, 1-click buy shortcuts, and instant cluster audits.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Clients["User & AI Interfaces"]
        TG["Telegram Mobile / Desktop\n(grammY Gateway)"]
        AI["AI Agents\n(Claude Desktop, Cursor, MCP Clients)"]
    end

    subgraph Gateway["TypeScript Gateway (bot-gateway-ts)"]
        Router["Message & Command Router"]
        Detector["Token CA Detector (Fast Parse)"]
        MCPServer["MCP Server (STDIO & SSE 38088)"]
        UserStore["Secure State & Key Mapping Engine"]
    end

    subgraph Core["Rust Trading Core (backend-core-rust)"]
        API["Axum HTTP / JSON-RPC Engine"]
        Crypto["AES-256-GCM Key Enclave"]
        Executor["Swap & Snipe Engine (<15ms)"]
        HoneypotSim["Bytecode Sandbox Simulator"]
    end

    subgraph Sentry["Go Risk Sentry (sentry-detector-go)"]
        PoolScan["WSS PairCreated Pool Scanner"]
        WhaleRadar["Whale & Smart Money Radar"]
        RiskEngine["Static Bytecode & Tax Verifier"]
    end

    subgraph Blockchains["Multi-Chain Network"]
        RH["Robinhood Chain (Arbitrum Orbit L2)"]
        SOL["Solana (Jito MEV Engine)"]
        EVM["EVM (Base, BSC, ETH, Sei, XLayer)"]
        MOVE["Move & TVM (Sui, Aptos, TON)"]
    end

    TG --> Router
    AI --> MCPServer
    Router --> Detector
    Router --> UserStore
    MCPServer --> UserStore
    Detector --> API
    UserStore --> API
    API --> Crypto
    API --> Executor
    API --> HoneypotSim
    PoolScan --> API
    WhaleRadar --> API
    Executor --> RH
    Executor --> SOL
    Executor --> EVM
    Executor --> MOVE
```

---

## 📁 Directory Structure

```text
whitecat-trading-bot/
├── README.md                                  # English documentation (Primary)
├── README_zh.md                               # Chinese documentation (中文官方文档)
├── robinhood_chain_development_guide.md       # Robinhood Chain official developer guide
├── 白猫打狗机器人_功能全复现与技术架构白皮书.md    # Architecture & reverse-engineering whitepaper
├── .env.example                               # Environment variables template
├── database/                                  # Database layer
│   ├── schema.sql                             # PostgreSQL 16 schema (users, wallets, referral, audit)
│   └── redis.conf                             # High-performance low-latency Redis configuration
├── backend-core-rust/                         # [Core 1] High-speed Rust trading engine (< 50ms)
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs                            # REST / JSON-RPC microservice on port 8080
│       ├── config.rs                          # Network endpoints and environment config
│       ├── security/crypto.rs                 # AES-256-GCM key management & wallet generation
│       ├── chains/robinhood.rs                # Robinhood Chain native adapter (4663, 250ms FCFS)
│       ├── chains/evm.rs                      # Multi-chain EVM router (Base, BSC, ETH, Sei)
│       ├── chains/solana.rs                   # Solana Raydium/Jupiter routing & Jito bundle
│       ├── chains/sui_ton.rs                  # Sui Move & TON TVM integration
│       ├── simulator/honeypot.rs              # Honeypot sandbox simulation & tax verifier
│       └── executor/                          # Swap, snipe, trailing stop-loss execution
├── bot-gateway-ts/                            # [Gateway 2] Telegram bot & MCP server (TypeScript)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── bot.ts                             # grammY instance, router & webhook listener
│       ├── mcp/                               # Dual-transport MCP server (STDIO & SSE)
│       ├── menus/                             # Full Telegram inline interactive menus
│       ├── handlers/tokenDetector.ts          # Instant CA recognition & market card
│       └── services/                          # User store, on-chain balances, PnL poster renderer
├── sentry-detector-go/                        # [Sentry 3] Real-time risk scanner & whale tracker (Go)
│   ├── go.mod
│   ├── main.go                                # Service entrypoint
│   ├── scanner/pool_scanner.go                # WSS pool creation listener
│   ├── tracker/whale_tracker.go               # Smart-money wallet tracker & dump alarm
│   └── risk/security_check.go                 # Bytecode static auditor
├── scripts/
│   ├── build_all.sh                           # Build script for all three microservices
│   └── start_dev.sh                           # Local development startup script
└── tests/
    └── test_e2e_flow.py                       # Automated end-to-end integration test suite
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: `v20.x` or higher
- **Rust**: `1.78` or higher
- **Go**: `1.22` or higher
- **Redis**: `v7.x`
- **PostgreSQL**: `v15.x`

### 1. Clone & Build
```bash
git clone https://github.com/web3baimao/whitecat-trading-bot.git
cd whitecat-trading-bot

chmod +x scripts/*.sh
./scripts/build_all.sh
```

### 2. Configure Environment
```bash
cp .env.example .env
# Fill in your Telegram BOT_TOKEN and RPC endpoints in .env
```

### 3. Run Automated Tests
```bash
# Run End-to-End Simulation
python3 tests/test_e2e_flow.py

# Run MCP Protocol Integration Test
./bot-gateway-ts/node_modules/.bin/tsx bot-gateway-ts/tests/test_mcp_integration.ts
```

### 4. Launch Services
```bash
./scripts/start_dev.sh
```

---

## 🛡 Security & Risk Control

1. **Zero Balance Real-World Interception**: Prevents submitting failing transactions to the blockchain, eliminating unnecessary gas fees.
2. **Honeypot Sandbox Simulator**: Executes simulation swaps before submitting real orders to verify that tokens can be sold and that taxes do not exceed user thresholds.
3. **Hardware AES-256-GCM Encryption**: All private keys are encrypted at rest using an external master secret key with unique nonces.
4. **Anti-MEV Private Mempools**: Trades on Solana route through Jito Bundle block engines; EVM trades route through Flashbots and private builders.

---

## 🌍 Internationalization (i18n)

WhiteCat features native 11-language support across all menus, alert notifications, and MCP diagnostics:
- 🇨🇳 简体中文 (`zh-hans`)
- 🇭🇰 繁體中文 (`zh-hant`)
- 🇺🇸 English (`en`)
- 🇻🇳 Tiếng Việt (`vi`)
- 🇷🇺 Русский (`ru`)
- 🇰🇷 한국어 (`ko`)
- 🇯🇵 日本語 (`ja`)
- 🇪🇸 Español (`es`)
- 🇹🇷 Türkçe (`tr`)
- 🇵🇱 Polski (`pl`)
- 🇩🇪 Deutsch (`de`)

---

## 🔍 Search Keywords & Topics

To help developers and traders discover this project, the repository is indexed under key Web3 trading topics:

`telegram-bot`, `trading-bot`, `solana`, `robinhood-chain`, `mcp`, `model-context-protocol`, `ai-agent`, `dex`, `crypto`, `memecoin`, `sniper-bot`, `copy-trading`, `anti-mev`, `honeypot-detector`, `defi`, `arbitrum`, `sui`, `ton`, `rust`, `typescript`, `raydium`, `pancakeswap`, `uniswap`, `jito`

---

## 🤝 Collaborators & Team

- **Creator & Lead Architect**: [@web3baimao](https://github.com/web3baimao)
- **Core Collaborator**: [@chisonkon](https://github.com/ChiSonKon)

Contributions, issues, and feature proposals are warmly welcome! Please feel free to open an issue or submit a pull request.

---

## 📄 License

This project is open-sourced under the [MIT License](./LICENSE).


## Protocol Fee / 开源维护分成

本开源项目默认包含 0.6% 的开发者生态维护税（Protocol Fee），用于支持白猫项目的开源开发与节点基础设施维护。使用者可在 `.env` 中通过 `PROTOCOL_FEE_RATE=0` 自主调零或修改为你自己的钱包地址。

**当前实现状态**：
- **EVM（BSC / ETH / Base / Arc）**、**Solana（SOL）** 和 **Sui** 原生资产的分成切分逻辑已全部实装并通过全量 38 项安全回归测试（**38/38 测试 100% 通过**，`pass 38, fail 0`）。
- **TON / Gram**：TON 链（现亦称 Gram 生态）由于 DEX 路由还在进行深度安全适配，**交易执行目前仍严格保持安全禁用（Fail-closed）**。预设的 TON/Gram 开发者生态冷钱包收款地址为 `UQCZHJD5q7BMyAau7baOHGcww7w127xZK2rTdvqzv4IWOXXh`（Non-bounceable 格式），在 TON 路由实装开放前不会产生任何链上分成交互。
- 生产环境上线前请在 `.env` 中确认开发者冷钱包收款地址（参见 `.env.example`），部署注意事项请参阅 [部署说明](DEPLOYMENT.md) 和 [接续文档](PROTOCOL_FEE_HANDOFF.md)。

Fee arithmetic uses integer base units; the default configured rate is 0.006 (0.6%), capped at 0.020 (2%). Set `PROTOCOL_FEE_RATE=0` to disable. No developer recipient addresses are fabricated. Main-menu and referral-detail GitHub buttons link to [the official source repository](https://github.com/ChiSonKon/whitecat-trading-bot).
