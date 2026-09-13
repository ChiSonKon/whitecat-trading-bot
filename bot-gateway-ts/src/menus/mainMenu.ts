import { InlineKeyboard, Keyboard } from 'grammy';
import { WalletEntry } from './walletMenu.js';
import { I18nService } from '../services/i18nService.js';

export class MainMenu {
  public static getChainDisplayName(chain: string): string {
    const map: Record<string, string> = {
      robinhood: 'Robinhood',
      bsc: 'BSC',
      solana: 'Solana',
      base: 'Base',
      ethereum: 'Ethereum',
      sui: 'Sui',
      ton: 'TON',
      xlayer: 'XLayer',
      aptos: 'Aptos',
      sei: 'Sei EVM'
    };
    return map[chain.toLowerCase()] || chain.toUpperCase();
  }

  public static getChainNativeSymbol(chain: string): string {
    const map: Record<string, string> = {
      robinhood: 'ETH',
      bsc: 'BNB',
      solana: 'SOL',
      base: 'ETH',
      ethereum: 'ETH',
      sui: 'SUI',
      ton: 'TON',
      xlayer: 'OKB',
      aptos: 'APT',
      sei: 'SEI'
    };
    return map[chain.toLowerCase()] || 'ETH';
  }

  public static getLangButtonLabel(langCode: string = 'en'): string {
    return I18nService.getLangLabel(langCode);
  }

  public static renderText(chain: string, wallets: WalletEntry[], lang: string = 'en'): string {
    const chainName = this.getChainDisplayName(chain);
    const count = wallets.length;
    const currentChainLine = I18nService.getMainCurrentChain(lang, chainName);
    const reminder = I18nService.getSecurityReminder(lang);

    if (count === 0) {
      const zeroText = I18nService.getMainZeroWallets(lang);
      return (
        `${currentChainLine}\n\n` +
        `${zeroText}\n\n\n` +
        `${reminder}`
      );
    }

    const activeWallet = wallets.find(w => w.isDefault) || wallets[0];
    const balStr = activeWallet.balance !== undefined ? activeWallet.balance : 0;
    return (
      `${currentChainLine}\n\n` +
      `Wallet_${activeWallet.index + 1}: ${balStr} ${activeWallet.symbol} \n` +
      `<code>${activeWallet.address}</code>\n\n\n` +
      `${reminder}`
    );
  }

  public static renderKeyboard(wallets: WalletEntry[], lang: string = 'en'): InlineKeyboard {
    const kb = new InlineKeyboard();
    const count = wallets.length;
    const langLabel = this.getLangButtonLabel(lang);

    // 1. 零钱包状态 (1:1 对齐 PinkPunk 0 钱包状态)
    if (count === 0) {
      kb.text(I18nService.btnCreateWallet(lang), 'create_wallet')
        .text(I18nService.btnImportWallet(lang), 'import_wallet')
        .row()
        .text(langLabel, 'lang')
        .row()
        .text(I18nService.btnSwitchChain(lang), 'chain_change')
        .row()
        .text(I18nService.btnMcp(lang), 'menu_mcp');
      return kb;
    }

    // 2. 已有钱包状态 (1:1 对齐 PinkPunk 主菜单矩阵)
    // Row 1: Buy/Sell & Limit Order
    kb.text(I18nService.btnBuySell(lang), 'buy_sell')
      .text(I18nService.btnLimitOrder(lang), 'limit_order_list')
      .row()
      // Row 2: Sniper & Copy Trade
      .text(I18nService.btnSniper(lang), 'sniper_token')
      .text(I18nService.btnCopyTrade(lang), 'copy_trade')
      .row()
      // Row 3: Asset & Wallet
      .text(I18nService.btnAsset(lang), 'asset')
      .text(I18nService.btnWallet(lang), 'setting')
      .row()
      // Row 4: Trade Setting & Referral Reward
      .text(I18nService.btnTradeSetting(lang), 'trade_setting')
      .text(I18nService.btnReferral(lang), 'referral')
      .row()
      // Row 5: Language & Switch Chain
      .text(langLabel, 'lang')
      .text(I18nService.btnSwitchChain(lang), 'chain_change')
      .row()
      // Row 6: 🤖 MCP 智能体接入 (MCP Agent Integration)
      .text(I18nService.btnMcp(lang), 'menu_mcp')
      .row()
      // Row 7: 监听群发 (@wchjbot)
      .url(I18nService.btnMonitorBroadcast(lang), 'https://t.me/wchjbot')
      .row()
      // Row 8: TG机器人开发 / 群发引流 / Web3技术支持 (https://t.me/biqrxnxiYW/667)
      .url(I18nService.btnDevTechSupport(lang), 'https://t.me/biqrxnxiYW/667');

    return kb;
  }

  /**
   * 构造底部常驻回复键盘 (ReplyKeyboardMarkup) - 三个并排按键
   * [ 🚀 打开主菜单 | 📊 资产持仓 | 💳 钱包设置 ]
   */
  public static getBottomKeyboard(lang: string = 'en'): Keyboard {
    return new Keyboard()
      .text(I18nService.btnDockMainMenu(lang))
      .text(I18nService.btnDockAsset(lang))
      .text(I18nService.btnDockWallet(lang))
      .resized()
      .persistent()
      .placeholder(I18nService.getDockPlaceholder(lang));
  }
}
