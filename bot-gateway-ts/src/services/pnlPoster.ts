export interface PnLData {
  tokenSymbol: string;
  tokenAddress: string;
  chain: string;
  entryPrice: number;
  currentPrice: number;
  pnlPct: number;
  profitNative: number;
  nativeSymbol: string;
  userReferralCode: string;
}

export class PnLPosterGenerator {
  public static generateCardText(data: PnLData): string {
    const isProfit = data.pnlPct >= 0;
    const emojiHeader = isProfit ? '🚀🚀🚀 【白猫打狗·大捷海报】 🚀🚀🚀' : '🛡️ 【白猫打狗·持仓报告】 🛡️';
    const statusEmoji = isProfit ? '🟢 暴赚' : '🔴 浮亏';
    const sign = isProfit ? '+' : '';

    const barLength = 12;
    const filled = Math.min(barLength, Math.max(1, Math.floor(Math.abs(data.pnlPct) / 10)));
    const bar = isProfit
      ? '🟩'.repeat(filled) + '⬜'.repeat(barLength - filled)
      : '🟥'.repeat(filled) + '⬜'.repeat(barLength - filled);

    return `
${emojiHeader}

🎯 **代币**: #${data.tokenSymbol} (${data.chain.toUpperCase()})
📍 **合约**: \`${data.tokenAddress.slice(0, 8)}...${data.tokenAddress.slice(-6)}\`
📊 **收益率**: ${statusEmoji} **${sign}${data.pnlPct.toFixed(2)}%**
📈 **盈亏进度**: [ ${bar} ]
💰 **净收益**: **${sign}${data.profitNative.toFixed(4)} ${data.nativeSymbol}**

💵 **买入成本**: \$${data.entryPrice.toFixed(6)}
⚡ **当前市价**: \$${data.currentPrice.toFixed(6)}

---
🐾 **白猫打狗机器人 (WhiteCat Trading Bot)**
⚡ **50ms 极速链上狙击 | 首发支持 Robinhood Chain**
🎁 **加入跟单分佣**: \`https://t.me/WhiteCatTradingBot?start=${data.userReferralCode}\`
    `.trim();
  }
}
