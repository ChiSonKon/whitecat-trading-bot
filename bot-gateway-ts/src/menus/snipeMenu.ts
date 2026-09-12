import { InlineKeyboard } from 'grammy';
import { I18nService } from '../services/i18nService.js';

export class SnipeMenu {
  public static renderText(lang: string = 'en'): string {
    return `
${I18nService.t('snipe.title', lang)}
---
${I18nService.t('snipe.desc', lang)}

${I18nService.t('snipe.mode1', lang)}
${I18nService.t('snipe.mode2', lang)}

${I18nService.t('snipe.robinhood', lang)}
    `.trim();
  }

  public static renderKeyboard(lang: string = 'en'): InlineKeyboard {
    const kb = new InlineKeyboard()
      .text(I18nService.t('snipe.createLiquidity', lang), 'snipe_create_liquidity')
      .text(I18nService.t('snipe.createMethod', lang), 'snipe_create_method')
      .row()
      .text(I18nService.t('snipe.toggleBlast', lang), 'snipe_toggle_blast')
      .text(I18nService.t('snipe.adjustTip', lang), 'snipe_adjust_tip')
      .row()
      .text(I18nService.t('snipe.viewActive', lang), 'snipe_view_active')
      .row()
      .text(I18nService.btnBack(lang), 'menu_main');

    return kb;
  }
}
