import { InlineKeyboard } from 'grammy';
import { E, ButtonIcons, createStyledBtn } from '../ui/emojis.js';

export class ArcGuideMenu {
  public static ARCAT_CA = '0x07704B06981eA962b87296362a1281484d160000';
  public static SHARCFUN_CA = '0x99b37b7fccAA7a1030617b6195eB3045c523BB97';

  public static renderText(lang: string = 'zh-hans'): string {
    const isZh = lang === 'zh-hans' || lang === 'zh-hant';

    if (isZh) {
      return (
        `${E.WHITECAT} <b>Arc Network 跨链综合指引</b>\n\n` +
        `💡 <b>兑换 ARC 链原生 USDC (Gas & 交易计价)</b>\n` +
        `ARC 链 (<a href="https://x.com/arc">@arc</a>) 原生使用本链 <b>USDC</b> 结算。您需要从 BSC / SOL / ETH / BASE 跨链兑换：\n\n` +
        `<b>官方合作跨链桥：</b>\n` +
        `• <a href="https://across.to/">Across Protocol</a> (首选推荐)\n` +
        `• <a href="https://interchain.axelar.dev/">Axelar Interchain</a>\n` +
        `• <a href="https://wheelx.fi/">WheelX</a>\n` +
        `• <a href="https://portalbridge.com/">Wormhole Portal</a>`
      );
    }

    return (
      `${E.WHITECAT} <b>Arc Network Cross-Chain Bridge Guide</b>\n\n` +
      `💡 <b>Cross-chain Bridge to ARC USDC (Gas & Trading)</b>\n` +
      `ARC Chain (<a href="https://x.com/arc">@arc</a>) operates on native <b>USDC</b> for gas and trading. Bridge USDC from BSC / SOL / ETH / BASE:\n\n` +
      `<b>Official Bridges:</b>\n` +
      `• <a href="https://across.to/">Across Protocol</a> (Recommended)\n` +
      `• <a href="https://interchain.axelar.dev/">Axelar Interchain</a>\n` +
      `• <a href="https://wheelx.fi/">WheelX</a>\n` +
      `• <a href="https://portalbridge.com/">Wormhole Portal</a>`
    );
  }

  public static renderKeyboard(lang: string = 'zh-hans'): InlineKeyboard {
    const isZh = lang === 'zh-hans' || lang === 'zh-hant';

    return InlineKeyboard.from([
      [
        { text: '🌉 Across Protocol (推荐)', url: 'https://across.to/' },
        { text: '🌐 Axelar Interchain', url: 'https://interchain.axelar.dev/' }
      ],
      [
        { text: '🔄 WheelX', url: 'https://wheelx.fi/' },
        { text: '🌀 Wormhole Portal', url: 'https://portalbridge.com/' }
      ],
      [
        createStyledBtn(isZh ? '🔙 返回主菜单' : '🔙 Main Menu', {
          callback_data: 'menu_main',
          style: 'primary',
          icon_custom_emoji_id: ButtonIcons.BACK
        })
      ]
    ]);
  }
}
