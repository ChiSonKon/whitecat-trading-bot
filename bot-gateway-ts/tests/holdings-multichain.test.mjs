import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whitecat-holdings-'));
process.env.USER_STORE_FILE = path.join(tempDir, 'users.json');
process.env.USER_STORE_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

test('TradeMenu renders holding and computed valuation accurately', async () => {
  const { TradeMenu } = await import('../dist/menus/tradeMenu.js');

  const market = {
    address: '0x23791AA3B031659B593cF141a2Bc76B0ad657777',
    symbol: 'FLY',
    name: 'FlyToken',
    chain: 'bsc',
    priceUsd: 0.00015,
    priceNative: 0.0000003,
    liquidityNative: 50,
    marketCapUsd: 150000,
    devStatus: 'HOLDING',
    smartDegenCount: 3,
    kolCount: 1,
    linkedHoldRate: 0.04
  };

  const text1 = TradeMenu.renderText({
    market,
    chain: 'bsc',
    walletName: 'Wallet_1',
    walletAddress: '0x77cb092148084f6ba8239b10a4c24f3b49c53fc4',
    walletBalance: 0.05,
    userHolding: 1791.7293,
    userHoldingNative: 0,
    pnlNative: 0.0001,
    pnlPct: 20.0,
    lang: 'zh-CN',
    userId: 7031963354,
    botUsername: 'wctibot'
  });

  assert.match(text1, /1,791\.7293/);
  assert.match(text1, /≈\s*0\.0005\s*BNB/);
  assert.match(text1, /PnL:\s*<b>0\.0001\s*BNB<\/b>/);
});

test('syncTokenHoldings queries on-chain EVM token balance and populates user.tokenHoldings', async () => {
  const { getOrCreateUser, syncTokenHoldings } = await import('../dist/services/userService.js');
  const { OnChainSwapService } = await import('../dist/services/onChainSwapService.js');

  const user = getOrCreateUser(8888001, 'evm_holder_test');
  user.activeChain = 'bsc';
  user.walletsByChain.set('bsc', [
    {
      index: 0,
      chain: 'bsc',
      address: '0x1111111111111111111111111111111111111111',
      privateKey: '0x' + '1'.repeat(64),
      balance: 1.0,
      isDefault: true
    }
  ]);

  const targetCa = '0x23791AA3B031659B593cF141a2Bc76B0ad657777';

  // Mock callEvmRpc
  const originalCallEvm = OnChainSwapService.callEvmRpc;
  OnChainSwapService.callEvmRpc = async (chain, method, params) => {
    if (method === 'eth_call') {
      const callData = params[0].data;
      if (callData.startsWith('0x70a08231')) {
        // Return 1791.729265534116146435 in hex (18 decimals)
        return '0x' + BigInt('1791729265534116146435').toString(16);
      }
      if (callData.startsWith('0x313ce567')) {
        return '0x12'; // 18 decimals
      }
    }
    return '0x0';
  };

  try {
    assert.equal(user.tokenHoldings.has(targetCa.toLowerCase()), false);

    await syncTokenHoldings(user, 'bsc', targetCa);

    const holding = user.tokenHoldings.get(targetCa.toLowerCase());
    assert.ok(holding, 'Holding should be populated in user.tokenHoldings');
    assert.ok(Math.abs(holding.amount - 1791.729265) < 0.001, `Amount ${holding.amount} should match on-chain`);
    assert.equal(holding.chain, 'bsc');
  } finally {
    OnChainSwapService.callEvmRpc = originalCallEvm;
  }
});

test('syncTokenHoldings queries Solana token balance and populates user.tokenHoldings', async () => {
  const { getOrCreateUser, syncTokenHoldings } = await import('../dist/services/userService.js');
  const { OnChainSwapService } = await import('../dist/services/onChainSwapService.js');

  const user = getOrCreateUser(8888002, 'sol_holder_test');
  user.activeChain = 'solana';
  user.walletsByChain.set('solana', [
    {
      index: 0,
      chain: 'solana',
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      privateKey: 'sol_mock_priv',
      balance: 5.0,
      isDefault: true
    }
  ]);

  const targetMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'; // BONK mint

  // Mock callSolanaRpc
  const originalCallSol = OnChainSwapService.callSolanaRpc;
  OnChainSwapService.callSolanaRpc = async (method, params) => {
    if (method === 'getTokenAccountsByOwner') {
      return {
        value: [
          {
            account: {
              data: {
                parsed: {
                  info: {
                    tokenAmount: {
                      amount: '5000000000',
                      decimals: 5,
                      uiAmount: 50000.0
                    }
                  }
                }
              }
            }
          }
        ]
      };
    }
    return null;
  };

  try {
    assert.equal(user.tokenHoldings.has(targetMint.toLowerCase()), false);

    await syncTokenHoldings(user, 'solana', targetMint);

    const holding = user.tokenHoldings.get(targetMint.toLowerCase());
    assert.ok(holding, 'Solana holding should be populated in user.tokenHoldings');
    assert.equal(holding.amount, 50000.0);
    assert.equal(holding.chain, 'solana');
  } finally {
    OnChainSwapService.callSolanaRpc = originalCallSol;
  }
});
