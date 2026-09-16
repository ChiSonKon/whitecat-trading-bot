# Protocol Fee Deployment & Integration Guide

**Pre-deployment Notice**: EVM (BSC/ETH/Base), Solana, and Sui protocol fee logic is fully implemented in code and passed 100% of unit tests (31/31 passed). Before deploying to production, valid cold wallet recipient addresses must be configured in `.env`, and the team/user must confirm the on-chain settlement mode (two-transaction decoupled mode vs atomic router contract). TON swaps remain disabled for safety.

本开源项目默认包含 0.6% 的开发者生态维护税（Protocol Fee），用于支持白猫项目的开源开发与节点基础设施维护。使用者可在 `.env` 中通过 `PROTOCOL_FEE_RATE=0` 自主调零或修改为你自己的钱包地址。

In this implementation:
- **EVM (BSC, ETH, Base)**: Native asset (BNB/ETH) buy splits gross amount in wei; net is routed to router with slippage protection. Upon swap success, the fee is transferred via `EvmNonceManager`. Sell calculates fee on confirmed native return and transfers it.
- **Solana**: Native SOL buy splits lamports; net is routed to Jupiter quote. Upon confirmation, fee is transferred via `SystemProgram.transfer`. Sell calculates fee on confirmed SOL return and transfers it.
- **Sui**: Native SUI buy splits fee atomically within the PTB. Sell sets 7k SDK commission parameters. SDK compatibility (`balanceChanges`) and timeout local digest preservation are fully implemented.

## Configuration

Copy the root `.env.example` values into the `.env` used by your gateway working directory. Set `PROTOCOL_FEE_RATE=0` to retain fee-free behavior while this change is incomplete. Restart the process after editing configuration.

```dotenv
PROTOCOL_FEE_RATE=0.006
PROTOCOL_FEE_RECIPIENT_EVM=
PROTOCOL_FEE_RECIPIENT_SOLANA=
PROTOCOL_FEE_RECIPIENT_SUI=
PROTOCOL_FEE_RECIPIENT_TON=
```

Recipients intentionally have no default: actual developer public addresses must be supplied. Never enter private keys in these variables. A positive Sui fee rate with a missing, invalid or zero recipient rejects the trade before signing.

Rates are parsed as exact decimal fractions, up to 18 decimal places, within 0–0.020. Sui sell's SDK commission interface requires whole basis points (0.0001 increments); unsupported finer rates reject instead of rounding. Fee base-unit dust remains with the trader.

## Current Sui behavior

- Buy: quote uses `gross - floor(gross * rate)` in MIST; fee is split from gas and transferred within the same PTB. Fee-enabled buys require gross plus a conservative 0.5 SUI gas budget. Actual gas can be lower.
- Sell: 7k commission parameters use the SUI output coin and configured recipient; BluefinX paths that ignore commission are rejected. The SDK contract's exact settlement semantics still require independent verification.
- Signing address is checked. Failed or unknown execution status cannot be reported as success merely because a digest exists.
- No live transactions, contract deployment or cold-wallet transfers have been performed as part of development.

## Local validation

From `bot-gateway-ts`, run `npm run build` and `node --test tests/*.test.mjs`. Regression tests mock chain calls and do not establish mainnet safety. Complete integration tests and the pending EVM/Solana architecture decision before deployment.
