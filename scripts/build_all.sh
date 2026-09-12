#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=================================================================="
echo "🐾 正在全量构建 白猫打狗机器人 (WhiteCat Trading Bot)..."
echo "=================================================================="

echo "📦 1. 编译 Go 风控哨兵服务 (sentry-detector-go)..."
cd "$ROOT_DIR/sentry-detector-go"
go build -o whitecat-sentry-detector .
echo "✅ Go 哨兵编译成功！"

echo "📦 2. 构建 TypeScript Telegram 网关 (bot-gateway-ts)..."
cd "$ROOT_DIR/bot-gateway-ts"
pnpm run build || npm run build
echo "✅ TypeScript 网关编译成功！"

echo "📦 3. 编译 Rust 极速交易内核 (backend-core-rust)..."
cd "$ROOT_DIR/backend-core-rust"
cargo build --release
echo "✅ Rust 交易内核编译成功！"

echo "=================================================================="
echo "🎉 全套微服务构建完毕！"
echo "=================================================================="
