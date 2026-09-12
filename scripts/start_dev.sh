#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=================================================================="
echo "🐾 正在以开发模式启动 白猫打狗机器人 (WhiteCat Trading Bot)..."
echo "=================================================================="

# 检查环境文件
if [ ! -f "$ROOT_DIR/.env" ]; then
    echo "ℹ️ 未发现 .env 文件，正在从 .env.example 初始化..."
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
fi

echo "🚀 [1/3] 启动 Rust 交易内核 (端口 8080)..."
(cd "$ROOT_DIR/backend-core-rust" && cargo run) &
RUST_PID=$!

echo "🚀 [2/3] 启动 Go 风控哨兵服务..."
(cd "$ROOT_DIR/sentry-detector-go" && go run .) &
GO_PID=$!

echo "🚀 [3/3] 启动 TypeScript Telegram Bot 网关..."
(cd "$ROOT_DIR/bot-gateway-ts" && pnpm run dev) &
TS_PID=$!

cleanup() {
    echo "正在停止所有白猫打狗子服务..."
    kill $RUST_PID $GO_PID $TS_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "✨ 所有微服务已在后台运行！按 Ctrl+C 可停止全部服务。"
wait
