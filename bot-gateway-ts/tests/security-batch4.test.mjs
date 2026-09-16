import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const globalTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whitecat-b4-global-'));
process.env.USER_STORE_FILE = path.join(globalTestDir, 'absent.json');
process.env.USER_STORE_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

test('BUG-025 generateUniqueReferralCode generates cryptographically random and unique codes', async () => {
  const { generateUniqueReferralCode, getOrCreateUser, userStore } = await import('../dist/services/userService.js');
  const code1 = generateUniqueReferralCode();
  const code2 = generateUniqueReferralCode();
  assert.match(code1, /^WC[0-9A-F]{8}$/);
  assert.match(code2, /^WC[0-9A-F]{8}$/);
  assert.notEqual(code1, code2);

  // Verify two users with same last 4 digits get different codes
  const u1 = getOrCreateUser(1001234);
  const u2 = getOrCreateUser(9991234);
  assert.notEqual(u1.referralCode, u2.referralCode);
  assert.notEqual(u1.referralCode, 'WC1234');
  assert.notEqual(u2.referralCode, 'WC1234');
  userStore.clear();
});

test('BUG-027 and BUG-023 pendingAction is persisted and restored, saveUserStore write coalescing works', async () => {
  const localDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whitecat-pending-'));
  const storeFile = path.join(localDir, 'store.json');
  process.env.USER_STORE_FILE = storeFile;
  const { userStore, saveUserStore, loadUserStore } = await import('../dist/services/userService.js');
  try {
    userStore.set(8888, {
      userId: 8888,
      username: 'tester',
      activeChain: 'bsc',
      lang: 'en',
      walletsByChain: new Map(),
      tokenHoldings: new Map(),
      referralCode: 'WCTEST1234',
      invitedCount: 0,
      tradedUsersCount: 0,
      tradeCount: 0,
      tradeVolume: 0,
      totalEarned: 0,
      claimableCommission: 0,
      claimedCommission: 0,
      monitoredWallets: [],
      limitOrders: [],
      tradeConfig: { mode: 'fast', gasTip: 0.001, slippage: 50, antiMev: true, buyPresets: [0.1], sellPresets: [100] },
      pendingAction: { type: 'import_wallet', data: { chain: 'solana' }, createdAt: Date.now() },
      transactions: []
    });

    // Test concurrent saves without throwing or corrupting
    await Promise.all([
      Promise.resolve().then(() => saveUserStore()),
      Promise.resolve().then(() => saveUserStore()),
      Promise.resolve().then(() => saveUserStore())
    ]);

    userStore.clear();
    assert.equal(userStore.size, 0);

    loadUserStore();
    const restored = userStore.get(8888);
    assert.ok(restored);
    assert.equal(restored.pendingAction?.type, 'import_wallet');
    assert.equal(restored.pendingAction?.data?.chain, 'solana');
    userStore.clear();
  } finally {
    process.env.USER_STORE_FILE = path.join(globalTestDir, 'absent.json');
    fs.rmSync(localDir, { recursive: true });
  }
});

test('BUG-024 MCP SSE server CORS blocks untrusted origins and rejects OPTIONS', async () => {
  const { WhiteCatSseServer } = await import('../dist/mcp/sseServer.js');
  const server = new WhiteCatSseServer({ port: 0, host: '127.0.0.1' });
  try {
    await server.start();
    const base = `http://127.0.0.1:${server.server.address().port}`;

    // 1. Untrusted origin OPTIONS is rejected with 403
    const evilOptions = await fetch(base + '/sse', {
      method: 'OPTIONS',
      headers: { Origin: 'https://malicious-attacker.com' }
    });
    assert.equal(evilOptions.status, 403);
    assert.equal(evilOptions.headers.get('access-control-allow-origin'), null);

    // 2. Localhost origin is allowed
    const localOptions = await fetch(base + '/sse', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3000' }
    });
    assert.equal(localOptions.status, 204);
    assert.equal(localOptions.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  } finally {
    await server.stop();
  }
});

test('BUG-026 EvmNonceManager serializes concurrent calls per address and increments consecutive nonces', async () => {
  const { EvmNonceManager, OnChainSwapService: Swap } = await import('../dist/services/onChainSwapService.js');
  const address = '0x' + '33'.repeat(20);
  const chain = 'bsc';

  let rpcCallCount = 0;
  const origRpc = Swap.callEvmRpc;
  Swap.callEvmRpc = async (c, method) => {
    if (method === 'eth_getTransactionCount') {
      rpcCallCount++;
      return '0x5'; // rpc returns nonce 5
    }
    return '0x0';
  };

  EvmNonceManager.reset(chain, address);

  const allocatedNonces = [];
  // Run 3 concurrent operations
  await Promise.all([
    EvmNonceManager.withLock(chain, address, async (nonce) => {
      await new Promise(r => setTimeout(r, 20));
      allocatedNonces.push(nonce);
      return nonce;
    }),
    EvmNonceManager.withLock(chain, address, async (nonce) => {
      await new Promise(r => setTimeout(r, 10));
      allocatedNonces.push(nonce);
      return nonce;
    }),
    EvmNonceManager.withLock(chain, address, async (nonce) => {
      allocatedNonces.push(nonce);
      return nonce;
    })
  ]);

  Swap.callEvmRpc = origRpc;
  EvmNonceManager.reset(chain, address);

  // Consecutive nonces without collision: 5, 6, 7
  assert.deepEqual(allocatedNonces.sort((a, b) => a - b), [5, 6, 7]);
});
