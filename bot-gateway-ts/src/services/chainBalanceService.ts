import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

const proxyUri = process.env.SOCKS_PROXY || 'socks5h://127.0.0.1:1080';
const agent = new SocksProxyAgent(proxyUri);
const client = axios.create({
  httpAgent: agent,
  httpsAgent: agent,
  timeout: 5000
});

export class ChainBalanceService {
  /**
   * 真实查询各公链 RPC 的原生代币余额
   */
  public static async getNativeBalance(chain: string, address: string): Promise<number> {
    const c = chain.toLowerCase();
    try {
      if (c === 'sui') {
        return await this.getSuiBalance(address);
      }
      if (c === 'solana') {
        return await this.getSolanaBalance(address);
      }
      if (c === 'ton') {
        return await this.getTonBalance(address);
      }
      // EVM 链系列
      return await this.getEvmBalance(c, address);
    } catch (err: any) {
      console.warn(`[ChainBalanceService] Query balance error on ${chain} for ${address}:`, err?.message);
      return 0;
    }
  }

  /**
   * 查询 Sui 原生代币余额 (单位: SUI, 9 decimals)
   */
  private static async getSuiBalance(address: string): Promise<number> {
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

    for (const rpcUrl of endpoints) {
      try {
        const resp = await client.post(rpcUrl, payload);
        const res = resp.data?.result;
        if (res && res.totalBalance !== undefined) {
          const raw = BigInt(res.totalBalance);
          return Number(raw) / 1e9;
        }
      } catch {}
    }
    return 0;
  }

  /**
   * 查询 Solana 原生代币余额 (单位: SOL, 9 decimals)
   */
  private static async getSolanaBalance(address: string): Promise<number> {
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

    for (const rpcUrl of endpoints) {
      try {
        const resp = await client.post(rpcUrl, payload);
        const val = resp.data?.result?.value;
        if (typeof val === 'number') {
          return val / 1e9;
        }
      } catch {}
    }
    return 0;
  }

  /**
   * 查询 TON 原生代币余额 (单位: TON, 9 decimals)
   */
  private static async getTonBalance(address: string): Promise<number> {
    try {
      const resp = await client.get(`https://toncenter.com/api/v2/getAddressBalance?address=${address}`);
      const val = resp.data?.result;
      if (val !== undefined) {
        return Number(BigInt(val)) / 1e9;
      }
    } catch {}
    return 0;
  }

  /**
   * 查询 EVM 链原生代币余额 (单位: ETH/BNB/OKB/SEI, 18 decimals)
   */
  private static async getEvmBalance(chain: string, address: string): Promise<number> {
    const rpcMap: Record<string, string[]> = {
      bsc: ['https://bsc-dataseed.binance.org', 'https://binance.llamarpc.com', 'https://bsc-dataseed1.defibit.io'],
      robinhood: ['https://rpc.mainnet.chain.robinhood.com'],
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

    for (const rpcUrl of rpcs) {
      try {
        const resp = await client.post(rpcUrl, payload);
        const hex = resp.data?.result;
        if (typeof hex === 'string') {
          const wei = BigInt(hex);
          return Number(wei) / 1e18;
        }
      } catch {}
    }
    return 0;
  }
}
