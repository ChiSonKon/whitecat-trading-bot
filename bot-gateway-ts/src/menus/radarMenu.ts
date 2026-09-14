import { InlineKeyboard } from 'grammy';
import { RadarCandidate } from '../services/memeRadarService.js';
import { I18nService } from '../services/i18nService.js';
import { MainMenu } from './mainMenu.js';

export class RadarMenu {
  public static renderText(chain: string, candidates: RadarCandidate[], lang: string = 'zh-hans'): string {
    const chainName = MainMenu.getChainDisplayName(chain);
    let text = `🔥 <b>${I18nService.t('radar.title', lang)} [${chainName}]</b>\n\n`;
    text += `${I18nService.t('radar.desc', lang)}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (candidates.length === 0) {
      text += `<i>${I18nService.t('radar.empty', lang)}</i>\n\n`;
    } else {
      candidates.forEach((c, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `<b>[#${idx + 1}]</b>`;
        const scoreBadge = c.compositeScore >= 80 ? '🟢' : c.compositeScore >= 60 ? '🟡' : '🔴';
        const ratBadge = c.linkedHoldRate > 0.15 ? '🔴 高危' : c.linkedHoldRate > 0.08 ? '🟡 中等' : '🟢 极低';
        const kolAlert = c.isKolOnlyTrap ? `\n   ⚠️ <b>${I18nService.t('radar.kolWarning', lang)}</b>` : '';

        text += `${medal} <b>$${c.symbol}</b> (${c.name})\n`;
        text += `   • 评分: ${scoreBadge} <b>${c.compositeScore}</b>/100 | 市值: $${(c.marketCapUsd / 1000).toFixed(1)}k | 池子: $${(c.liquidityUsd / 1000).toFixed(1)}k\n`;
        text += `   • 聪明钱: <b>${c.smartDegenCount}人</b> | KOL: <b>${c.renownedKolCount}人</b>\n`;
        text += `   • 关联老鼠仓: ${ratBadge} (<b>${(c.linkedHoldRate * 100).toFixed(1)}%</b>) | Dev: <code>${c.devStatus}</code>${kolAlert}\n`;
        text += `   • 合约: <code>${c.tokenAddress}</code>\n\n`;
      });
    }

    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💡 <i>${I18nService.t('radar.footerTip', lang)}</i>`;
    return text;
  }

  public static renderKeyboard(chain: string, candidates: RadarCandidate[], lang: string = 'zh-hans'): InlineKeyboard {
    const kb = new InlineKeyboard();

    // 候选代币快捷直达按钮 (每行 2 个)
    for (let i = 0; i < Math.min(candidates.length, 6); i += 2) {
      const c1 = candidates[i];
      const c2 = candidates[i + 1];
      if (c1 && c2) {
        kb.text(`🚀 #${i + 1} $${c1.symbol} (${c1.compositeScore}分)`, `radar_pick_${c1.shortKey}`)
          .text(`🚀 #${i + 2} $${c2.symbol} (${c2.compositeScore}分)`, `radar_pick_${c2.shortKey}`)
          .row();
      } else if (c1) {
        kb.text(`🚀 #${i + 1} $${c1.symbol} (${c1.compositeScore}分)`, `radar_pick_${c1.shortKey}`)
          .row();
      }
    }

    // 控制操作按键
    kb.text(I18nService.t('radar.btnRefresh', lang), 'radar_refresh')
      .text(I18nService.btnSwitchChain(lang), 'chain_change')
      .row()
      .text(I18nService.btnBack(lang), 'menu_home');

    return kb;
  }
}
