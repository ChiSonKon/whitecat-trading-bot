import { CONFIG } from '../config.js';
import { nativeBaseUnits, requireBuyBalance } from './protocolFee.js';
import { createSuiBuyFeeTransaction, suiSellCommission } from './suiProtocolFee.js';
import { createEvmBuyFeePlan, createEvmSellFeePlan, EVM_FEE_TRANSFER_GAS } from './evmProtocolFee.js';
import { createSolanaBuyFeePlan, createSolanaSellFeePlan, SOLANA_FEE_TRANSFER_LAMPORTS } from './solanaProtocolFee.js';
import crypto from 'crypto';
import bs58 from 'bs58';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { ethers } from 'ethers';
import { Keypair as SolKeypair, SystemProgram, Transaction as SolTransaction, PublicKey as SolPublicKey, LAMPORTS_PER_SOL, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { getQuote, buildTx, executeTx, Config, BluefinXTx } from '@bluefin-exchange/bluefin7k-aggregator-sdk';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction as SuiTransaction } from '@mysten/sui/transactions';
import { toBase64, fromBase64 } from '@mysten/sui/utils';
import { TokenMarketService, TokenMarketData } from './tokenMarketService.js';
import { ChainBalanceService } from './chainBalanceService.js';
import { BackendClient } from './backendClient.js';

const proxyUri = process.env.SOCKS_PROXY && process.env.SOCKS_PROXY !== 'none' ? process.env.SOCKS_PROXY : undefined;
const proxyAgent = proxyUri ? new SocksProxyAgent(proxyUri) : undefined;
const httpClient = axios.create({
  httpAgent: proxyAgent,
  httpsAgent: proxyAgent,
  timeout: 8000
});

export interface SwapExecutionResult {
  orderId: string;
  chain: string;
  action: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  amountIn: number;
  estimatedAmountOut: number;
  txHash: string;
  status: string;
  isRealOnChain: boolean;
  executionTimeMs: number;
  effectivePrice?: number;
  error?: string;
}

interface EvmChainSpec {
  chainId: number;
  symbol: string;
  rpcUrls: string[];
  routerAddress: string;
  wrappedNative: string;
  factoryAddress?: string;
  nativeDecimals?: number;
  dexType?: 'uniswapV2' | 'uniswapV3';
}

const EVM_SPECS: Record<string, EvmChainSpec> = {
  bsc: {
    chainId: 56,
    symbol: 'BNB',
    rpcUrls: ['https://bsc-dataseed.binance.org', 'https://binance.llamarpc.com', 'https://bsc-dataseed1.defibit.io'],
    routerAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    wrappedNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    factoryAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
    nativeDecimals: 18,
    dexType: 'uniswapV2'
  },
  base: {
    chainId: 8453,
    symbol: 'ETH',
    rpcUrls: ['https://mainnet.base.org', 'https://base.llamarpc.com', 'https://1rpc.io/base'],
    routerAddress: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    wrappedNative: '0x4200000000000000000000000000000000000006',
    factoryAddress: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6',
    nativeDecimals: 18,
    dexType: 'uniswapV2'
  },
  robinhood: {
    chainId: 4663,
    symbol: 'ETH',
    rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'],
    routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    wrappedNative: '0x4200000000000000000000000000000000000006',
    factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    nativeDecimals: 18,
    dexType: 'uniswapV2'
  },
  arc: {
    chainId: 5042,
    symbol: 'USDC',
    rpcUrls: ['https://niorfun.com/api/rpc', 'https://rpc.arc-scan.org'],
    routerAddress: process.env.ARC_ROUTER_ADDRESS || '0x53bf6b0684ec7ef91e1387da3d1a1769bc5a6f77',
    wrappedNative: process.env.ARC_WRAPPED_NATIVE || '0x3600000000000000000000000000000000000000',
    factoryAddress: process.env.ARC_FACTORY_ADDRESS || '0xf0db7b58379503491d857dB50AC9ece64c653918',
    nativeDecimals: 18,
    dexType: 'uniswapV3'
  },
  ethereum: {
    chainId: 1,
    symbol: 'ETH',
    rpcUrls: ['https://eth.llamarpc.com', 'https://cloudflare-eth.com', 'https://1rpc.io/eth'],
    routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    wrappedNative: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    nativeDecimals: 18
  },
  sei: {
    chainId: 1329,
    symbol: 'SEI',
    rpcUrls: ['https://evm-rpc.sei-apis.com'],
    routerAddress: '',
    wrappedNative: '0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1',
    nativeDecimals: 18
  },
  xlayer: {
    chainId: 196,
    symbol: 'OKB',
    rpcUrls: ['https://rpc.xlayer.tech'],
    routerAddress: '',
    wrappedNative: '0xe538905cf8410324e03a5a23c1c177a474d59b2b',
    nativeDecimals: 18
  }
};

const UNISWAP_V3_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
  'function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum)) payable returns (uint256 amountOut)',
  'function multicall(uint256 deadline, bytes[] data) payable returns (bytes[])',
  'function factory() external view returns (address)',
  'function WETH9() external view returns (address)'
];

const UNISWAP_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] amounts)',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
  'function factory() external view returns (address)',
  'function WETH() external view returns (address)'
];

const UNISWAP_FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function allPairs(uint) external view returns (address pair)',
  'function allPairsLength() external view returns (uint)',
  'function feeTo() external view returns (address)'
];

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)'
];

export class EvmNonceManager {
  private static addressLocks = new Map<string, Promise<any>>();
  private static localNonces = new Map<string, number>();

  public static async withLock<T>(chain: string, address: string, fn: (nonce: number) => Promise<T>): Promise<T> {
    const key = `${chain.toLowerCase()}:${address.toLowerCase()}`;

    while (this.addressLocks.has(key)) {
      try {
        await this.addressLocks.get(key);
      } catch {}
    }

    let releaseLock!: () => void;
    const lockPromise = new Promise<void>(resolve => {
      releaseLock = resolve;
    });
    this.addressLocks.set(key, lockPromise);

    try {
      const nonceHex = await OnChainSwapService.callEvmRpc(chain, 'eth_getTransactionCount', [address, 'pending']);
      const rpcNonce = parseInt(nonceHex, 16);
      const lastLocal = this.localNonces.get(key);
      const allocatedNonce = (lastLocal !== undefined && lastLocal >= rpcNonce) ? lastLocal + 1 : rpcNonce;
      this.localNonces.set(key, allocatedNonce);

      return await fn(allocatedNonce);
    } catch (err) {
      this.localNonces.delete(key);
      throw err;
    } finally {
      this.addressLocks.delete(key);
      releaseLock();
    }
  }

  public static reset(chain: string, address: string): void {
    const key = `${chain.toLowerCase()}:${address.toLowerCase()}`;
    this.localNonces.delete(key);
    this.addressLocks.delete(key);
  }
}

export class OnChainSwapService {
  public static httpClient = httpClient;

  public static async getFactoryAddress(chain: string): Promise<string> {
    const spec = EVM_SPECS[chain.toLowerCase()];
    if (!spec) throw new Error(`Chain ${chain} not configured in EVM_SPECS`);
    if (spec.factoryAddress) return spec.factoryAddress;
    if (!spec.routerAddress) throw new Error(`Swap router is not configured for chain ${chain}`);
    const routerIface = new ethers.Interface(UNISWAP_ROUTER_ABI);
    const res = await this.callEvmRpc(chain, 'eth_call', [{
      to: spec.routerAddress,
      data: routerIface.encodeFunctionData('factory')
    }, 'latest']);
    if (res && res !== '0x') {
      const decoded = routerIface.decodeFunctionResult('factory', res);
      return decoded[0];
    }
    throw new Error(`Failed to resolve factory address for chain ${chain}`);
  }

  public static async getPairAddress(chain: string, tokenA: string, tokenB: string): Promise<string> {
    const factoryAddr = await this.getFactoryAddress(chain);
    const factoryIface = new ethers.Interface(UNISWAP_FACTORY_ABI);
    const callData = factoryIface.encodeFunctionData('getPair', [tokenA, tokenB]);
    const pairHex = await this.callEvmRpc(chain, 'eth_call', [{
      to: factoryAddr,
      data: callData
    }, 'latest']);
    if (pairHex && pairHex !== '0x') {
      const decoded = factoryIface.decodeFunctionResult('getPair', pairHex);
      return decoded[0];
    }
    return ethers.ZeroAddress;
  }

  private static async minimumOutput(chain: string, amountIn: bigint, path: string[], slippagePct: number): Promise<bigint> {
    if (!Number.isFinite(slippagePct) || slippagePct < 0 || slippagePct >= 100 || amountIn <= 0n) {
      throw new Error('Invalid swap amount or slippage');
    }
    const spec = EVM_SPECS[chain];
    if (!spec?.routerAddress) throw new Error('Swap router is not configured for this chain');
    const chainId = await this.callEvmRpc(chain, 'eth_chainId', []);
    if (BigInt(chainId) !== BigInt(spec.chainId)) throw new Error('RPC chain ID mismatch');
    const code = await this.callEvmRpc(chain, 'eth_getCode', [spec.routerAddress, 'latest']);
    if (!code || /^0x0*$/.test(code)) throw new Error('Swap router has no deployed code');
    const iface = new ethers.Interface(UNISWAP_ROUTER_ABI);
    const result = await this.callEvmRpc(chain, 'eth_call', [{
      to: spec.routerAddress, data: iface.encodeFunctionData('getAmountsOut', [amountIn, path])
    }, 'latest']);
    const amounts = iface.decodeFunctionResult('getAmountsOut', result)[0];
    if (amounts.length !== path.length || amounts[0] !== amountIn) throw new Error('Invalid router quote');
    const minimum = BigInt(amounts[amounts.length - 1]) * BigInt(10000 - Math.ceil(slippagePct * 100)) / 10000n;
    if (minimum <= 0n) throw new Error('Minimum output must be positive');
    return minimum;
  }

  public static async getV3Pool(chain: string, tokenA: string, tokenB: string): Promise<{ poolAddress: string; fee: number } | null> {
    const spec = EVM_SPECS[chain.toLowerCase()];
    if (!spec || !spec.factoryAddress) return null;
    const iface = new ethers.Interface([
      'function getPool(address,address,uint24) view returns (address)'
    ]);
    const feeTiers = [10000, 3000, 500, 100];
    for (const fee of feeTiers) {
      try {
        const calldata = iface.encodeFunctionData('getPool', [tokenA, tokenB, fee]);
        const resHex = await this.callEvmRpc(chain, 'eth_call', [{ to: spec.factoryAddress, data: calldata }, 'latest']);
        if (resHex && typeof resHex === 'string' && resHex !== '0x') {
          const [pool] = iface.decodeFunctionResult('getPool', resHex);
          if (pool && pool !== ethers.ZeroAddress && pool.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
            return { poolAddress: pool, fee };
          }
        }
      } catch {}
    }
    return null;
  }

  public static async callEvmRpc(chain: string, method: string, params: any[]): Promise<any> {
    const spec = EVM_SPECS[chain.toLowerCase()];
    const rpcs = spec ? spec.rpcUrls : ['https://bsc-dataseed.binance.org'];
    if (!rpcs || rpcs.length === 0) {
      throw new Error(`All RPC endpoints failed for chain ${chain}`);
    }

    const executeSingle = async (rpcUrl: string, timeoutMs: number): Promise<any> => {
      const resp = await this.httpClient.post(
        rpcUrl,
        {
          jsonrpc: '2.0',
          id: Math.floor(Math.random() * 100000),
          method,
          params
        },
        { timeout: timeoutMs }
      );
      if (resp.data?.error) {
        throw new Error(resp.data.error.message || JSON.stringify(resp.data.error));
      }
      return resp.data?.result;
    };

    const isWrite = method === 'eth_sendRawTransaction';

    // 写入/广播交易：严格单节点单播，避免多节点并发广播造成 Nonce 冲突
    if (isWrite || rpcs.length === 1) {
      let lastErr = null;
      for (const rpcUrl of rpcs) {
        try {
          return await executeSingle(rpcUrl, 4000);
        } catch (err: any) {
          lastErr = err;
        }
      }
      throw lastErr || new Error(`All RPC endpoints failed for chain ${chain}`);
    }

    // 只读方法：Fastest-Wins 快速竞速并发模式 (超时 4000ms)，优先最快可用节点返回
    try {
      const raceBatch = rpcs.slice(0, 3);
      return await Promise.any(raceBatch.map(url => executeSingle(url, 4000)));
    } catch (raceErr: any) {
      // 若首批竞速均失败且存在更多节点，继续 fallback
      if (rpcs.length > 3) {
        let lastErr = null;
        for (const rpcUrl of rpcs.slice(3)) {
          try {
            return await executeSingle(rpcUrl, 3000);
          } catch (err: any) {
            lastErr = err;
          }
        }
        throw lastErr || raceErr;
      }
      const errToThrow = raceErr?.errors?.[0] || raceErr;
      throw errToThrow || new Error(`All RPC endpoints failed for chain ${chain}`);
    }
  }

  public static parseEvmRevertReason(err: any): string {
    const msg = err?.message || String(err || '');
    if (msg.includes('insufficient funds')) {
      return '钱包原生代币余额不足以支付交易金额及 Gas 矿工费。';
    }
    if (msg.includes('EXPIRED')) {
      return '交易签名已超时失效，请重试。';
    }
    if (msg.includes('INSUFFICIENT_OUTPUT_AMOUNT') || msg.includes('Too little received') || msg.includes('TLM')) {
      return '价格滑点超限或流动性不足，请在设置中调高滑点重试。';
    }
    if (msg.includes('TRANSFER_FROM_FAILED') || msg.includes('STF')) {
      return '代币授权额度不足或转账失败 (TransferFrom failed)。';
    }
    if (msg.includes('TRANSFER_FAILED') || msg.includes('TF')) {
      return '代币转账失败，合约可能存在买卖税或交易限制。';
    }
    if (msg.includes('Pancake: K') || msg.includes('UniswapV2: K')) {
      return '交易对流动性恒定乘积 K 值异常，池子流动性可能正在剧烈变动。';
    }
    if (msg.includes('execution reverted: 0x') || msg.includes('execution reverted') || msg.includes('reverted')) {
      return '链上模拟执行被回滚。可能由于价格滑点超限或流动性不足，请在设置中调高滑点重试。';
    }
    return msg || 'EVM 链上模拟执行失败';
  }

  public static async pollEvmReceipt(chain: string, txHash: string, maxWaitMs: number = 12000): Promise<{ status: 'SUCCESS' | 'FAILED' | 'PENDING'; gasUsed?: number }> {
    const pollStart = Date.now();
    const pollInterval = 1200;
    while (Date.now() - pollStart < maxWaitMs) {
      await new Promise(r => setTimeout(r, pollInterval));
      try {
        const receipt = await this.callEvmRpc(chain, 'eth_getTransactionReceipt', [txHash]);
        if (receipt && receipt.status !== undefined && receipt.status !== null) {
          const st = String(receipt.status);
          const gasUsed = parseInt(receipt.gasUsed || '0', 16);
          if (st === '0x1' || st === '1') {
            return { status: 'SUCCESS', gasUsed };
          } else if (st === '0x0' || st === '0') {
            return { status: 'FAILED', gasUsed };
          }
        }
      } catch {}
    }
    return { status: 'PENDING' };
  }

  public static async callSolanaRpc(method: string, params: any[]): Promise<any> {
    const rpcs = [
      'https://api.mainnet-beta.solana.com',
      'https://solana-rpc.publicnode.com'
    ];
    let lastErr = null;

    for (const rpcUrl of rpcs) {
      try {
        const resp = await this.httpClient.post(rpcUrl, {
          jsonrpc: '2.0',
          id: 1,
          method,
          params
        });
        if (resp.data?.error) {
          throw new Error(resp.data.error.message || JSON.stringify(resp.data.error));
        }
        return resp.data?.result;
      } catch (err: any) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Solana RPC failed');
  }

  public static async pollSolanaReceipt(signature: string, maxWaitMs: number = 20000): Promise<{ status: 'SUCCESS' | 'FAILED' | 'PENDING'; err?: any }> {
    const pollStart = Date.now();
    const pollInterval = 1500;
    while (Date.now() - pollStart < maxWaitMs) {
      await new Promise(r => setTimeout(r, pollInterval));
      try {
        const res = await this.callSolanaRpc('getSignatureStatuses', [[signature], { searchTransactionHistory: true }]);
        const status = res?.value?.[0];
        if (status) {
          if (status.err) {
            return { status: 'FAILED', err: status.err };
          }
          if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
            return { status: 'SUCCESS' };
          }
        }
      } catch {}
    }
    return { status: 'PENDING' };
  }

  public static generateChainTxHash(chain: string): string {
    const c = chain.toLowerCase();
    if (c === 'sui') {
      return bs58.encode(crypto.randomBytes(32));
    }
    if (c === 'solana') {
      return bs58.encode(crypto.randomBytes(64));
    }
    if (c === 'ton') {
      return crypto.randomBytes(32).toString('hex');
    }
    return '0x' + crypto.randomBytes(32).toString('hex');
  }

  public static getChainNativeSymbol(chain: string): string {
    const c = chain.toLowerCase();
    if (c === 'sui') return 'SUI';
    if (c === 'solana') return 'SOL';
    if (c === 'ton') return 'TON';
    const spec = EVM_SPECS[c];
    return spec ? spec.symbol : 'ETH';
  }

  public static async executeFastBuy(params: {
    userId: number;
    chain: string;
    walletAddress: string;
    privateKey?: string;
    tokenAddress: string;
    amountNative: number;
    slippagePct: number;
    priorityFeeTier?: string;
    gasTip?: number;
  }): Promise<SwapExecutionResult> {
    const startTime = Date.now();
    const orderId = crypto.randomUUID();
    const targetChain = params.chain.toLowerCase();
    if (['sei', 'xlayer', 'ton', 'aptos'].includes(targetChain)) {
      return { orderId, chain: targetChain, action: 'BUY', tokenAddress: params.tokenAddress,
        tokenSymbol: 'TOKEN', tokenName: 'Token', amountIn: 0, estimatedAmountOut: 0,
        txHash: '', status: 'FAILED', isRealOnChain: false, executionTimeMs: Date.now() - startTime,
        error: 'Swaps are unavailable on this chain until a verified implementation is configured.' };
    }

    const nativeSymbol = this.getChainNativeSymbol(targetChain);

    const security = await BackendClient.checkHoneypot(targetChain, params.tokenAddress);
    if (security.risk_level !== 'SAFE' || security.is_honeypot || !security.can_buy || !security.can_sell) {
      return { orderId, chain: targetChain, action: 'BUY', tokenAddress: params.tokenAddress,
        tokenSymbol: 'TOKEN', tokenName: 'Token', amountIn: params.amountNative, estimatedAmountOut: 0,
        txHash: '', status: 'FAILED', isRealOnChain: false, executionTimeMs: Date.now() - startTime,
        error: `Security check blocked purchase (${security.risk_level}): ${security.reason}` };
    }
    const market = await TokenMarketService.fetchTokenDetails(params.tokenAddress, targetChain);
    const symbol = market.symbol || 'TOKEN';
    const name = market.name || 'Token';

    // 2. 严格全链链上余额预检 (对齐 Sui 行为)
    const onChainBalance = (await ChainBalanceService.getNativeBalance(targetChain, params.walletAddress)) ?? 0;
    if (onChainBalance < params.amountNative) {
      console.warn(`[OnChainSwap] Balance check rejected on ${targetChain}: balance ${onChainBalance} < required ${params.amountNative}`);
      return {
        orderId,
        chain: targetChain,
        action: 'BUY',
        tokenAddress: params.tokenAddress,
        tokenSymbol: symbol,
        tokenName: name,
        amountIn: params.amountNative,
        estimatedAmountOut: 0,
        txHash: '',
        status: 'FAILED',
        isRealOnChain: false,
        executionTimeMs: Date.now() - startTime,
        error: `链上可用余额不足 (当前: ${onChainBalance.toFixed(4)} ${nativeSymbol}，需要: ${params.amountNative} ${nativeSymbol})`
      };
    }

    // 3. Sui 链聚合执行
    if (targetChain === 'sui') {
      try {
        const tokenIn = '0x2::sui::SUI';
        const tokenOut = params.tokenAddress;
        const grossMist = nativeBaseUnits(params.amountNative, 9);
        const feePlan = createSuiBuyFeeTransaction(grossMist, CONFIG.PROTOCOL_FEE_RATE_SCALED, CONFIG.PROTOCOL_FEE_RECIPIENT_SUI);
        const amountInMist = feePlan.net.toString();
        if (CONFIG.PROTOCOL_FEE_RATE_SCALED > 0n) {
          const balance = await Config.getSuiClient().core.getBalance({ owner: params.walletAddress });
          requireBuyBalance(BigInt(balance.balance.balance), grossMist, 500_000_000n);
          feePlan.tx.setGasBudget(500_000_000n);
        }

        console.log(`[OnChainSwap] Sui fast buy: ${params.amountNative} SUI -> ${symbol} (${tokenOut})`);

        let quote = null;
        try {
          quote = await getQuote({
            tokenIn,
            tokenOut,
            amountIn: amountInMist
          });
        } catch (quoteErr: any) {
          console.warn(`[OnChainSwap] Sui aggregator quote fallback: ${quoteErr?.message}`);
        }

        const quoteReturn = quote ? parseFloat(quote.returnAmount || '0') : 0;
        const effectiveTokens = quoteReturn > 0
          ? quoteReturn
          : (market.priceNative > 0
              ? (params.amountNative / market.priceNative) * (1 - (params.slippagePct || 5) / 100)
              : params.amountNative * 80);

        if (params.privateKey && params.privateKey.startsWith('suiprivkey1')) {
          if (!quote || quoteReturn <= 0) {
            return {
              orderId,
              chain: 'sui',
              action: 'BUY',
              tokenAddress: params.tokenAddress,
              tokenSymbol: symbol,
              tokenName: name,
              amountIn: params.amountNative,
              estimatedAmountOut: 0,
              txHash: '',
              status: 'FAILED',
              isRealOnChain: false,
              executionTimeMs: Date.now() - startTime,
              error: '聚合器未能为该代币找到有效买入路径或流动性不足'
            };
          }

          console.log(`[OnChainSwap] Executing REAL on-chain Sui swap for ${params.walletAddress} (balance: ${onChainBalance} SUI)...`);
          const { secretKey } = decodeSuiPrivateKey(params.privateKey);
          const keypair = Ed25519Keypair.fromSecretKey(secretKey);
          if (keypair.toSuiAddress().toLowerCase() !== params.walletAddress.toLowerCase()) throw new Error('Signing key does not match wallet address');

          if (CONFIG.PROTOCOL_FEE_RATE_SCALED > 0n && quote.routes?.some((route: any) => route.hops?.some((hop: any) => hop.pool?.type === 'bluefinx'))) {
            throw new Error('BluefinX cannot guarantee atomic protocol fee settlement');
          }
          const { tx, coinOut } = await buildTx({
            quoteResponse: quote,
            accountAddress: params.walletAddress,
            slippage: Math.min(Math.max((params.slippagePct || 5) / 100, 0.01), 0.5),
            commission: { partner: params.walletAddress, commissionBps: 0 },
            ...(CONFIG.PROTOCOL_FEE_RATE_SCALED > 0n ? { extendTx: { tx: feePlan.tx } } : {})
          });

          if (tx) {
            if (CONFIG.PROTOCOL_FEE_RATE_SCALED > 0n) {
              if (tx instanceof BluefinXTx || !coinOut) throw new Error('Unsupported fee transaction');
              tx.transferObjects([coinOut], tx.pure.address(params.walletAddress));
            }
            const client = Config.getSuiClient();
            const isBluefinX = tx instanceof BluefinXTx;
            const rawBytes = isBluefinX ? fromBase64(tx.txBytes) : await tx.build({ client: client.core });
            let localDigest = '';
            if (!isBluefinX) {
              try {
                localDigest = await tx.getDigest({ client: client.core });
              } catch {}
            }
            const { signature } = await keypair.signTransaction(rawBytes);
            const signedTxBytes = toBase64(rawBytes);
            let response: any;
            try {
              response = await executeTx(tx, signature, signedTxBytes, { effects: true, balanceChanges: true });
            } catch (execErr: any) {
              if (localDigest) {
                console.warn(`[OnChainSwap] Sui executeTx threw after signing (${localDigest}), reporting PENDING:`, execErr?.message || execErr);
                return {
                  orderId, chain: 'sui', action: 'BUY', tokenAddress: params.tokenAddress,
                  tokenSymbol: symbol, tokenName: name, amountIn: params.amountNative,
                  estimatedAmountOut: quoteReturn || effectiveTokens, txHash: localDigest,
                  status: 'PENDING', isRealOnChain: true, executionTimeMs: Date.now() - startTime,
                  error: 'Sui transaction broadcast was submitted or pending confirmation; check status before retrying.'
                };
              }
              throw execErr;
            }
            const execRes: any = response.Transaction || response.FailedTransaction || response;
            if (execRes.status?.success !== true) {
              return {
                orderId, chain: 'sui', action: 'BUY', tokenAddress: params.tokenAddress,
                tokenSymbol: symbol, tokenName: name, amountIn: params.amountNative,
                estimatedAmountOut: 0, txHash: execRes.digest || localDigest || '',
                status: execRes.status?.success === false ? 'FAILED' : 'PENDING',
                isRealOnChain: Boolean(execRes.digest || localDigest), executionTimeMs: Date.now() - startTime,
                error: 'Sui transaction did not report confirmed success; do not resubmit until checked.'
              };
            }

            const realDigest = execRes?.digest ||
              localDigest ||
              execRes?.Transaction?.digest ||
              execRes?.transaction?.digest ||
              execRes?.effects?.transactionDigest ||
              execRes?.Transaction?.effects?.transactionDigest;

            if (realDigest) {
              console.log(`[OnChainSwap] 🔥 Sui on-chain transaction SUCCESS! Digest: ${realDigest}`);
              let finalTokensOut = quoteReturn || effectiveTokens;
              if (execRes?.balanceChanges) {
                const tokenChange = execRes.balanceChanges.find(
                  (b: any) => (b.address === params.walletAddress || b.owner?.AddressOwner === params.walletAddress || (!b.address && !b.owner)) &&
                              (b.coinType?.toLowerCase() === params.tokenAddress.toLowerCase() ||
                               params.tokenAddress.toLowerCase().includes(b.coinType?.toLowerCase()))
                );
                if (tokenChange && tokenChange.amount) {
                  let suiTokenDecimals = 9;
                  try {
                    const client = Config.getSuiClient();
                    const meta = await client.core.getCoinMetadata({ coinType: params.tokenAddress });
                    if (meta?.coinMetadata?.decimals !== undefined) {
                      suiTokenDecimals = meta.coinMetadata.decimals;
                    }
                  } catch {}
                  finalTokensOut = Math.abs(parseFloat(tokenChange.amount)) / Math.pow(10, suiTokenDecimals);
                }
              }

              return {
                orderId,
                chain: 'sui',
                action: 'BUY',
                tokenAddress: params.tokenAddress,
                tokenSymbol: symbol,
                tokenName: name,
                amountIn: params.amountNative,
                estimatedAmountOut: finalTokensOut,
                txHash: realDigest,
                status: 'SUCCESS',
                isRealOnChain: true,
                executionTimeMs: Date.now() - startTime,
                effectivePrice: quote?.effectivePrice || market.priceNative
              };
            } else {
              throw new Error('节点未返回交易哈希');
            }
          }
        }
      } catch (err: any) {
        console.error(`[OnChainSwap] Sui trade execution error:`, err?.message || err);
        return {
          orderId,
          chain: 'sui',
          action: 'BUY',
          tokenAddress: params.tokenAddress,
          tokenSymbol: symbol,
          tokenName: name,
          amountIn: params.amountNative,
          estimatedAmountOut: 0,
          txHash: '',
          status: 'FAILED',
          isRealOnChain: false,
          executionTimeMs: Date.now() - startTime,
          error: err?.message || '链上买入交易执行失败'
        };
      }
    }

    // 4. EVM 链族系 (BSC, Base, Robinhood, Ethereum, Sei, XLayer) 真实签名与广播
    const evmSpec = EVM_SPECS[targetChain];
    if (evmSpec) {
      if (params.privateKey && (params.privateKey.startsWith('0x') || params.privateKey.length === 64)) {
        try {
          const cleanPk = params.privateKey.startsWith('0x') ? params.privateKey : `0x${params.privateKey}`;
          const wallet = new ethers.Wallet(cleanPk);
          if (wallet.address.toLowerCase() !== params.walletAddress.toLowerCase()) throw new Error('Signing key does not match wallet address');

          console.log(`[OnChainSwap] Executing REAL on-chain EVM Buy on ${targetChain} for ${wallet.address} (balance: ${onChainBalance} ${nativeSymbol})...`);

          const routerIface = new ethers.Interface(UNISWAP_ROUTER_ABI);
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
          const path = [evmSpec.wrappedNative, params.tokenAddress];

          const nativeDecimals = evmSpec.nativeDecimals ?? 18;
          const grossWei = nativeBaseUnits(params.amountNative, nativeDecimals);
          const feeRecipient = (targetChain === 'arc' && CONFIG.PROTOCOL_FEE_RECIPIENT_ARC)
            ? CONFIG.PROTOCOL_FEE_RECIPIENT_ARC
            : CONFIG.PROTOCOL_FEE_RECIPIENT_EVM;
          const feePlan = createEvmBuyFeePlan(grossWei, CONFIG.PROTOCOL_FEE_RATE_SCALED, feeRecipient);
          const valueWei = feePlan.net;
          let calldata = '';
          let txValue = valueWei;
          let estimatedGas = 350000n;

          if (evmSpec.dexType === 'uniswapV3') {
            // Arc Network (EVM Uniswap V3) 执行逻辑
            const usdcAddr = evmSpec.wrappedNative; // 0x3600000000000000000000000000000000000000 (系统 USDC 双向镜像合约)
            const usdcUnits = BigInt(Math.floor(params.amountNative * 1e6));
            const arcFeePlan = createEvmBuyFeePlan(usdcUnits, CONFIG.PROTOCOL_FEE_RATE_SCALED, feeRecipient);
            const valueUnits = arcFeePlan.net;

            const v3Pool = await this.getV3Pool(targetChain, usdcAddr, params.tokenAddress);
            if (!v3Pool) {
              return {
                orderId, chain: targetChain, action: 'BUY', tokenAddress: params.tokenAddress,
                tokenSymbol: symbol, tokenName: name, amountIn: params.amountNative, estimatedAmountOut: 0,
                txHash: '', status: 'FAILED', isRealOnChain: false, executionTimeMs: Date.now() - startTime,
                error: `未在 ${targetChain} 链上定位到代币流动性池 (Uniswap V3 Pool)`
              };
            }

            // 查询代币精度 Decimals
            let tokenDecimals = 18;
            const erc20Iface = new ethers.Interface(ERC20_ABI);
            try {
              const decData = erc20Iface.encodeFunctionData('decimals');
              const decHex = await this.callEvmRpc(targetChain, 'eth_call', [{ to: params.tokenAddress, data: decData }, 'latest']);
              if (decHex && typeof decHex === 'string' && decHex !== '0x') {
                tokenDecimals = parseInt(decHex, 16) || 18;
              }
            } catch {}

            // 计算滑点保底输出
            let minOut = 1n;
            if (market.priceNative && market.priceNative > 0) {
              const expectedTokens = Number(valueUnits) / 1e6 / market.priceNative;
              const slipMultiplier = (100 - (params.slippagePct || 5)) / 100;
              const minTokens = Math.max(expectedTokens * slipMultiplier, 0);
              const safeDecimals = Math.min(Math.max(tokenDecimals, 0), 18);
              minOut = ethers.parseUnits(minTokens.toFixed(safeDecimals), tokenDecimals);
              if (minOut <= 0n) minOut = 1n;
            }

            // 判断 zeroForOne (token0 -> token1)
            const isZeroForOne = usdcAddr.toLowerCase() < params.tokenAddress.toLowerCase();
            const poolBigInt = BigInt(v3Pool.poolAddress);
            const poolParam = isZeroForOne ? poolBigInt : ((1n << 255n) | poolBigInt);
            const pools = [poolParam];

            // 检查并自动按需执行 USDC Allowance 授权
            let currentAllowance = 0n;
            try {
              const allowData = erc20Iface.encodeFunctionData('allowance', [wallet.address, evmSpec.routerAddress]);
              const allowHex = await this.callEvmRpc(targetChain, 'eth_call', [{ to: usdcAddr, data: allowData }, 'latest']);
              if (allowHex && typeof allowHex === 'string' && allowHex !== '0x') {
                currentAllowance = BigInt(allowHex);
              }
            } catch {}

            if (currentAllowance < usdcUnits) {
              console.log(`[OnChainSwap] Insufficient USDC allowance for router ${evmSpec.routerAddress}, sending approve...`);
              const approveTxHash = await EvmNonceManager.withLock(targetChain, wallet.address, async (approveNonce) => {
                const approveGasPriceHex = await this.callEvmRpc(targetChain, 'eth_gasPrice', []);
                const approveTx = {
                  to: usdcAddr,
                  value: 0n,
                  data: erc20Iface.encodeFunctionData('approve', [evmSpec.routerAddress, ethers.MaxUint256]),
                  nonce: approveNonce,
                  gasLimit: 70000n,
                  gasPrice: BigInt(approveGasPriceHex || '0x4a817c800'),
                  chainId: evmSpec.chainId
                };
                const signedApprove = await wallet.signTransaction(approveTx);
                return await this.callEvmRpc(targetChain, 'eth_sendRawTransaction', [signedApprove]);
              });
              console.log(`[OnChainSwap] USDC Approve broadcast: ${approveTxHash}, waiting for confirmation...`);
              const approveRes = await this.pollEvmReceipt(targetChain, approveTxHash, 15000);
              if (approveRes.status === 'FAILED') {
                throw new Error(`USDC 授权交易被链上回滚 (tx: ${approveTxHash})`);
              }
            }

            const v3RouterIface = new ethers.Interface(UNISWAP_V3_ROUTER_ABI);
            calldata = v3RouterIface.encodeFunctionData('exactInputSingle', [{
              tokenIn: usdcAddr,
              tokenOut: params.tokenAddress,
              fee: v3Pool.fee,
              recipient: wallet.address,
              amountIn: valueUnits,
              amountOutMinimum: minOut,
              sqrtPriceLimitX96: 0n
            }]);
            txValue = 0n; // msg.value 必须为 0
          } else {
            const minimum = await this.minimumOutput(targetChain, valueWei, path, params.slippagePct);
            calldata = routerIface.encodeFunctionData('swapExactETHForTokensSupportingFeeOnTransferTokens', [
              minimum,
              path,
              wallet.address,
              deadline
            ]);
            txValue = valueWei;
          }

          // 1. Pre-flight 仿真模拟 (eth_estimateGas)
          try {
            const simParams = [{
              from: wallet.address,
              to: evmSpec.routerAddress,
              value: '0x' + txValue.toString(16),
              data: calldata
            }];
            const estHex = await this.callEvmRpc(targetChain, 'eth_estimateGas', simParams);
            if (estHex && typeof estHex === 'string') {
              estimatedGas = (BigInt(estHex) * 125n) / 100n;
            }
          } catch (simErr: any) {
            const friendlyErr = this.parseEvmRevertReason(simErr);
            console.warn(`[OnChainSwap] ⚠️ Pre-flight EVM Buy simulation REVERTED on ${targetChain}:`, friendlyErr);
            return {
              orderId,
              chain: targetChain,
              action: 'BUY',
              tokenAddress: params.tokenAddress,
              tokenSymbol: symbol,
              tokenName: name,
              amountIn: params.amountNative,
              estimatedAmountOut: 0,
              txHash: '',
              status: 'FAILED',
              isRealOnChain: false,
              executionTimeMs: Date.now() - startTime,
              error: friendlyErr
            };
          }

          if (feePlan.fee > 0n) {
            const gasPriceHex = await this.callEvmRpc(targetChain, 'eth_gasPrice', []);
            const gasPrice = BigInt(gasPriceHex || '0x4a817c800');
            const rawGasCost = (estimatedGas + EVM_FEE_TRANSFER_GAS) * gasPrice;
            const gasReserved = nativeDecimals < 18 && rawGasCost >= 10n ** (18n - BigInt(nativeDecimals))
              ? rawGasCost / (10n ** (18n - BigInt(nativeDecimals)))
              : rawGasCost;
            const userBalWei = nativeBaseUnits(onChainBalance.toString(), nativeDecimals);
            requireBuyBalance(userBalWei, grossWei, gasReserved);
          }

          const realTxHash = await EvmNonceManager.withLock(targetChain, wallet.address, async (nonce) => {
            const gasPriceHex = await this.callEvmRpc(targetChain, 'eth_gasPrice', []);
            let gasPrice = BigInt(gasPriceHex || '0x4a817c800');
            if (params.gasTip && params.gasTip > 0 && estimatedGas > 0n) {
              const tipUnits = nativeBaseUnits(params.gasTip.toString(), nativeDecimals);
              const tipPerGas = tipUnits / estimatedGas;
              if (tipPerGas > 0n) {
                gasPrice += tipPerGas;
              }
            }

            const txDraft = {
              to: evmSpec.routerAddress,
              value: txValue,
              data: calldata,
              nonce,
              gasLimit: estimatedGas,
              gasPrice,
              chainId: evmSpec.chainId
            };

            const signedTxHex = await wallet.signTransaction(txDraft);
            return await this.callEvmRpc(targetChain, 'eth_sendRawTransaction', [signedTxHex]);
          });

          if (realTxHash && typeof realTxHash === 'string' && realTxHash.startsWith('0x')) {
            console.log(`[OnChainSwap] 📡 Real EVM Buy broadcast to mempool on ${targetChain}! Hash: ${realTxHash}`);

            // 2. 真实回执确认 (Receipt Verification)
            const receiptRes = await this.pollEvmReceipt(targetChain, realTxHash, 12000);

            if (receiptRes.status === 'PENDING') {
              return { orderId, chain: targetChain, action: 'BUY',
                tokenAddress: params.tokenAddress, tokenSymbol: symbol, tokenName: name,
                amountIn: params.amountNative, estimatedAmountOut: 0, txHash: realTxHash,
                status: 'PENDING', isRealOnChain: true, executionTimeMs: Date.now() - startTime,
                error: 'Transaction broadcast; confirmation pending. Do not resubmit.' };
            }
            if (receiptRes.status === 'FAILED') {
              console.error(`[OnChainSwap] ❌ EVM Buy REVERTED on-chain on ${targetChain}! Hash: ${realTxHash}`);
              return {
                orderId,
                chain: targetChain,
                action: 'BUY',
                tokenAddress: params.tokenAddress,
                tokenSymbol: symbol,
                tokenName: name,
                amountIn: params.amountNative,
                estimatedAmountOut: 0,
                txHash: realTxHash,
                status: 'FAILED',
                isRealOnChain: true,
                executionTimeMs: Date.now() - startTime,
                error: '链上执行被合约回滚 (Status: Reverted)。可能原因：代币流动性不足、滑点过低或存在特殊交易限制。'
              };
            }

            console.log(`[OnChainSwap] 🔥 EVM on-chain Buy CONFIRMED on ${targetChain}! Hash: ${realTxHash}`);
            if (feePlan.fee > 0n && feePlan.recipient) {
              try {
                const feeTxHash = await EvmNonceManager.withLock(targetChain, wallet.address, async (feeNonce) => {
                  const feeGasPriceHex = await this.callEvmRpc(targetChain, 'eth_gasPrice', []);
                  const feeGasPrice = BigInt(feeGasPriceHex || '0x4a817c800');
                  const feeDraft = {
                    to: feePlan.recipient,
                    value: feePlan.fee,
                    nonce: feeNonce,
                    gasLimit: EVM_FEE_TRANSFER_GAS,
                    gasPrice: feeGasPrice,
                    chainId: evmSpec.chainId
                  };
                  const signedFeeTx = await wallet.signTransaction(feeDraft);
                  return await this.callEvmRpc(targetChain, 'eth_sendRawTransaction', [signedFeeTx]);
                });
                console.log(`[OnChainSwap] 💰 EVM protocol fee broadcast on ${targetChain}: ${feeTxHash}`);
              } catch (feeErr: any) {
                console.warn(`[OnChainSwap] ⚠️ EVM protocol fee transfer deferred on ${targetChain}:`, feeErr?.message || feeErr);
              }
            }
            const priceNative = market.priceNative > 0 ? market.priceNative : 0.0001;
            const netNative = Number(valueWei) / (10 ** nativeDecimals);
            const estimatedTokens = (netNative / priceNative) * (1 - (params.slippagePct || 5) / 100);

            return {
              orderId,
              chain: targetChain,
              action: 'BUY',
              tokenAddress: params.tokenAddress,
              tokenSymbol: symbol,
              tokenName: name,
              amountIn: params.amountNative,
              estimatedAmountOut: estimatedTokens,
              txHash: realTxHash,
              status: 'SUCCESS',
              isRealOnChain: true,
              executionTimeMs: Date.now() - startTime,
              effectivePrice: priceNative
            };
          } else {
            throw new Error(`节点未返回合规交易哈希: ${JSON.stringify(realTxHash)}`);
          }
        } catch (evmErr: any) {
          console.error(`[OnChainSwap] Real EVM Buy failed on ${targetChain}:`, evmErr?.message || evmErr);
          return {
            orderId,
            chain: targetChain,
            action: 'BUY',
            tokenAddress: params.tokenAddress,
            tokenSymbol: symbol,
            tokenName: name,
            amountIn: params.amountNative,
            estimatedAmountOut: 0,
            txHash: '',
            status: 'FAILED',
            isRealOnChain: false,
            executionTimeMs: Date.now() - startTime,
            error: evmErr?.message || 'EVM 链上买入广播失败'
          };
        }
      }
    }

    // 5. Solana 真实链上买入 (Jupiter V6 API)
    if (targetChain === 'solana') {
      if (!params.privateKey) {
        return {
          orderId, chain: 'solana', action: 'BUY', tokenAddress: params.tokenAddress,
          tokenSymbol: symbol, tokenName: name, amountIn: params.amountNative,
          estimatedAmountOut: 0, txHash: '', status: 'FAILED', isRealOnChain: false,
          executionTimeMs: Date.now() - startTime,
          error: '缺少有效 Solana 私钥'
        };
      }
      try {
        const secretKey = bs58.decode(params.privateKey);
        const keypair = SolKeypair.fromSecretKey(secretKey);
        if (keypair.publicKey.toBase58().toLowerCase() !== params.walletAddress.toLowerCase()) {
          throw new Error('Signing key does not match wallet address');
        }
        const grossLamports = nativeBaseUnits(params.amountNative, 9);
        const feePlan = createSolanaBuyFeePlan(grossLamports, CONFIG.PROTOCOL_FEE_RATE_SCALED, CONFIG.PROTOCOL_FEE_RECIPIENT_SOLANA);
        const solLamports = Number(feePlan.net);
        if (solLamports <= 0) throw new Error('买入 SOL 金额过小');

        if (feePlan.fee > 0n) {
          const balanceLamports = BigInt(Math.floor(onChainBalance * LAMPORTS_PER_SOL));
          requireBuyBalance(balanceLamports, grossLamports, SOLANA_FEE_TRANSFER_LAMPORTS);
        }

        const inputMint = 'So11111111111111111111111111111111111111112';
        const outputMint = params.tokenAddress;
        const slippageBps = Math.min(Math.max(Math.floor((params.slippagePct || 5) * 100), 50), 5000);

        // 1. 获取 Jupiter 报价
        const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${solLamports}&slippageBps=${slippageBps}`;
        const quoteResp = await this.httpClient.get(quoteUrl);
        if (!quoteResp.data || !quoteResp.data.outAmount) {
          throw new Error('Jupiter 聚合器未找到有效买入路径或流动性不足');
        }
        const quoteData = quoteResp.data;

        // 2. 获取 Swap 交易
        const swapResp = await this.httpClient.post('https://quote-api.jup.ag/v6/swap', {
          quoteResponse: quoteData,
          userPublicKey: keypair.publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto'
        });
        if (!swapResp.data?.swapTransaction) {
          throw new Error('Jupiter Swap 交易生成失败');
        }

        // 3. 反序列化、签名、广播
        const swapBuf = Buffer.from(swapResp.data.swapTransaction, 'base64');
        const versionedTx = VersionedTransaction.deserialize(swapBuf);
        versionedTx.sign([keypair]);
        const rawBytes = versionedTx.serialize();
        const rawBase64 = Buffer.from(rawBytes).toString('base64');

        const realTxSig = await this.callSolanaRpc('sendTransaction', [rawBase64, { encoding: 'base64', skipPreflight: false, maxRetries: 2 }]);
        if (!realTxSig || typeof realTxSig !== 'string') {
          throw new Error(`Solana 节点返回异常: ${JSON.stringify(realTxSig)}`);
        }

        console.log(`[OnChainSwap] 📡 Real Solana Buy broadcast to network! Sig: ${realTxSig}`);

        // 4. 确认回执
        const receiptRes = await this.pollSolanaReceipt(realTxSig, 25000);
        const outAmountRaw = BigInt(quoteData.outAmount || '0');
        let outDecimals = 6;
        try {
          const supplyRes = await this.callSolanaRpc('getTokenSupply', [params.tokenAddress]);
          if (supplyRes?.value?.decimals !== undefined) outDecimals = supplyRes.value.decimals;
        } catch {}
        const estimatedTokens = Number(outAmountRaw) / Math.pow(10, outDecimals);

        if (receiptRes.status === 'PENDING') {
          return {
            orderId, chain: 'solana', action: 'BUY', tokenAddress: params.tokenAddress,
            tokenSymbol: symbol, tokenName: name, amountIn: params.amountNative,
            estimatedAmountOut: estimatedTokens, txHash: realTxSig,
            status: 'PENDING', isRealOnChain: true, executionTimeMs: Date.now() - startTime,
            effectivePrice: market.priceNative > 0 ? market.priceNative : params.amountNative / (estimatedTokens || 1)
          };
        }
        if (receiptRes.status === 'FAILED') {
          return {
            orderId, chain: 'solana', action: 'BUY', tokenAddress: params.tokenAddress,
            tokenSymbol: symbol, tokenName: name, amountIn: params.amountNative,
            estimatedAmountOut: 0, txHash: realTxSig,
            status: 'FAILED', isRealOnChain: true, executionTimeMs: Date.now() - startTime,
            error: `Solana 链上买入回滚: ${JSON.stringify(receiptRes.err)}`
          };
        }

        if (feePlan.fee > 0n && feePlan.recipient) {
          try {
            const feeTransferTx = new SolTransaction().add(
              SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: new SolPublicKey(feePlan.recipient),
                lamports: feePlan.fee
              })
            );
            const bhRes = await this.callSolanaRpc('getLatestBlockhash', [{ commitment: 'confirmed' }]);
            feeTransferTx.recentBlockhash = bhRes?.value?.blockhash || bhRes?.blockhash || '11111111111111111111111111111111';
            feeTransferTx.feePayer = keypair.publicKey;
            feeTransferTx.sign(keypair);
            const feeRawBase64 = Buffer.from(feeTransferTx.serialize()).toString('base64');
            const feeSig = await this.callSolanaRpc('sendTransaction', [feeRawBase64, { encoding: 'base64', skipPreflight: false, maxRetries: 2 }]);
            console.log(`[OnChainSwap] 💰 Solana buy protocol fee broadcast: ${feeSig}`);
          } catch (feeErr: any) {
            console.warn(`[OnChainSwap] ⚠️ Solana buy protocol fee transfer deferred:`, feeErr?.message || feeErr);
          }
        }

        return {
          orderId, chain: 'solana', action: 'BUY', tokenAddress: params.tokenAddress,
          tokenSymbol: symbol, tokenName: name, amountIn: params.amountNative,
          estimatedAmountOut: estimatedTokens, txHash: realTxSig,
          status: 'SUCCESS', isRealOnChain: true, executionTimeMs: Date.now() - startTime,
          effectivePrice: market.priceNative > 0 ? market.priceNative : params.amountNative / (estimatedTokens || 1)
        };
      } catch (solErr: any) {
        console.error(`[OnChainSwap] Solana buy execution error:`, solErr?.message || solErr);
        return {
          orderId, chain: 'solana', action: 'BUY', tokenAddress: params.tokenAddress,
          tokenSymbol: symbol, tokenName: name, amountIn: params.amountNative,
          estimatedAmountOut: 0, txHash: '', status: 'FAILED', isRealOnChain: false,
          executionTimeMs: Date.now() - startTime,
          error: solErr?.message || 'Solana 交易执行失败'
        };
      }
    }

    return {
      orderId, chain: targetChain, action: 'BUY', tokenAddress: params.tokenAddress,
      tokenSymbol: symbol, tokenName: name, amountIn: params.amountNative,
      estimatedAmountOut: 0, txHash: '', status: 'FAILED', isRealOnChain: false,
      executionTimeMs: Date.now() - startTime,
      error: 'No supported swap implementation or valid signing key; nothing was broadcast.'
    };
  }

  public static async executeFastSell(params: {
    userId: number;
    chain: string;
    walletAddress: string;
    privateKey?: string;
    tokenAddress: string;
    sellPercentage: number;
    sellInitial?: boolean;
    totalTokenBalance: number;
    costBasisNative: number;
    slippagePct: number;
    priorityFeeTier?: string;
    gasTip?: number;
  }): Promise<SwapExecutionResult> {
    const startTime = Date.now();
    const orderId = crypto.randomUUID();
    const targetChain = params.chain.toLowerCase();
    if (['sei', 'xlayer', 'ton', 'aptos'].includes(targetChain)) {
      return { orderId, chain: targetChain, action: 'SELL', tokenAddress: params.tokenAddress,
        tokenSymbol: 'TOKEN', tokenName: 'Token', amountIn: 0, estimatedAmountOut: 0,
        txHash: '', status: 'FAILED', isRealOnChain: false, executionTimeMs: Date.now() - startTime,
        error: 'Swaps are unavailable on this chain until a verified implementation is configured.' };
    }


    // 严格持仓校验
    if (params.totalTokenBalance <= 0) {
      return {
        orderId,
        chain: targetChain,
        action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
        tokenAddress: params.tokenAddress,
        tokenSymbol: 'TOKEN',
        tokenName: 'Token',
        amountIn: 0,
        estimatedAmountOut: 0,
        txHash: '',
        status: 'FAILED',
        isRealOnChain: false,
        executionTimeMs: Date.now() - startTime,
        error: '未持有该代币或链上代币余额为 0'
      };
    }

    const market = await TokenMarketService.fetchTokenDetails(params.tokenAddress, targetChain);
    const symbol = market.symbol || 'TOKEN';
    const name = market.name || 'Token';
    const currentPriceNative = market.priceNative > 0 ? market.priceNative : 0.0001;
    const slippageFactor = 1 - Math.min(Math.max((params.slippagePct || 5) / 100, 0.005), 0.5);

    let tokensToSell = 0;
    let expectedNativeBack = 0;

    if (params.sellInitial && params.costBasisNative > 0) {
      tokensToSell = Math.min(params.costBasisNative / currentPriceNative, params.totalTokenBalance);
      expectedNativeBack = tokensToSell * currentPriceNative * slippageFactor;
    } else {
      const pct = Math.min(Math.max(params.sellPercentage, 1), 100);
      tokensToSell = params.totalTokenBalance * (pct / 100);
      expectedNativeBack = tokensToSell * currentPriceNative * slippageFactor;
    }

    if (targetChain === 'sui') {
      try {
        const tokenIn = params.tokenAddress;
        const tokenOut = '0x2::sui::SUI';
        const commission = suiSellCommission(CONFIG.PROTOCOL_FEE_RATE_SCALED, CONFIG.PROTOCOL_FEE_RECIPIENT_SUI, params.walletAddress);
        let suiTokenDecimals = 9;
        try {
          const client = Config.getSuiClient();
          const meta = await client.core.getCoinMetadata({ coinType: params.tokenAddress });
          if (meta?.coinMetadata?.decimals !== undefined) {
            suiTokenDecimals = meta.coinMetadata.decimals;
          }
        } catch {}
        const amountInRaw = Math.floor(tokensToSell * Math.pow(10, suiTokenDecimals)).toString();

        let quote = null;
        try {
          quote = await getQuote({
            tokenIn,
            tokenOut,
            amountIn: amountInRaw
          });
        } catch (quoteErr: any) {
          console.warn(`[OnChainSwap] Sui sell quote fallback: ${quoteErr?.message}`);
        }

        const quoteReturnSui = quote ? parseFloat(quote.returnAmount || '0') / 1e9 : expectedNativeBack;

        if (params.privateKey && params.privateKey.startsWith('suiprivkey1')) {
          if (!quote || quoteReturnSui <= 0) {
            return {
              orderId,
              chain: 'sui',
              action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
              tokenAddress: params.tokenAddress,
              tokenSymbol: symbol,
              tokenName: name,
              amountIn: tokensToSell,
              estimatedAmountOut: 0,
              txHash: '',
              status: 'FAILED',
              isRealOnChain: false,
              executionTimeMs: Date.now() - startTime,
              error: '聚合器未找到有效卖出路径或代币流动性不足'
            };
          }

          console.log(`[OnChainSwap] Executing REAL on-chain Sui SELL for ${params.walletAddress}...`);
          const { secretKey } = decodeSuiPrivateKey(params.privateKey);
          const keypair = Ed25519Keypair.fromSecretKey(secretKey);
          if (keypair.toSuiAddress().toLowerCase() !== params.walletAddress.toLowerCase()) throw new Error('Signing key does not match wallet address');

          if (CONFIG.PROTOCOL_FEE_RATE_SCALED > 0n && quote.routes?.some((route: any) => route.hops?.some((hop: any) => hop.pool?.type === 'bluefinx'))) {
            throw new Error('BluefinX ignores protocol fee commission');
          }
          const { tx } = await buildTx({
            quoteResponse: quote,
            accountAddress: params.walletAddress,
            slippage: Math.min(Math.max((params.slippagePct || 5) / 100, 0.01), 0.5),
            commission
          });

          if (tx) {
            const client = Config.getSuiClient();
            const isBluefinX = tx instanceof BluefinXTx;
            const rawBytes = isBluefinX ? fromBase64(tx.txBytes) : await tx.build({ client: client.core });
            let localDigest = '';
            if (!isBluefinX) {
              try {
                localDigest = await tx.getDigest({ client: client.core });
              } catch {}
            }
            const { signature } = await keypair.signTransaction(rawBytes);
            const signedTxBytes = toBase64(rawBytes);
            let response: any;
            try {
              response = await executeTx(tx, signature, signedTxBytes, { effects: true, balanceChanges: true });
            } catch (execErr: any) {
              if (localDigest) {
                console.warn(`[OnChainSwap] Sui sell executeTx threw after signing (${localDigest}), reporting PENDING:`, execErr?.message || execErr);
                return {
                  orderId, chain: 'sui', action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`, tokenAddress: params.tokenAddress,
                  tokenSymbol: symbol, tokenName: name, amountIn: tokensToSell,
                  estimatedAmountOut: quoteReturnSui, txHash: localDigest,
                  status: 'PENDING', isRealOnChain: true, executionTimeMs: Date.now() - startTime,
                  error: 'Sui transaction broadcast was submitted or pending confirmation; check status before retrying.'
                };
              }
              throw execErr;
            }
            const execRes: any = response.Transaction || response.FailedTransaction || response;
            if (execRes.status?.success !== true) {
              return {
                orderId, chain: 'sui', action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`, tokenAddress: params.tokenAddress,
                tokenSymbol: symbol, tokenName: name, amountIn: tokensToSell,
                estimatedAmountOut: 0, txHash: execRes.digest || localDigest || '',
                status: execRes.status?.success === false ? 'FAILED' : 'PENDING',
                isRealOnChain: Boolean(execRes.digest || localDigest), executionTimeMs: Date.now() - startTime,
                error: 'Sui transaction did not report confirmed success; do not resubmit until checked.'
              };
            }

            const realDigest = execRes?.digest ||
              localDigest ||
              execRes?.Transaction?.digest ||
              execRes?.transaction?.digest ||
              execRes?.effects?.transactionDigest ||
              execRes?.Transaction?.effects?.transactionDigest;

            if (realDigest) {
              console.log(`[OnChainSwap] 🔥 Sui on-chain SELL SUCCESS! Digest: ${realDigest}`);
              let finalSuiOut = quoteReturnSui * (10000 - commission.commissionBps) / 10000;
              if (execRes?.balanceChanges) {
                const suiChange = execRes.balanceChanges.find(
                  (b: any) => (b.address === params.walletAddress || b.owner?.AddressOwner === params.walletAddress || (!b.address && !b.owner)) &&
                              (b.coinType === '0x2::sui::SUI' || b.coinType?.endsWith('::sui::SUI'))
                );
                if (suiChange && suiChange.amount) {
                  const rawChange = parseFloat(suiChange.amount);
                  if (rawChange > 0) {
                    finalSuiOut = rawChange / 1e9;
                  }
                }
              }

              return {
                orderId,
                chain: 'sui',
                action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
                tokenAddress: params.tokenAddress,
                tokenSymbol: symbol,
                tokenName: name,
                amountIn: tokensToSell,
                estimatedAmountOut: finalSuiOut,
                txHash: realDigest,
                status: 'SUCCESS',
                isRealOnChain: true,
                executionTimeMs: Date.now() - startTime,
                effectivePrice: quote?.effectivePrice || currentPriceNative
              };
            } else {
              throw new Error('节点未返回交易哈希');
            }
          }
        }
      } catch (err: any) {
        console.error(`[OnChainSwap] Sui sell execution error:`, err?.message || err);
        return {
          orderId,
          chain: 'sui',
          action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
          tokenAddress: params.tokenAddress,
          tokenSymbol: symbol,
          tokenName: name,
          amountIn: tokensToSell,
          estimatedAmountOut: 0,
          txHash: '',
          status: 'FAILED',
          isRealOnChain: false,
          executionTimeMs: Date.now() - startTime,
          error: err?.message || '链上卖出交易执行失败'
        };
      }
    }

    const evmSpec = EVM_SPECS[targetChain];
    if (evmSpec && params.privateKey && (params.privateKey.startsWith('0x') || params.privateKey.length === 64)) {
      try {
        const cleanPk = params.privateKey.startsWith('0x') ? params.privateKey : `0x${params.privateKey}`;
        const wallet = new ethers.Wallet(cleanPk);
        if (wallet.address.toLowerCase() !== params.walletAddress.toLowerCase()) throw new Error('Signing key does not match wallet address');
        const routerIface = new ethers.Interface(UNISWAP_ROUTER_ABI);
        const erc20Iface = new ethers.Interface(ERC20_ABI);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
        const path = [params.tokenAddress, evmSpec.wrappedNative];
        const nativeDecimals = evmSpec.nativeDecimals ?? 18;

        // 1. 查询代币精度 Decimals
        let tokenDecimals = 18;
        try {
          const decData = erc20Iface.encodeFunctionData('decimals');
          const decHex = await this.callEvmRpc(targetChain, 'eth_call', [{ to: params.tokenAddress, data: decData }, 'latest']);
          if (decHex && typeof decHex === 'string' && decHex !== '0x') {
            const parsed = parseInt(decHex, 16);
            if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 36) {
              tokenDecimals = parsed;
            }
          }
        } catch {}

        // 真实链上代币余额查询与精度精准计算 (BUG-016 消除 6 位截断与 dust)
        let onChainTokenBalance = 0n;
        try {
          const balData = erc20Iface.encodeFunctionData('balanceOf', [wallet.address]);
          const balHex = await this.callEvmRpc(targetChain, 'eth_call', [{ to: params.tokenAddress, data: balData }, 'latest']);
          if (balHex && typeof balHex === 'string' && balHex !== '0x') {
            onChainTokenBalance = BigInt(balHex);
          }
        } catch {}

        let rawTokenAmount = 0n;
        if (params.sellPercentage === 100 && onChainTokenBalance > 0n) {
          rawTokenAmount = onChainTokenBalance;
        } else if (onChainTokenBalance > 0n) {
          rawTokenAmount = (onChainTokenBalance * BigInt(Math.floor(params.sellPercentage))) / 100n;
        } else {
          const safeDecimals = Math.min(Math.max(tokenDecimals, 0), 18);
          const safeStr = tokensToSell.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: safeDecimals });
          rawTokenAmount = ethers.parseUnits(safeStr, tokenDecimals);
        }

        if (rawTokenAmount <= 0n) {
          throw new Error('计算出的卖出代币数量为 0，请检查代币精度与持仓');
        }

        // 2. 检查并按需自动授权 ERC20 Allowance (BUG-010 按需精确授权 & 检验回执)
        let currentAllowance = 0n;
        try {
          const allowData = erc20Iface.encodeFunctionData('allowance', [wallet.address, evmSpec.routerAddress]);
          const allowHex = await this.callEvmRpc(targetChain, 'eth_call', [{ to: params.tokenAddress, data: allowData }, 'latest']);
          if (allowHex && typeof allowHex === 'string' && allowHex !== '0x') {
            currentAllowance = BigInt(allowHex);
          }
        } catch {}

        if (currentAllowance < rawTokenAmount) {
          console.log(`[OnChainSwap] Insufficient allowance for router ${evmSpec.routerAddress}, sending approve for ${rawTokenAmount}...`);
          const approveCalldata = erc20Iface.encodeFunctionData('approve', [evmSpec.routerAddress, rawTokenAmount]);
          const approveTxHash = await EvmNonceManager.withLock(targetChain, wallet.address, async (approveNonce) => {
            const approveGasPriceHex = await this.callEvmRpc(targetChain, 'eth_gasPrice', []);
            const approveTx = {
              to: params.tokenAddress,
              value: 0n,
              data: approveCalldata,
              nonce: approveNonce,
              gasLimit: 70000n,
              gasPrice: BigInt(approveGasPriceHex || '0x4a817c800'),
              chainId: evmSpec.chainId
            };
            const signedApprove = await wallet.signTransaction(approveTx);
            return await this.callEvmRpc(targetChain, 'eth_sendRawTransaction', [signedApprove]);
          });
          console.log(`[OnChainSwap] Approve broadcast: ${approveTxHash}, waiting for confirmation...`);
          const approveRes = await this.pollEvmReceipt(targetChain, approveTxHash, 15000);
          if (approveRes.status === 'FAILED') {
            return {
              orderId,
              chain: targetChain,
              action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
              tokenAddress: params.tokenAddress,
              tokenSymbol: symbol,
              tokenName: name,
              amountIn: tokensToSell,
              estimatedAmountOut: 0,
              txHash: approveTxHash,
              status: 'FAILED',
              isRealOnChain: true,
              executionTimeMs: Date.now() - startTime,
              error: `ERC20 授权交易被合约回滚 (tx: ${approveTxHash})`
            };
          } else if (approveRes.status === 'PENDING') {
            return {
              orderId,
              chain: targetChain,
              action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
              tokenAddress: params.tokenAddress,
              tokenSymbol: symbol,
              tokenName: name,
              amountIn: tokensToSell,
              estimatedAmountOut: 0,
              txHash: approveTxHash,
              status: 'PENDING',
              isRealOnChain: true,
              executionTimeMs: Date.now() - startTime,
              error: `ERC20 授权交易已广播但等待上链确认 (tx: ${approveTxHash})，请等待确认后再卖出`
            };
          }
        }

        let calldata = '';
        let minimum = 0n;

        if (evmSpec.dexType === 'uniswapV3') {
          const usdcAddr = evmSpec.wrappedNative;
          const v3Pool = await this.getV3Pool(targetChain, params.tokenAddress, usdcAddr);
          if (!v3Pool) {
            return {
              orderId,
              chain: targetChain,
              action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
              tokenAddress: params.tokenAddress,
              tokenSymbol: symbol,
              tokenName: name,
              amountIn: tokensToSell,
              estimatedAmountOut: 0,
              txHash: '',
              status: 'FAILED',
              isRealOnChain: false,
              executionTimeMs: Date.now() - startTime,
              error: `未在 ${targetChain} 链上定位到代币流动性池 (Uniswap V3 Pool)`
            };
          }

          // zeroForOne: token0 -> token1
          const isZeroForOne = params.tokenAddress.toLowerCase() < usdcAddr.toLowerCase();
          const poolBigInt = BigInt(v3Pool.poolAddress);
          const poolParam = isZeroForOne ? poolBigInt : ((1n << 255n) | poolBigInt);
          const pools = [poolParam];

          // 估算预期回款 USDC
          const sellExpectedNative = (market.priceNative && market.priceNative > 0)
            ? (tokensToSell * market.priceNative)
            : 0.1;
          const minReturnUnits = BigInt(Math.floor(sellExpectedNative * (1 - (params.slippagePct || 5) / 100) * 1e6));

          const v3RouterIface = new ethers.Interface(UNISWAP_V3_ROUTER_ABI);
          calldata = v3RouterIface.encodeFunctionData('exactInputSingle', [{
            tokenIn: params.tokenAddress,
            tokenOut: usdcAddr,
            fee: v3Pool.fee,
            recipient: wallet.address,
            amountIn: rawTokenAmount,
            amountOutMinimum: minReturnUnits > 0n ? minReturnUnits : 1n,
            sqrtPriceLimitX96: 0n
          }]);
        } else {
          minimum = await this.minimumOutput(targetChain, rawTokenAmount, path, params.slippagePct);
          calldata = routerIface.encodeFunctionData('swapExactTokensForETHSupportingFeeOnTransferTokens', [
            rawTokenAmount,
            minimum,
            path,
            wallet.address,
            deadline
          ]);
        }

        // 3. Pre-flight 仿真模拟 (eth_estimateGas)
        let estimatedGas = 350000n;
        try {
          const simParams = [{
            from: wallet.address,
            to: evmSpec.routerAddress,
            value: '0x0',
            data: calldata
          }];
          const estHex = await this.callEvmRpc(targetChain, 'eth_estimateGas', simParams);
          if (estHex && typeof estHex === 'string') {
            estimatedGas = (BigInt(estHex) * 125n) / 100n;
          }
        } catch (simErr: any) {
          const friendlyErr = this.parseEvmRevertReason(simErr);
          console.warn(`[OnChainSwap] ⚠️ Pre-flight EVM Sell simulation REVERTED on ${targetChain}:`, friendlyErr);
          return {
            orderId,
            chain: targetChain,
            action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
            tokenAddress: params.tokenAddress,
            tokenSymbol: symbol,
            tokenName: name,
            amountIn: tokensToSell,
            estimatedAmountOut: 0,
            txHash: '',
            status: 'FAILED',
            isRealOnChain: false,
            executionTimeMs: Date.now() - startTime,
            error: friendlyErr
          };
        }

        // P0-04: Capture pre-sell native balance for actual revenue calculation
        let preSellBalHex: string = '0x0';
        try {
          preSellBalHex = await this.callEvmRpc(targetChain, 'eth_getBalance', [wallet.address, 'latest']);
        } catch { /* will fall back to estimated fee */ }

        const realTxHash = await EvmNonceManager.withLock(targetChain, wallet.address, async (nonce) => {
          const gasPriceHex = await this.callEvmRpc(targetChain, 'eth_gasPrice', []);
          let gasPrice = BigInt(gasPriceHex || '0x4a817c800');
          if (params.gasTip && params.gasTip > 0 && estimatedGas > 0n) {
            const tipUnits = nativeBaseUnits(params.gasTip.toString(), nativeDecimals);
            const tipPerGas = tipUnits / estimatedGas;
            if (tipPerGas > 0n) {
              gasPrice += tipPerGas;
            }
          }

          const txDraft = {
            to: evmSpec.routerAddress,
            value: 0n,
            data: calldata,
            nonce,
            gasLimit: estimatedGas,
            gasPrice,
            chainId: evmSpec.chainId
          };

          const signedTxHex = await wallet.signTransaction(txDraft);
          return await this.callEvmRpc(targetChain, 'eth_sendRawTransaction', [signedTxHex]);
        });

        if (realTxHash && typeof realTxHash === 'string' && realTxHash.startsWith('0x')) {
          console.log(`[OnChainSwap] 📡 Real EVM Sell broadcast to mempool on ${targetChain}! Hash: ${realTxHash}`);
          const receiptRes = await this.pollEvmReceipt(targetChain, realTxHash, 12000);

          if (receiptRes.status === 'PENDING') {
              return { orderId, chain: targetChain, action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
                tokenAddress: params.tokenAddress, tokenSymbol: symbol, tokenName: name,
                amountIn: tokensToSell, estimatedAmountOut: 0, txHash: realTxHash,
                status: 'PENDING', isRealOnChain: true, executionTimeMs: Date.now() - startTime,
                error: 'Transaction broadcast; confirmation pending. Do not resubmit.' };
            }
            if (receiptRes.status === 'FAILED') {
            console.error(`[OnChainSwap] ❌ EVM Sell REVERTED on-chain on ${targetChain}! Hash: ${realTxHash}`);
            return {
              orderId,
              chain: targetChain,
              action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
              tokenAddress: params.tokenAddress,
              tokenSymbol: symbol,
              tokenName: name,
              amountIn: tokensToSell,
              estimatedAmountOut: 0,
              txHash: realTxHash,
              status: 'FAILED',
              isRealOnChain: true,
              executionTimeMs: Date.now() - startTime,
              error: '链上执行被合约回滚 (Status: Reverted)。可能原因：代币卖出税过高、滑点过低或交易受限。'
            };
          }

          const nativeDecimals = evmSpec.nativeDecimals ?? 18;
          // P0-04 FIX: Use actual confirmed proceeds for fee, not estimated.
          // Query post-swap balance and compare with pre-swap to get real revenue.
          let actualNativeWei: bigint;
          try {
            const postBalHex = await this.callEvmRpc(targetChain, 'eth_getBalance', [wallet.address, 'latest']);
            const postBal = BigInt(postBalHex || '0x0');
            const preSellBal = BigInt(preSellBalHex || '0x0');
            // Actual proceeds = post balance - pre balance (gas already deducted by chain)
            actualNativeWei = postBal > preSellBal ? postBal - preSellBal : 0n;
          } catch {
            // If balance query fails, do NOT charge fee on unknown revenue
            actualNativeWei = 0n;
          }
          const expectedNativeWei = nativeBaseUnits(expectedNativeBack.toFixed(nativeDecimals > 8 ? 8 : nativeDecimals), nativeDecimals);
          const feeRecipient = (targetChain === 'arc' && CONFIG.PROTOCOL_FEE_RECIPIENT_ARC)
            ? CONFIG.PROTOCOL_FEE_RECIPIENT_ARC
            : CONFIG.PROTOCOL_FEE_RECIPIENT_EVM;
          const feeBaseWei = actualNativeWei > 0n ? actualNativeWei : expectedNativeWei;
          const sellFeePlan = createEvmSellFeePlan(feeBaseWei, CONFIG.PROTOCOL_FEE_RATE_SCALED, feeRecipient);
          if (sellFeePlan.fee > 0n && sellFeePlan.recipient) {
            try {
              const feeTxHash = await EvmNonceManager.withLock(targetChain, wallet.address, async (feeNonce) => {
                const feeGasPriceHex = await this.callEvmRpc(targetChain, 'eth_gasPrice', []);
                const feeGasPrice = BigInt(feeGasPriceHex || '0x4a817c800');
                const feeDraft = {
                  to: sellFeePlan.recipient,
                  value: sellFeePlan.fee,
                  nonce: feeNonce,
                  gasLimit: EVM_FEE_TRANSFER_GAS,
                  gasPrice: feeGasPrice,
                  chainId: evmSpec.chainId
                };
                const signedFeeTx = await wallet.signTransaction(feeDraft);
                return await this.callEvmRpc(targetChain, 'eth_sendRawTransaction', [signedFeeTx]);
              });
              console.log(`[OnChainSwap] 💰 EVM sell protocol fee broadcast on ${targetChain}: ${feeTxHash}`);
            } catch (feeErr: any) {
              console.warn(`[OnChainSwap] ⚠️ EVM sell protocol fee transfer deferred on ${targetChain}:`, feeErr?.message || feeErr);
            }
          }

          const finalNativeOut = Number(sellFeePlan.net) / (10 ** nativeDecimals);

          return {
            orderId,
            chain: targetChain,
            action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
            tokenAddress: params.tokenAddress,
            tokenSymbol: symbol,
            tokenName: name,
            amountIn: tokensToSell,
            estimatedAmountOut: finalNativeOut,
            txHash: realTxHash,
            status: 'SUCCESS',
            isRealOnChain: true,
            executionTimeMs: Date.now() - startTime,
            effectivePrice: currentPriceNative
          };
        }
      } catch (sellEvmErr: any) {
        console.error(`[OnChainSwap] Real EVM Sell failed on ${targetChain}:`, sellEvmErr?.message || sellEvmErr);
        return {
          orderId,
          chain: targetChain,
          action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
          tokenAddress: params.tokenAddress,
          tokenSymbol: symbol,
          tokenName: name,
          amountIn: tokensToSell,
          estimatedAmountOut: 0,
          txHash: '',
          status: 'FAILED',
          isRealOnChain: false,
          executionTimeMs: Date.now() - startTime,
          error: sellEvmErr?.message || 'EVM 链上卖出执行失败'
        };
      }
    }

    // Solana 真实链上卖出 (Jupiter V6 API)
    if (targetChain === 'solana') {
      if (!params.privateKey) {
        return {
          orderId, chain: 'solana', action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
          tokenAddress: params.tokenAddress, tokenSymbol: symbol, tokenName: name,
          amountIn: tokensToSell, estimatedAmountOut: 0, txHash: '',
          status: 'FAILED', isRealOnChain: false, executionTimeMs: Date.now() - startTime,
          error: '缺少有效 Solana 私钥'
        };
      }
      try {
        const secretKey = bs58.decode(params.privateKey);
        const keypair = SolKeypair.fromSecretKey(secretKey);
        if (keypair.publicKey.toBase58().toLowerCase() !== params.walletAddress.toLowerCase()) {
          throw new Error('Signing key does not match wallet address');
        }

        // 1. 查询代币精度与持有量
        let tokenDecimals = 6;
        try {
          const supplyRes = await this.callSolanaRpc('getTokenSupply', [params.tokenAddress]);
          if (supplyRes?.value?.decimals !== undefined) tokenDecimals = supplyRes.value.decimals;
        } catch {}

        // 查询用户链上真实的 SPL token balance
        let rawAmountIn: bigint = 0n;
        try {
          const accs = await this.callSolanaRpc('getTokenAccountsByOwner', [
            keypair.publicKey.toBase58(),
            { mint: params.tokenAddress },
            { encoding: 'jsonParsed' }
          ]);
          const tokenAcc = accs?.value?.[0];
          if (tokenAcc?.account?.data?.parsed?.info?.tokenAmount?.amount) {
            const onChainBal = BigInt(tokenAcc.account.data.parsed.info.tokenAmount.amount);
            if (params.sellPercentage === 100) {
              rawAmountIn = onChainBal;
            } else {
              rawAmountIn = (onChainBal * BigInt(Math.floor(params.sellPercentage))) / 100n;
            }
          }
        } catch {}

        if (rawAmountIn <= 0n) {
          rawAmountIn = BigInt(Math.floor(tokensToSell * Math.pow(10, tokenDecimals)));
        }
        if (rawAmountIn <= 0n) throw new Error('卖出代币数量不能为 0');

        const inputMint = params.tokenAddress;
        const outputMint = 'So11111111111111111111111111111111111111112';
        const slippageBps = Math.min(Math.max(Math.floor((params.slippagePct || 5) * 100), 50), 5000);

        // 2. 获取 Jupiter 卖出报价
        const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${rawAmountIn.toString()}&slippageBps=${slippageBps}`;
        const quoteResp = await this.httpClient.get(quoteUrl);
        if (!quoteResp.data || !quoteResp.data.outAmount) {
          throw new Error('Jupiter 聚合器未找到有效卖出路径或流动性不足');
        }
        const quoteData = quoteResp.data;

        // 3. 构建 Swap 交易
        const swapResp = await this.httpClient.post('https://quote-api.jup.ag/v6/swap', {
          quoteResponse: quoteData,
          userPublicKey: keypair.publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto'
        });
        if (!swapResp.data?.swapTransaction) {
          throw new Error('Jupiter Swap 交易生成失败');
        }

        // 4. 签名与广播
        const swapBuf = Buffer.from(swapResp.data.swapTransaction, 'base64');
        const versionedTx = VersionedTransaction.deserialize(swapBuf);
        versionedTx.sign([keypair]);
        const rawBytes = versionedTx.serialize();
        const rawBase64 = Buffer.from(rawBytes).toString('base64');

        const realTxSig = await this.callSolanaRpc('sendTransaction', [rawBase64, { encoding: 'base64', skipPreflight: false, maxRetries: 2 }]);
        if (!realTxSig || typeof realTxSig !== 'string') {
          throw new Error(`Solana 节点返回异常: ${JSON.stringify(realTxSig)}`);
        }

        console.log(`[OnChainSwap] 📡 Real Solana Sell broadcast to network! Sig: ${realTxSig}`);

        // 5. 确认回执
        const receiptRes = await this.pollSolanaReceipt(realTxSig, 25000);
        const outLamports = BigInt(quoteData.outAmount || '0');
        const sellFeePlan = createSolanaSellFeePlan(outLamports, CONFIG.PROTOCOL_FEE_RATE_SCALED, CONFIG.PROTOCOL_FEE_RECIPIENT_SOLANA);
        const finalSolOut = Number(sellFeePlan.net) / LAMPORTS_PER_SOL;

        if (receiptRes.status === 'PENDING') {
          return {
            orderId, chain: 'solana', action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
            tokenAddress: params.tokenAddress, tokenSymbol: symbol, tokenName: name,
            amountIn: tokensToSell, estimatedAmountOut: finalSolOut, txHash: realTxSig,
            status: 'PENDING', isRealOnChain: true, executionTimeMs: Date.now() - startTime,
            effectivePrice: quoteData.effectivePrice || currentPriceNative
          };
        }
        if (receiptRes.status === 'FAILED') {
          return {
            orderId, chain: 'solana', action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
            tokenAddress: params.tokenAddress, tokenSymbol: symbol, tokenName: name,
            amountIn: tokensToSell, estimatedAmountOut: 0, txHash: realTxSig,
            status: 'FAILED', isRealOnChain: true, executionTimeMs: Date.now() - startTime,
            error: `Solana 卖出交易链上回滚: ${JSON.stringify(receiptRes.err)}`
          };
        }

        if (sellFeePlan.fee > 0n && sellFeePlan.recipient) {
          try {
            const feeTransferTx = new SolTransaction().add(
              SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: new SolPublicKey(sellFeePlan.recipient),
                lamports: sellFeePlan.fee
              })
            );
            const bhRes = await this.callSolanaRpc('getLatestBlockhash', [{ commitment: 'confirmed' }]);
            feeTransferTx.recentBlockhash = bhRes?.value?.blockhash || bhRes?.blockhash || '11111111111111111111111111111111';
            feeTransferTx.feePayer = keypair.publicKey;
            feeTransferTx.sign(keypair);
            const feeRawBase64 = Buffer.from(feeTransferTx.serialize()).toString('base64');
            const feeSig = await this.callSolanaRpc('sendTransaction', [feeRawBase64, { encoding: 'base64', skipPreflight: false, maxRetries: 2 }]);
            console.log(`[OnChainSwap] 💰 Solana sell protocol fee broadcast: ${feeSig}`);
          } catch (feeErr: any) {
            console.warn(`[OnChainSwap] ⚠️ Solana sell protocol fee transfer deferred:`, feeErr?.message || feeErr);
          }
        }

        return {
          orderId, chain: 'solana', action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
          tokenAddress: params.tokenAddress, tokenSymbol: symbol, tokenName: name,
          amountIn: tokensToSell, estimatedAmountOut: finalSolOut, txHash: realTxSig,
          status: 'SUCCESS', isRealOnChain: true, executionTimeMs: Date.now() - startTime,
          effectivePrice: quoteData.effectivePrice || currentPriceNative
        };
      } catch (solErr: any) {
        console.error(`[OnChainSwap] Solana sell execution error:`, solErr?.message || solErr);
        return {
          orderId, chain: 'solana', action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
          tokenAddress: params.tokenAddress, tokenSymbol: symbol, tokenName: name,
          amountIn: tokensToSell, estimatedAmountOut: 0, txHash: '',
          status: 'FAILED', isRealOnChain: false, executionTimeMs: Date.now() - startTime,
          error: solErr?.message || 'Solana 卖出执行失败'
        };
      }
    }

    const txHash = '';
    return {
      orderId,
      chain: targetChain,
      action: params.sellInitial ? 'SELL_INITIAL' : `SELL_${params.sellPercentage}%`,
      tokenAddress: params.tokenAddress,
      tokenSymbol: symbol,
      tokenName: name,
      amountIn: tokensToSell,
      estimatedAmountOut: expectedNativeBack,
      txHash,
      status: 'FAILED',
      error: 'No supported swap implementation or valid signing key',
      isRealOnChain: false,
      executionTimeMs: Math.max(Date.now() - startTime, 18),
      effectivePrice: currentPriceNative
    };
  }

  public static async executeTransferNative(params: {
    chain: string;
    fromAddress: string;
    privateKey?: string;
    toAddress: string;
    amount: number;
  }): Promise<{
    success: boolean;
    txHash: string;
    isRealOnChain: boolean;
    actualAmount: number;
    toAddress: string;
    error?: string;
  }> {
    const c = params.chain.toLowerCase();
    const nativeSymbol = this.getChainNativeSymbol(c);

    // 1. 全链严格余额检查
    const currentOnChainBalance = (await ChainBalanceService.getNativeBalance(c, params.fromAddress)) ?? 0;
    if (currentOnChainBalance < params.amount) {
      return {
        success: false,
        txHash: '',
        isRealOnChain: false,
        actualAmount: params.amount,
        toAddress: params.toAddress,
        error: `链上可用余额不足 (当前: ${currentOnChainBalance.toFixed(4)} ${nativeSymbol}，转账需要: ${params.amount} ${nativeSymbol})`
      };
    }

    // 2. Sui 真实链上转账
    if (c === 'sui') {
      if (!params.privateKey || !params.privateKey.startsWith('suiprivkey1')) {
        return {
          success: false,
          txHash: '',
          isRealOnChain: false,
          actualAmount: params.amount,
          toAddress: params.toAddress,
          error: '当前钱包未配置有效 Sui 私钥，无法执行链上转账'
        };
      }
      try {
        console.log(`[OnChainTransfer] Initiating REAL on-chain Sui transfer of ${params.amount} SUI to ${params.toAddress}...`);
        const { secretKey } = decodeSuiPrivateKey(params.privateKey);
        const keypair = Ed25519Keypair.fromSecretKey(secretKey);
        const client = Config.getSuiClient();

        const tx = new SuiTransaction();
        const amountMist = Math.floor(params.amount * 1e9);
        const [coin] = tx.splitCoins(tx.gas, [amountMist]);
        tx.transferObjects([coin], params.toAddress);
        tx.setSender(keypair.toSuiAddress());

        const res: any = await (client as any).signAndExecuteTransaction({
          transaction: tx,
          signer: keypair
        });

        const realDigest =
          res?.digest ||
          res?.Transaction?.digest ||
          res?.transaction?.digest ||
          res?.effects?.transactionDigest ||
          res?.Transaction?.effects?.transactionDigest;

        if (realDigest) {
          console.log(`[OnChainTransfer] 🔥 Sui real transfer SUCCESS! Digest: ${realDigest}`);
          return {
            success: true,
            txHash: realDigest,
            isRealOnChain: true,
            actualAmount: params.amount,
            toAddress: params.toAddress
          };
        } else {
          return {
            success: false,
            txHash: '',
            isRealOnChain: false,
            actualAmount: params.amount,
            toAddress: params.toAddress,
            error: 'Sui 节点未返回交易摘要 Digest'
          };
        }
      } catch (err: any) {
        console.error(`[OnChainTransfer] Real Sui transfer error:`, err?.message || err);
        return {
          success: false,
          txHash: '',
          isRealOnChain: false,
          actualAmount: params.amount,
          toAddress: params.toAddress,
          error: err?.message || '链上转账执行失败'
        };
      }
    }

    // 3. EVM 真实链上转账
    const evmSpec = EVM_SPECS[c];
    if (evmSpec) {
      if (!params.privateKey || (!params.privateKey.startsWith('0x') && params.privateKey.length !== 64)) {
        return {
          success: false,
          txHash: '',
          isRealOnChain: false,
          actualAmount: params.amount,
          toAddress: params.toAddress,
          error: `当前钱包未配置有效 ${evmSpec.symbol} EVM 私钥，无法执行真实链上转账`
        };
      }

      try {
        console.log(`[OnChainTransfer] Initiating REAL EVM transfer of ${params.amount} ${evmSpec.symbol} on ${c} to ${params.toAddress}...`);
        const cleanPk = params.privateKey.startsWith('0x') ? params.privateKey : `0x${params.privateKey}`;
        const wallet = new ethers.Wallet(cleanPk);

        const nativeDecimals = evmSpec.nativeDecimals ?? 18;
        const valueWei = nativeBaseUnits(params.amount.toString(), nativeDecimals);

        const realTxHash = await EvmNonceManager.withLock(c, wallet.address, async (nonce) => {
          const gasPriceHex = await this.callEvmRpc(c, 'eth_gasPrice', []);
          const gasPrice = BigInt(gasPriceHex || '0x4a817c800');

          const txDraft = {
            to: params.toAddress,
            value: valueWei,
            nonce,
            gasLimit: 21000n,
            gasPrice,
            chainId: evmSpec.chainId
          };

          const signedTxHex = await wallet.signTransaction(txDraft);
          return await this.callEvmRpc(c, 'eth_sendRawTransaction', [signedTxHex]);
        });

        if (realTxHash && typeof realTxHash === 'string' && realTxHash.startsWith('0x')) {
          console.log(`[OnChainTransfer] 📡 Real EVM transfer broadcast on ${c}! Hash: ${realTxHash}, waiting for receipt...`);
          const receipt = await this.pollEvmReceipt(c, realTxHash, 15000);
          if (receipt.status === 'FAILED') {
            return {
              success: false,
              txHash: realTxHash,
              isRealOnChain: true,
              actualAmount: params.amount,
              toAddress: params.toAddress,
              error: 'EVM 链上转账被合约回滚 (Reverted)'
            };
          }
          if (receipt.status === 'PENDING') {
            return {
              success: false,
              txHash: realTxHash,
              isRealOnChain: true,
              actualAmount: params.amount,
              toAddress: params.toAddress,
              error: 'EVM 链上转账已广播但尚未确认 (PENDING)'
            };
          }
          console.log(`[OnChainTransfer] 🔥 EVM real transfer SUCCESS on ${c}! Hash: ${realTxHash}`);
          return {
            success: true,
            txHash: realTxHash,
            isRealOnChain: true,
            actualAmount: params.amount,
            toAddress: params.toAddress
          };
        } else {
          return {
            success: false,
            txHash: '',
            isRealOnChain: false,
            actualAmount: params.amount,
            toAddress: params.toAddress,
            error: `节点返回非标准哈希: ${JSON.stringify(realTxHash)}`
          };
        }
      } catch (evmErr: any) {
        console.error(`[OnChainTransfer] Real EVM transfer error on ${c}:`, evmErr?.message || evmErr);
        return {
          success: false,
          txHash: '',
          isRealOnChain: false,
          actualAmount: params.amount,
          toAddress: params.toAddress,
          error: evmErr?.message || 'EVM 链上转账广播失败'
        };
      }
    }

    // 4. Solana 真实链上转账
    if (c === 'solana') {
      if (!params.privateKey) {
        return {
          success: false,
          txHash: '',
          isRealOnChain: false,
          actualAmount: params.amount,
          toAddress: params.toAddress,
          error: '当前钱包未配置有效 Solana 私钥，无法执行链上转账'
        };
      }

      try {
        console.log(`[OnChainTransfer] Initiating REAL Solana transfer of ${params.amount} SOL to ${params.toAddress}...`);
        const secretKey = bs58.decode(params.privateKey);
        const keypair = SolKeypair.fromSecretKey(secretKey);

        const bhResult = await this.callSolanaRpc('getLatestBlockhash', [{ commitment: 'finalized' }]);
        const recentBlockhash = bhResult?.value?.blockhash;

        if (!recentBlockhash) {
          throw new Error('未能从 Solana 节点获取最新区块哈希 Blockhash');
        }

        const lamports = BigInt(Math.floor(params.amount * LAMPORTS_PER_SOL));
        const solTx = new SolTransaction({
          recentBlockhash,
          feePayer: keypair.publicKey
        }).add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new SolPublicKey(params.toAddress),
            lamports
          })
        );

        solTx.sign(keypair);
        const rawWire = solTx.serialize();
        const rawBase64 = Buffer.from(rawWire).toString('base64');
        const realTxSig = await this.callSolanaRpc('sendTransaction', [rawBase64, { encoding: 'base64' }]);

        if (realTxSig && typeof realTxSig === 'string') {
          console.log(`[OnChainTransfer] 📡 Solana real transfer broadcast! Sig: ${realTxSig}, waiting for confirmation...`);
          const receipt = await this.pollSolanaReceipt(realTxSig, 25000);
          if (receipt.status === 'FAILED') {
            return {
              success: false,
              txHash: realTxSig,
              isRealOnChain: true,
              actualAmount: params.amount,
              toAddress: params.toAddress,
              error: 'Solana 链上转账回滚'
            };
          }
          if (receipt.status === 'PENDING') {
            return {
              success: false,
              txHash: realTxSig,
              isRealOnChain: true,
              actualAmount: params.amount,
              toAddress: params.toAddress,
              error: 'Solana 链上转账已广播但尚未确认 (PENDING)'
            };
          }
          console.log(`[OnChainTransfer] 🔥 Solana real transfer SUCCESS! Signature: ${realTxSig}`);
          return {
            success: true,
            txHash: realTxSig,
            isRealOnChain: true,
            actualAmount: params.amount,
            toAddress: params.toAddress
          };
        } else {
          throw new Error(`Solana 节点返回异常: ${JSON.stringify(realTxSig)}`);
        }
      } catch (solErr: any) {
        console.error(`[OnChainTransfer] Real Solana transfer error:`, solErr?.message || solErr);
        return {
          success: false,
          txHash: '',
          isRealOnChain: false,
          actualAmount: params.amount,
          toAddress: params.toAddress,
          error: solErr?.message || 'Solana 链上转账广播失败'
        };
      }
    }

    return {
      success: false,
      txHash: '',
      isRealOnChain: false,
      actualAmount: params.amount,
      toAddress: params.toAddress,
      error: `当前链 (${c}) 暂不支持真实链上原生代币转账`
    };
  }

  public static async executeTransferToken(params: {
    chain: string;
    fromAddress: string;
    privateKey?: string;
    tokenAddress: string;
    toAddress: string;
    amount: number;
  }): Promise<{
    success: boolean;
    txHash: string;
    isRealOnChain: boolean;
    actualAmount: number;
    toAddress: string;
    error?: string;
    status?: 'SUCCESS' | 'FAILED' | 'PENDING';
  }> {
    const c = params.chain.toLowerCase();
    if (!params.toAddress || params.amount <= 0) {
      return {
        success: false,
        txHash: '',
        isRealOnChain: false,
        actualAmount: params.amount,
        toAddress: params.toAddress,
        error: '转账目标地址无效或金额必须大于 0'
      };
    }
    if (!params.privateKey) {
      return {
        success: false,
        txHash: '',
        isRealOnChain: false,
        actualAmount: params.amount,
        toAddress: params.toAddress,
        error: '当前钱包未配置有效私钥，无法执行链上代币转账'
      };
    }

    // 1. EVM 链 ERC-20 真实转账
    const evmSpec = EVM_SPECS[c];
    if (evmSpec) {
      try {
        const cleanPk = params.privateKey.startsWith('0x') ? params.privateKey : `0x${params.privateKey}`;
        const wallet = new ethers.Wallet(cleanPk);
        if (wallet.address.toLowerCase() !== params.fromAddress.toLowerCase()) {
          throw new Error('Signing key does not match wallet address');
        }

        const erc20Iface = new ethers.Interface(ERC20_ABI);

        // 获取代币精度
        let tokenDecimals = 18;
        try {
          const decData = erc20Iface.encodeFunctionData('decimals');
          const decHex = await this.callEvmRpc(c, 'eth_call', [{ to: params.tokenAddress, data: decData }, 'latest']);
          if (decHex && typeof decHex === 'string' && decHex !== '0x') {
            const parsed = parseInt(decHex, 16);
            if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 36) {
              tokenDecimals = parsed;
            }
          }
        } catch {}

        // 查询用户代币余额
        let onChainTokenBalance = 0n;
        try {
          const balData = erc20Iface.encodeFunctionData('balanceOf', [wallet.address]);
          const balHex = await this.callEvmRpc(c, 'eth_call', [{ to: params.tokenAddress, data: balData }, 'latest']);
          if (balHex && typeof balHex === 'string' && balHex !== '0x') {
            onChainTokenBalance = BigInt(balHex);
          }
        } catch {}

        const safeDecimals = Math.min(Math.max(tokenDecimals, 0), 18);
        const safeStr = params.amount.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: safeDecimals });
        const rawTokenAmount = ethers.parseUnits(safeStr, tokenDecimals);

        if (rawTokenAmount <= 0n) {
          throw new Error('转账代币数量过小');
        }
        if (onChainTokenBalance < rawTokenAmount) {
          throw new Error('代币余额不足 (当前链上持有量低于转账数量)');
        }

        const transferCalldata = erc20Iface.encodeFunctionData('transfer', [params.toAddress, rawTokenAmount]);

        let estimatedGas = 65000n;
        try {
          const estHex = await this.callEvmRpc(c, 'eth_estimateGas', [{
            from: wallet.address,
            to: params.tokenAddress,
            value: '0x0',
            data: transferCalldata
          }]);
          if (estHex && typeof estHex === 'string') {
            estimatedGas = (BigInt(estHex) * 125n) / 100n;
          }
        } catch (simErr: any) {
          const reason = this.parseEvmRevertReason(simErr);
          throw new Error(`代币转账预执行失败: ${reason}`);
        }

        const realTxHash = await EvmNonceManager.withLock(c, wallet.address, async (nonce) => {
          const gasPriceHex = await this.callEvmRpc(c, 'eth_gasPrice', []);
          const gasPrice = BigInt(gasPriceHex || '0x4a817c800');

          const txDraft = {
            to: params.tokenAddress,
            value: 0n,
            data: transferCalldata,
            nonce,
            gasLimit: estimatedGas,
            gasPrice,
            chainId: evmSpec.chainId
          };

          const signedTxHex = await wallet.signTransaction(txDraft);
          return await this.callEvmRpc(c, 'eth_sendRawTransaction', [signedTxHex]);
        });

        if (realTxHash && typeof realTxHash === 'string' && realTxHash.startsWith('0x')) {
          console.log(`[OnChainTransfer] 📡 Real EVM ERC20 transfer broadcast on ${c}! Hash: ${realTxHash}, waiting for receipt...`);
          const receipt = await this.pollEvmReceipt(c, realTxHash, 15000);
          if (receipt.status === 'FAILED') {
            return {
              success: false,
              txHash: realTxHash,
              isRealOnChain: true,
              actualAmount: params.amount,
              toAddress: params.toAddress,
              status: 'FAILED',
              error: 'ERC20 代币转账交易被合约回滚 (Reverted)'
            };
          }
          if (receipt.status === 'PENDING') {
            return {
              success: false,
              txHash: realTxHash,
              isRealOnChain: true,
              actualAmount: params.amount,
              toAddress: params.toAddress,
              status: 'PENDING',
              error: 'ERC20 代币转账交易已广播但尚未确认 (PENDING)'
            };
          }
          return {
            success: true,
            txHash: realTxHash,
            isRealOnChain: true,
            actualAmount: params.amount,
            toAddress: params.toAddress,
            status: 'SUCCESS'
          };
        } else {
          throw new Error(`节点返回异常: ${JSON.stringify(realTxHash)}`);
        }
      } catch (evmErr: any) {
        console.error(`[OnChainTransfer] Real EVM token transfer error on ${c}:`, evmErr?.message || evmErr);
        return {
          success: false,
          txHash: '',
          isRealOnChain: false,
          actualAmount: params.amount,
          toAddress: params.toAddress,
          error: evmErr?.message || 'EVM 代币转账广播失败'
        };
      }
    }

    // 2. Solana SPL 代币真实转账
    if (c === 'solana') {
      try {
        const secretKey = bs58.decode(params.privateKey);
        const keypair = SolKeypair.fromSecretKey(secretKey);
        if (keypair.publicKey.toBase58().toLowerCase() !== params.fromAddress.toLowerCase()) {
          throw new Error('Signing key does not match wallet address');
        }

        let tokenDecimals = 6;
        try {
          const supplyRes = await this.callSolanaRpc('getTokenSupply', [params.tokenAddress]);
          if (supplyRes?.value?.decimals !== undefined) tokenDecimals = supplyRes.value.decimals;
        } catch {}

        const rawAmount = BigInt(Math.floor(params.amount * Math.pow(10, tokenDecimals)));
        if (rawAmount <= 0n) throw new Error('转账 SPL 代币数量过小');

        const mintPubkey = new SolPublicKey(params.tokenAddress);
        const toPubkey = new SolPublicKey(params.toAddress);
        const SPL_TOKEN_PROGRAM_ID = new SolPublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        const SPL_ATA_PROGRAM_ID = new SolPublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

        const [sourceAta] = SolPublicKey.findProgramAddressSync([keypair.publicKey.toBuffer(), SPL_TOKEN_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()], SPL_ATA_PROGRAM_ID);
        const [destAta] = SolPublicKey.findProgramAddressSync([toPubkey.toBuffer(), SPL_TOKEN_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()], SPL_ATA_PROGRAM_ID);

        const bhResult = await this.callSolanaRpc('getLatestBlockhash', [{ commitment: 'finalized' }]);
        const recentBlockhash = bhResult?.value?.blockhash;
        if (!recentBlockhash) throw new Error('未能从 Solana 节点获取最新 Blockhash');

        const solTx = new SolTransaction({ recentBlockhash, feePayer: keypair.publicKey });

        // 检查目标账户 ATA 是否已初始化
        const destAccInfo = await this.callSolanaRpc('getAccountInfo', [destAta.toBase58(), { encoding: 'base64' }]);
        if (!destAccInfo?.value) {
          solTx.add(
            new TransactionInstruction({
              programId: SPL_ATA_PROGRAM_ID,
              keys: [
                { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: destAta, isSigner: false, isWritable: true },
                { pubkey: toPubkey, isSigner: false, isWritable: false },
                { pubkey: mintPubkey, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
              ],
              data: Buffer.alloc(0)
            })
          );
        }

        const transferData = Buffer.alloc(9);
        transferData.writeUInt8(3, 0);
        transferData.writeBigUInt64LE(rawAmount, 1);

        solTx.add(
          new TransactionInstruction({
            programId: SPL_TOKEN_PROGRAM_ID,
            keys: [
              { pubkey: sourceAta, isSigner: false, isWritable: true },
              { pubkey: destAta, isSigner: false, isWritable: true },
              { pubkey: keypair.publicKey, isSigner: true, isWritable: false }
            ],
            data: transferData
          })
        );

        solTx.sign(keypair);
        const rawWire = solTx.serialize();
        const rawBase64 = Buffer.from(rawWire).toString('base64');
        const realTxSig = await this.callSolanaRpc('sendTransaction', [rawBase64, { encoding: 'base64' }]);

        if (realTxSig && typeof realTxSig === 'string') {
          console.log(`[OnChainTransfer] 📡 Solana SPL transfer broadcast! Sig: ${realTxSig}, waiting for confirmation...`);
          const receipt = await this.pollSolanaReceipt(realTxSig, 25000);
          if (receipt.status === 'FAILED') {
            return {
              success: false,
              txHash: realTxSig,
              isRealOnChain: true,
              actualAmount: params.amount,
              toAddress: params.toAddress,
              status: 'FAILED',
              error: 'Solana SPL 代币转账被回滚'
            };
          }
          if (receipt.status === 'PENDING') {
            return {
              success: false,
              txHash: realTxSig,
              isRealOnChain: true,
              actualAmount: params.amount,
              toAddress: params.toAddress,
              status: 'PENDING',
              error: 'Solana SPL 代币转账已广播但尚未确认 (PENDING)'
            };
          }
          return {
            success: true,
            txHash: realTxSig,
            isRealOnChain: true,
            actualAmount: params.amount,
            toAddress: params.toAddress,
            status: 'SUCCESS'
          };
        } else {
          throw new Error(`Solana 节点返回异常: ${JSON.stringify(realTxSig)}`);
        }
      } catch (solErr: any) {
        console.error(`[OnChainTransfer] Real Solana SPL transfer error:`, solErr?.message || solErr);
        return {
          success: false,
          txHash: '',
          isRealOnChain: false,
          actualAmount: params.amount,
          toAddress: params.toAddress,
          error: solErr?.message || 'Solana SPL 代币转账广播失败'
        };
      }
    }

    return {
      success: false,
      txHash: '',
      isRealOnChain: false,
      actualAmount: params.amount,
      toAddress: params.toAddress,
      error: `当前链 (${c}) 暂不支持真实链上代币转账`
    };
  }
}
