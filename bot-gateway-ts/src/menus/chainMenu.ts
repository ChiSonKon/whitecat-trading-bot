import { InlineKeyboard } from 'grammy';
import { I18nService } from '../services/i18nService.js';

export class ChainMenu {
  public static renderText(lang: string = 'en'): string {
    return I18nService.getSelectChainPrompt(lang);
  }

  public static renderKeyboard(lang: string = 'en', isOnboarding: boolean = false): InlineKeyboard {
    const kb = new InlineKeyboard()
      .text('Robinhood', 'switch_chain_robinhood')
      .row()
      .text('BSC', 'switch_chain_bsc')
      .row()
      .text('Sui', 'switch_chain_sui')
      .row()
      .text('XLayer', 'switch_chain_xlayer')
      .row()
      .text('Solana', 'switch_chain_solana')
      .row()
      .text('TON', 'switch_chain_ton')
      .row()
      .text('Aptos', 'switch_chain_aptos')
      .row()
      .text('Sei EVM', 'switch_chain_sei')
      .row()
      .text('Base', 'switch_chain_base')
      .row()
      .text('Ethereum', 'switch_chain_ethereum')
      .row();

    if (isOnboarding) {
      kb.text(I18nService.btnBackToLang(lang), 'onboard_back_lang');
    } else {
      kb.text(I18nService.btnClose(lang), 'menu_close');
    }

    return kb;
  }
}
