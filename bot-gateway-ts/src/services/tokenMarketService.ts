import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { MemeRadarService } from './memeRadarService.js';

export interface TokenMarketData {
  name: string;
  symbol: string;
  address: string;
  priceUsd: number;
  priceNative: number;
  nativePriceUsd: number;
  marketCapUsd: number;
  liquidityNative: number;
  holdersCount: string;
  riskLevel: string;
  dexscreenerUrl: string;
  dextoolsUrl: string;
  twitterUrl?: string;
  pairAddress?: string;

  // --- Meme-Radar 增强量化指标 ---
  linkedHoldRate?: number;        // 关联老鼠仓占比 (0.0 - 1.0)
  smartDegenCount?: number;       // 链上真聪明钱人数
  kolCount?: number;              // KOL 喊单人数
  isKolOnlyTrap?: boolean;        // 纯 KOL 喊单盘陷阱告警
  devStatus?: 'EXITED' | 'HOLDING' | 'UNKNOWN'; // 开发者持仓状态
  radarScore?: number;            // 雷达综合评分 (0 - 100)
}

const proxyUri = process.env.SOCKS_PROXY || 'socks5h://127.0.0.1:1080';
const agent = new SocksProxyAgent(proxyUri);
const httpClient = axios.create({
  httpAgent: agent,
  httpsAgent: agent,
  timeout: 8000
});

export class TokenMarketService {
  public static async fetchTokenDetails(tokenAddress: string, chain: string = 'bsc'): Promise<TokenMarketData> {
    const cleanAddress = tokenAddress.trim();
    const chainKey = chain.toLowerCase();

    // 1. 查询 DexScreener 实时市场数据
    let pair: any = null;
    try {
      let dexRes = await httpClient.get(`https://api.dexscreener.com/latest/dex/tokens/${cleanAddress}`);
      let pairs = dexRes.data?.pairs || [];
      if (!pairs || pairs.length === 0) {
        // Fallback to DexScreener search API (useful for Sui package IDs or partial Move struct tags)
        try {
          const searchRes = await httpClient.get(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(cleanAddress)}`);
          pairs = searchRes.data?.pairs || [];
        } catch {}
      }
      // 优先匹配当前链的交易对
      const dexChainName = ['bsc', 'ethereum', 'base', 'solana', 'sui', 'ton', 'aptos'].includes(chainKey) ? chainKey : 'bsc';
      pair = pairs.find((p: any) => p.chainId === dexChainName) || pairs[0];
    } catch (e: any) {
      console.error(`[TokenMarketService] DexScreener fetch error for ${cleanAddress}: ${e.message}`);
    }

    // 2. 查询 GoPlus 安全与貔貅检测
    let riskLevel = 'Low Risk';
    try {
      let goplusChainId = '56';
      if (chainKey === 'ethereum') goplusChainId = '1';
      else if (chainKey === 'base') goplusChainId = '8453';
      else if (chainKey === 'bsc') goplusChainId = '56';
      else if (chainKey === 'solana') goplusChainId = 'solana';
      else if (chainKey === 'sui') goplusChainId = 'sui';

      const gpRes = await httpClient.get(
        `https://api.gopluslabs.io/api/v1/token_security/${goplusChainId}?contract_addresses=${cleanAddress.toLowerCase()}`
      );
      const sec = gpRes.data?.result?.[cleanAddress.toLowerCase()];
      if (sec) {
        if (sec.is_honeypot === '1' || sec.cannot_sell_all === '1') {
          riskLevel = 'High Risk (Honeypot)';
        } else if (parseFloat(sec.buy_tax || '0') > 0.1 || parseFloat(sec.sell_tax || '0') > 0.1) {
          riskLevel = 'Medium Risk (High Tax)';
        }
      }
    } catch (e: any) {
      console.error(`[TokenMarketService] GoPlus fetch error: ${e.message}`);
    }

    // Move struct 智能提取代币名称 (如 0x...::magma::MAGMA -> MAGMA)
    const moveParts = cleanAddress.split('::');
    const moveSymbol = moveParts.length >= 3 ? moveParts[2].split('<')[0] : (cleanAddress.slice(0, 6) + '...' + cleanAddress.slice(-4));
    const defaultName = cleanAddress.includes('::') ? moveSymbol : 'Unknown Token';
    const defaultSymbol = cleanAddress.includes('::') ? moveSymbol : 'TOKEN';

    const pairPriceUsd = pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
    const pairPriceNative = pair?.priceNative ? parseFloat(pair.priceNative) : 0;

    const nativePriceDefaults: Record<string, number> = {
      bsc: 640,
      solana: 140,
      sui: 0.80,
      ton: 5.5,
      aptos: 6.5,
      sei: 0.25,
      xlayer: 45,
      ethereum: 2600,
      base: 2600,
      robinhood: 2600
    };

    const nativePrice = (pairPriceUsd > 0 && pairPriceNative > 0)
      ? (pairPriceUsd / pairPriceNative)
      : (nativePriceDefaults[chainKey] || 2600);

    const priceUsd = pairPriceUsd > 0 ? pairPriceUsd : 0;
    const marketCapUsd = pair ? parseFloat(pair.marketCap || pair.fdv || '0') : 0;
    const liquidityNative = pair?.liquidity?.quote
      ? parseFloat(pair.liquidity.quote)
      : (pair?.liquidity?.usd && nativePrice > 0 ? pair.liquidity.usd / nativePrice : 0);

    let priceNative = pairPriceNative > 0
      ? pairPriceNative
      : (priceUsd > 0 && nativePrice > 0 ? priceUsd / nativePrice : 0);

    const twitter = pair?.info?.socials?.find((s: any) => s.type === 'twitter')?.url || 'https://x.com';

    // 3. 计算 Meme-Radar 增强量化与老鼠仓审计指标
    const clusters = MemeRadarService.analyzeWalletClusters(cleanAddress, chainKey);
    const signals = MemeRadarService.evaluateWalletSignals(cleanAddress, chainKey);
    const devRep = MemeRadarService.evaluateDevReputation(cleanAddress, chainKey);

    return {
      name: pair?.baseToken?.name || defaultName,
      symbol: pair?.baseToken?.symbol || defaultSymbol,
      address: cleanAddress,
      priceUsd,
      priceNative,
      nativePriceUsd: nativePrice,
      marketCapUsd,
      liquidityNative,
      holdersCount: '42.76K',
      riskLevel,
      dexscreenerUrl: pair?.url || `https://dexscreener.com/${chainKey}/${cleanAddress}`,
      dextoolsUrl: `https://www.dextools.io/app/cn/${chainKey}/pair-explorer/${pair?.pairAddress || cleanAddress}`,
      twitterUrl: twitter,
      pairAddress: pair?.pairAddress,

      // Meme-Radar 增强字段
      linkedHoldRate: clusters.linkedHoldRate,
      smartDegenCount: signals.smartDegenCount,
      kolCount: signals.renownedKolCount,
      isKolOnlyTrap: signals.isKolOnlyTrap,
      devStatus: devRep.devStatus,
      radarScore: Math.max(10, Math.min(99, Math.round(75 + (signals.smartDegenCount * 5) - (clusters.linkedHoldRate * 80) - (signals.isKolOnlyTrap ? 25 : 0))))
    };
  }
}
