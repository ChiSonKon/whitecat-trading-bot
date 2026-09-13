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
  type: 'buy_x' | 'sell_x' | 'query_ca' | 'add_copy' | 'transfer_native' | 'transfer_native_amount' | 'transfer_token' | 'transfer_token_to' | 'transfer_token_amount' | 'set_tip';
  data?: any;
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
const DATA_FILE = path.join(__dirname, '../../data/user_store.json');
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
  return `wc_sec_${generateRandomHex(24)}`;
}

export function saveUserStore(): void {
  try {
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
    fs.writeFileSync(DATA_FILE, JSON.stringify(rawObj, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('[UserStore] Failed to save user_store.json:', err?.message);
  }
}

export function loadUserStore(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
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
        userStore.set(uid, {
          userId: u.userId,
          username: u.username || 'trader',
          activeChain: u.activeChain || 'bsc',
          lang: u.lang || 'zh-hans',
          onboarded: u.onboarded !== undefined ? u.onboarded : true,
          walletsByChain,
          tokenHoldings,
          referralCode: u.referralCode || `WC${uid.toString().slice(-4)}`,
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
    console.warn('[UserStore] Failed to load user_store.json:', err?.message);
  }
}

// 首次自动加载用户状态
loadUserStore();

export function getOrCreateUser(userId: number | string, username: string = 'trader'): UserState {
  const numId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
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
      referralCode: `WC${numId.toString().slice(-4)}`,
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

export async function syncTokenHoldings(user: UserState, chain?: string): Promise<void> {
  const targetChain = (chain || user.activeChain).toLowerCase();
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
  status?: 'SUCCESS' | 'FAILED';
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
