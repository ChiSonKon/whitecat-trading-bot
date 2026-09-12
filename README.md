# 白猫打狗机器人 (WhiteCat Trading Bot) 复现工程

本项目为针对知名 Telegram 头部多链打狗交易机器人 **@PinkPunkTradingBot** 的全功能 1:1 复现与增强研发工程，并全球首发集成 **Robinhood Chain（Chain ID: 4663）**。

---

## 📁 核心设计文档导览

1. **[白猫打狗机器人_功能全复现与技术架构白皮书.md](./白猫打狗机器人_功能全复现与技术架构白皮书.md)**
   * @PinkPunkTradingBot 原生功能像素级解构（多链钱包矩阵、极速买卖、开盘狙击、止盈止损、聪明钱跟单、貔貅检测、多级分佣裂变）。
   * 混合微服务技术架构选型深度决策（Rust 交易核心 + TypeScript/Go TG网关 + Redis + PostgreSQL）。
   * 系统微服务序列图与分阶段落地路线图（Roadmap）。

2. **[robinhood_chain_development_guide.md](./robinhood_chain_development_guide.md)**
   * Robinhood Chain（Arbitrum Orbit L2，EVM 兼容）主网/测试网网络配置（RPC, Chain ID 4663, BlockScout）。
   * 先到先得（FCFS）排序机制下 250ms 抢开盘核心逻辑与代码实现（Python Web3 & Rust Alloy）。
   * RWA 美股代币与热点 Meme 币跨界交易路由接入方案。

---

## 🏗️ 生产级微服务落地架构

```text
白猫打狗机器人复现/
├── README.md                                  # 项目概览与快速启动手册
├── robinhood_chain_development_guide.md       # Robinhood 链官方开发全解
├── 白猫打狗机器人_功能全复现与技术架构白皮书.md    # 架构与逆向白皮书
├── .env.example                               # 统一环境变量模板
├── database/                                  # 【持久层】
│   ├── schema.sql                             # PostgreSQL 16 完整生产表结构 (用户/10钱包矩阵/流水/返佣/貔貅库)
│   └── redis.conf                             # Redis 7 极速内存与低延迟打狗调优配置
├── backend-core-rust/                         # 【内核 1】Rust 异步极速撮合与交易引擎 (< 50ms)
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs                            # REST/JSON-RPC 接口服务 (端口 8080)
│       ├── config.rs                          # 环境变量与网络配置
│       ├── security/crypto.rs                 # 金融级 AES-256-GCM 硬件加密私钥托管与 EVM/Solana 钱包生成
│       ├── chains/robinhood.rs                # ★ Robinhood Chain 专有适配 (4663, 250ms FCFS 排序, Uniswap V2/V3)
│       ├── chains/evm.rs                      # Base, BSC, Ethereum, Sei 多链 EVM 适配器
│       ├── chains/solana.rs                   # Solana Raydium/Jupiter 路由与 Jito Bundle 防夹
│       ├── chains/sui_ton.rs                  # Sui Move 与 TON 扩展适配
│       ├── simulator/honeypot.rs              # 貔貅盘 (Honeypot) 沙盒检测与买卖税模拟
│       └── executor/                          # 快捷买卖 (Swap)、一键保本出本 (Sell Initial)、开盘狙击、移动追踪止损
├── bot-gateway-ts/                            # 【前端 2】Telegram 交互网关 (TypeScript + grammY)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── bot.ts                             # grammY 实例、指令分发与长轮询/Webhook
│       ├── menus/                             # 1:1 像素级复现 PinkPunk 菜单 (主页/钱包/快捷交易/狙击/跟单/返佣/设置)
│       ├── handlers/tokenDetector.ts          # 聊天框发送 CA 毫秒级自动识别并弹出买卖控制台
│       └── services/                          # 后端 RPC 客户端与 PnL 收益海报渲染器
├── sentry-detector-go/                        # 【哨兵 3】风控哨兵与聪明钱雷达 (Go)
│   ├── go.mod
│   ├── main.go                                # 哨兵服务主入口
│   ├── scanner/pool_scanner.go                # Robinhood Chain WSS 监听 Uniswap PairCreated 新池秒级开盘
│   ├── tracker/whale_tracker.go               # 巨鲸聪明钱交易监听与防砸盘 (Anti-Dump) 预警
│   └── risk/security_check.go                 # 合约字节码静态扫描 (开源、增发、黑名单、交易限制)
├── scripts/
│   ├── build_all.sh                           # 一键编译全套三大微服务二进制
│   └── start_dev.sh                           # 一键在本地启动开发全链路
└── tests/
    └── test_e2e_flow.py                       # 端到端全链路自动化仿真测试套件 (5项测试全过)
```

---

## 🚀 快速上手与运行

### 1. 执行全量构建
```bash
./scripts/build_all.sh
```

### 2. 运行端到端自动化测试套件
```bash
python3 tests/test_e2e_flow.py
```

### 3. 一键启动本地开发环境
```bash
cp .env.example .env
./scripts/start_dev.sh
```

---

## ⚡ 核心性能指标
* **链上打包与广播准备时延**：< 15ms（Rust 内存级流水线 + 连接池复用）
* **开盘首发支持**：Robinhood Chain (Chain ID: 4663)，250ms 排序器直连
* **安全防护**：内置防夹 (Anti-MEV) 私密路由，预执行沙盒 100% 自动阻断貔貅盘与恶意 Rug 币

