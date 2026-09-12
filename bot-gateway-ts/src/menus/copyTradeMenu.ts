import { InlineKeyboard } from 'grammy';
import { WalletEntry } from './walletMenu.js';
import { I18nService } from '../services/i18nService.js';

export class CopyTradeMenu {
  public static renderText(wallet?: WalletEntry, targetsCount: number = 0, lang: string = 'en'): string {
    const wName = wallet ? `Wallet_${wallet.index + 1}` : 'Wallet_1';
    const wAddr = wallet ? wallet.address : '0x0000000000000000000000000000000000000000';

    return (
      `⚡️ <b>${I18nService.t('copyTrade.title', lang)}</b>\n\n` +
      `💳 ${wName}\n` +
      `<code>${wAddr}</code>\n\n` +
      `📖 <b>${I18nService.t('copyTrade.instructions', lang)}</b>：\n` +
      `${I18nService.t('copyTrade.desc1', lang)}\n` +
      `${I18nService.t('copyTrade.desc2', lang)}\n` +
      `${I18nService.t('copyTrade.desc3', lang)}\n\n` +
      `🟢 ${I18nService.t('copyTrade.status', lang, { status: `<b>${I18nService.t('copyTrade.active', lang)}</b>` })}\n` +
      `📊 ${I18nService.t('copyTrade.monitored', lang)}: <b>${targetsCount} / 10</b>`
    );
  }

  public static renderKeyboard(lang: string = 'en'): InlineKeyboard {
    return new InlineKeyboard()
      .text(I18nService.btnBack(lang), 'menu_main')
      .text(I18nService.t('copyTrade.add', lang), 'copy_add');
  }
}
