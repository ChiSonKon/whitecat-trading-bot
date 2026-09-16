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
  chain?: string;
  baseCurrency?: string;
  createdAt?: number;
}

export interface LimitOrderEvaluation {
  triggered: boolean;
  baseCurrency: string;
  triggerPrice: number;
  currentPrice: number;
  priceDiffPct: number;
  orderType: string;
  reason: string;
}

export class LimitOrderMenu {
  /**
   * 格式化触发价格展示
   * ARC 链使用天然 USDC 计价，其它链默认使用 $
   */
  public static formatPrice(price: number, chain: string = 'bsc'): string {
    const isArc = (chain || '').toLowerCase() === 'arc';
    return isArc ? `${price} USDC` : `$${price}`;
  }

  /**
   * 判定限价单是否达到触发阈值
   * ARC 链以 USDC 作为天然计价基准本位 (1 USDC = $1.00 USD)
   */
  public static isOrderTriggered(
    order: LimitOrderItem,
    currentPrice: number,
    chain: string = 'arc'
  ): boolean {
    const targetChain = (order.chain || chain || 'arc').toLowerCase();
    // 限价买入：当当前市价回调至或低于挂单触发价时触发
    if (order.orderType === 'BUY') {
      return currentPrice <= order.triggerPrice;
    }
    // 限价卖出：止盈单当市价涨至或超过触发价时触发；止损单当市价跌破触发价时触发
    if (order.orderType === 'SELL') {
      if (order.id && (order.id.startsWith('sl_') || order.id.startsWith('stop_loss_'))) {
        return currentPrice <= order.triggerPrice;
      }
      return currentPrice >= order.triggerPrice;
    }
    return false;
  }

  /**
   * 限价单触发价格比对接口 (兼容别名)
   */
  public static compareTriggerPrice(
    order: LimitOrderItem,
    currentPrice: number,
    chain: string = 'arc'
  ): boolean {
    return this.isOrderTriggered(order, currentPrice, chain);
  }

  /**
   * 对限价单执行全面触发研判与偏离度计算
   */
  public static evaluateLimitOrder(
    order: LimitOrderItem,
    currentPrice: number,
    chain: string = 'arc'
  ): LimitOrderEvaluation {
    const targetChain = (order.chain || chain || 'arc').toLowerCase();
    const baseCurrency = targetChain === 'arc' ? 'USDC' : 'USD';
    const triggered = this.isOrderTriggered(order, currentPrice, targetChain);
    const priceDiffPct = order.triggerPrice > 0
      ? parseFloat((((currentPrice - order.triggerPrice) / order.triggerPrice) * 100).toFixed(4))
      : 0;

    let reason = '';
    if (triggered) {
      if (order.orderType === 'BUY') {
        reason = `市价 ${currentPrice} ${baseCurrency} 已触及或低于买入目标价 ${order.triggerPrice} ${baseCurrency}`;
      } else {
        reason = `市价 ${currentPrice} ${baseCurrency} 已触及或高于卖出目标价 ${order.triggerPrice} ${baseCurrency}`;
      }
    } else {
      if (order.orderType === 'BUY') {
        reason = `市价 ${currentPrice} ${baseCurrency} 高于买入目标价 ${order.triggerPrice} ${baseCurrency}，等待回调`;
      } else {
        reason = `市价 ${currentPrice} ${baseCurrency} 低于卖出目标价 ${order.triggerPrice} ${baseCurrency}，等待上涨`;
      }
    }

    return {
      triggered,
      baseCurrency,
      triggerPrice: order.triggerPrice,
      currentPrice,
      priceDiffPct,
      orderType: order.orderType,
      reason
    };
  }

  public static renderText(
    wallet?: WalletEntry,
    orders: LimitOrderItem[] = [],
    lang: string = 'en',
    chain: string = 'bsc'
  ): string {
    const wName = wallet ? `Wallet_${wallet.index + 1}` : 'Wallet_1';
    const isCurrentArc = (chain || '').toLowerCase() === 'arc';
    const chainBadge = isCurrentArc ? ' [ARC / USDC]' : '';

    if (orders.length === 0) {
      return `💳 ${wName}${chainBadge}\n${I18nService.t('limitOrder.noData', lang)}`;
    }

    const orderLines = orders
      .map((o, idx) => {
        const orderChain = (o.chain || chain || 'bsc').toLowerCase();
        const isArc = orderChain === 'arc';
        const priceLabel = isArc ? `${o.triggerPrice} USDC` : `$${o.triggerPrice}`;
        const arcTag = isArc ? ' [USDC]' : '';
        return `${idx + 1}. [${o.orderType}] <b>${o.symbol}</b>${arcTag} ${I18nService.t('limitOrder.triggerPrice', lang)}: ${priceLabel} ${I18nService.t('limitOrder.amount', lang)}: ${o.amount}`;
      })
      .join('\n');

    return `💳 ${wName}${chainBadge}\n${I18nService.t('limitOrder.activeOrders', lang)}:\n\n${orderLines}`;
  }

  public static renderKeyboard(lang: string = 'en'): InlineKeyboard {
    return new InlineKeyboard()
      .text(I18nService.btnBack(lang), 'menu_main')
      .text(I18nService.btnRefresh(lang), 'limit_refresh')
      .row()
      .text(I18nService.t('limitOrder.addOrder', lang), 'limit_add');
  }
}
