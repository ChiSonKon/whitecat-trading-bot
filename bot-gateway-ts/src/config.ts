import dotenv from 'dotenv';
import { parseProtocolFeeRate } from './services/protocolFee.js';
dotenv.config();

export const CONFIG = {
  PROTOCOL_FEE_RATE: process.env.PROTOCOL_FEE_RATE ?? '0.006',
  PROTOCOL_FEE_RATE_SCALED: parseProtocolFeeRate(process.env.PROTOCOL_FEE_RATE ?? '0.006'),
  PROTOCOL_FEE_RECIPIENT_EVM: process.env.PROTOCOL_FEE_RECIPIENT_EVM?.trim() || '',
  PROTOCOL_FEE_RECIPIENT_SOLANA: process.env.PROTOCOL_FEE_RECIPIENT_SOLANA?.trim() || '',
  PROTOCOL_FEE_RECIPIENT_SUI: process.env.PROTOCOL_FEE_RECIPIENT_SUI?.trim() || '',
  PROTOCOL_FEE_RECIPIENT_TON: process.env.PROTOCOL_FEE_RECIPIENT_TON?.trim() || '',
  PROTOCOL_FEE_RECIPIENT_APTOS: process.env.PROTOCOL_FEE_RECIPIENT_APTOS?.trim() || '',
  PROTOCOL_FEE_RECIPIENT_ARC: process.env.PROTOCOL_FEE_RECIPIENT_ARC?.trim() || process.env.PROTOCOL_FEE_RECIPIENT_EVM?.trim() || '',
  BOT_TOKEN: process.env.BOT_TOKEN || 'MOCK_BOT_TOKEN_FOR_TESTING',
  BACKEND_CORE_URL: process.env.BACKEND_CORE_URL || 'http://127.0.0.1:8085',
  DEFAULT_CHAIN: process.env.DEFAULT_CHAIN || 'robinhood',
  SUPPORTED_CHAINS: [
    { id: 'robinhood', name: 'Robinhood Chain', icon: '🪶', native: 'ETH', chainId: 4663 },
    { id: 'arc', name: 'Arc Network', icon: '🏛️', native: 'USDC', chainId: 5042 },
    { id: 'solana', name: 'Solana', icon: '🟣', native: 'SOL', chainId: 501 },
    { id: 'base', name: 'Base', icon: '🔵', native: 'ETH', chainId: 8453 },
    { id: 'bsc', name: 'BNB Smart Chain', icon: '🟡', native: 'BNB', chainId: 56 },
    { id: 'ethereum', name: 'Ethereum', icon: '💎', native: 'ETH', chainId: 1 },
    { id: 'sui', name: 'Sui', icon: '💧', native: 'SUI', chainId: 101 },
    { id: 'ton', name: 'TON', icon: '💎', native: 'TON', chainId: 607 }
  ]
};
