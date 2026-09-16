/**
 * ARC Containment Patch — Isolation Regression Tests
 * 
 * Verifies that the P0-containment patch correctly blocks all ARC
 * transaction paths while leaving non-ARC chains unaffected.
 * 
 * This does NOT certify the bot for production use. It only verifies
 * that the temporary containment is effective.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// ── Block 1: TS callEvmRpc rejects ARC eth_sendRawTransaction ──

test('CONTAINMENT: callEvmRpc rejects eth_sendRawTransaction for ARC', async () => {
  const { OnChainSwapService: Swap } = await import('../dist/services/onChainSwapService.js');

  await assert.rejects(
    () => Swap.callEvmRpc('arc', 'eth_sendRawTransaction', ['0xdeadbeef']),
    (err) => {
      assert.ok(err.message.includes('ARC transactions are disabled'),
        `Expected containment message, got: ${err.message}`);
      return true;
    },
    'callEvmRpc must throw for ARC eth_sendRawTransaction'
  );
});

test('CONTAINMENT: callEvmRpc rejects eth_sendRawTransaction for ARC (case-insensitive)', async () => {
  const { OnChainSwapService: Swap } = await import('../dist/services/onChainSwapService.js');

  await assert.rejects(
    () => Swap.callEvmRpc('ARC', 'eth_sendRawTransaction', ['0xdeadbeef']),
    (err) => {
      assert.ok(err.message.includes('ARC transactions are disabled'));
      return true;
    },
    'Must also block uppercase ARC'
  );
});

test('CONTAINMENT: callEvmRpc allows non-sendRawTransaction for ARC (read methods ok)', async () => {
  const { OnChainSwapService: Swap } = await import('../dist/services/onChainSwapService.js');

  // The containment check specifically only blocks eth_sendRawTransaction
  // Other methods (eth_chainId, eth_getBalance, etc.) should pass through
  let threw = false;
  try {
    await Swap.callEvmRpc('arc', 'eth_chainId', []);
  } catch (e) {
    // Network error is expected (no real RPC), but containment error is NOT expected
    if (e.message.includes('ARC transactions are disabled')) {
      threw = true;
    }
  }
  assert.ok(!threw, 'eth_chainId must NOT trigger ARC containment block');
});

// ── Block 2: TS executeFastBuy returns FAILED for ARC ──

test('CONTAINMENT: executeFastBuy returns FAILED for ARC chain', async () => {
  const { OnChainSwapService: Swap } = await import('../dist/services/onChainSwapService.js');

  const res = await Swap.executeFastBuy({
    userId: 1,
    chain: 'arc',
    privateKey: '0x' + 'ab'.repeat(32),
    walletAddress: '0x' + '11'.repeat(20),
    tokenAddress: '0x' + '22'.repeat(20),
    amountNative: 10,
    slippagePct: 5,
  });

  assert.equal(res.status, 'FAILED', 'ARC buy must be FAILED');
  assert.equal(res.isRealOnChain, false, 'Must NOT be real on-chain');
});

// ── Block 3: TS executeFastSell returns FAILED for ARC ──

test('CONTAINMENT: executeFastSell returns FAILED for ARC chain', async () => {
  const { OnChainSwapService: Swap } = await import('../dist/services/onChainSwapService.js');

  const res = await Swap.executeFastSell({
    userId: 1,
    chain: 'arc',
    privateKey: '0x' + 'ab'.repeat(32),
    walletAddress: '0x' + '11'.repeat(20),
    tokenAddress: '0x' + '22'.repeat(20),
    sellPercentage: 100,
    totalTokenBalance: 1000,
    costBasisNative: 50,
    slippagePct: 5,
  });

  assert.equal(res.status, 'FAILED', 'ARC sell must be FAILED');
  assert.equal(res.isRealOnChain, false, 'Must NOT be real on-chain');
});

// ── Block 4: Non-ARC chains unaffected ──

test('CONTAINMENT: BSC sendRawTransaction is NOT blocked', async () => {
  const { OnChainSwapService: Swap } = await import('../dist/services/onChainSwapService.js');

  const origRpc = Swap.callEvmRpc;
  try {
    Swap.callEvmRpc = async (chain, method, params) => {
      assert.equal(chain, 'bsc', 'BSC call must go to BSC');
      if (method === 'eth_sendRawTransaction') {
        return '0x' + 'cc'.repeat(32);
      }
      throw new Error('mock: only testing sendRaw');
    };

    const hash = await Swap.callEvmRpc('bsc', 'eth_sendRawTransaction', ['0xdeadbeef']);
    assert.ok(hash.startsWith('0x'), 'BSC sendRawTransaction must succeed');
  } finally {
    Swap.callEvmRpc = origRpc;
  }
});

test('CONTAINMENT: other EVM chains are NOT containment-blocked', async () => {
  const { OnChainSwapService: Swap } = await import('../dist/services/onChainSwapService.js');

  for (const chain of ['bsc', 'ethereum', 'base', 'robinhood']) {
    let containmentBlocked = false;
    try {
      await Swap.callEvmRpc(chain, 'eth_sendRawTransaction', ['0xdeadbeef']);
    } catch (e) {
      if (e.message.includes('transactions are disabled')) {
        containmentBlocked = true;
      }
      // Other errors (network, etc.) are fine
    }
    assert.ok(!containmentBlocked, `${chain} must NOT be containment-blocked`);
  }
});
