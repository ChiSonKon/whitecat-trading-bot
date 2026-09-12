import { InlineKeyboard } from 'grammy';
import { WalletEntry } from './walletMenu.js';
import { I18nService } from '../services/i18nService.js';

export interface LimitOrderItem {
  id: string;
  tokenAddress: string;
  symbol: string;
  orderType: 'BUY' | 'SELL';
  triggerPrice: number;
  amount: number;
}

export class LimitOrderMenu {
  public static renderText(wallet?: WalletEntry, orders: LimitOrderItem[] = [], lang: string = 'en'): string {
    const wName = wallet ? `Wallet_${wallet.index + 1}` : 'Wallet_1';

    if (orders.length === 0) {
      return `💳 ${wName}\n${I18nService.t('limitOrder.noData', lang)}`;
    }

    const orderLines = orders
      .map(
        (o, idx) =>
          `${idx + 1}. [${o.orderType}] <b>${o.symbol}</b> ${I18nService.t('limitOrder.triggerPrice', lang)}: $${o.triggerPrice} ${I18nService.t('limitOrder.amount', lang)}: ${o.amount}`
      )
      .join('\n');

    return `💳 ${wName}\n${I18nService.t('limitOrder.activeOrders', lang)}:\n\n${orderLines}`;
  }

  public static renderKeyboard(lang: string = 'en'): InlineKeyboard {
    return new InlineKeyboard()
      .text(I18nService.btnBack(lang), 'menu_main')
      .text(I18nService.btnRefresh(lang), 'limit_refresh')
      .row()
      .text(I18nService.t('limitOrder.addOrder', lang), 'limit_add');
  }
}
