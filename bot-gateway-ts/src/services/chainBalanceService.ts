import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

const proxyUri = process.env.SOCKS_PROXY && process.env.SOCKS_PROXY !== 'none' ? process.env.SOCKS_PROXY : undefined;
const agent = proxyUri ? new SocksProxyAgent(proxyUri) : undefined;
const client = axios.create({
  httpAgent: agent,
  httpsAgent: agent,
  timeout: 5000
});

interface BalanceCacheEntry {
  balance: number;
  expiresAt: number;
}

export class ChainBalanceService {
  public static httpClient = client;
  private static balanceCache = new Map<string, BalanceCacheEntry>();
  private static inFlightBalances = new Map<string, Promise<number | null>>();
  public static readonly CACHE_TTL_MS = 3500;
  public static readonly MAX_CACHE_ENTRIES = 2000;

  public static clearCache(): void {
    this.balanceCache.clear();
    this.inFlightBalances.clear();
  }

  public static getCacheSize(): number {
    return this.balanceCache.size;
  }

  public static invalidateCache(chain: string, address: string): void {
    const key = `${chain.toLowerCase()}:${address.trim().toLowerCase()}`;
    this.balanceCache.delete(key);
  }

  /**
   * 真实查询各公链 RPC 的原生代币余额 (支持短期内存缓存与 Single-Flight 并发合并)
   */
  public static async getNativeBalance(chain: string, address: string): Promise<number | null> {
    const c = chain.toLowerCase();
    const cleanAddr = address.trim().toLowerCase();
    const cacheKey = `${c}:${cleanAddr}`;

    // 1. 内存缓存检查 (3.5s TTL)
    const cached = this.balanceCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.balance;
    }

    // 2. Single-Flight 并发请求合并
    const inFlight = this.inFlightBalances.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const task = this.fetchNativeBalanceInternal(c, address);
    this.inFlightBalances.set(cacheKey, task);

    try {
      const balance = await task;
      if (typeof balance === 'number' && !isNaN(balance)) {
        if (this.balanceCache.size >= this.MAX_CACHE_ENTRIES) {
          const oldest = this.balanceCache.keys().next().value;
          if (oldest) this.balanceCache.delete(oldest);
        }
        this.balanceCache.set(cacheKey, {
          balance,
          expiresAt: Date.now() + this.CACHE_TTL_MS
        });
      }
      return balance;
    } finally {
      this.inFlightBalances.delete(cacheKey);
    }
  }

  private static async fetchNativeBalanceInternal(chain: string, address: string): Promise<number | null> {
    try {
      if (chain === 'sui') {
        return await this.getSuiBalance(address);
      }
      if (chain === 'solana') {
        return await this.getSolanaBalance(address);
      }
      if (chain === 'ton') {
        return await this.getTonBalance(address);
      }
      // EVM 链系列
      return await this.getEvmBalance(chain, address);
    } catch (err: any) {
      console.warn(`[ChainBalanceService] Query balance error on ${chain} for ${address}:`, err?.message);
      return null;
    }
  }

  /**
   * 查询 Sui 原生代币余额 (单位: SUI, 9 decimals)
   */
  private static async getSuiBalance(address: string): Promise<number | null> {
    const endpoints = [
      'https://sui-rpc.publicnode.com',
      'https://mainnet.sui.rpcpool.com',
      'https://sui-mainnet.nodeinfra.com'
    ];

    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_getBalance',
      params: [address, '0x2::sui::SUI']
    };

    const execute = async (rpcUrl: string): Promise<number> => {
      const resp = await this.httpClient.post(rpcUrl, payload, { timeout: 2500 });
      const res = resp.data?.result;
      if (res && res.totalBalance !== undefined) {
        const raw = BigInt(res.totalBalance);
        return Number(raw) / 1e9;
      }
      throw new Error('Invalid Sui balance response');
    };

    try {
      return await Promise.any(endpoints.map(url => execute(url)));
    } catch {
      return null;
    }
  }

  /**
   * 查询 Solana 原生代币余额 (单位: SOL, 9 decimals)
   */
  private static async getSolanaBalance(address: string): Promise<number | null> {
    const endpoints = [
      'https://api.mainnet-beta.solana.com',
      'https://solana-rpc.publicnode.com'
    ];

    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address]
    };

    const execute = async (rpcUrl: string): Promise<number> => {
      const resp = await this.httpClient.post(rpcUrl, payload, { timeout: 2500 });
      const val = resp.data?.result?.value;
      if (typeof val === 'number') {
        return val / 1e9;
      }
      throw new Error('Invalid Solana balance response');
    };

    try {
      return await Promise.any(endpoints.map(url => execute(url)));
    } catch {
      return null;
    }
  }

  /**
   * 查询 TON 原生代币余额 (单位: TON, 9 decimals)
   */
  private static async getTonBalance(address: string): Promise<number | null> {
    try {
      const resp = await this.httpClient.get(`https://toncenter.com/api/v2/getAddressBalance?address=${address}`, { timeout: 3000 });
      const val = resp.data?.result;
      if (val !== undefined) {
        return Number(BigInt(val)) / 1e9;
      }
    } catch {}
    return null;
  }

  /**
   * 查询 EVM 链原生代币余额 (单位: ETH/BNB/OKB/SEI 为 18 decimals; ARC USDC 为 6 decimals)
   */
  private static async getEvmBalance(chain: string, address: string): Promise<number | null> {
    const rpcMap: Record<string, string[]> = {
      bsc: ['https://bsc-dataseed.binance.org', 'https://binance.llamarpc.com', 'https://bsc-dataseed1.defibit.io'],
      robinhood: ['https://rpc.mainnet.chain.robinhood.com'],
      arc: ['https://rpc.arc-scan.org', 'https://niorfun.com/api/rpc'],
      base: ['https://mainnet.base.org', 'https://base.llamarpc.com', 'https://1rpc.io/base'],
      ethereum: ['https://eth.llamarpc.com', 'https://cloudflare-eth.com', 'https://1rpc.io/eth'],
      xlayer: ['https://rpc.xlayer.tech'],
      sei: ['https://evm-rpc.sei-apis.com']
    };

    const rpcs = rpcMap[chain] || ['https://binance.llamarpc.com'];
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest']
    };

    const decimals = chain.toLowerCase() === 'arc' ? 6 : 18;
    const divisor = 10 ** decimals;

    const execute = async (rpcUrl: string): Promise<number> => {
      const resp = await this.httpClient.post(rpcUrl, payload, { timeout: 2500 });
      const hex = resp.data?.result;
      if (typeof hex === 'string') {
        const wei = BigInt(hex);
        return Number(wei) / divisor;
      }
      throw new Error('Invalid eth_getBalance response');
    };

    try {
      const candidates = rpcs.slice(0, 3);
      return await Promise.any(candidates.map(url => execute(url)));
    } catch {
      if (rpcs.length > 3) {
        for (const rpcUrl of rpcs.slice(3)) {
          try {
            return await execute(rpcUrl);
          } catch {}
        }
      }
      return null;
    }
  }
}
