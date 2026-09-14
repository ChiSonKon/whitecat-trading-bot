# 🐱 白猫打狗机器人 (WhiteCat Trading Bot) & MCP 智能体系统

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.78+-orange.svg?logo=rust)](https://www.rust-lang.org/)
[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8.svg?logo=go)](https://go.dev/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram_Bot-grammY-2CA5E0.svg?logo=telegram)](https://grammy.dev/)
[![MCP](https://img.shields.io/badge/Protocol-MCP%20(Model%20Context%20Protocol)-purple.svg)](https://modelcontextprotocol.io/)
[![Multi-Chain](https://img.shields.io/badge/Chains-10%20Chains%20Supported-brightgreen.svg)](#-支持的-10-大主流公链)

**生产级高频多链 Telegram 打狗交易机器人 & AI Agent MCP 智能体内核**  
*全面对标 @PinkPunkTradingBot 商业级功能，全球首发深度支持 Robinhood Chain（Arbitrum Orbit L2）！*

[English](./README.md) | [简体中文](./README_zh.md)

> 💡 **核心逆向揭秘与致谢**：本项目并非凭空从零手写，而是**深度借助了 [白猫 TG 商业助手 (tg-sender-releases)](https://github.com/ChiSonKon/tg-sender-releases) 独创的「TG 机器人 MCP」协议工具，结合顶级 AI 智能体自主逆向、像素级解构并重构而成**！如果你也想轻松探查、逆向、自动化运营或矩阵裂变 Telegram 机器人生态，强烈建议必看神器 👉 [**ChiSonKon/tg-sender-releases**](https://github.com/ChiSonKon/tg-sender-releases) ⭐

</div>

---

## 🔮 逆向诞生记：如何借助「白猫 TG 助手 MCP」与 AI 极速复刻商业大作？

很多开发者好奇：**为什么我们能在极短时间内对标业界顶流商业打狗机器人 @PinkPunkTradingBot，完成 10 条公链、毫秒级撮合、貔貅风控以及 MCP 智能体全生态的 1:1 像素级复现与增强？**

**这背后不可或缺的核心生产力武器，正是 [白猫 TG 商业助手 (tg-sender-releases)](https://github.com/ChiSonKon/tg-sender-releases)！**

### 🌟 核心逆向黑科技
1. 🤖 **原生 TG 机器人 MCP 智能体探查 (`tg_probe_bot_features`)**：
   - 传统人工逆向 Telegram Bot 需要耗费数周时间手动抓包、点击数十层 Inline Keyboards 与解析深层 Callback 数据。
   - 而通过 `tg-sender-releases` 内置的 TG 机器人 MCP 协议，AI 智能体直接化身为全自动探针，全天候无人值守地遍历、探查目标机器人的深层内联菜单、Callback 隐蔽指令、业务状态机与多币种交易路由，直接为本项目自动生成了底层契约与 UI 状态树！
2. 🧬 **社群生态与巨鲸流量智能解构 (`tg_analyze_group_ecosystem`)**：
   - 借助生态分析与用户分类工具，瞬间摸清头部打狗群、巨鲸交流群的高频交易痛点、真实交易频次与滑点忍受度，帮助系统针对性优化了 250ms 抢开盘与防夹策略。
3. 🚀 **商业级 TG 营销矩阵与自动化裂变**：
   - 除了逆向探查，`tg-sender-releases` 更是一套统治级的 Telegram 商业自动化工具箱：支持多账号防封矩阵、群成员高速精准采集、定向批量拉群、智能交互群发与账号自动热身。

> 🔥 **强烈安利**：如果你正在探索 Telegram Web3 赛道、想要逆向分析竞品机器人、或者需要为自己的 Telegram 机器人与社群快速引流裂变，**绝对不能错过这个宝藏项目**：  
> 👉 **[立即前往探索：白猫 TG 助手商业版 (tg-sender-releases)](https://github.com/ChiSonKon/tg-sender-releases)** ⭐ 欢迎 Star 收藏与体验！

---

## 📖 项目简介

**白猫打狗机器人 (WhiteCat Trading Bot)** 是一套专为 Meme 币狙击、链上高频交易与去中心化资产管理打造的生产级全栈系统。工程采用 **Rust 撮合内核 + TypeScript/grammY Telegram 网关 + Go 语言风控哨兵** 混合微服务架构，并在业内首创标准化 **MCP (Model Context Protocol)** 智能体生态，让 Claude Desktop、Cursor、Antigravity 等任意 AI 助手能够直接化身为全自动交易操盘手。

### 🌟 核心特性

- ⚡ **极致时延**：Rust 异步交易引擎，链上签名与广播准备时延 `< 15ms`。
- 🌐 **10 链矩阵**：原生打通 Robinhood Chain、Solana、Base、BSC、Sui、TON、Ethereum、Sei、XLayer、Aptos。
- 🛡 **全天候风控**：内置 Honeypot（貔貅盘）沙盒模拟、买卖税拦截、防夹（Anti-MEV / Jito Bundle）与恶意代码扫描。
- 🤖 **MCP 智能体生态**：支持 STDIO 与 HTTP/SSE 双模传输协议，提供 16 项标准化交易与风控工具。
- 🔥 **爆点雷达与老鼠仓穿透**：全链实时爆点挖掘，资金链路同源聚类（穿透庄家/Dev 分仓老鼠仓），聪明钱与 KOL 喊单接盘陷阱识别，开发者发币信用画像。
- 🎯 **一键智能交易**：发送合约地址（CA）毫秒级自动解析行情、安全评级，一键买入、快捷防跑卖出、移动追踪止盈止损。
- 👥 **聪明钱跟单**：毫秒级监听巨鲸与聪明钱钱包，支持按比例跟买跟卖与防砸盘（Anti-Dump）急救。
- 🌍 **全球化国际化**：全平台原生无缝支持 11 种国际语言（中简、中繁、英、越、俄、韩、日、西、土、波、德）。

---

## 🌐 支持的 10 大主流公链

| 公链名称 | 链类型 / 虚拟机 | 核心路由 / DEX | 防夹 / 极速通道 | 特色支持 |
| :--- | :--- | :--- | :--- | :--- |
| **Robinhood Chain** | Arbitrum Orbit L2 (EVM) | Uniswap V2/V3 | 250ms FCFS 排序直连 | ★ **全球首发集成 (Chain ID: 4663)** |
| **Solana** | SVM | Raydium, Jupiter | Jito MEV Bundle 保护 | 极速防夹、新池狙击 |
| **Binance Smart Chain (BSC)** | EVM | PancakeSwap V2/V3 | BSC MEV Private RPC | 高频土狗打狗 |
| **Base** | EVM (OP Stack) | Uniswap V3, Aerodrome | Flashbots Builder | Coinbase L2 热点币狙击 |
| **Sui** | Move VM | Bluefin, Cetus | Sui Multi-Node Failover | Move 原生代币短 Key 体系 |
| **TON** | TVM | DeDust, STON.fi | Direct TON RPC | Telegram 原生生态集成 |
| **Ethereum** | EVM | Uniswap V2/V3 | Flashbots Protect | 经典主流资产 |
| **Sei** | Sei EVM | DragonSwap | Turbo Block Time | 亚秒级极速撮合 |
| **XLayer** | Polygon CDK L2 | OKX DEX | OKX Private Relay | OKX 官方 L2 网络 |
| **Aptos** | Move VM | Liquidswap, Pontem | Aptos REST Node | Move 生态双引擎 |

---

## 🏗️ 生产级微服务落地架构

```text
whitecat-trading-bot/
├── README.md                                  # 英文官方文档 (Primary)
├── README_zh.md                               # 中文官方文档
├── robinhood_chain_development_guide.md       # Robinhood 链官方开发全解
├── 白猫打狗机器人_功能全复现与技术架构白皮书.md    # 架构与逆向白皮书
├── .env.example                               # 统一环境变量配置模板
├── database/                                  # 【持久层】
│   ├── schema.sql                             # PostgreSQL 16 完整生产表结构
│   └── redis.conf                             # Redis 7 极速低延迟打狗调优配置
├── backend-core-rust/                         # 【内核 1】Rust 异步极速撮合与交易引擎 (< 50ms)
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs                            # REST/JSON-RPC 接口服务 (默认 8080)
│       ├── config.rs                          # 多链 RPC 与密钥安全配置
│       ├── security/crypto.rs                 # 金融级 AES-256-GCM 硬件加密私钥托管与钱包生成
│       ├── chains/robinhood.rs                # ★ Robinhood Chain 专有适配 (4663, 250ms FCFS 排序)
│       ├── chains/evm.rs                      # Base, BSC, Ethereum, Sei 多链 EVM 适配器
│       ├── chains/solana.rs                   # Solana Raydium/Jupiter 路由与 Jito Bundle
│       ├── chains/sui_ton.rs                  # Sui Move 与 TON 扩展适配
│       ├── simulator/honeypot.rs              # 貔貅盘 (Honeypot) 沙盒检测与买卖税模拟
│       └── executor/                          # 快捷买卖、出本保本、开盘狙击、移动追踪止损
├── bot-gateway-ts/                            # 【网关 2】Telegram 交互网关与 MCP 服务 (TypeScript + grammY)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── bot.ts                             # grammY 实例、指令分发与长轮询/Webhook
│       ├── mcp/                               # 🤖 MCP (Model Context Protocol) 智能体双模服务
│       │   ├── index.ts                       # STDIO 模式入口
│       │   ├── sseServer.ts                   # HTTP/SSE 模式服务 (端口 38088)
│       │   ├── mcpServer.ts                   # 16 项 MCP 交易、风控与雷达工具注册
│       │   └── tools/                         # MCP 工具具体实现 (含雷达与老鼠仓审计)
│       ├── menus/                             # 1:1 像素级复现 PinkPunk 菜单 (钱包/交易/跟单/雷达/MCP)
│       │   ├── radarMenu.ts                   # 🔥 爆点雷达实时排行榜面板
│       │   └── ...
│       ├── handlers/tokenDetector.ts          # 聊天框发送 CA 毫秒级识别并弹出买卖控制台
│       └── services/                          # 用户状态存储、多链余额、Meme 雷达与 PnL 海报
│           ├── memeRadarService.ts            # 🔥 爆点雷达、老鼠仓同源穿透与聪明钱画像
│           └── ...
├── sentry-detector-go/                        # 【哨兵 3】风控哨兵与聪明钱雷达 (Go)
│   ├── go.mod
│   ├── main.go                                # 哨兵服务主入口
│   ├── scanner/pool_scanner.go                # WSS 监听 Uniswap PairCreated 新池开盘
│   ├── tracker/whale_tracker.go               # 巨鲸聪明钱交易监听与防砸盘预警
│   └── risk/security_check.go                 # 合约字节码静态扫描 (开源、增发、黑名单)
├── scripts/
│   ├── build_all.sh                           # 一键编译全套三大微服务二进制
│   └── start_dev.sh                           # 一键在本地启动开发全链路
└── tests/
    ├── test_e2e_flow.py                       # 端到端全链路自动化仿真测试套件
    └── test_radar_integration.ts              # 爆点雷达与 16 项 MCP 工具全量自动化测试
```

---

## 🔥 爆点雷达与老鼠仓穿透审计系统

本项目深度吸纳链上先锋算法，原生内置 **Meme 爆点雷达与老鼠仓穿透审计引擎** (`src/services/memeRadarService.ts`)：

1. 🎯 **多维量化综合评分体系 (0-100 分)**：
   - 深度权衡池子早期流动性、5 分钟换手速度、2 万~15 万美元黄金爆发市值区间。
   - 动态赋权聪明钱底仓，严厉扣减庄家砸盘、貔貅税率及同源分仓老鼠仓。
2. 🧬 **资金链路聚类老鼠仓穿透 (Linked Wallet Clustering)**：
   - 穿透追踪链上巨鲸与持仓前 20 钱包的初始原生代币注资祖先 (`from_address`)。
   - 彻底揭开表面分散、实则同源的庄家/Dev 分仓老鼠仓假象 (`linkedHoldRate`)。
3. 🪤 **聪明钱 vs KOL 喊单接盘盘识别 (Smart Degen vs KOL Trap)**：
   - 区分“真聪明钱悄悄建仓”与“纯花钱请推特/TG 大V 喊单拉高出货”盘口 (`smartDegenCount <= 1 && renownedKolCount > 0`)。
4. 👨‍💻 **发币团队人品全景画像 (Dev Reputation)**：
   - 实时审计开发者历史发币总数、内盘毕业率（Graduation Rate）及当前持仓状态 (`HOLDING` 坚守还是 `EXITED` 提桶跑路)。
5. 📱 **Telegram 雷达看板与一键狙击**：
   - 指令 `/radar`、`/hot` 或主菜单【`🔥 爆点雷达`】直达。一键买入、快捷防跑卖出、实时刷新排行。

---

## 🤖 MCP 智能体生态 (Model Context Protocol)

白猫打狗机器人全面实现标准化 **Model Context Protocol (MCP)**，让任意 AI Agent 成为您的全自动交易操盘手。

### 1. 接入模式 (Dual Transport)
- **STDIO 模式 (本地客户端)**：适用于 Claude Desktop、Cursor、Antigravity、Cline 等本地客户端。
- **HTTP / SSE 模式 (远程智能体)**：伴随 Bot 守护进程 24/7 常驻监听（默认端口 `38088`，端点 `/sse`），适用于远程 Agent 节点、集群与自动化 Webhook。

### 2. Claude Desktop 接入示例 (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "whitecat-trading-bot": {
      "command": "node",
      "args": [
        "/绝对路径/bot-gateway-ts/dist/mcp/index.js",
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

### 3. Telegram 机器人控制面板
- **菜单入口**：主菜单直达【`🤖 MCP 智能体接入`】按键，或发送官方指令 `/mcp`。
- **安全护栏**：
  - 🔑 独立安全令牌管理与一键重置。
  - 🛡 **智能体自主交易开关**（一键开启或关闭 Agent 的买卖权限，关闭时仅允许只读投研审计）。
  - ⚠️ **单笔最大交易限额防护**（杜绝 Agent 误操作或死循环超额扣款）。
  - 📊 16 项 MCP 工具实时清单与 11 种国际语言无缝切换。

---

## 🚀 快速上手与运行

### 1. 环境依赖
- **Node.js**: >= 20.x
- **Rust**: >= 1.78
- **Go**: >= 1.22
- **Redis**: >= 7.x
- **PostgreSQL**: >= 15.x

### 2. 执行全量构建
```bash
# 克隆仓库
git clone https://github.com/web3baimao/whitecat-trading-bot.git
cd whitecat-trading-bot

# 赋予执行权限并全量构建
chmod +x scripts/*.sh
./scripts/build_all.sh
```

### 3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件填入您的 Telegram Bot Token 和各链 RPC 节点
```

### 4. 运行端到端测试套件
```bash
python3 tests/test_e2e_flow.py
```

### 5. 一键启动服务
```bash
./scripts/start_dev.sh
```

---

## 📁 进阶设计文档导览

1. **[白猫打狗机器人_功能全复现与技术架构白皮书.md](./白猫打狗机器人_功能全复现与技术架构白皮书.md)**：原生功能像素级解构、微服务架构选型、时序图与系统安全方案。
2. **[robinhood_chain_development_guide.md](./robinhood_chain_development_guide.md)**：Robinhood Chain（Arbitrum Orbit L2）250ms 抢开盘核心逻辑与代码实操。

---

## 🤝 协作与贡献

欢迎提交 Issue 与 Pull Request！共同打造全网最快、最安全的多链交易与 MCP 智能体基础设施。

- **核心作者**: [web3baimao](https://github.com/web3baimao)
- **核心协同开发者**: [chisonkon](https://github.com/ChiSonKon)

## 📄 开源许可证

本项目基于 [MIT License](./LICENSE) 开源。
