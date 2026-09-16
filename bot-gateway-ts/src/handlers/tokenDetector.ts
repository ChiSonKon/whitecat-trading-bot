import { InlineKeyboard } from 'grammy';
import { TokenMarketService } from '../services/tokenMarketService.js';
import { TradeMenu } from '../menus/tradeMenu.js';
import { MainMenu } from './../menus/mainMenu.js';
import { WalletEntry } from '../menus/walletMenu.js';
import { TokenKeyHelper } from '../services/tokenKeyHelper.js';

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
  if (c === 'robinhood') return `https://explorer.mainnet.chain.robinhood.com/address/${address}`;
  if (c === 'arc') return `https://arc-scan.org/address/${address}`;
  return `https://bscscan.com/address/${address}`;
}

import bs58 from 'bs58';

export interface TokenDetectionResult {
  isContract: boolean;
  type: 'evm' | 'solana' | 'sui' | 'aptos' | 'ton' | null;
  address: string;
  chainHint?: string;
}

export class TokenDetector {
  /**
   * 智能嗅探消息文本中的代币合约地址 (CA)
   * 支持任意位置提取 (纯地址、推特链接、DexScreener 链接、Pump.fun 链接、喊单文案等)
   */
  public static sniffTokenContract(text: string): TokenDetectionResult {
    if (!text || typeof text !== 'string') {
      return { isContract: false, type: null, address: '' };
    }

    const trimmed = text.trim();

    // 1. 优先整行完全匹配
    // 1.1 Sui Move Token 结构体 (如 0x9f854...::magma::MAGMA 或 0x2::sui::SUI 或带泛型)
    const moveStructExact = trimmed.match(/^(0x[a-fA-F0-9]{1,66})::([a-zA-Z0-9_]+)(::[a-zA-Z0-9_<>:, ]+)?$/i);
    if (moveStructExact) {
      return { isContract: true, type: 'sui', address: moveStructExact[0], chainHint: 'sui' };
    }

    // 1.2 EVM 合约 (0x 开头 + 40位十六进制)
    const evmExact = trimmed.match(/^0x[a-fA-F0-9]{40}$/i);
    if (evmExact) {
      return { isContract: true, type: 'evm', address: evmExact[0] };
    }

    // 1.3 Sui / Aptos 32 字节原生地址 (0x 开头 + 64位十六进制)
    const moveExact = trimmed.match(/^0x[a-fA-F0-9]{64}$/i);
    if (moveExact) {
      return { isContract: true, type: 'sui', address: moveExact[0], chainHint: 'sui' };
    }

    // 1.4 TON User-Friendly 地址 (EQ, UQ, kQ, 0Q, Ef 开头 + 46位 Base64) 或原始地址 0: / -1:
    const tonExact = trimmed.match(/^(EQ|UQ|kQ|0Q|Ef)[a-zA-Z0-9_-]{46}$/) || trimmed.match(/^(-1|0):[a-fA-F0-9]{64}$/);
    if (tonExact) {
      return { isContract: true, type: 'ton', address: tonExact[0], chainHint: 'ton' };
    }

    // 1.5 Solana Base58 Mint (32~44 字符 Base58，且通过 32-byte Ed25519 校验)
    const solanaExact = trimmed.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    if (solanaExact && !trimmed.startsWith('0x') && !trimmed.startsWith('/')) {
      try {
        const decoded = bs58.decode(trimmed);
        if (decoded.length === 32) {
          return { isContract: true, type: 'solana', address: solanaExact[0], chainHint: 'solana' };
        }
      } catch {}
    }

    // 2. 检查消息内是否嵌入了主流行情/分析平台链接，直接精准提取链与合约
    // 2.1 DexScreener 链接: dexscreener.com/<chain>/<address>
    const dexScreenerMatch = text.match(/dexscreener\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_:.]{32,128})/i);
    if (dexScreenerMatch) {
      const rawChain = dexScreenerMatch[1].toLowerCase();
      const rawAddr = dexScreenerMatch[2];
      const subDetection = this.sniffTokenContract(rawAddr);
      if (subDetection.isContract) {
        return {
          ...subDetection,
          chainHint: this.normalizeChainSlug(rawChain) || subDetection.chainHint
        };
      }
    }

    // 2.2 Pump.fun 链接: pump.fun/coin/<address>
    const pumpMatch = text.match(/pump\.fun\/(?:coin\/)?([1-9A-HJ-NP-Za-km-z]{32,44})/i);
    if (pumpMatch) {
      const candidate = pumpMatch[1];
      try {
        if (bs58.decode(candidate).length === 32) {
          return { isContract: true, type: 'solana', address: candidate, chainHint: 'solana' };
        }
      } catch {}
    }

    // 2.3 各大公链原生区块浏览器链接直达提取
    const explorerUrlMatches: { regex: RegExp; chain: string; type: 'evm' | 'solana' | 'sui' | 'ton' }[] = [
      { regex: /arc-scan\.org\/(?:token|address)\/(0x[a-fA-F0-9]{40})/i, chain: 'arc', type: 'evm' },
      { regex: /bscscan\.com\/(?:token|address)\/(0x[a-fA-F0-9]{40})/i, chain: 'bsc', type: 'evm' },
      { regex: /basescan\.org\/(?:token|address)\/(0x[a-fA-F0-9]{40})/i, chain: 'base', type: 'evm' },
      { regex: /etherscan\.io\/(?:token|address)\/(0x[a-fA-F0-9]{40})/i, chain: 'ethereum', type: 'evm' },
      { regex: /solscan\.io\/(?:token|account)\/([1-9A-HJ-NP-Za-km-z]{32,44})/i, chain: 'solana', type: 'solana' },
      { regex: /suiscan\.xyz\/(?:mainnet|testnet)\/(?:coin|account)\/([0-9a-zA-Z_:<>, ]+)/i, chain: 'sui', type: 'sui' },
      { regex: /tonviewer\.com\/([a-zA-Z0-9_-]{48})/i, chain: 'ton', type: 'ton' }
    ];

    for (const exp of explorerUrlMatches) {
      const m = text.match(exp.regex);
      if (m && m[1]) {
        return { isContract: true, type: exp.type, address: m[1], chainHint: exp.chain };
      }
    }

    // 3. 上下文公链提示词推断 (Chain Hint)
    let contextChainHint: string | undefined = undefined;
    const lowerText = text.toLowerCase();
    if (/(?:^|\W)(arc|sharc|arcat|dyor)(?:\W|$)/i.test(lowerText)) contextChainHint = 'arc';
    else if (/(?:^|\W)(bsc|bnb|binance|pancake)(?:\W|$)/i.test(lowerText)) contextChainHint = 'bsc';
    else if (/(?:^|\W)(base|coinbase)(?:\W|$)/i.test(lowerText)) contextChainHint = 'base';
    else if (/(?:^|\W)(sol|solana|pump|raydium)(?:\W|$)/i.test(lowerText)) contextChainHint = 'solana';
    else if (/(?:^|\W)(sui|suiscan|bluefin)(?:\W|$)/i.test(lowerText)) contextChainHint = 'sui';
    else if (/(?:^|\W)(ton|tonviewer|dedust)(?:\W|$)/i.test(lowerText)) contextChainHint = 'ton';
    else if (/(?:^|\W)(eth|ethereum|uniswap)(?:\W|$)/i.test(lowerText)) contextChainHint = 'ethereum';
    else if (/(?:^|\W)(sei|seitrace)(?:\W|$)/i.test(lowerText)) contextChainHint = 'sei';
    else if (/(?:^|\W)(xlayer|okx)(?:\W|$)/i.test(lowerText)) contextChainHint = 'xlayer';
    else if (/(?:^|\W)(robinhood)(?:\W|$)/i.test(lowerText)) contextChainHint = 'robinhood';

    // 4. 任意位置智能正则嗅探提取 (无边界字符穿透)
    // 4.1 优先探测 Sui Move 结构体: 如 0x...::...
    const embeddedMove = text.match(/(?:^|[^a-zA-Z0-9_])(0x[a-fA-F0-9]{1,66}::[a-zA-Z0-9_]+(?:::[a-zA-Z0-9_<>:, ]+)?)(?![a-zA-Z0-9_])/i);
    if (embeddedMove && embeddedMove[1]) {
      return { isContract: true, type: 'sui', address: embeddedMove[1].trim(), chainHint: contextChainHint || 'sui' };
    }

    // 4.2 探测 TON Friendly 地址 (48 字符)
    const embeddedTon = text.match(/(?:^|[^a-zA-Z0-9_-])((?:EQ|UQ|kQ|0Q|Ef)[a-zA-Z0-9_-]{46})(?![a-zA-Z0-9_-])/);
    if (embeddedTon && embeddedTon[1]) {
      return { isContract: true, type: 'ton', address: embeddedTon[1], chainHint: 'ton' };
    }

    // 4.3 探测 EVM 42 字符合约 (0x + 40 位 hex，后置紧随断言排除 64-hex Sui 原生或 TxHash)
    const embeddedEvm = text.match(/(?:^|[^a-zA-Z0-9])(0x[a-fA-F0-9]{40})(?![a-fA-F0-9])/i);
    if (embeddedEvm && embeddedEvm[1]) {
      return { isContract: true, type: 'evm', address: embeddedEvm[1], chainHint: contextChainHint };
    }

    // 4.4 探测 Sui 66 字符原生地址 (0x + 64 位 hex)
    const embeddedSuiHex = text.match(/(?:^|[^a-zA-Z0-9])(0x[a-fA-F0-9]{64})(?![a-fA-F0-9])/i);
    if (embeddedSuiHex && embeddedSuiHex[1]) {
      return { isContract: true, type: 'sui', address: embeddedSuiHex[1], chainHint: contextChainHint || 'sui' };
    }

    // 4.5 探测 Solana Base58 地址 (32~44 字符 Base58，排除 0x 开头，并通过 32 字节 Ed25519 校验)
    const solanaCandidates = text.match(/(?:^|[^a-zA-Z0-9])([1-9A-HJ-NP-Za-km-z]{32,44})(?![a-zA-Z0-9])/g);
    if (solanaCandidates) {
      for (const item of solanaCandidates) {
        const cleanCandidate = item.replace(/^[^a-zA-Z0-9]+/, '').replace(/[^a-zA-Z0-9]+$/, '');
        if (cleanCandidate.length >= 32 && cleanCandidate.length <= 44 && !cleanCandidate.startsWith('0x')) {
          try {
            const decoded = bs58.decode(cleanCandidate);
            if (decoded.length === 32) {
              return { isContract: true, type: 'solana', address: cleanCandidate, chainHint: 'solana' };
            }
          } catch {}
        }
      }
    }

    return { isContract: false, type: null, address: '' };
  }

  public static isTokenContract(text: string): TokenDetectionResult {
    return this.sniffTokenContract(text);
  }

  public static normalizeChainSlug(slug: string): string | undefined {
    const s = slug.toLowerCase();
    if (s === 'solana' || s === 'sol') return 'solana';
    if (s === 'bsc' || s === 'bnb' || s === 'binance') return 'bsc';
    if (s === 'base') return 'base';
    if (s === 'ethereum' || s === 'eth') return 'ethereum';
    if (s === 'arc') return 'arc';
    if (s === 'sui') return 'sui';
    if (s === 'ton') return 'ton';
    if (s === 'sei') return 'sei';
    if (s === 'xlayer') return 'xlayer';
    if (s === 'robinhood') return 'robinhood';
    if (s === 'aptos') return 'aptos';
    return undefined;
  }

  public static isEvmChain(chain: string): boolean {
    const c = chain.toLowerCase();
    return ['ethereum', 'bsc', 'base', 'robinhood', 'xlayer', 'sei', 'arc'].includes(c);
  }

  public static isChainCompatible(chain: string, detectedType: 'evm' | 'solana' | 'sui' | 'aptos' | 'ton' | null): boolean {
    const c = chain.toLowerCase();
    if (!detectedType) return false;
    if (detectedType === 'evm') {
      return this.isEvmChain(c);
    }
    if (detectedType === 'ton') {
      return c === 'ton';
    }
    if (detectedType === 'solana') {
      return c === 'solana';
    }
    if (detectedType === 'sui') {
      return c === 'sui' || c === 'aptos';
    }
    if (detectedType === 'aptos') {
      return c === 'aptos' || c === 'sui';
    }
    return false;
  }

  public static isValidWalletAddressForChain(chain: string, address: string): boolean {
    const c = chain.toLowerCase();
    const trimmed = address.trim();
    if (this.isEvmChain(c)) {
      return /^0x[a-fA-F0-9]{40}$/i.test(trimmed);
    }
    if (c === 'solana') {
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed) && !trimmed.startsWith('0x');
    }
    if (c === 'ton') {
      return /^(EQ|UQ|kQ|0Q|Ef)[a-zA-Z0-9_-]{46}$/.test(trimmed) || /^(-1|0):[a-fA-F0-9]{64}$/.test(trimmed);
    }
    if (c === 'sui' || c === 'aptos') {
      return /^0x[a-fA-F0-9]{64}$/i.test(trimmed) && !trimmed.includes('::');
    }
    return false;
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
    botUsername?: string,
    tradeConfig?: any
  ): Promise<{ hasWallet: boolean; text: string; keyboard: any }> {
    // 1. 如果当前链钱包数为 0，1:1 模仿 PinkPunk 阻断并提示生成钱包
    if (wallets.length === 0) {
      const isZh = lang === 'zh-hans' || lang === 'zh-hant';
      const text = isZh ? '您当前关联了 0 个钱包(0/10)' : 'You have a total of 0 linked wallets(0/10)';
      const keyboard = MainMenu.renderKeyboard([], lang, chain);
      return { hasWallet: false, text, keyboard };
    }

    // 2. 调用真实的 DexScreener + GoPlus 安全数据服务
    const market = await TokenMarketService.fetchTokenDetails(tokenAddress, chain);
    const activeWallet = wallets.find(w => w.isDefault) || wallets[0];

    // A. 跨链归属判定：如果代币在当前所选链无交易对，但在其它链检测到了有效流动池
    if (market.foundOnCurrentChain === false && market.actualChainId && market.actualChainId !== chain.toLowerCase()) {
      const isZh = lang === 'zh-hans' || lang === 'zh-hant';
      const currentChainName = MainMenu.getChainDisplayName(chain);
      const targetChain = market.actualChainId;
      const targetChainName = MainMenu.getChainDisplayName(targetChain);
      const tokenKey = TokenKeyHelper.register(tokenAddress);

      const text = isZh
        ? `⚠️ <b>代币所属公链提示 (Cross-Chain Notice)</b>\n\n` +
          `🌐 当前所选公链: <b>${currentChainName}</b>\n` +
          `🦄 识别代币: <b>${market.name} (${market.symbol})</b>\n` +
          `📝 合约地址:\n<code>${tokenAddress}</code>\n\n` +
          `💡 该代币在当前 <b>${currentChainName}</b> 链上未检测到流动性池，其实际交易对位于 <b>${targetChainName}</b>。\n` +
          `是否立即切换至 <b>${targetChainName}</b> 链进行交易？`
        : `⚠️ <b>Token Chain Mismatch</b>\n\n` +
          `🌐 Current Chain: <b>${currentChainName}</b>\n` +
          `🦄 Detected Token: <b>${market.name} (${market.symbol})</b>\n` +
          `📝 Contract Address:\n<code>${tokenAddress}</code>\n\n` +
          `💡 No liquidity pair found on <b>${currentChainName}</b>. This token is actively traded on <b>${targetChainName}</b>.\n` +
          `Would you like to switch to <b>${targetChainName}</b> now?`;

      const keyboard = new InlineKeyboard()
        .text(isZh ? `🔄 切换至 ${targetChainName} 交易 ${market.symbol}` : `🔄 Switch to ${targetChainName} & Trade ${market.symbol}`, `switch_to_${targetChain}_${tokenKey}`)
        .row()
        .text(isZh ? `🌐 切换其它公链` : `🌐 Switch Chain`, 'menu_switch_chain')
        .text(isZh ? `🔙 返回主菜单` : `🔙 Return`, 'menu_main');

      return { hasWallet: true, text, keyboard };
    }

    // 智能判定：是否为普通钱包地址 (而非代币合约)
    // 1) Sui / Aptos 链：Move 代币必含 '::'。不含 '::' 且 DexScreener 无流动池且符合 32 字节地址的为钱包地址
    // 2) 其它公链：必须链上明确确证为 EOA (isConfirmedEoa === true) 且无流动池，才识别为普通钱包地址！
    const isChainWallet = this.isValidWalletAddressForChain(chain, tokenAddress);
    const isSuiWallet = (chain.toLowerCase() === 'sui' || chain.toLowerCase() === 'aptos') &&
      !tokenAddress.includes('::') &&
      (!market.pairAddress || market.name === 'Unknown Token' || market.priceNative === 0) &&
      isChainWallet;

    // 严禁未收录合约或 RPC 临时离线被误杀！只有当链上 RPC 成功返回且确证 code 为 0x 时才判定为 EOA 钱包
    const isGeneralWallet = market.isConfirmedEoa === true &&
      !market.pairAddress &&
      !market.isContract &&
      isChainWallet;

    if (isSuiWallet || isGeneralWallet) {
      const isZh = lang === 'zh-hans' || lang === 'zh-hant';
      const chainName = MainMenu.getChainDisplayName(chain);
      const nativeSymbol = MainMenu.getChainNativeSymbol(chain);
      const explorerUrl = getChainAccountUrl(chain, tokenAddress);
      const tokenKey = TokenKeyHelper.register(tokenAddress);

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
        .text(isZh ? `🪙 作为代币交易 (强制)` : `🪙 Trade as Token`, `trade_force_${tokenKey}`)
        .url(isZh ? `🔍 区块链浏览器` : `🔍 Explorer`, explorerUrl)
        .row()
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

    const currentHoldingNative = (userHolding > 0 && currentPriceNative > 0)
      ? userHolding * currentPriceNative
      : userHoldingNative;

    const text = TradeMenu.renderText({
      market,
      chain,
      walletName: `Wallet_${activeWallet.index + 1}`,
      walletAddress: activeWallet.address,
      walletBalance: activeWallet.balance !== undefined ? activeWallet.balance : 0,
      userHolding,
      userHoldingNative: currentHoldingNative,
      pnlNative,
      pnlPct,
      lang,
      userId,
      botUsername
    });

    const keyboard = TradeMenu.renderKeyboard(chain, tokenAddress, lang, tradeConfig);
    return { hasWallet: true, text, keyboard };
  }
}
