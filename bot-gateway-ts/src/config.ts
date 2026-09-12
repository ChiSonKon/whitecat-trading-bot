import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  BOT_TOKEN: process.env.BOT_TOKEN || 'MOCK_BOT_TOKEN_FOR_TESTING',
  BACKEND_CORE_URL: process.env.BACKEND_CORE_URL || 'http://127.0.0.1:8080',
  DEFAULT_CHAIN: process.env.DEFAULT_CHAIN || 'robinhood',
  SUPPORTED_CHAINS: [
    { id: 'robinhood', name: 'Robinhood Chain', icon: '🪶', native: 'ETH', chainId: 4663 },
    { id: 'solana', name: 'Solana', icon: '🟣', native: 'SOL', chainId: 501 },
    { id: 'base', name: 'Base', icon: '🔵', native: 'ETH', chainId: 8453 },
    { id: 'bsc', name: 'BNB Smart Chain', icon: '🟡', native: 'BNB', chainId: 56 },
    { id: 'ethereum', name: 'Ethereum', icon: '💎', native: 'ETH', chainId: 1 },
    { id: 'sui', name: 'Sui', icon: '💧', native: 'SUI', chainId: 101 },
    { id: 'ton', name: 'TON', icon: '💎', native: 'TON', chainId: 607 }
  ]
};
