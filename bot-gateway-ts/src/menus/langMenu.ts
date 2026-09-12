import { InlineKeyboard } from 'grammy';
import { I18nService, ALL_LANGUAGES, LangInfo } from '../services/i18nService.js';

export const SUPPORTED_LANGUAGES: LangInfo[] = ALL_LANGUAGES;

export class LangMenu {
  public static getLangByCode(code: string): LangInfo {
    return I18nService.getLangInfo(code);
  }

  public static getLangById(id: number): LangInfo {
    return ALL_LANGUAGES.find(l => l.id === id) || ALL_LANGUAGES[0];
  }

  public static renderText(currentCode: string = 'en'): string {
    return I18nService.getSelectLangPrompt(currentCode);
  }

  public static renderKeyboard(currentCode: string = 'en'): InlineKeyboard {
    // 过滤掉当前已选中的语言，显示其他可选语言
    const norm = I18nService.normalizeLang(currentCode);
    const options = ALL_LANGUAGES.filter(l => l.code !== norm);
    const kb = new InlineKeyboard();

    for (let i = 0; i < options.length; i += 2) {
      kb.text(options[i].name, `lang_click?${options[i].id}`);
      if (i + 1 < options.length) {
        kb.text(options[i + 1].name, `lang_click?${options[i + 1].id}`);
      }
      kb.row();
    }

    kb.text(I18nService.btnClose(currentCode), 'menu_close');
    return kb;
  }

  public static renderOnboardingKeyboard(): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (let i = 0; i < ALL_LANGUAGES.length; i += 2) {
      kb.text(ALL_LANGUAGES[i].name, `onboard_lang_${ALL_LANGUAGES[i].code}`);
      if (i + 1 < ALL_LANGUAGES.length) {
        kb.text(ALL_LANGUAGES[i + 1].name, `onboard_lang_${ALL_LANGUAGES[i + 1].code}`);
      }
      kb.row();
    }
    return kb;
  }
}
