# WhiteCat Trading Bot (白猫打狗机器人) - Agent 全局维护守则与项目向导

## 1. 项目概览与关键架构 (Quick Reference)

- **核心目录**: `bot-gateway-ts` (TypeScript + grammY 架构)
- **多链支持**: 10 条主流链 (BSC, Robinhood, Sui, Base, Solana, Ethereum, Sei, TON, XLayer, Aptos)。
  - 全公链与 Sui 链行为 100% 对齐：0 余额真实拦截、私钥签名与广播、节点高可用容灾。
- **国际化系统**: `src/services/i18nService.ts` 完整支持 11 种语言 (`zh-hans`, `zh-hant`, `en`, `ru`, `vi`, `ko`, `ja`, `es`, `tr`, `pl`, `de`)。新增任何菜单或按钮文案必须同步全量 11 种语言。
- **代币短 Key 体系**: `src/services/tokenKeyHelper.ts` 负责将长合约地址与 Move TypeTag 映射为短 Key，杜绝 Telegram 64 字节 Inline Callback 溢出。
- **构建与进程重启规范**:
  ```bash
  # 1. 编译 TypeScript
  npm run build
  # 2. 找到当前子进程 PID (运行在 start_daemon.sh 守护进程下)
  ps -ef | grep "node dist/bot.js" | grep -v grep
  # 3. 杀掉当前 node 进程，守护进程会在 2 秒内自动拉起最新编译的 dist/bot.js (严禁手动再跑一个 background bot 避免 409 冲突)
  kill -9 <child_bot_pid>
  ```

---

## 2. Token 预算监控与主动会话切换守则 (Token & Context Guardrail)

所有在本工作区运行的 Agent 必须严格遵守以下上下文健康守则：

1. **自动识别 Token 膨胀临界点**：
   - 当检测到当前会话中已经出现 `<CONTEXT_SUMMARY>`（表明历史对话已被压缩截断，Token 消耗极高）；
   - 或者当前会话的交互轮次已超过 15 轮，且伴随大量文件读写与终端测试输出时；
2. **主动提醒开新会话机制**：
   - 当完成当前一个完整的需求或 Bug 修复闭环（编译通过并完成验证）后，**必须在回复末尾主动提醒用户开启新会话**，例如：
   > 💡 **Token 节能与效率提醒**：当前任务已全面落地并验证完毕。当前会话上下文已较为厚重，若继续在此会话中开启新的修复任务，单次交互将消耗大量 Token 且容易导致模型注意力衰减。**强烈建议您开启一个全新的对话会话**。在新会话中您可以直接提出新需求，我将自动根据工作区规则秒级理解项目背景！
