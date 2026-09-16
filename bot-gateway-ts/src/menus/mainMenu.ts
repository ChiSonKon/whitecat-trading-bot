import { GITHUB_URL, githubLabel } from '../ui/openSource.js';
import { InlineKeyboard, Keyboard } from 'grammy';
import { WalletEntry } from './walletMenu.js';
import { I18nService } from '../services/i18nService.js';
import { ButtonIcons, E, createStyledBtn, stripEmojis } from '../ui/emojis.js';

export class MainMenu {
  public static getChainDisplayName(chain: string): string {
    const map: Record<string, string> = {
      robinhood: 'Robinhood',
      arc: 'Arc Network',
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
      arc: 'USDC',
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
        `${E.WHITECAT} <b>WhiteCat Trading Bot</b>

` +
        `${currentChainLine}

` +
        `<pre>
` +
        `┌─────────────────────────────────┐
` +
        `│ 💳 关联钱包: 0 个 (0/10)        │
` +
        `│ 🌐 当前公链: ${chainName.padEnd(17)}  │
` +
        `└─────────────────────────────────┘
` +
        `</pre>
` +
        `${zeroText}

` +
        `${reminder}`
      );
    }

    const activeWallet = wallets.find(w => w.isDefault) || wallets[0];
    const balStr = activeWallet.balance !== undefined ? activeWallet.balance : 0;
    return (
      `${E.WHITECAT} <b>WhiteCat Trading Bot</b> ｜ ${E.GLOBE} <b>${chainName}</b>

` +
      `<pre>
` +
      `┌─────────────────────────────────┐
` +
      `│ 💳 活跃钱包: Wallet_${activeWallet.index + 1}
` +
      `│ 💰 账户余额: ${balStr} ${activeWallet.symbol}
` +
      `│ 🌐 所在网络: ${chainName}
` +
      `└─────────────────────────────────┘
` +
      `</pre>
` +
      `<code>${activeWallet.address}</code>

` +
      `${reminder}`
    );
  }

  public static renderKeyboard(wallets: WalletEntry[], lang: string = 'en', chain: string = 'bsc'): InlineKeyboard {
    const count = wallets.length;
    const langLabel = this.getLangButtonLabel(lang);
    const isZh = lang === 'zh-hans' || lang === 'zh-hant';
    const isArc = chain.toLowerCase() === 'arc';
    const chainName = this.getChainDisplayName(chain);

    const guideBtnText = isArc
      ? (isZh ? '🌐 ARC 跨链指引' : '🌐 ARC Bridge Guide')
      : (isZh ? `🌐 ${chainName} 生态与内盘指引` : `🌐 ${chainName} Ecosystem Guide`);

    const chainGuideBtn = [
      [
        createStyledBtn(guideBtnText, {
          callback_data: isArc ? 'menu_arc_guide' : `menu_chain_guide_${chain.toLowerCase()}`,
          style: 'primary',
          icon_custom_emoji_id: ButtonIcons.GLOBE
        })
      ]
    ];

    // 1. 零钱包状态
    if (count === 0) {
      return InlineKeyboard.from([
        [createStyledBtn(githubLabel(lang), { url: GITHUB_URL, icon_custom_emoji_id: ButtonIcons.STAR })],
        [
          createStyledBtn(I18nService.btnCreateWallet(lang), { callback_data: 'create_wallet', style: 'success', icon_custom_emoji_id: ButtonIcons.PLUS }),
          createStyledBtn(I18nService.btnImportWallet(lang), { callback_data: 'import_wallet', style: 'primary', icon_custom_emoji_id: ButtonIcons.FOLDER })
        ],
        ...chainGuideBtn,
        [
          createStyledBtn(langLabel, { callback_data: 'lang', style: 'primary', icon_custom_emoji_id: ButtonIcons.GLOBE })
        ],
        [
          createStyledBtn(I18nService.btnSwitchChain(lang), { callback_data: 'chain_change', style: 'primary', icon_custom_emoji_id: ButtonIcons.REFRESH })
        ],
        [
          createStyledBtn(I18nService.btnMcp(lang), { callback_data: 'menu_mcp', style: 'primary', icon_custom_emoji_id: ButtonIcons.ROBOT }),
          createStyledBtn(I18nService.btnRadar(lang), { callback_data: 'menu_radar', style: 'danger', icon_custom_emoji_id: ButtonIcons.FIRE })
        ]
      ]);
    }

    // 2. 已有钱包状态 (按最新 TG 机器人色彩与高级图标规范布局，彻底杜绝 Emoji 重叠)
    return InlineKeyboard.from([
      [
        createStyledBtn(I18nService.btnBuySell(lang), { callback_data: 'buy_sell', style: 'success', icon_custom_emoji_id: ButtonIcons.LIGHTNING }),
        createStyledBtn(I18nService.btnLimitOrder(lang), { callback_data: 'limit_order_list', style: 'primary', icon_custom_emoji_id: ButtonIcons.LIMIT_ORDER })
      ],
      [
        createStyledBtn(I18nService.btnSniper(lang), { callback_data: 'sniper_token', style: 'success', icon_custom_emoji_id: ButtonIcons.TARGET }),
        createStyledBtn(I18nService.btnCopyTrade(lang), { callback_data: 'copy_trade', style: 'primary', icon_custom_emoji_id: ButtonIcons.GROUP })
      ],
      [
        createStyledBtn(I18nService.btnAsset(lang), { callback_data: 'asset', style: 'primary', icon_custom_emoji_id: ButtonIcons.DIAMOND }),
        createStyledBtn(I18nService.btnWallet(lang), { callback_data: 'setting', style: 'primary', icon_custom_emoji_id: ButtonIcons.CARD })
      ],
      ...chainGuideBtn,
      [
        createStyledBtn(I18nService.btnTradeSetting(lang), { callback_data: 'trade_setting', style: 'primary', icon_custom_emoji_id: ButtonIcons.GEAR }),
        createStyledBtn(githubLabel(lang), { url: GITHUB_URL, icon_custom_emoji_id: ButtonIcons.STAR })
      ],
      [
        createStyledBtn(langLabel, { callback_data: 'lang', style: 'primary', icon_custom_emoji_id: ButtonIcons.GLOBE }),
        createStyledBtn(I18nService.btnSwitchChain(lang), { callback_data: 'chain_change', style: 'primary', icon_custom_emoji_id: ButtonIcons.REFRESH })
      ],
      [
        createStyledBtn(I18nService.btnMcp(lang), { callback_data: 'menu_mcp', style: 'primary', icon_custom_emoji_id: ButtonIcons.ROBOT }),
        createStyledBtn(I18nService.btnRadar(lang), { callback_data: 'menu_radar', style: 'danger', icon_custom_emoji_id: ButtonIcons.FIRE })
      ],
      [
        createStyledBtn(I18nService.btnMonitorBroadcast(lang), { url: 'https://t.me/wchjbot', icon_custom_emoji_id: ButtonIcons.ANNOUNCE })
      ],
      [
        createStyledBtn(I18nService.btnDevTechSupport(lang), { url: 'https://t.me/biqrxnxiYW/667', icon_custom_emoji_id: ButtonIcons.WHITECAT })
      ]
    ]);
  }

  /**
   * 构造底部常驻回复键盘 (ReplyKeyboardMarkup)
   * 遵循 Telegram 最新彩色与自定义图标规范，文本前缀原生 Emoji 全部自动过滤
   */
  public static getBottomKeyboard(lang: string = 'en'): Keyboard {
    const mainBtn = {
      text: stripEmojis(I18nService.btnDockMainMenu(lang)),
      style: 'primary' as const,
      icon_custom_emoji_id: ButtonIcons.WHITECAT
    };
    const assetBtn = {
      text: stripEmojis(I18nService.btnDockAsset(lang)),
      style: 'success' as const,
      icon_custom_emoji_id: ButtonIcons.DIAMOND
    };
    const walletBtn = {
      text: stripEmojis(I18nService.btnDockWallet(lang)),
      style: 'primary' as const,
      icon_custom_emoji_id: ButtonIcons.CARD
    };

    return Keyboard.from([[mainBtn, assetBtn, walletBtn]])
      .resized()
      .persistent()
      .placeholder(I18nService.getDockPlaceholder(lang));
  }
}
