import { InlineKeyboard } from 'grammy';
import { MainMenu } from './mainMenu.js';
import { I18nService } from '../services/i18nService.js';

export interface TradeConfig {
  mode: 'fast' | 'normal';
  gasTip: number;
  slippage: number;
  antiMev: boolean;
  buyPresets: number[];
  sellPresets: number[];
}

export class SettingsMenu {
  public static renderText(chain: string, config: TradeConfig, lang: string = 'en'): string {
    const chainName = MainMenu.getChainDisplayName(chain);
    const nativeSymbol = MainMenu.getChainNativeSymbol(chain);

    const modeStr = config.mode === 'fast' ? I18nService.t('settings.fastMode', lang) : I18nService.t('settings.normalMode', lang);
    const mevStr = config.antiMev ? `🟢 ${I18nService.t('settings.enabled', lang)}` : `🔴 ${I18nService.t('settings.disabled', lang)}`;
    
    return (
      `⚙️ <b>${I18nService.t('settings.title', lang)} (${chainName})</b>\n\n` +
      `${I18nService.t('settings.currentMode', lang)}: <b>${modeStr}</b>\n` +
      `⛽️ ${I18nService.t('settings.gasTip', lang)}: <b>${config.gasTip} ${nativeSymbol}</b>\n` +
      `📉 ${I18nService.t('settings.slippage', lang)}: <b>${config.slippage}%</b>\n` +
      `🛡️ ${I18nService.t('settings.antiMev', lang)}: <b>${mevStr}</b>\n\n` +
      `${I18nService.t('settings.hint', lang)}`
    );
  }

  public static renderKeyboard(chain: string, config: TradeConfig, lang: string = 'en'): InlineKeyboard {
    const nativeSymbol = MainMenu.getChainNativeSymbol(chain);

    const fastLabel = config.mode === 'fast'
      ? `✅ ${I18nService.t('settings.fastModeShort', lang)}`
      : I18nService.t('settings.fastModeShort', lang);

    const normalLabel = config.mode === 'normal'
      ? `✅ ${I18nService.t('settings.normalModeShort', lang)}`
      : I18nService.t('settings.normalModeShort', lang);

    const tipLabel = `✏️ ${I18nService.t('settings.gasTip', lang)}`;
    const slipLabel = `✏️ ${I18nService.t('settings.slippage', lang)} (${config.slippage}%)`;
    
    // We reuse trade.buy / trade.sell
    const buyPrefix = `✏️ ${I18nService.t('trade.buy', lang)}`;
    const sellPrefix = `✏️ ${I18nService.t('trade.sell', lang)}`;

    const b1 = config.buyPresets[0] || 0.02;
    const b2 = config.buyPresets[1] || 0.05;
    const b3 = config.buyPresets[2] || 0.1;
    const b4 = config.buyPresets[3] || 0.2;
    const b5 = config.buyPresets[4] || 0.5;

    const s1 = config.sellPresets[0] || 50;
    const s2 = config.sellPresets[1] || 100;

    return new InlineKeyboard()
      // Row 1: Mode toggles & Tip
      .text(fastLabel, 'set_mode_fast')
      .text(normalLabel, 'set_mode_normal')
      .text(tipLabel, 'set_tip')
      .row()
      // Row 2: Slippage
      .text(slipLabel, 'set_slippage')
      .row()
      // Row 3: Buy presets 1, 2, 3
      .text(`${buyPrefix} ${b1} ${nativeSymbol}`, 'set_buy_1')
      .text(`${buyPrefix} ${b2} ${nativeSymbol}`, 'set_buy_2')
      .text(`${buyPrefix} ${b3} ${nativeSymbol}`, 'set_buy_3')
      .row()
      // Row 4: Buy presets 4, 5
      .text(`${buyPrefix} ${b4} ${nativeSymbol}`, 'set_buy_4')
      .text(`${buyPrefix} ${b5} ${nativeSymbol}`, 'set_buy_5')
      .row()
      // Row 5: Sell presets 50%, 100%
      .text(`${sellPrefix} ${s1}%`, 'set_sell_1')
      .text(`${sellPrefix} ${s2}%`, 'set_sell_2')
      .row()
      // Row 6: Return
      .text(I18nService.btnBack(lang), 'menu_main');
  }
}
