import { InlineKeyboard } from 'grammy';
import { TokenMarketService } from '../services/tokenMarketService.js';
import { TradeMenu } from '../menus/tradeMenu.js';
import { MainMenu } from './../menus/mainMenu.js';
import { WalletEntry } from '../menus/walletMenu.js';

export function getChainAccountUrl(chain: string, address: string): string {
  const c = chain.toLowerCase();
  if (c === 'solana') return `https://solscan.io/account/${address}`;
  if (c === 'ethereum') return `https://etherscan.io/address/${address}`;
  if (c === 'base') return `https://basescan.org/address/${address}`;
  if (c === 'sui') return `https://suiscan.xyz/mainnet/account/${address}`;
  if (c === 'ton') return `https://tonviewer.com/${address}`;
  if (c === 'aptos') return `https://explorer.aptoslabs.com/account/${address}?network=mainnet`;
  if (c === 'xlayer') return `https://www.okx.com/zh-hans/explorer/xlayer/address/${address}`;
  if (c === 'sei') return `https://seitrace.com/address/${address}`;
  return `https://bscscan.com/address/${address}`;
}

export class TokenDetector {
  public static isTokenContract(text: string): {
    isContract: boolean;
    type: 'evm' | 'solana' | 'sui' | 'aptos' | 'ton' | null;
    address: string;
  } {
    const trimmed = text.trim();

    // 1. 优先匹配 Sui Move Token 结构体 (如 0x9f854...::magma::MAGMA 或 0x2::sui::SUI 或带泛型)
    const moveStructMatch = trimmed.match(/^(0x[a-fA-F0-9]{1,66})::([a-zA-Z0-9_]+)(::[a-zA-Z0-9_<>:, ]+)?$/i);
    if (moveStructMatch) {
      return { isContract: true, type: 'sui', address: moveStructMatch[0] };
    }

    // 2. 匹配 EVM 合约 (0x 开头 + 40位十六进制)
    const evmMatch = trimmed.match(/^0x[a-fA-F0-9]{40}$/);
    if (evmMatch) {
      return { isContract: true, type: 'evm', address: evmMatch[0] };
    }

    // 3. 匹配 Sui / Aptos 32 字节原生地址 (0x 开头 + 64位十六进制)
    const moveMatch = trimmed.match(/^0x[a-fA-F0-9]{64}$/i);
    if (moveMatch) {
      return { isContract: true, type: 'sui', address: moveMatch[0] };
    }

    // 4. 匹配 TON User-Friendly 地址 (EQ 或 UQ 开头 + 46位 Base64)
    const tonMatch = trimmed.match(/^(EQ|UQ)[a-zA-Z0-9_-]{46}$/);
    if (tonMatch) {
      return { isContract: true, type: 'ton', address: tonMatch[0] };
    }

    // 5. 匹配 Solana Base58 Mint (32~44 字符 Base58)
    const solanaMatch = trimmed.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    if (solanaMatch && !trimmed.startsWith('0x') && !trimmed.startsWith('/') && trimmed.length >= 32) {
      return { isContract: true, type: 'solana', address: solanaMatch[0] };
    }

    return { isContract: false, type: null, address: '' };
  }

  public static async analyzeAndBuildView(
    chain: string,
    tokenAddress: string,
    wallets: WalletEntry[],
    lang: string = 'en',
    userHolding: number = 0,
    userHoldingNative: number = 0,
    boughtNative: number = 0,
    soldNative: number = 0,
    userId?: number,
    botUsername?: string
  ): Promise<{ hasWallet: boolean; text: string; keyboard: any }> {
    // 1. 如果当前链钱包数为 0，1:1 模仿 PinkPunk 阻断并提示生成钱包
    if (wallets.length === 0) {
      const isZh = lang === 'zh-hans' || lang === 'zh-hant';
      const text = isZh ? '您当前关联了 0 个钱包(0/10)' : 'You have a total of 0 linked wallets(0/10)';
      const keyboard = MainMenu.renderKeyboard([], lang);
      return { hasWallet: false, text, keyboard };
    }

    // 2. 调用真实的 DexScreener + GoPlus 安全数据服务
    const market = await TokenMarketService.fetchTokenDetails(tokenAddress, chain);
    const activeWallet = wallets.find(w => w.isDefault) || wallets[0];

    // 智能判定：是否为普通钱包地址 (而非代币合约)
    // 1) Sui / Aptos 链：Move 代币必含 '::' (如 0x...::coin::COIN)。不含 '::' 且 DexScreener 无流动池的均为钱包地址
    // 2) 其它公链：DexScreener 无流动池且无价格，且符合钱包/账号地址格式的，一律智能识别为钱包地址
    const isSuiWallet = (chain.toLowerCase() === 'sui' || chain.toLowerCase() === 'aptos') &&
      !tokenAddress.includes('::') &&
      (!market.pairAddress || market.name === 'Unknown Token' || market.priceNative === 0);

    const isGeneralWallet = !market.pairAddress &&
      market.name === 'Unknown Token' &&
      market.priceNative === 0 &&
      (tokenAddress.startsWith('0x') || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tokenAddress));

    if (isSuiWallet || isGeneralWallet) {
      const isZh = lang === 'zh-hans' || lang === 'zh-hant';
      const chainName = MainMenu.getChainDisplayName(chain);
      const nativeSymbol = MainMenu.getChainNativeSymbol(chain);
      const explorerUrl = getChainAccountUrl(chain, tokenAddress);

      const text = isZh
        ? `👛 <b>已识别钱包地址</b>\n\n` +
          `🌐 所在链: <b>${chainName}</b>\n` +
          `📥 钱包地址:\n<code>${tokenAddress}</code>\n\n` +
          `💳 当前钱包: <b>Wallet_${activeWallet.index + 1} (${activeWallet.balance ?? 0} ${nativeSymbol})</b>\n\n` +
          `💡 <i>请选择您要执行的操作：</i>`
        : `👛 <b>Wallet Address Detected</b>\n\n` +
          `🌐 Chain: <b>${chainName}</b>\n` +
          `📥 Address:\n<code>${tokenAddress}</code>\n\n` +
          `💳 Current Wallet: <b>Wallet_${activeWallet.index + 1} (${activeWallet.balance ?? 0} ${nativeSymbol})</b>\n\n` +
          `💡 <i>Please select an action:</i>`;

      const keyboard = new InlineKeyboard()
        .text(isZh ? `💸 向此地址转账 ${nativeSymbol}` : `💸 Transfer ${nativeSymbol}`, `transfer_to_${tokenAddress}`)
        .text(isZh ? `👥 开启跟单监控` : `👥 Copy Trade`, `copy_add_${tokenAddress}`)
        .row()
        .url(isZh ? `🔍 区块链浏览器` : `🔍 Explorer`, explorerUrl)
        .text(isZh ? `🔙 返回主菜单` : `🔙 Return`, 'menu_main');

      return { hasWallet: true, text, keyboard };
    }

    let currentPriceNative = market.priceNative > 0 ? market.priceNative : 0;
    if (currentPriceNative <= 0 && market.priceUsd > 0 && market.nativePriceUsd > 0) {
      currentPriceNative = market.priceUsd / market.nativePriceUsd;
    }
    const entryPriceNative = (userHolding > 0 && boughtNative > 0)
      ? (userHoldingNative > 0 ? userHoldingNative : boughtNative) / userHolding
      : 0;
    if (currentPriceNative <= 0) {
      currentPriceNative = entryPriceNative;
    }

    let pnlNative = 0;
    let pnlPct = 0;
    if (boughtNative > 0) {
      const holdingVal = userHolding * currentPriceNative;
      pnlNative = (holdingVal + soldNative) - boughtNative;
      if (Math.abs(currentPriceNative - entryPriceNative) / (entryPriceNative || 1) < 0.0005) {
        pnlNative = 0;
        pnlPct = 0;
      } else {
        pnlPct = (pnlNative / boughtNative) * 100;
      }
    }

    const text = TradeMenu.renderText({
      market,
      chain,
      walletName: `Wallet_${activeWallet.index + 1}`,
      walletAddress: activeWallet.address,
      walletBalance: activeWallet.balance !== undefined ? activeWallet.balance : 0,
      userHolding,
      userHoldingNative,
      pnlNative,
      pnlPct,
      lang,
      userId,
      botUsername
    });

    const keyboard = TradeMenu.renderKeyboard(chain, tokenAddress, lang);
    return { hasWallet: true, text, keyboard };
  }
}
