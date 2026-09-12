import { InlineKeyboard } from 'grammy';
import { MainMenu } from './mainMenu.js';
import { I18nService } from '../services/i18nService.js';
import { WalletEntry } from './walletMenu.js';

export interface UserTransactionRecord {
  id: string;
  chain: string;
  walletAddress: string;
  type: 'BUY' | 'SELL' | 'TRANSFER';
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;
  amountNative: number;
  amountToken: number;
  gasFeeNative: number;
  txHash: string;
  timestamp: number;
  status: 'SUCCESS' | 'FAILED';
  isRealOnChain?: boolean;
}

export class BillingMenu {
  public static getChainTxUrl(chain: string, txHash: string): string {
    const c = chain.toLowerCase();
    if (c === 'solana') return `https://solscan.io/tx/${txHash}`;
    if (c === 'ethereum') return `https://etherscan.io/tx/${txHash}`;
    if (c === 'base') return `https://basescan.org/tx/${txHash}`;
    if (c === 'robinhood') return `https://explorer.robinhood.com/tx/${txHash}`;
    if (c === 'sui') return `https://suiscan.xyz/mainnet/tx/${txHash}`;
    if (c === 'ton') return `https://tonviewer.com/transaction/${txHash}`;
    if (c === 'aptos') return `https://explorer.aptoslabs.com/txn/${txHash}?network=mainnet`;
    if (c === 'xlayer') return `https://www.okx.com/zh-hans/explorer/xlayer/tx/${txHash}`;
    if (c === 'sei') return `https://seitrace.com/tx/${txHash}`;
    return `https://bscscan.com/tx/${txHash}`;
  }

  public static getChainAddressUrl(chain: string, address: string): string {
    const c = chain.toLowerCase();
    if (c === 'solana') return `https://solscan.io/account/${address}`;
    if (c === 'ethereum') return `https://etherscan.io/address/${address}`;
    if (c === 'base') return `https://basescan.org/address/${address}`;
    if (c === 'robinhood') return `https://explorer.robinhood.com/address/${address}`;
    if (c === 'sui') return `https://suiscan.xyz/mainnet/account/${address}`;
    if (c === 'ton') return `https://tonviewer.com/${address}`;
    if (c === 'aptos') return `https://explorer.aptoslabs.com/account/${address}?network=mainnet`;
    if (c === 'xlayer') return `https://www.okx.com/zh-hans/explorer/xlayer/address/${address}`;
    if (c === 'sei') return `https://seitrace.com/address/${address}`;
    return `https://bscscan.com/address/${address}`;
  }

  public static renderText(
    chain: string,
    activeWallet?: WalletEntry,
    transactions: UserTransactionRecord[] = [],
    lang: string = 'en'
  ): string {

    const c = chain.toLowerCase();
    const chainName = MainMenu.getChainDisplayName(c);
    const nativeSymbol = MainMenu.getChainNativeSymbol(c);

    // 筛选当前链记录
    const chainTxs = transactions.filter(tx => !tx.chain || tx.chain.toLowerCase() === c);

    // 统计过去 24 小时数据
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recent24hTxs = chainTxs.filter(tx => tx.timestamp >= oneDayAgo);

    const txCount24h = recent24hTxs.length;
    const totalGas24h = recent24hTxs.reduce((sum, tx) => sum + (tx.gasFeeNative || 0), 0);
    const totalVolume24h = recent24hTxs.reduce((sum, tx) => sum + (tx.amountNative || 0), 0);

    const walletLabel = activeWallet ? ` (Wallet_${activeWallet.index + 1})` : '';

    let text = `📑 <b>${I18nService.t('billing.title', lang)}</b> ｜ <b>${chainName}${walletLabel}</b>\n\n`;
    text += `${I18nService.t('billing.past24h', lang, { txCount: txCount24h.toString(), volume: totalVolume24h.toFixed(4) + ' ' + nativeSymbol, gas: totalGas24h.toFixed(4) + ' ' + nativeSymbol })}\n\n`;

    if (chainTxs.length === 0) {
      text += `💡 <i>${I18nService.t('billing.noRecords', lang)}</i>`;
    } else {
      text += `${I18nService.t('billing.recentTx', lang, { count: Math.min(chainTxs.length, 10).toString() })}\n\n`;
      const displayTxs = chainTxs.slice(0, 10);
      displayTxs.forEach((tx, i) => {
        const timeStr = new Date(tx.timestamp).toISOString().slice(5, 19).replace('T', ' ');
        const typeIcon = tx.type === 'BUY' ? '🟢' : (tx.type === 'SELL' ? '🔴' : '🔄');
        const typeLabel = tx.type === 'BUY' ? I18nService.t('billing.typeBuy', lang) : (tx.type === 'SELL' ? I18nService.t('billing.typeSell', lang) : I18nService.t('billing.typeTransfer', lang));
        const txUrl = this.getChainTxUrl(tx.chain || c, tx.txHash);
        const shortHash = tx.txHash.length > 16 ? `${tx.txHash.slice(0, 8)}...${tx.txHash.slice(-6)}` : tx.txHash;

        text += `${i + 1}. ${typeIcon} <b>[${typeLabel}] ${tx.tokenSymbol}</b>\n`;
        if (tx.type === 'BUY') {
          text += `💸 ${I18nService.t('billing.spent', lang)}: <code>${tx.amountNative.toFixed(4)} ${nativeSymbol}</code> ｜ 📈 ${I18nService.t('billing.got', lang)}: <code>${tx.amountToken.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${tx.tokenSymbol}</code>\n`;
        } else if (tx.type === 'SELL') {
          text += `📉 ${I18nService.t('billing.sold', lang)}: <code>${tx.amountToken.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${tx.tokenSymbol}</code> ｜ 💰 ${I18nService.t('billing.received', lang)}: <code>${tx.amountNative.toFixed(4)} ${nativeSymbol}</code>\n`;
        } else {
          text += `📤 ${I18nService.t('billing.sent', lang)}: <code>${tx.amountNative.toFixed(4)} ${nativeSymbol}</code>\n`;
        }
        text += `⛽️ Gas: <code>${tx.gasFeeNative.toFixed(4)} ${nativeSymbol}</code> ｜ 🕒 <code>${timeStr}</code>\n`;
        text += `🔗 ${I18nService.t('billing.hash', lang)}: <a href="${txUrl}">${shortHash}</a>\n\n`;
      });
    }
    return text;
  }

  public static renderKeyboard(
    chain: string,
    activeWallet?: WalletEntry,
    lang: string = 'en'
  ): InlineKeyboard {

    const c = chain.toLowerCase();
    const kb = new InlineKeyboard();

    // Row 1: Refresh & Back to Wallet
    kb.text(I18nService.t('billing.refreshBilling', lang), 'billing_refresh')
      .text(I18nService.t('billing.backToWallet', lang), 'wallet_refresh')
      .row();

    // Row 2: Block Explorer Link
    if (activeWallet && activeWallet.address) {
      const explorerUrl = this.getChainAddressUrl(c, activeWallet.address);
      kb.url(I18nService.t('billing.fullExplorer', lang), explorerUrl).row();
    }

    // Row 3: Close
    kb.text(I18nService.btnClose(lang), 'menu_close');

    return kb;
  }
}
