import { InlineKeyboard } from 'grammy';
import { TokenMarketData } from '../services/tokenMarketService.js';
import { MainMenu } from './mainMenu.js';
import { I18nService } from "../services/i18nService.js";
import { TokenKeyHelper } from '../services/tokenKeyHelper.js';

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
    if (['bsc', 'robinhood', 'ethereum', 'base', 'solana', 'sui', 'ton', 'xlayer', 'sei', 'aptos'].includes(s)) {
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
    const gasGwei = chain.toLowerCase() === 'bsc' ? '0.28' : chain.toLowerCase() === 'robinhood' ? '0.05' : chain.toLowerCase() === 'sui' ? '0.002' : '15';

    const escapedName = this.escapeHtml(market.name);
    const escapedAddress = this.escapeHtml(market.address);
    const escapedRisk = this.escapeHtml(market.riskLevel || 'Safe');
    const escapedWalletName = this.escapeHtml(walletName);

    const tokenKey = TokenKeyHelper.register(market.address);
    const botUser = params.botUsername || 'whitecat_doge_yr3ybv_bot';
    const inviterParam = params.userId ? `${tokenKey}_${params.userId}_${chainId}` : `${tokenKey}-${chainId}`;
    const directBotUrl = `https://t.me/${botUser}?start=referTrade_${inviterParam}`;

    const shareTitle = I18nService.getShareTradeText(lang, market.name, market.symbol || '', chainName, market.address);
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(directBotUrl)}&text=${encodeURIComponent(shareTitle)}`;

    const holdingNative = userHoldingNative || 0;
    const icon = pnlNative >= 0 ? '🟢' : '🔴';
    const holdingStr = userHolding > 0 ? userHolding.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '0';
    const holdingValStr = holdingNative.toFixed(4);

    return (
      `<b>${escapedName}</b>  ｜  <a href="${shareUrl}">${I18nService.t('trade.referTrading', lang)}</a>\n` +
      `<code>${escapedAddress}</code>\n` +
      `${I18nService.t('trade.holding', lang)}: ${holdingStr}  (≈${holdingValStr} ${nativeSymbol}) ${icon} PnL: ${pnlNative.toFixed(4)} ${nativeSymbol}(≈ ${pnlPct.toFixed(2)}%)\n\n` +
      `<b>⚠️ ${I18nService.t('trade.risk', lang)}: ${escapedRisk} </b>\n\n` +
      `${escapedWalletName}\n` +
      `<code>${walletAddress}</code>\n` +
      `${I18nService.t('trade.balance', lang)}: ${walletBalance} ${nativeSymbol}\n\n` +
      `📄 ${I18nService.t('trade.price', lang)}: $${market.priceUsd < 0.01 ? market.priceUsd.toFixed(6) : market.priceUsd.toFixed(3)} 👤${I18nService.t('trade.holders', lang)}: ${market.holdersCount}  \n` +
      `🏦 ${I18nService.t('trade.mc', lang)}: $${mcStr} 🌊 ${I18nService.t('trade.liq', lang)}: ${liqStr} ${nativeSymbol} \n` +
      `⛽️ ${I18nService.t('trade.turboMode', lang)} ≈ ${gasGwei} Gwei (${chainName})\n` +
      `<a href="${market.dexscreenerUrl}">Dexscreener</a> | <a href="${market.dextoolsUrl}">DexTools</a> | <a href="${market.twitterUrl || 'https://x.com'}">Twitter</a>\n` +
      `⚠️ ${I18nService.t('trade.limitOrderWarning', lang)}`
    );
  }

  public static renderKeyboard(chain: string, tokenAddress: string, lang: string = 'en'): InlineKeyboard {
    const nativeSymbol = MainMenu.getChainNativeSymbol(chain);
    const isBsc = chain.toLowerCase() === 'bsc';
    const isSol = chain.toLowerCase() === 'solana';
    const isSui = chain.toLowerCase() === 'sui';

    const b1 = isBsc ? '0.02' : isSol ? '0.1' : isSui ? '0.05' : '0.01';
    const b2 = isBsc ? '0.05' : isSol ? '0.5' : isSui ? '0.1' : '0.05';
    const b3 = isBsc ? '0.1' : isSol ? '1' : isSui ? '0.2' : '0.1';
    const b4 = isBsc ? '0.2' : isSol ? '2' : isSui ? '0.5' : '0.2';
    const b5 = isBsc ? '0.5' : isSol ? '5' : isSui ? '1' : '0.5';

    const returnLabel = I18nService.btnBack(lang);
    const refreshLabel = I18nService.btnRefresh(lang);
    const buyPrefix = I18nService.t('trade.buy', lang) || '';
    const sellPrefix = I18nService.t('trade.sell', lang) || '';
    const switchWalletLabel = I18nService.t('trade.switchWallet', lang);
    const limitOrderLabel = (I18nService as any).btnLimitOrder ? (I18nService as any).btnLimitOrder(lang) : '📌 Limit Order';
    const tp1Label = I18nService.t('trade.tp1', lang) || '';
    const tp2Label = I18nService.t('trade.tp2', lang) || '';
    const pnlFullLabel = I18nService.t('trade.pnlFull', lang) || '';
    const pnlSimpleLabel = I18nService.t('trade.pnlSimple', lang) || '';

    const tKey = TokenKeyHelper.toKey(tokenAddress);

    return new InlineKeyboard()
      // Row 1: Return & Refresh
      .text(returnLabel, 'asset')
      .text(refreshLabel, `mr?${tKey}`)
      .row()
      // Row 2: Buy 1, 2, 3
      .text(`${buyPrefix} ${b1} ${nativeSymbol}`, `buy_${tKey}_1`)
      .text(`${buyPrefix} ${b2} ${nativeSymbol}`, `buy_${tKey}_2`)
      .text(`${buyPrefix} ${b3} ${nativeSymbol}`, `buy_${tKey}_3`)
      .row()
      // Row 3: Buy 4, 5, X
      .text(`${buyPrefix} ${b4} ${nativeSymbol}`, `buy_${tKey}_4`)
      .text(`${buyPrefix} ${b5} ${nativeSymbol}`, `buy_${tKey}_5`)
      .text(`${buyPrefix} X ${nativeSymbol}`, `buy_x_${tKey}`)
      .row()
      // Row 4: Switch Wallet, Limit Order
      .text(switchWalletLabel, `bscw?${tKey}`)
      .text(limitOrderLabel, `lmt_${tKey}`)
      .row()
      // Row 5: Sell 50%, 100%, X%
      .text(`${sellPrefix} 50%`, `sell_${tKey}_50`)
      .text(`${sellPrefix} 100%`, `sell_${tKey}_100`)
      .text(`${sellPrefix} X %`, `sell_x_${tKey}`)
      .row()
      // Row 6: TP / Rise Sell
      .text(tp1Label, `tp1_${tKey}`)
      .text(tp2Label, `tp2_${tKey}`)
      .row()
      // Row 7: PnL Charts
      .text(pnlFullLabel, `pnl_f_${tKey}`)
      .text(pnlSimpleLabel, `pnl_s_${tKey}`);
  }
}
