import { InlineKeyboard } from 'grammy';
import { MainMenu } from './mainMenu.js';
import { WalletEntry } from './walletMenu.js';
import { TokenKeyHelper } from '../services/tokenKeyHelper.js';
import { I18nService } from '../services/i18nService.js';

export interface TokenHoldingItem {
  address: string;
  symbol: string;
  balance: number;
  nativeValue: number;
  pnlNative: number;
  pnlPct: number;
}

export class AssetMenu {
  public static renderText(
    chain: string,
    wallet: WalletEntry,
    tokens: TokenHoldingItem[] = [],
    lang: string = 'en'
  ): string {
    const chainName = MainMenu.getChainDisplayName(chain);
    const nativeSymbol = MainMenu.getChainNativeSymbol(chain);
    const currentChainLine = I18nService.getMainCurrentChain(lang, chainName);
    const balStr = wallet.balance !== undefined ? wallet.balance : 0;

    let tokensText = '';
    if (tokens.length > 0) {
      const pnlLabel = lang === 'zh-hans' ? '盈亏' : lang === 'zh-hant' ? '盈虧' : lang === 'vi' ? 'L/L' : lang === 'ru' ? 'PnL' : lang === 'ko' ? '손익' : 'PnL';
      tokensText = '\n\n' + tokens
        .map(t => {
          const balFmt = t.balance.toLocaleString('en-US', { maximumFractionDigits: 4 });
          const valFmt = t.nativeValue.toFixed(4);
          const pnlSign = t.pnlNative >= 0 ? '+' : '';
          const icon = t.pnlNative >= 0 ? '🟢' : '🔴';
          return (
            `<b>${t.symbol}</b>: ${balFmt} (≈${valFmt} ${nativeSymbol}) ${icon} ${pnlLabel}: ${pnlSign}${t.pnlNative.toFixed(4)} ${nativeSymbol}(≈ ${pnlSign}${t.pnlPct.toFixed(2)}%)\n` +
            `<code>${t.address}</code>`
          );
        })
        .join('\n\n');
    }

    return (
      `${currentChainLine}\n\n` +
      `Wallet_${wallet.index + 1}: ${balStr} ${nativeSymbol} \n` +
      `<code>${wallet.address}</code>` +
      tokensText
    );
  }

  public static renderKeyboard(chain: string, tokens: TokenHoldingItem[] = [], lang: string = 'en'): InlineKeyboard {
    const nativeSymbol = MainMenu.getChainNativeSymbol(chain);
    const kb = new InlineKeyboard();

    // Row 1: Return & Refresh
    kb.text(I18nService.btnBack(lang), 'menu_main')
      .text(I18nService.btnRefresh(lang), 'asset_refresh')
      .row();

    // Row 2: Transfer Native & Transfer Token
    kb.text(I18nService.btnTransferNative(lang, nativeSymbol), 'transfer_native')
      .text(I18nService.btnTransferToken(lang), 'transfer_token')
      .row();

    // Row 3: Display Token
    kb.text(I18nService.btnShowTokens(lang), 'show_tokens');

    // Row 4+: Quick actions for held tokens
    if (tokens.length > 0) {
      for (const t of tokens) {
        const tKey = TokenKeyHelper.toKey(t.address);
        const balLabel = `${t.symbol} ${t.balance > 1000 ? (t.balance / 1000).toFixed(1) + 'K' : t.balance.toFixed(0)}`;
        kb.row()
          .text(balLabel, `mr?${tKey}`)
          .text(I18nService.btnSellPercent(50, lang), `sell_${tKey}_50`)
          .text(I18nService.btnSellPercent(100, lang), `sell_${tKey}_100`);
      }
    }

    return kb;
  }
}
