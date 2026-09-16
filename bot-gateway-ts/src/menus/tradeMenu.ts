import { InlineKeyboard } from 'grammy';
import { TokenMarketData } from '../services/tokenMarketService.js';
import { MainMenu } from './mainMenu.js';
import { I18nService } from "../services/i18nService.js";
import { TokenKeyHelper } from '../services/tokenKeyHelper.js';
import { ButtonIcons, E, createStyledBtn, stripEmojis } from '../ui/emojis.js';
import { SettingsMenu } from './settingsMenu.js';

export interface TradeViewParams {
  market: TokenMarketData;
  chain: string;
  walletName: string;
  walletAddress: string;
  walletBalance: number;
  userHolding: number;
  userHoldingNative?: number;
  pnlNative?: number;
  pnlPct?: number;
  lang?: string;
  userId?: number;
  botUsername?: string;
}

export class TradeMenu {
  public static getChainId(chain: string): number {
    const map: Record<string, number> = {
      bsc: 56,
      robinhood: 4663,
      arc: 5042,
      ethereum: 1,
      base: 8453,
      solana: 501,
      sui: 101,
      ton: 607,
      xlayer: 196,
      sei: 1329,
      aptos: 1102
    };
    return map[chain.toLowerCase()] || 4663;
  }

  public static resolveChainFromIdOrName(idOrName: string | number): string {
    const s = String(idOrName).toLowerCase().trim();
    const idToChain: Record<string, string> = {
      '56': 'bsc',
      '4663': 'robinhood',
      '5042': 'arc',
      '1': 'ethereum',
      '8453': 'base',
      '501': 'solana',
      '101': 'sui',
      '607': 'ton',
      '196': 'xlayer',
      '1329': 'sei',
      '1102': 'aptos'
    };
    if (idToChain[s]) return idToChain[s];
    if (['bsc', 'robinhood', 'arc', 'ethereum', 'base', 'solana', 'sui', 'ton', 'xlayer', 'sei', 'aptos'].includes(s)) {
      return s;
    }
    return 'robinhood';
  }

  public static formatMarketCap(mc: number): string {
    if (mc >= 1_000_000_000) return `${(mc / 1_000_000_000).toFixed(2)}B`;
    if (mc >= 1_000_000) return `${(mc / 1_000_000).toFixed(2)}M`;
    if (mc >= 1_000) return `${(mc / 1_000).toFixed(1)}K`;
    return `${mc.toFixed(0)}`;
  }

  public static formatLiq(liq: number): string {
    if (liq >= 1_000_000) return `${(liq / 1_000_000).toFixed(2)}M`;
    if (liq >= 1_000) return `${(liq / 1_000).toFixed(2)}K`;
    return `${liq.toFixed(2)}`;
  }

  public static escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  public static renderText(params: TradeViewParams): string {
    const { market, chain, walletName, walletAddress, walletBalance, userHolding, userHoldingNative, pnlNative = 0, pnlPct = 0, lang = 'en' } = params;
    const chainName = MainMenu.getChainDisplayName(chain);
    const nativeSymbol = MainMenu.getChainNativeSymbol(chain);
    const chainId = this.getChainId(chain);
    const mcStr = this.formatMarketCap(market.marketCapUsd);
    const liqStr = this.formatLiq(market.liquidityNative);
    const gasGwei = chain.toLowerCase() === 'bsc' ? '0.28' : chain.toLowerCase() === 'robinhood' ? '0.05' : chain.toLowerCase() === 'arc' ? '0.01' : chain.toLowerCase() === 'sui' ? '0.002' : '15';

    const escapedName = this.escapeHtml(market.name);
    const escapedAddress = this.escapeHtml(market.address);
    const escapedRisk = this.escapeHtml(market.riskLevel || 'Safe');
    const escapedWalletName = this.escapeHtml(walletName);

    const tokenKey = TokenKeyHelper.register(market.address);
    const botUser = params.botUsername || 'wctibot';
    const inviterParam = params.userId ? `${tokenKey}_${params.userId}_${chainId}` : `${tokenKey}-${chainId}`;
    const directBotUrl = `https://t.me/${botUser}?start=referTrade_${inviterParam}`;

    const shareTitle = I18nService.getShareTradeText(lang, market.name, market.symbol || '', chainName, market.address);
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(directBotUrl)}&text=${encodeURIComponent(shareTitle)}`;

    const rawHoldingNative = userHoldingNative ?? 0;
    const holdingNative = rawHoldingNative > 0 ? rawHoldingNative : ((userHolding ?? 0) > 0 && (market.priceNative || 0) > 0 ? (userHolding ?? 0) * market.priceNative : 0);
    const icon = pnlNative >= 0 ? '🟢' : '🔴';
    const holdingStr = userHolding > 0 ? userHolding.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '0';
    const holdingValStr = holdingNative.toFixed(4);

    const smartDegens = market.smartDegenCount ?? 0;
    const kolCount = market.kolCount ?? 0;
    const linkedRate = ((market.linkedHoldRate ?? 0.02) * 100).toFixed(1);
    const ratBadge = (market.linkedHoldRate ?? 0) > 0.15 ? '🔴 高危' : (market.linkedHoldRate ?? 0) > 0.08 ? '🟡 中等' : '🟢 安全';
    const devStatus = market.devStatus || 'HOLDING';
    const kolAlert = market.isKolOnlyTrap ? `\n⚠️ <b>${I18nService.t('radar.kolWarning', lang)}</b>` : '';

    const priceFormatted = market.priceUsd < 0.01 ? market.priceUsd.toFixed(6) : market.priceUsd.toFixed(4);

    // 科技感紧凑 Monospace 结构化表格
    const tableBlock =
      `<pre>\n` +
      `┌─────────────────────────────────┐\n` +
      `│ 🌐 网络公链: ${chainName.padEnd(16)} │\n` +
      `│ 💵 实时价格: $${priceFormatted.padEnd(15)} │\n` +
      `│ 🏦 流通市值: $${mcStr.padEnd(15)} │\n` +
      `│ 🌊 流动池深: ${(liqStr + ' ' + nativeSymbol).padEnd(16)} │\n` +
      `│ ⛽️ 预估Gas : ${(gasGwei + ' Gwei').padEnd(16)} │\n` +
      `│ ⚠️ 安全评级: ${escapedRisk.padEnd(16)} │\n` +
      `└─────────────────────────────────┘\n` +
      `</pre>`;

    return (
      `${E.WHITECAT} <b>${escapedName} (${this.escapeHtml(market.symbol || 'TOKEN')})</b> ｜ <a href="${shareUrl}">${I18nService.t('trade.referTrading', lang)}</a>\n` +
      `<code>${escapedAddress}</code>\n\n` +
      `${tableBlock}\n` +
      `🎯 聪明钱: <b>${smartDegens}人</b> | KOL: <b>${kolCount}人</b> | 评分: <b>${market.radarScore ?? 85}分</b>\n` +
      `🧬 关联老鼠仓: ${ratBadge} (<b>${linkedRate}%</b>) | Dev: <code>${devStatus}</code>${kolAlert}\n\n` +
      `💳 <b>${escapedWalletName}</b>: <code>${walletAddress}</code>\n` +
      `💰 余额: <b>${walletBalance} ${nativeSymbol}</b>\n` +
      `📊 持仓: <b>${holdingStr}</b> (≈${holdingValStr} ${nativeSymbol}) ${icon} PnL: <b>${pnlNative.toFixed(4)} ${nativeSymbol}</b> (≈ ${pnlPct.toFixed(2)}%)\n\n` +
      `${this.buildLinkBar(chain, market, lang)}\n` +
      `⚠️ <i>${I18nService.t('trade.limitOrderWarning', lang)}</i>`
    );
  }

  public static buildLinkBar(chain: string, market: any, lang: string = 'en'): string {
    const c = (chain || 'bsc').toLowerCase();
    const links: { title: string; url: string }[] = [];

    // 1. 区块浏览器 (对于所有公链 100% 具备有效直达)
    const explorerName =
      c === 'arc' ? 'ArcScan' :
      c === 'solana' ? 'Solscan' :
      c === 'bsc' ? 'BscScan' :
      c === 'base' ? 'Basescan' :
      c === 'ethereum' ? 'Etherscan' :
      c === 'sui' ? 'Suiscan' :
      c === 'ton' ? 'Tonviewer' :
      c === 'robinhood' ? 'Robinhood' :
      'Explorer';

    const explorerUrl = market.explorerUrl || (
      c === 'arc' ? `https://arc-scan.org/token/${market.address}` :
      c === 'solana' ? `https://solscan.io/token/${market.address}` :
      c === 'bsc' ? `https://bscscan.com/token/${market.address}` :
      c === 'base' ? `https://basescan.org/token/${market.address}` :
      c === 'ethereum' ? `https://etherscan.io/token/${market.address}` :
      c === 'sui' ? `https://suiscan.xyz/mainnet/coin/${market.address}` :
      c === 'ton' ? `https://tonviewer.com/${market.address}` :
      `https://bscscan.com/token/${market.address}`
    );
    links.push({ title: explorerName, url: explorerUrl });

    // 2. 针对 ARC 链特殊适配：优先展示官方发射台 / DEX 直达，不展示 404 的 Dexscreener/DexTools
    if (c === 'arc') {
      const dexLabel = market.symbol === 'SHARCFUN' ? 'Sharcfun发射台' :
                       market.symbol === 'ARCAT' ? 'Dyor发射台' : 'Dyor DEX';
      const dexUrl = market.dexUrl || (market.symbol === 'SHARCFUN' ? 'https://sharc.fun' : 'https://dyorswap.org/?chainId=5042');
      links.push({ title: dexLabel, url: dexUrl });
    } else {
      // 其他公链：Dexscreener / GMGN / DexTools
      if (market.dexscreenerUrl) {
        links.push({ title: 'Dexscreener', url: market.dexscreenerUrl });
      }
      if (market.gmgnUrl && (c === 'solana' || c === 'bsc' || c === 'base')) {
        links.push({ title: 'GMGN', url: market.gmgnUrl });
      } else if (market.dextoolsUrl) {
        links.push({ title: 'DexTools', url: market.dextoolsUrl });
      }
      if (market.dexUrl && c === 'solana' && market.address?.toLowerCase().endsWith('pump')) {
        links.push({ title: 'Pump.fun', url: market.dexUrl });
      }
    }

    // 3. Twitter / X 社交链接 (杜绝裸域名 https://x.com/、大写与变种，保证有效性)
    let twitterUrl = market.twitterUrl;
    let isRootX = false;
    if (twitterUrl) {
      try {
        const parsed = new URL(twitterUrl.trim());
        const host = parsed.hostname.toLowerCase();
        if (host === 'x.com' || host === 'www.x.com' || host === 'twitter.com' || host === 'www.twitter.com') {
          const pathname = parsed.pathname.replace(/\/+$/, '');
          if (!pathname || pathname === '') {
            isRootX = true;
          }
        }
      } catch {
        isRootX = true;
      }
    } else {
      isRootX = true;
    }

    if (isRootX) {
      if (c === 'arc') {
        twitterUrl = market.symbol === 'SHARCFUN' ? 'https://x.com/SharcFun' :
                     market.symbol === 'ARCAT' ? 'https://x.com/DYORSWAPDEX' : `https://x.com/search?q=${encodeURIComponent(market.address)}`;
      } else {
        twitterUrl = `https://x.com/search?q=${encodeURIComponent('$' + (market.symbol || 'TOKEN'))}`;
      }
    }
    links.push({ title: 'Twitter', url: twitterUrl });

    return `🔗 ` + links.map(l => `<a href="${this.escapeHtml(l.url)}">${this.escapeHtml(l.title)}</a>`).join(' | ');
  }

  public static renderKeyboard(chain: string, tokenAddress: string, lang: string = 'en', tradeConfig?: any): InlineKeyboard {
    const nativeSymbol = MainMenu.getChainNativeSymbol(chain);
    const isBsc = chain.toLowerCase() === 'bsc';
    const isSol = chain.toLowerCase() === 'solana';
    const isSui = chain.toLowerCase() === 'sui';
    const isArc = chain.toLowerCase() === 'arc';

    const presets = tradeConfig ? SettingsMenu.getEffectiveBuyPresets(chain, tradeConfig) : 
      (isArc ? [10, 50, 100, 200, 500] : isBsc ? [0.02, 0.05, 0.1, 0.2, 0.5] : isSol ? [0.1, 0.5, 1, 2, 5] : isSui ? [0.05, 0.1, 0.2, 0.5, 1] : [0.01, 0.05, 0.1, 0.2, 0.5]);
    const b1 = String(presets[0] ?? (isArc ? '10' : '0.01'));
    const b2 = String(presets[1] ?? (isArc ? '50' : '0.05'));
    const b3 = String(presets[2] ?? (isArc ? '100' : '0.1'));
    const b4 = String(presets[3] ?? (isArc ? '200' : '0.2'));
    const b5 = String(presets[4] ?? (isArc ? '500' : '0.5'));

    const returnLabel = I18nService.btnBack(lang);
    const refreshLabel = I18nService.btnRefresh(lang);
    const buyPrefix = stripEmojis(I18nService.t('trade.buy', lang) || '买入');
    const sellPrefix = stripEmojis(I18nService.t('trade.sell', lang) || '卖出');
    const switchWalletLabel = I18nService.t('trade.switchWallet', lang);
    const limitOrderLabel = (I18nService as any).btnLimitOrder ? (I18nService as any).btnLimitOrder(lang) : 'Limit Order';
    const tp1Label = I18nService.t('trade.tp1', lang) || '';
    const tp2Label = I18nService.t('trade.tp2', lang) || '';
    const pnlFullLabel = I18nService.t('trade.pnlFull', lang) || '';
    const pnlSimpleLabel = I18nService.t('trade.pnlSimple', lang) || '';

    const tKey = TokenKeyHelper.toKey(tokenAddress);
    const cLower = chain.toLowerCase();

    return InlineKeyboard.from([
      // Row 1: Return & Refresh (彻底杜绝 Emoji 重叠)
      [
        createStyledBtn(returnLabel, { callback_data: 'asset', style: 'primary', icon_custom_emoji_id: ButtonIcons.BACK }),
        createStyledBtn(refreshLabel, { callback_data: `mr?${tKey}`, style: 'primary', icon_custom_emoji_id: ButtonIcons.REFRESH })
      ],
      // Row 2: Buy 1, 2, 3 (绿色 success)
      [
        { text: `${buyPrefix} ${b1} ${nativeSymbol}`, callback_data: `buy_${cLower}_${tKey}_1`, style: 'success' },
        { text: `${buyPrefix} ${b2} ${nativeSymbol}`, callback_data: `buy_${cLower}_${tKey}_2`, style: 'success' },
        { text: `${buyPrefix} ${b3} ${nativeSymbol}`, callback_data: `buy_${cLower}_${tKey}_3`, style: 'success' }
      ],
      // Row 3: Buy 4, 5, X (绿色 success)
      [
        { text: `${buyPrefix} ${b4} ${nativeSymbol}`, callback_data: `buy_${cLower}_${tKey}_4`, style: 'success' },
        { text: `${buyPrefix} ${b5} ${nativeSymbol}`, callback_data: `buy_${cLower}_${tKey}_5`, style: 'success' },
        { text: `${buyPrefix} X ${nativeSymbol}`, callback_data: `buy_x_${cLower}_${tKey}`, style: 'success' }
      ],
      // Row 4: Switch Wallet, Limit Order (蓝色 primary)
      [
        createStyledBtn(switchWalletLabel, { callback_data: `bscw?${tKey}`, style: 'primary', icon_custom_emoji_id: ButtonIcons.CARD }),
        createStyledBtn(limitOrderLabel, { callback_data: `lmt_${tKey}`, style: 'primary', icon_custom_emoji_id: ButtonIcons.LIMIT_ORDER })
      ],
      // Row 5: Sell 50%, 100%, X% (红色 danger)
      [
        { text: `${sellPrefix} 50%`, callback_data: `sell_${cLower}_${tKey}_50`, style: 'danger' },
        createStyledBtn(`${sellPrefix} 100%`, { callback_data: `sell_${cLower}_${tKey}_100`, style: 'danger', icon_custom_emoji_id: ButtonIcons.PERCENT_100 }),
        { text: `${sellPrefix} X %`, callback_data: `sell_x_${cLower}_${tKey}`, style: 'danger' }
      ],
      // Row 6: TP / Rise Sell (蓝色 primary)
      [
        { text: stripEmojis(tp1Label), callback_data: `tp1_${tKey}`, style: 'primary' },
        { text: stripEmojis(tp2Label), callback_data: `tp2_${tKey}`, style: 'primary' }
      ],
      // Row 7: PnL Charts (蓝色 primary)
      [
        createStyledBtn(pnlFullLabel, { callback_data: `pnl_f_${tKey}`, style: 'primary', icon_custom_emoji_id: ButtonIcons.DIAMOND }),
        { text: stripEmojis(pnlSimpleLabel), callback_data: `pnl_s_${tKey}`, style: 'primary' }
      ]
    ]);
  }
}
