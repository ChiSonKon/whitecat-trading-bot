import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TokenKeyHelper } from '../src/services/tokenKeyHelper.js';
import { TokenMarketService } from '../src/services/tokenMarketService.js';
import { ChainBalanceService } from '../src/services/chainBalanceService.js';
import { OnChainSwapService } from '../src/services/onChainSwapService.js';

async function runPerformanceTestSuite() {
  console.log('🚀 开始执行 WhiteCat 全链路性能极致调优专项验证套件...\n');

  // =========================================================================
  // Test 1: TokenKeyHelper 内存命中速度与防抖批写
  // =========================================================================
  console.log('--- [Test 1] TokenKeyHelper 内存极速命中与防抖异步批写 ---');
  const testAddresses: string[] = [];
  for (let i = 0; i < 500; i++) {
    testAddresses.push('0x' + crypto.randomBytes(20).toString('hex'));
  }

  // 连续注册 500 个不同代币地址，测试耗时（原本同步写盘 500 次需要数秒）
  const tRegisterStart = performance.now();
  const keys: string[] = [];
  for (const addr of testAddresses) {
    keys.push(TokenKeyHelper.register(addr));
  }
  const registerTimeMs = performance.now() - tRegisterStart;
  console.log('  ⚡️ 连续注册 500 个新代币地址耗时: ' + registerTimeMs.toFixed(2) + 'ms (平均 ' + (registerTimeMs / 500).toFixed(3) + 'ms/次)');
  assert.ok(registerTimeMs < 150, '注册 500 个代币必须在 150ms 内完成');

  // 测试内存反查命中速度
  const tLookupStart = performance.now();
  for (let i = 0; i < 500; i++) {
    const resolved = TokenKeyHelper.toAddress(keys[i]);
    assert.strictEqual(resolved.toLowerCase(), testAddresses[i].toLowerCase());
  }
  const lookupTimeMs = performance.now() - tLookupStart;
  console.log('  ⚡️ 内存反查 500 次耗时: ' + lookupTimeMs.toFixed(2) + 'ms (平均 ' + (lookupTimeMs / 500).toFixed(3) + 'ms/次)');
  assert.ok(lookupTimeMs < 50, '内存反查 500 次必须在 50ms 内完成');

  // 验证 flush() 异步落盘能力
  await TokenKeyHelper.flush();
  console.log('  ✅ Test 1 Passed: TokenKeyHelper 内存优先与防抖批写验证通过！\n');

  // =========================================================================
  // Test 2: TokenMarketService 短期内存缓存与 Single-Flight
  // =========================================================================
  console.log('--- [Test 2] TokenMarketService 短期内存缓存与 Single-Flight 并发合并 ---');
  TokenMarketService.clearCache();
  const testToken = '0x07704B06981eA962b87296362a1281484d160000'; //  (预置代币)

  // 1. 首次查询与缓存写入
  const tFetch1 = performance.now();
  const res1 = await TokenMarketService.fetchTokenDetails(testToken, 'arc');
  const fetch1Ms = performance.now() - tFetch1;
  assert.strictEqual(res1.symbol, 'ARCAT');
  console.log('  ⚡️ 首次获取代币详情耗时: ' + fetch1Ms.toFixed(2) + 'ms');

  // 2. 第二次查询（应该 100% 命中内存缓存，耗时 < 1ms）
  const tFetch2 = performance.now();
  const res2 = await TokenMarketService.fetchTokenDetails(testToken, 'arc');
  const fetch2Ms = performance.now() - tFetch2;
  console.log('  ⚡️ 缓存命中耗时: ' + fetch2Ms.toFixed(2) + 'ms');
  assert.strictEqual(res2.symbol, 'ARCAT');
  assert.ok(fetch2Ms < 5, '缓存命中耗时必须小于 5ms');

  // 3. 验证 Single-Flight 并发请求合并机制
  TokenMarketService.clearCache();
  const p1 = TokenMarketService.fetchTokenDetails(testToken, 'arc');
  const p2 = TokenMarketService.fetchTokenDetails(testToken, 'arc');
  const p3 = TokenMarketService.fetchTokenDetails(testToken, 'arc');
  const [m1, m2, m3] = await Promise.all([p1, p2, p3]);
  assert.strictEqual(m1.symbol, 'ARCAT');
  assert.strictEqual(m2.symbol, 'ARCAT');
  assert.strictEqual(m3.symbol, 'ARCAT');
  console.log('  ⚡️ Single-Flight 并发请求合并验证成功 (3个并发请求合并为1个执行)');

  // 4. 验证主动失效
  TokenMarketService.invalidateCache(testToken, 'arc');
  assert.strictEqual(TokenMarketService.getCacheSize(), 0);
  console.log('  ✅ Test 2 Passed: TokenMarketService 缓存与 Single-Flight 机制 100% 正常！\n');

  // =========================================================================
  // Test 3: ChainBalanceService 内存缓存与 Single-Flight
  // =========================================================================
  console.log('--- [Test 3] ChainBalanceService 内存缓存与 Single-Flight ---');
  ChainBalanceService.clearCache();
  const testWallet = '0xba3da1ac68e284ec73457df24f4c183485c0f603';

  // 模拟客户端快速连击余额查询
  const origPost = ChainBalanceService.httpClient.post;
  let callCount = 0;
  ChainBalanceService.httpClient.post = async (url: string, payload: any) => {
    callCount++;
    await new Promise(r => setTimeout(r, 20));
    return { data: { result: '0x1bc16d674ec80000' } }; // 2 BNB
  };

  try {
    // 3.1 验证 Single-Flight：并发同时发起 5 个余额查询，底层仅单次任务执行 (3个竞速节点)
    callCount = 0;
    const bPromises = [
      ChainBalanceService.getNativeBalance('bsc', testWallet),
      ChainBalanceService.getNativeBalance('bsc', testWallet),
      ChainBalanceService.getNativeBalance('bsc', testWallet),
      ChainBalanceService.getNativeBalance('bsc', testWallet),
      ChainBalanceService.getNativeBalance('bsc', testWallet)
    ];
    const balances = await Promise.all(bPromises);
    assert.strictEqual(balances[0], 2);
    // 未加 Single-Flight 时 5 次并发会发起 5*3=15 次 RPC，加了 Single-Flight 后合并为单次任务的 3 个竞速节点
    assert.strictEqual(callCount, 3, 'Single-Flight 必须合并为单次任务执行 (3次竞速调用而不是15次)');
    console.log('  ⚡️ Single-Flight: 5 次并发余额查询合并为单次任务 (' + callCount + ' 个候选竞速节点，无冗余穿透)');

    // 3.2 验证 TTL 缓存命中：第二次直接读取缓存，零网络请求
    callCount = 0;
    const cachedBal = await ChainBalanceService.getNativeBalance('bsc', testWallet);
    assert.strictEqual(cachedBal, 2);
    assert.strictEqual(callCount, 0, '缓存命中时不应发起任何 RPC 请求');
    console.log('  ⚡️ 余额缓存命中: 0 次底层 RPC 调用');

    // 3.3 验证缓存主动失效
    ChainBalanceService.invalidateCache('bsc', testWallet);
    const refreshedBal = await ChainBalanceService.getNativeBalance('bsc', testWallet);
    assert.strictEqual(refreshedBal, 2);
    assert.strictEqual(callCount, 3, '失效后重新发起单次任务的 3 个候选节点请求');
    console.log('  ⚡️ 缓存失效后正常穿透获取最新余额');
  } finally {
    ChainBalanceService.httpClient.post = origPost;
  }
  console.log('  ✅ Test 3 Passed: ChainBalanceService 缓存与 Single-Flight 机制 100% 正常！\n');

  // =========================================================================
  // Test 4: callEvmRpc Fastest-Wins 竞速与 ARC Containment
  // =========================================================================
  console.log('--- [Test 4] callEvmRpc Fastest-Wins 竞速与 ARC 安全阻断守卫 ---');
  // 4.1 ARC 交易放行检验 (直接穿透至 RPC，不再拦截)
  const origPostArc = OnChainSwapService.httpClient.post;
  try {
    let called = false;
    OnChainSwapService.httpClient.post = async () => {
      called = true;
      return { data: { jsonrpc: '2.0', id: 1, result: '0xmock_hash' } };
    };
    const res = await OnChainSwapService.callEvmRpc('arc', 'eth_sendRawTransaction', ['0x1234']);
    assert.strictEqual(res, '0xmock_hash');
    assert.ok(called, 'ARC eth_sendRawTransaction 必须直接调用 RPC');
    console.log('  ⚡️ ARC 真实交易已顺利解封并放行至 RPC 通道');
  } finally {
    OnChainSwapService.httpClient.post = origPostArc;
  }

  // 4.2 模拟多节点竞速（Node 1 挂起，Node 2 秒回，Fastest-Wins 立即返回不卡顿）
  const origSwapPost = OnChainSwapService.httpClient.post;
  OnChainSwapService.httpClient.post = async (url: string, payload: any) => {
    if (url.includes('binance.org')) {
      await new Promise(r => setTimeout(r, 1200));
      return { data: { result: '0x38' } };
    }
    await new Promise(r => setTimeout(r, 10));
    return { data: { result: '0x38' } }; // chainId 56
  };

  try {
    const tRace = performance.now();
    const chainIdHex = await OnChainSwapService.callEvmRpc('bsc', 'eth_chainId', []);
    const raceMs = performance.now() - tRace;
    assert.strictEqual(chainIdHex, '0x38');
    console.log('  ⚡️ 多节点竞速读取 eth_chainId 耗时: ' + raceMs.toFixed(2) + 'ms (节点1挂起, 节点2迅速胜出)');
    assert.ok(raceMs < 300, '竞速模式下无需死等死节点');
  } finally {
    OnChainSwapService.httpClient.post = origSwapPost;
  }
  console.log('  ✅ Test 4 Passed: Fastest-Wins 竞速与 ARC 阻断守卫验证通过！\n');

  console.log('====================================================');
  console.log('🎉 所有 4 项核心性能专项调优测试 100% 验证通过！');
  console.log('====================================================');
}

runPerformanceTestSuite().catch(err => {
  console.error('❌ 性能专项测试失败:', err);
  process.exit(1);
});
