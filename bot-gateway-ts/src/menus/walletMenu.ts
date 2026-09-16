import { InlineKeyboard } from 'grammy';
import { MainMenu } from './mainMenu.js';
import { I18nService } from '../services/i18nService.js';

export interface WalletEntry {
  index: number;
  address: string;
  isDefault: boolean;
  balance: number;
  lastOnChainBalance?: number;
  symbol: string;
  privateKey?: string;
  encryptedPrivateKey?: string;
  nonceIv?: string;
  name?: string;
  label?: string;
}

export class WalletMenu {
  public static renderText(chain: string, wallets: WalletEntry[], lang: string = 'en'): string {
    const chainName = MainMenu.getChainDisplayName(chain);
    const nativeSymbol = MainMenu.getChainNativeSymbol(chain);
    const currentChainLine = I18nService.getMainCurrentChain(lang, chainName);
    const activeWallet = wallets.find(w => w.isDefault) || wallets[0];

    if (!activeWallet) {
      const zeroText = I18nService.getMainZeroWallets(lang);
      return `${currentChainLine}\n\n${zeroText}`;
    }

    const balStr = activeWallet.balance !== undefined ? activeWallet.balance : 0;
    const displayName = activeWallet.name || activeWallet.label || `Wallet_${activeWallet.index + 1}`;
    return (
      `${currentChainLine}\n\n` +
      `${displayName}: ${balStr} ${nativeSymbol} \n` +
      `<code>${activeWallet.address}</code>`
    );
  }

  public static renderKeyboard(wallets: WalletEntry[], lang: string = 'en', chain: string = 'bsc'): InlineKeyboard {
    const activeWallet = wallets.find(w => w.isDefault) || wallets[0] || { index: 0 };
    const wName = activeWallet.name || activeWallet.label || `Wallet_${activeWallet.index + 1}`;
    const nativeSymbol = MainMenu.getChainNativeSymbol(chain);

    const kb = new InlineKeyboard();

    // Row 1: Wallet switch & rename
    kb.text(`${wName} 🔀`, 'switch_wallet')
      .text(`✏️ ${wName}`, 'rename_wallet')
      .row();

    // Row 2: Create & Import
    kb.text(I18nService.btnCreateWallet(lang), 'create_wallet')
      .text(I18nService.btnImportWallet(lang), 'import_wallet')
      .row();

    // Row 3: Export key & Delete
    kb.text(I18nService.btnExportKey(lang), 'export_private_key')
      .text(I18nService.btnDeleteWallet(lang), 'delete_wallet')
      .row();

    // Row 4: Transfer & Billing
    kb.text(I18nService.btnTransferNative(lang, nativeSymbol), 'transfer_native')
      .text(I18nService.btnBilling(lang), 'wallet_billing')
      .row();

    // Row 5: Return to Main
    kb.text(I18nService.btnBack(lang), 'menu_main');

    return kb;
  }
}
