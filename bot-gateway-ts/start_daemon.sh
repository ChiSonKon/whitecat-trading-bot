#!/bin/bash
export RUN_BOT_NOW=true
while true; do
  echo "🤖 [Supervisor] Starting WhiteCat Trading Bot Gateway..."
  node dist/bot.js
  exit_code=$?
  echo "⚠️ [Supervisor] Bot exited with code ${exit_code}. Auto-restarting in 2 seconds..."
  sleep 2
done
