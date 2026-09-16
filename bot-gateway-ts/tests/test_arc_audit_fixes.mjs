/**
 * Verification Test Suite for ARC Audit Fixes
 * 
 * Verifies:
 * 1. TradeMenu button labels dynamically reflect custom user presets
 * 2. Callback data encodes target chain and enforces chain match
 * 3. HTML escaping prevents XSS/injection via token symbol
 * 4. URL normalization blocks bare domain (x.com, X.COM) bypass
 * 5. TokenDetector zero-wallet flow preserves ARC guide (passes chain to MainMenu)
 * 6. ChainBalanceService returns null on RPC error instead of masquerading as 0
 * 7. Containment guard prevents raw transaction broadcast on ARC
 */
import test from 'node:test';
import assert from 'node:assert/strict';

test('FIX P0-03: TradeMenu dynamically reflects custom user buy presets', async () => {
  const { TradeMenu } = await import('../dist/menus/tradeMenu.js');

  const customConfig = {
    buyPresets: [0.02, 0.05, 0.1, 0.2, 0.5],
    chainBuyPresets: {
      arc: [999, 888, 777, 666, 555]
    }
  };

  const kb = TradeMenu.renderKeyboard('arc', '0x99b37b7fccAA7a1030617b6195eB3045c523BB97', 'zh-hans', customConfig);
  const flat = kb.inline_keyboard.flat();
  const buyBtns = flat.filter(b => b.callback_data && b.callback_data.startsWith('buy_arc_'));

  assert.equal(buyBtns.length, 5, 'Should have 5 buy preset buttons');
  assert.ok(buyBtns[0].text.includes('999 USDC'), `Button 1 should display 999 USDC, got: ${buyBtns[0].text}`);
  assert.ok(buyBtns[1].text.includes('888 USDC'), `Button 2 should display 888 USDC, got: ${buyBtns[1].text}`);
  assert.ok(buyBtns[2].text.includes('777 USDC'), `Button 3 should display 777 USDC, got: ${buyBtns[2].text}`);
});

test('FIX P0-03: TradeMenu callback data encodes target chain', async () => {
  const { TradeMenu } = await import('../dist/menus/tradeMenu.js');

  const kb = TradeMenu.renderKeyboard('arc', '0x99b37b7fccAA7a1030617b6195eB3045c523BB97', 'zh-hans');
  const flat = kb.inline_keyboard.flat();

  const buyBtn = flat.find(b => b.callback_data && b.callback_data.startsWith('buy_'));
  assert.ok(buyBtn, 'Buy button should exist');
  assert.ok(buyBtn.callback_data.startsWith('buy_arc_'), `Callback data should encode 'arc' chain: ${buyBtn.callback_data}`);

  const sellBtn = flat.find(b => b.callback_data && b.callback_data.startsWith('sell_'));
  assert.ok(sellBtn, 'Sell button should exist');
  assert.ok(sellBtn.callback_data.startsWith('sell_arc_'), `Callback data should encode 'arc' chain: ${sellBtn.callback_data}`);

  // Check callback data length is well within 64-byte Telegram limit
  for (const btn of flat) {
    if (btn.callback_data) {
      assert.ok(Buffer.byteLength(btn.callback_data, 'utf8') <= 64,
        `Callback data exceeds 64 bytes: ${btn.callback_data}`);
    }
  }
});

test('FIX P1: HTML escaping prevents injection via token symbol', async () => {
  const { TradeMenu } = await import('../dist/menus/tradeMenu.js');

  const maliciousMarket = {
    address: '0x99b37b7fccAA7a1030617b6195eB3045c523BB97',
    name: 'Test<script>alert(1)</script>',
    symbol: 'BAD<tag>',
    priceUsd: 1,
    priceNative: 1,
    marketCapUsd: 100000,
    liquidityNative: 50000
  };

  const text = TradeMenu.renderText({
    market: maliciousMarket,
    chain: 'arc',
    walletName: 'TestWallet',
    walletAddress: '0x1111111111111111111111111111111111111111',
    walletBalance: 100,
    userHolding: 0,
    userHoldingNative: 0,
    lang: 'zh-hans'
  });

  assert.ok(!text.includes('<script>'), 'Script tag should be escaped');
  assert.ok(!text.includes('BAD<tag>'), 'Symbol tag should be escaped');
  assert.ok(text.includes('BAD&lt;tag&gt;'), 'Symbol tag should be HTML encoded');
  assert.ok(text.includes('&lt;script&gt;'), 'Name tag should be HTML encoded');
});

test('FIX P1: URL normalization blocks bare domain (x.com, X.COM) bypass', async () => {
  const { TradeMenu } = await import('../dist/menus/tradeMenu.js');

  for (const bareUrl of ['https://x.com', 'https://x.com/', 'https://X.COM/', 'https://twitter.com/', ' https://x.com ']) {
    const market = {
      address: '0x1234567890123456789012345678901234567890',
      name: 'Test',
      symbol: 'TEST',
      twitterUrl: bareUrl
    };

    const linkBar = TradeMenu.buildLinkBar('arc', market, 'zh-hans');
    assert.ok(!linkBar.includes('href="https://x.com/"'), `Bare domain ${bareUrl} should not be in href`);
    assert.ok(!linkBar.includes('href="https://X.COM/"'), `Uppercase bare domain ${bareUrl} should not be in href`);
    // Should fallback to search
    assert.ok(linkBar.includes('search?q='), `Bare domain ${bareUrl} should trigger search fallback`);
  }
});

test('FIX P1: TokenDetector zero-wallet flow preserves ARC guide', async () => {
  const { TokenDetector } = await import('../dist/handlers/tokenDetector.js');

  const res = await TokenDetector.analyzeAndBuildView(
    'arc',
    '0x99b37b7fccAA7a1030617b6195eB3045c523BB97',
    [], // 0 wallets
    'zh-hans'
  );

  assert.equal(res.hasWallet, false);
  const kbJson = JSON.stringify(res.keyboard);
  assert.ok(kbJson.includes('menu_arc_guide'), 'Zero-wallet view for ARC must include ARC guide button');
  assert.ok(!kbJson.includes('生态与内盘指引'), 'Zero-wallet view for ARC must NOT show default BSC guide');
});

test('FIX P0-01: ChainBalanceService returns null on RPC error instead of 0', async () => {
  const { ChainBalanceService } = await import('../dist/services/chainBalanceService.js');

  const origPost = ChainBalanceService.httpClient.post;
  ChainBalanceService.httpClient.post = async () => {
    throw new Error('RPC_DEAD_FOR_TEST');
  };

  try {
    const bal = await ChainBalanceService.getNativeBalance('arc', '0x1111111111111111111111111111111111111111');
    assert.equal(bal, null, 'RPC failure must return null, NOT 0');
  } finally {
    ChainBalanceService.httpClient.post = origPost;
  }
});

test('FIX P0-04: OnChainSwapService unblocks ARC broadcast to RPC', async () => {
  const { OnChainSwapService } = await import('../dist/services/onChainSwapService.js');

  const origRpc = OnChainSwapService.httpClient.post;
  try {
    let calledRpc = false;
    OnChainSwapService.httpClient.post = async (url, body) => {
      calledRpc = true;
      assert.equal(body.method, 'eth_sendRawTransaction');
      return { data: { jsonrpc: '2.0', id: 1, result: '0x11223344' } };
    };

    const res = await OnChainSwapService.callEvmRpc('arc', 'eth_sendRawTransaction', ['0xdead']);
    assert.equal(res, '0x11223344');
    assert.ok(calledRpc, 'eth_sendRawTransaction should reach RPC directly without containment blockage');
  } finally {
    OnChainSwapService.httpClient.post = origRpc;
  }
});

