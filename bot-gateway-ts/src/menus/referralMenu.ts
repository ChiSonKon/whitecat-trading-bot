import { InlineKeyboard } from 'grammy';
import { MainMenu } from './mainMenu.js';
import { I18nService } from '../services/i18nService.js';

export interface ReferralStats {
  invitedCount: number;
  tradedUsersCount: number;
  tradeCount: number;
  tradeVolume: number;
  totalEarned: number;
  claimableAmount: number;
  claimedAmount: number;
}

export class ReferralMenu {
  public static getWithdrawThreshold(chain: string): number {
    const c = chain.toLowerCase();
    if (c === 'sui') return 30;
    if (c === 'solana') return 0.1;
    if (c === 'bsc') return 0.05;
    return 0.01;
  }

  public static renderText(
    userId: number,
    chain: string,
    stats: Partial<ReferralStats> = {},
    lang: string = 'zh-hans'
  ): string {
    const symbol = MainMenu.getChainNativeSymbol(chain);
    const botUser = 'whitecat_doge_yr3ybv_bot';
    const inviteLink = `https://t.me/${botUser}?start=ref_${userId}`;
    const threshold = this.getWithdrawThreshold(chain);

    const invitedCount = stats.invitedCount || 0;
    const tradedUsersCount = stats.tradedUsersCount || 0;
    const tradeCount = stats.tradeCount || 0;
    const tradeVolume = stats.tradeVolume || 0;
    const claimableAmount = stats.claimableAmount || 0;
    const claimedAmount = stats.claimedAmount || 0;
    const totalEarned = stats.totalEarned ?? (claimableAmount + claimedAmount);

    return (
      `${I18nService.t('referral.code', lang)}: <code>${userId}</code>\n` +
      `${I18nService.t('referral.link', lang)}:\n` +
      `<code>${inviteLink}</code>\n\n` +
      `${I18nService.t('referral.stats', lang)}:\n` +
      `${I18nService.t('referral.invited', lang)}: ${invitedCount}\n` +
      `${I18nService.t('referral.tradedUsers', lang)}: ${tradedUsersCount}\n` +
      `${I18nService.t('referral.trades', lang)}: ${tradeCount}\n` +
      `${I18nService.t('referral.volume', lang)}: ${tradeVolume.toFixed(4)} ${symbol}\n\n` +
      `${I18nService.t('referral.commission', lang)}:\n` +
      `${I18nService.t('referral.totalEarned', lang)}: ${totalEarned.toFixed(4)} ${symbol}\n` +
      `${I18nService.t('referral.claimable', lang)}: ${claimableAmount.toFixed(4)} ${symbol}\n` +
      `${I18nService.t('referral.claimed', lang)}: ${claimedAmount.toFixed(4)} ${symbol}\n\n` +
      `${I18nService.t('referral.notes', lang)}:\n` +
      `${I18nService.t('referral.note1', lang)}\n` +
      `${I18nService.t('referral.note2', lang, { threshold: threshold.toString(), symbol })}`
    );
  }

  public static renderKeyboard(lang: string = 'zh-hans'): InlineKeyboard {
    return new InlineKeyboard()
      .text(I18nService.btnRefresh(lang), 'referral_refresh')
      .text(I18nService.btnClaimReward(lang), 'claim_referral')
      .row()
      .text(I18nService.btnBack(lang), 'menu_main');
  }
}
