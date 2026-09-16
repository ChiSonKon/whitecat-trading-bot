import axios from 'axios';
import { CONFIG } from '../config.js';

export interface WalletGenerationResponse {
  chain_family: string;
  address: string;
  private_key: string;
  encrypted_private_key: string;
  nonce_iv: string;
}

export interface HoneypotCheckResponse {
  chain: string;
  token_address: string;
  is_honeypot: bool;
  can_buy: bool;
  can_sell: bool;
  buy_tax_pct: number;
  sell_tax_pct: number;
  is_mintable: bool;
  risk_level: string;
  reason: string;
}

type bool = boolean;

export interface TradeResult {
  order_id: string;
  user_id: number;
  chain: string;
  action: string;
  token_address: string;
  amount_in: number;
  estimated_amount_out: number;
  tx_hash: string;
  status: string;
  pnl_pct?: number;
  pnl_native?: number;
  execution_time_ms: number;
}

export class BackendClient {
  private static baseUrl = CONFIG.BACKEND_CORE_URL;

  public static async health(): Promise<any> {
    try {
      const resp = await axios.get(`${this.baseUrl}/health`, { timeout: 3000 });
      return resp.data;
    } catch (e: any) {
      return { status: 'DEGRADED', error: e.message };
    }
  }

  public static async generateWallet(chainOrFamily: string = 'evm'): Promise<WalletGenerationResponse> {
    const resp = await axios.post(`${this.baseUrl}/api/v1/wallet/generate`, {
      chain: chainOrFamily.toLowerCase(),
      chain_family: chainOrFamily.toLowerCase()
    });
    return resp.data;
  }

  public static async decryptPrivateKey(ciphertextHex: string, nonceHex: string): Promise<string> {
    const resp = await axios.post(`${this.baseUrl}/api/v1/wallet/decrypt`, {
      ciphertext_hex: ciphertextHex,
      nonce_hex: nonceHex
    });
    return resp.data.private_key;
  }

  public static async getBalance(chain: string, address: string): Promise<{ balance: number; symbol: string }> {
    try {
      const resp = await axios.get(`${this.baseUrl}/api/v1/balance`, {
        params: { chain, address }
      });
      return { balance: resp.data.balance, symbol: resp.data.symbol };
    } catch {
      return { balance: 0.0, symbol: chain === 'solana' ? 'SOL' : 'ETH' };
    }
  }

  public static async checkHoneypot(chain: string, tokenAddress: string): Promise<HoneypotCheckResponse> {
    try {
      const resp = await axios.post(`${this.baseUrl}/api/v1/security/honeypot-check`, {
        chain,
        token_address: tokenAddress
      }, { timeout: 8000 });
      if (!resp.data || typeof resp.data.is_honeypot !== 'boolean' ||
          typeof resp.data.can_buy !== 'boolean' || typeof resp.data.can_sell !== 'boolean' ||
          typeof resp.data.risk_level !== 'string') throw new Error('Invalid security check response');
      return resp.data;
    } catch {
      return {
        chain,
        token_address: tokenAddress,
        is_honeypot: false,
        can_buy: false,
        can_sell: false,
        buy_tax_pct: 0.0,
        sell_tax_pct: 0.0,
        is_mintable: false,
        risk_level: 'UNKNOWN',
        reason: '安全检查不可用，无法确认代币风险'
      };
    }
  }

  public static async executeFastBuy(params: {
    userId: number;
    chain: string;
    walletAddress: string;
    tokenAddress: string;
    amountNative: number;
    slippagePct: number;
    antiMev: boolean;
    priorityFeeTier: string;
  }): Promise<TradeResult> {
    const resp = await axios.post(`${this.baseUrl}/api/v1/trade/fast-buy`, {
      user_id: params.userId,
      chain: params.chain,
      wallet_address: params.walletAddress,
      token_address: params.tokenAddress,
      amount_native: params.amountNative,
      slippage_pct: params.slippagePct,
      anti_mev: params.antiMev,
      priority_fee_tier: params.priorityFeeTier
    });
    return resp.data;
  }

  public static async executeFastSell(params: {
    userId: number;
    chain: string;
    walletAddress: string;
    tokenAddress: string;
    sellPercentage: number;
    sellInitial: boolean;
    totalTokenBalance: number;
    costBasisNative: number;
    currentTokenPriceNative: number;
    slippagePct: number;
  }): Promise<TradeResult> {
    const resp = await axios.post(`${this.baseUrl}/api/v1/trade/fast-sell`, {
      user_id: params.userId,
      chain: params.chain,
      wallet_address: params.walletAddress,
      token_address: params.tokenAddress,
      sell_percentage: params.sellPercentage,
      sell_initial: params.sellInitial,
      total_token_balance: params.totalTokenBalance,
      cost_basis_native: params.costBasisNative,
      current_token_price_native: params.currentTokenPriceNative,
      slippage_pct: params.slippagePct
    });
    return resp.data;
  }
}
