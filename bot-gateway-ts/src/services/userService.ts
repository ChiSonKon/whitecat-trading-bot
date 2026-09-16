import { decodeStore, writeStoreAtomic } from './encryptedStore.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { WalletEntry } from '../menus/walletMenu.js';
import { TradeConfig } from '../menus/settingsMenu.js';
import { LimitOrderItem } from '../menus/limitOrderMenu.js';
import { UserTransactionRecord } from '../menus/billingMenu.js';
import { TokenKeyHelper } from './tokenKeyHelper.js';
import { ChainBalanceService } from './chainBalanceService.js';

import { fileURLToPath } from 'url';

export interface PendingAction {
  type: 'buy_x' | 'sell_x' | 'query_ca' | 'add_copy' | 'transfer_native' | 'transfer_native_amount' | 'transfer_token' | 'transfer_token_to' | 'transfer_token_amount' | 'set_tip' | 'rename_wallet' | 'set_buy_preset' | 'set_sell_preset' | 'add_limit_order' | 'import_wallet';
  data?: any;
  createdAt?: number;
}

export interface UserTokenHolding {
  tokenAddress: string;
  chain: string;
  symbol: string;
  name: string;
  amount: number;
  costNative: number;
  totalBoughtNative?: number;
  totalSoldNative?: number;
}

export interface UserState {
  userId: number;
  username: string;
  activeChain: string;
  lang: string;
  onboarded?: boolean;
  walletsByChain: Map<string, WalletEntry[]>;
  tokenHoldings: Map<string, UserTokenHolding>;
  referralCode: string;
  inviterId?: number;
  invitedCount: number;
  tradedUsersCount: number;
  tradeCount: number;
  tradeVolume: number;
  totalEarned: number;
  claimableCommission: number;
  claimedCommission: number;
  monitoredWallets: string[];
  limitOrders: LimitOrderItem[];
  tradeConfig: TradeConfig;
  pendingAction?: PendingAction;
  transactions: UserTransactionRecord[];
  // MCP 智能体接入凭据与安全管控
  mcpToken?: string;
  mcpAutoTradeEnabled?: boolean;
  mcpMaxTradeLimit?: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = process.env.USER_STORE_FILE || path.join(__dirname, '../../data/user_store.json');
export const userStore = new Map<number, UserState>();

export function generateRandomHex(len: number): string {
  let s = '';
  const hexChars = '0123456789abcdef';
  for (let i = 0; i < len; i++) {
    s += hexChars[Math.floor(Math.random() * 16)];
  }
  return s;
}

export function generateMcpToken(): string {
  return `wc_sec_${crypto.randomBytes(32).toString('hex')}`;
}

export function generateUniqueReferralCode(): string {
  while (true) {
    const code = `WC${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    let collision = false;
    for (const u of userStore.values()) {
      if (u.referralCode === code) {
        collision = true;
        break;
      }
    }
    if (!collision) return code;
  }
}

let isStoreWriting = false;
let hasPendingStoreSave = false;

function executeSaveUserStoreSync(): void {
  const rawObj: Record<string, any> = {};
  userStore.forEach((user, uid) => {
    const walletsObj: Record<string, WalletEntry[]> = {};
    if (user.walletsByChain instanceof Map) {
      user.walletsByChain.forEach((wl, ch) => {
        walletsObj[ch] = wl;
      });
    } else if (user.walletsByChain && typeof user.walletsByChain === 'object') {
      Object.assign(walletsObj, user.walletsByChain);
    }
    const holdingsObj: Record<string, any> = {};
    if (user.tokenHoldings instanceof Map) {
      user.tokenHoldings.forEach((h, ca) => {
        holdingsObj[ca] = {
          tokenAddress: h.tokenAddress,
          chain: h.chain,
          symbol: h.symbol,
          name: h.name,
          amount: h.amount,
          costNative: h.costNative,
          totalBoughtNative: h.totalBoughtNative ?? h.costNative ?? 0,
          totalSoldNative: h.totalSoldNative ?? 0
        };
      });
    } else if (user.tokenHoldings && typeof user.tokenHoldings === 'object') {
      Object.assign(holdingsObj, user.tokenHoldings);
    }
    rawObj[uid.toString()] = {
      userId: user.userId,
      username: user.username,
      activeChain: user.activeChain,
      lang: user.lang,
      onboarded: user.onboarded ?? true,
      walletsByChain: walletsObj,
      tokenHoldings: holdingsObj,
      referralCode: user.referralCode,
      inviterId: user.inviterId,
      invitedCount: user.invitedCount || 0,
      tradedUsersCount: user.tradedUsersCount || 0,
      tradeCount: user.tradeCount || 0,
      tradeVolume: user.tradeVolume || 0,
      totalEarned: user.totalEarned || 0,
      claimableCommission: user.claimableCommission || 0,
      claimedCommission: user.claimedCommission || 0,
      monitoredWallets: user.monitoredWallets,
      limitOrders: user.limitOrders,
      tradeConfig: user.tradeConfig,
      pendingAction: user.pendingAction,
      transactions: user.transactions || [],
      mcpToken: user.mcpToken,
      mcpAutoTradeEnabled: user.mcpAutoTradeEnabled !== false,
      mcpMaxTradeLimit: user.mcpMaxTradeLimit ?? 0.5
    };
  });
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  writeStoreAtomic(DATA_FILE, rawObj);
}

export function saveUserStore(): void {
  try {
    if (isStoreWriting) {
      hasPendingStoreSave = true;
      return;
    }
    isStoreWriting = true;
    try {
      do {
        hasPendingStoreSave = false;
        executeSaveUserStoreSync();
      } while (hasPendingStoreSave);
    } finally {
      isStoreWriting = false;
    }
  } catch (err: any) {
    throw new Error('Failed to persist encrypted user store', { cause: err });
  }
}

export function loadUserStore(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const { data, legacy } = decodeStore(fs.readFileSync(DATA_FILE, 'utf-8'));
      if (legacy) writeStoreAtomic(DATA_FILE, data);
      for (const uidStr of Object.keys(data)) {
        const u = data[uidStr];
        const uid = parseInt(uidStr, 10);
        const walletsByChain = new Map<string, WalletEntry[]>();
        if (u.walletsByChain) {
          for (const [ch, wl] of Object.entries(u.walletsByChain)) {
            walletsByChain.set(ch, wl as WalletEntry[]);
          }
        }
        const tokenHoldings = new Map<string, UserTokenHolding>();
        if (u.tokenHoldings) {
          for (const [ca, item] of Object.entries(u.tokenHoldings)) {
            const canonicalCa = TokenKeyHelper.toAddress(ca).toLowerCase();
            if (typeof item === 'number') {
              tokenHoldings.set(canonicalCa, {
                tokenAddress: TokenKeyHelper.toAddress(ca),
                chain: u.activeChain || 'sui',
                symbol: 'TOKEN',
                name: 'Token',
                amount: item,
                costNative: 0.1,
                totalBoughtNative: 0.1,
                totalSoldNative: 0
              });
            } else if (item && typeof item === 'object') {
              const hObj = item as any;
              tokenHoldings.set(canonicalCa, {
                tokenAddress: hObj.tokenAddress || TokenKeyHelper.toAddress(ca),
                chain: hObj.chain || u.activeChain || 'sui',
                symbol: hObj.symbol || 'TOKEN',
                name: hObj.name || 'Token',
                amount: hObj.amount || 0,
                costNative: hObj.costNative || 0,
                totalBoughtNative: hObj.totalBoughtNative ?? hObj.costNative ?? 0,
                totalSoldNative: hObj.totalSoldNative ?? 0
              });
            }
          }
        }
        const transactions: UserTransactionRecord[] = Array.isArray(u.transactions) ? u.transactions : [];
        const isActionValid = u.pendingAction && (!u.pendingAction.createdAt || (Date.now() - u.pendingAction.createdAt < 3600 * 1000));
        userStore.set(uid, {
          userId: u.userId,
          username: u.username || 'trader',
          activeChain: u.activeChain || 'bsc',
          lang: u.lang || 'zh-hans',
          onboarded: u.onboarded !== undefined ? u.onboarded : true,
          walletsByChain,
          tokenHoldings,
          referralCode: u.referralCode || generateUniqueReferralCode(),
          inviterId: u.inviterId,
          invitedCount: u.invitedCount || 0,
          tradedUsersCount: u.tradedUsersCount || 0,
          tradeCount: u.tradeCount || 0,
          tradeVolume: u.tradeVolume || 0,
          totalEarned: u.totalEarned || 0,
          claimableCommission: u.claimableCommission || 0,
          claimedCommission: u.claimedCommission || 0,
          monitoredWallets: u.monitoredWallets || [],
          limitOrders: u.limitOrders || [],
          transactions,
          pendingAction: isActionValid ? u.pendingAction : undefined,
          tradeConfig: u.tradeConfig || {
            mode: 'fast',
            gasTip: 0.001,
            slippage: 50,
            antiMev: true,
            buyPresets: [0.02, 0.05, 0.1, 0.2, 0.5],
            sellPresets: [50, 100]
          },
          mcpToken: u.mcpToken || generateMcpToken(),
          mcpAutoTradeEnabled: u.mcpAutoTradeEnabled !== false,
          mcpMaxTradeLimit: u.mcpMaxTradeLimit ?? 0.5
        });
      }
      console.log(`[UserStore] Loaded ${userStore.size} users from ${DATA_FILE}`);
    }
  } catch (err: any) {
    throw new Error('Cannot load user store; refusing to start with empty wallets', { cause: err });
  }
}

// 首次自动加载用户状态
loadUserStore();

export function getOrCreateUser(userId: number | string, username: string = 'trader'): UserState {
  const numId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  if (!Number.isSafeInteger(numId) || numId <= 0) throw new Error('Invalid Telegram user ID');
  let user = userStore.get(numId);
  if (!user) {
    user = {
      userId: numId,
      username,
      activeChain: 'bsc',
      lang: 'zh-hans',
      onboarded: false,
      walletsByChain: new Map<string, WalletEntry[]>(),
      tokenHoldings: new Map<string, UserTokenHolding>(),
      transactions: [],
      referralCode: generateUniqueReferralCode(),
      inviterId: undefined,
      invitedCount: 0,
      tradedUsersCount: 0,
      tradeCount: 0,
      tradeVolume: 0.0,
      totalEarned: 0.0,
      claimableCommission: 0.0,
      claimedCommission: 0.0,
      monitoredWallets: [],
      limitOrders: [],
      tradeConfig: {
        mode: 'fast',
        gasTip: 0.001,
        slippage: 50,
        antiMev: true,
        buyPresets: [0.02, 0.05, 0.1, 0.2, 0.5],
        sellPresets: [50, 100]
      },
      mcpToken: generateMcpToken(),
      mcpAutoTradeEnabled: true,
      mcpMaxTradeLimit: 0.5
    };
    userStore.set(numId, user);
    saveUserStore();
  }
  if (!user.transactions) {
    user.transactions = [];
  }
  if (!user.mcpToken) {
    user.mcpToken = generateMcpToken();
    saveUserStore();
  }
  return user;
}

export function getUserWallets(user: UserState, chain?: string): WalletEntry[] {
  const c = (chain || user.activeChain).toLowerCase();
  if (!user.walletsByChain.has(c)) {
    user.walletsByChain.set(c, []);
  }
  return user.walletsByChain.get(c)!;
}

export async function syncWalletBalances(user: UserState, chain?: string): Promise<void> {
  const targetChain = (chain || user.activeChain).toLowerCase();
  const wallets = getUserWallets(user, targetChain);
  if (wallets.length === 0) return;

  await Promise.all(
    wallets.map(async w => {
      try {
        const onChainBal = await ChainBalanceService.getNativeBalance(targetChain, w.address);
        if (typeof onChainBal === 'number' && !isNaN(onChainBal)) {
          if (onChainBal > 0 || (w.lastOnChainBalance !== undefined && w.lastOnChainBalance > 0) || w.privateKey) {
            w.balance = parseFloat(onChainBal.toFixed(4));
            w.lastOnChainBalance = onChainBal;
          } else if (w.balance === undefined) {
            w.balance = onChainBal;
            w.lastOnChainBalance = onChainBal;
          }
        }
      } catch (err: any) {
        console.warn(`[SyncBalance] Failed for ${w.address}:`, err?.message);
      }
    })
  );
  if (targetChain === 'sui') {
    await syncTokenHoldings(user, targetChain).catch(() => {});
  }
  saveUserStore();
}

export async function syncTokenHoldings(user: UserState, chain?: string, specificTokenAddress?: string): Promise<void> {
  const targetChain = (chain || user.activeChain).toLowerCase();

  const evmChains = ['bsc', 'base', 'ethereum', 'robinhood', 'sei', 'xlayer', 'arc'];
  if (evmChains.includes(targetChain)) {
    const targetWallets = getUserWallets(user, targetChain);
    const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];
    if (!targetWallet) return;

    try {
      const { OnChainSwapService } = await import('./onChainSwapService.js');
      const { TokenMarketService } = await import('./tokenMarketService.js');

      // 1. 如果指定了特定的代币地址，确保将其纳入待同步集合
      const tokensToQuery = new Map<string, string>(); // lowerCa -> originalTokenAddress
      if (specificTokenAddress && specificTokenAddress.startsWith('0x') && specificTokenAddress.length === 42) {
        tokensToQuery.set(specificTokenAddress.toLowerCase(), specificTokenAddress);
      }
      for (const [key, holding] of user.tokenHoldings.entries()) {
        if (holding.chain.toLowerCase() === targetChain && holding.tokenAddress) {
          tokensToQuery.set(key.toLowerCase(), holding.tokenAddress);
        }
      }

      const cleanAddr = targetWallet.address.toLowerCase().replace('0x', '').padStart(64, '0');
      const balData = `0x70a08231${cleanAddr}`;

      for (const [lowerCa, tokenAddr] of tokensToQuery.entries()) {
        try {
          const balHex = await OnChainSwapService.callEvmRpc(targetChain, 'eth_call', [
            { to: tokenAddr, data: balData },
            'latest'
          ]);
          if (balHex && typeof balHex === 'string' && balHex !== '0x') {
            const rawBal = BigInt(balHex);
            let decimals = 18;
            try {
              const decHex = await OnChainSwapService.callEvmRpc(targetChain, 'eth_call', [
                { to: tokenAddr, data: '0x313ce567' },
                'latest'
              ]);
              if (decHex && typeof decHex === 'string' && decHex !== '0x') {
                decimals = parseInt(decHex, 16) || 18;
              }
            } catch {}

            const tokenAmount = Number(rawBal) / Math.pow(10, decimals);
            const existing = user.tokenHoldings.get(lowerCa);

            if (tokenAmount > 1e-6) {
              if (existing) {
                existing.amount = tokenAmount;
                user.tokenHoldings.set(lowerCa, existing);
              } else {
                // 自动补齐元数据
                let symbol = 'TOKEN';
                let name = 'Token';
                try {
                  const meta = await TokenMarketService.fetchTokenDetails(tokenAddr, targetChain);
                  if (meta?.symbol) symbol = meta.symbol;
                  if (meta?.name) name = meta.name;
                } catch {}
                user.tokenHoldings.set(lowerCa, {
                  tokenAddress: tokenAddr,
                  chain: targetChain,
                  symbol,
                  name,
                  amount: tokenAmount,
                  costNative: 0,
                  totalBoughtNative: 0,
                  totalSoldNative: 0
                });
              }
            } else if (existing) {
              user.tokenHoldings.delete(lowerCa);
            }
          }
        } catch {}
      }
      saveUserStore();
    } catch (err: any) {
      console.warn(`[SyncHoldings] EVM token sync error:`, err?.message);
    }
    return;
  }

  // Solana 链支持
  if (targetChain === 'solana') {
    const targetWallets = getUserWallets(user, targetChain);
    const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];
    if (!targetWallet) return;

    try {
      const { OnChainSwapService } = await import('./onChainSwapService.js');
      const { TokenMarketService } = await import('./tokenMarketService.js');

      // 1. 若指定特定 mint，优先定向查询
      if (specificTokenAddress && specificTokenAddress.length >= 32) {
        try {
          const accs = await OnChainSwapService.callSolanaRpc('getTokenAccountsByOwner', [
            targetWallet.address,
            { mint: specificTokenAddress },
            { encoding: 'jsonParsed' }
          ]);
          const tokenAcc = accs?.value?.[0];
          const tokenAmount = tokenAcc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
          const lowerCa = specificTokenAddress.toLowerCase();
          const existing = user.tokenHoldings.get(lowerCa);

          if (tokenAmount > 1e-6) {
            if (existing) {
              existing.amount = tokenAmount;
              user.tokenHoldings.set(lowerCa, existing);
            } else {
              let symbol = 'TOKEN';
              let name = 'Token';
              try {
                const meta = await TokenMarketService.fetchTokenDetails(specificTokenAddress, 'solana');
                if (meta?.symbol) symbol = meta.symbol;
                if (meta?.name) name = meta.name;
              } catch {}
              user.tokenHoldings.set(lowerCa, {
                tokenAddress: specificTokenAddress,
                chain: 'solana',
                symbol,
                name,
                amount: tokenAmount,
                costNative: 0,
                totalBoughtNative: 0,
                totalSoldNative: 0
              });
            }
          } else if (existing) {
            user.tokenHoldings.delete(lowerCa);
          }
        } catch {}
      }

      // 2. 同时遍历已记录的 Solana 代币
      for (const [key, holding] of user.tokenHoldings.entries()) {
        if (holding.chain.toLowerCase() === 'solana') {
          try {
            const accs = await OnChainSwapService.callSolanaRpc('getTokenAccountsByOwner', [
              targetWallet.address,
              { mint: holding.tokenAddress },
              { encoding: 'jsonParsed' }
            ]);
            const tokenAcc = accs?.value?.[0];
            const tokenAmount = tokenAcc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
            if (tokenAmount > 1e-6) {
              holding.amount = tokenAmount;
            } else {
              user.tokenHoldings.delete(key);
            }
          } catch {}
        }
      }
      saveUserStore();
    } catch (err: any) {
      console.warn(`[SyncHoldings] Solana token sync error:`, err?.message);
    }
    return;
  }

  if (targetChain !== 'sui') return;

  const targetWallets = getUserWallets(user, targetChain);
  const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];
  if (!targetWallet) return;

  try {
    const { Config } = await import('@bluefin-exchange/bluefin7k-aggregator-sdk');
    const client = Config.getSuiClient();
    const balances: any = await (client as any).listBalances({ owner: targetWallet.address });

    const activeTokens = new Set<string>();

    if (balances && Array.isArray(balances.balances)) {
      for (const item of balances.balances) {
        const coinType: string = item.coinType;
        if (coinType === '0x2::sui::SUI' || coinType.endsWith('::sui::SUI')) continue;

        const rawBalance = BigInt(item.balance || '0');
        const lowerCa = coinType.toLowerCase();

        if (rawBalance > 0n) {
          let decimals = 9;
          let symbol = 'TOKEN';
          let name = 'Token';
          try {
            const metaRes: any = await (client as any).getCoinMetadata({ coinType });
            const meta = metaRes?.coinMetadata || metaRes;
            if (meta) {
              decimals = meta.decimals ?? 9;
              symbol = meta.symbol ?? 'TOKEN';
              name = meta.name ?? 'Token';
            }
          } catch {}

          const tokenAmount = Number(rawBalance) / Math.pow(10, decimals);
          if (tokenAmount > 1e-4) {
            activeTokens.add(lowerCa);
            const existing = user.tokenHoldings.get(lowerCa);
            user.tokenHoldings.set(lowerCa, {
              tokenAddress: coinType,
              chain: 'sui',
              symbol: existing?.symbol || symbol,
              name: existing?.name || name,
              amount: tokenAmount,
              costNative: existing?.costNative || 0.2,
              totalBoughtNative: existing?.totalBoughtNative || 0.2,
              totalSoldNative: existing?.totalSoldNative || 0
            });
          }
        }
      }
    }

    for (const [key, holding] of user.tokenHoldings.entries()) {
      if (holding.chain === 'sui' && !activeTokens.has(key)) {
        user.tokenHoldings.delete(key);
      }
    }

    saveUserStore();
  } catch (err: any) {
    console.warn(`[SyncHoldings] Real Sui tokens sync error:`, err?.message);
  }
}

export function recordUserTransaction(user: UserState, tx: {
  chain: string;
  type: 'BUY' | 'SELL' | 'TRANSFER';
  walletAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;
  amountNative: number;
  amountToken: number;
  gasFeeNative?: number;
  txHash: string;
  status?: 'SUCCESS' | 'FAILED' | 'PENDING';
  isRealOnChain?: boolean;
}): void {
  if (!user.transactions) {
    user.transactions = [];
  }
  const gasDefaults: Record<string, number> = {
    sui: 0.000191,
    solana: 0.00005,
    bsc: 0.00035,
    ethereum: 0.0015,
    base: 0.00003,
    robinhood: 0.00002,
    arc: 0.001,
    ton: 0.005,
    aptos: 0.0008,
    sei: 0.001,
    xlayer: 0.0002
  };
  const gas = tx.gasFeeNative !== undefined ? tx.gasFeeNative : (gasDefaults[tx.chain.toLowerCase()] || 0.0002);
  user.transactions.unshift({
    id: tx.txHash || crypto.randomUUID(),
    chain: tx.chain,
    walletAddress: tx.walletAddress,
    type: tx.type,
    tokenAddress: tx.tokenAddress,
    tokenSymbol: tx.tokenSymbol,
    tokenName: tx.tokenName,
    amountNative: tx.amountNative,
    amountToken: tx.amountToken,
    gasFeeNative: gas,
    txHash: tx.txHash,
    timestamp: Date.now(),
    status: tx.status || 'SUCCESS',
    isRealOnChain: tx.isRealOnChain
  });
  if (user.transactions.length > 100) {
    user.transactions = user.transactions.slice(0, 100);
  }
  saveUserStore();
}

export function processTradeReferralAndFee(user: UserState, tradeAmountNative: number): void {
  const fee = tradeAmountNative * 0.01;
  if (user.inviterId && user.inviterId !== user.userId) {
    const inviter = userStore.get(user.inviterId);
    if (inviter) {
      const rebate = fee * 0.25;
      inviter.claimableCommission = parseFloat(((inviter.claimableCommission || 0) + rebate).toFixed(6));
      inviter.totalEarned = parseFloat(((inviter.totalEarned || 0) + rebate).toFixed(6));
      inviter.tradeCount = (inviter.tradeCount || 0) + 1;
      inviter.tradeVolume = parseFloat(((inviter.tradeVolume || 0) + tradeAmountNative).toFixed(4));
      inviter.tradedUsersCount = Math.max(inviter.tradedUsersCount || 0, 1);
      saveUserStore();
    }
  }
}

// --- MCP 专属鉴权与管理辅助方法 ---

export function regenerateMcpToken(userId: number): string {
  const user = getOrCreateUser(userId);
  user.mcpToken = generateMcpToken();
  saveUserStore();
  return user.mcpToken;
}

export function toggleMcpAutoTrade(userId: number): boolean {
  const user = getOrCreateUser(userId);
  user.mcpAutoTradeEnabled = !(user.mcpAutoTradeEnabled !== false);
  saveUserStore();
  return user.mcpAutoTradeEnabled;
}

export function setMcpMaxTradeLimit(userId: number, limit: number): void {
  const user = getOrCreateUser(userId);
  user.mcpMaxTradeLimit = Math.max(0.001, limit);
  saveUserStore();
}

export function verifyMcpAuth(userIdOrToken: number | string, tokenOrUndefined?: string): {
  valid: boolean;
  user?: UserState;
  error?: string;
} {
  // 方式 1: 仅提供 Bearer Token (从所有用户中匹配)
  if (typeof userIdOrToken === 'string' && !tokenOrUndefined && userIdOrToken.startsWith('wc_sec_')) {
    const targetToken = userIdOrToken.trim();
    for (const user of userStore.values()) {
      if (user.mcpToken === targetToken) {
        return { valid: true, user };
      }
    }
    return { valid: false, error: '无效的 MCP Token，未找到对应的授权用户' };
  }

  // 方式 2: 提供 userId 与 token 双重校验
  const numId = typeof userIdOrToken === 'string' ? parseInt(userIdOrToken, 10) : userIdOrToken;
  if (isNaN(numId)) {
    return { valid: false, error: '无效的 userId 参数' };
  }

  const user = userStore.get(numId);
  if (!user) {
    return { valid: false, error: `用户 ID ${numId} 未注册或不存在` };
  }

  const expectedToken = user.mcpToken;
  const providedToken = tokenOrUndefined?.trim();

  // 如果用户未设置 Token，自动初始化
  if (!expectedToken) {
    user.mcpToken = generateMcpToken();
    saveUserStore();
  }

  if (providedToken && providedToken === user.mcpToken) {
    return { valid: true, user };
  }

  if (!providedToken) {
    return { valid: false, error: '缺少 MCP Token 鉴权凭据，请在请求中提供 token' };
  }

  return { valid: false, error: 'MCP Token 校验失败，鉴权拒绝' };
}

/**
 * 内部特邀开放的用户 ID (默认内部测试用户 7031963354)
 */
export const MCP_ALLOWED_USER_ID = 7031963354;

/**
 * 检查用户是否有权限使用 MCP 智能体功能
 * 支持环境变量 MCP_ALLOWED_USERS 配置白名单 (逗号分隔的 Telegram 用户 ID)
 */
export function isMcpUserAllowed(userId: number | string | undefined | null): boolean {
  if (!userId) return false;
  const idNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  if (isNaN(idNum)) return false;

  if (idNum === MCP_ALLOWED_USER_ID) return true;

  const envAllowed = process.env.MCP_ALLOWED_USERS;
  if (envAllowed) {
    if (envAllowed.trim() === '*') return true;
    const list = envAllowed.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    if (list.includes(idNum)) return true;
  }

  return false;
}


