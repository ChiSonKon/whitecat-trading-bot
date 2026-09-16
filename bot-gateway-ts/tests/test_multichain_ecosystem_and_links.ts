import assert from 'assert';
import { TokenMarketService } from '../src/services/tokenMarketService.js';
import { TradeMenu } from '../src/menus/tradeMenu.js';
import { MainMenu } from '../src/menus/mainMenu.js';
import { ChainEcosystemMenu } from '../src/menus/chainEcosystemMenu.js';
import { WalletEntry } from '../src/menus/walletMenu.js';
import { ArcGuideMenu } from '../src/menus/arcGuideMenu.js';

async function run() {
  console.log('🧪 Starting Multi-Chain Ecosystem & Token Links Comprehensive Test Suite...\n');

  const mockWallets: WalletEntry[] = [
    {
      index: 0,
      address: '0x8ad68eb01f9d116f6dcbd384801bacedf715aced',
      symbol: 'USDC',
      balance: 100.5,
      isDefault: true
    }
  ];

  // =========================================================================
  // Test 1: $SHARCFUN CA 外部链接适配测试 (验证真实有效的 ArcScan、SharcFun 官网、@SharcFun 推特，无 404)
  // =========================================================================
  console.log('--- Test 1: $SHARCFUN Token External Links Adaptation ---');
  const sharcCa = '0x99b37b7fccAA7a1030617b6195eB3045c523BB97';
  const sharcMarket = await TokenMarketService.fetchTokenDetails(sharcCa, 'arc');

  console.log('  [SHARCFUN Links]:', {
    explorerUrl: sharcMarket.explorerUrl,
    dexUrl: sharcMarket.dexUrl,
    twitterUrl: sharcMarket.twitterUrl,
    dexscreenerUrl: sharcMarket.dexscreenerUrl,
    dextoolsUrl: sharcMarket.dextoolsUrl
  });

  // 验证 ArcScan、SharcFun 官网、@SharcFun 推特准确无误
  assert.strictEqual(sharcMarket.explorerUrl, `https://arc-scan.org/token/${sharcCa}`, 'Explorer URL must be ArcScan token page');
  assert.strictEqual(sharcMarket.dexUrl, 'https://sharc.fun', 'DEX URL must be official SharcFun launchpad');
  assert.strictEqual(sharcMarket.twitterUrl, 'https://x.com/SharcFun', 'Twitter URL must be official @SharcFun');

  const sharcTradeText = TradeMenu.renderText({
    market: sharcMarket,
    chain: 'arc',
    walletName: 'Wallet_1',
    walletAddress: mockWallets[0].address,
    walletBalance: 100.5,
    userHolding: 0,
    lang: 'zh-hans'
  });

  console.log('  [Rendered Trade Text Snippet]:\n ', sharcTradeText.split('\n').filter(l => l.startsWith('🔗')).join('\n '));

  // 必须包含 ArcScan、Sharcfun发射台、真实Twitter
  assert.ok(sharcTradeText.includes('ArcScan'), 'Must include ArcScan');
  assert.ok(sharcTradeText.includes('https://arc-scan.org/token/'), 'Must link to ArcScan token page');
  assert.ok(sharcTradeText.includes('Sharcfun发射台'), 'Must include Sharcfun launchpad link');
  assert.ok(sharcTradeText.includes('https://sharc.fun'), 'Must link to sharc.fun');
  assert.ok(sharcTradeText.includes('https://x.com/SharcFun'), 'Must link to official @SharcFun twitter');

  // 严禁包含 404 死链！
  assert.ok(!sharcTradeText.includes('https://dexscreener.com/arc/'), 'Must NOT generate 404 dexscreener /arc/ link!');
  assert.ok(!sharcTradeText.includes('https://www.dextools.io/app/cn/arc/'), 'Must NOT generate 404 dextools /arc/ link!');
  assert.ok(!sharcTradeText.includes('href="https://x.com/"') && !sharcTradeText.includes('href="https://x.com"'), 'Must NOT link to bare x.com homepage!');
  console.log('  ✅ Test 1 Passed: $SHARCFUN links verified (ArcScan, SharcFun, @SharcFun, zero 404s)!\n');

  // =========================================================================
  // Test 2: $ARCAT CA 外部链接测试 (验证真实有效的 ArcScan、Dyor Swap 官网、@DYORSWAPDEX 推特)
  // =========================================================================
  console.log('--- Test 2: $ARCAT Token External Links Adaptation ---');
  const arcatCa = '0x07704B06981eA962b87296362a1281484d160000';
  const arcatMarket = await TokenMarketService.fetchTokenDetails(arcatCa, 'arc');

  console.log('  [ARCAT Links]:', {
    explorerUrl: arcatMarket.explorerUrl,
    dexUrl: arcatMarket.dexUrl,
    twitterUrl: arcatMarket.twitterUrl
  });

  assert.strictEqual(arcatMarket.explorerUrl, `https://arc-scan.org/token/${arcatCa}`, 'Explorer URL must be ArcScan token page');
  assert.strictEqual(arcatMarket.dexUrl, 'https://dyorswap.org/?chainId=5042', 'DEX URL must be Dyor Swap');
  assert.strictEqual(arcatMarket.twitterUrl, 'https://x.com/DYORSWAPDEX', 'Twitter URL must be official @DYORSWAPDEX');

  const arcatTradeText = TradeMenu.renderText({
    market: arcatMarket,
    chain: 'arc',
    walletName: 'Wallet_1',
    walletAddress: mockWallets[0].address,
    walletBalance: 100.5,
    userHolding: 0,
    lang: 'zh-hans'
  });

  assert.ok(arcatTradeText.includes('Dyor发射台'), 'Must include Dyor launchpad');
  assert.ok(arcatTradeText.includes('https://dyorswap.org/?chainId=5042'), 'Must link to dyorswap.org');
  assert.ok(arcatTradeText.includes('https://x.com/DYORSWAPDEX'), 'Must link to @DYORSWAPDEX');
  console.log('  ✅ Test 2 Passed: $ARCAT links verified (ArcScan, Dyor Swap, @DYORSWAPDEX)!\n');

  // =========================================================================
  // Test 3: BSC / Solana / Base 链的 Dexscreener、DexTools (bnb/ether slug)、GMGN 链接准确有效性
  // =========================================================================
  console.log('--- Test 3: BSC / Solana / Base / ETH Link Format & Slug Accuracy ---');

  // 3.1 BSC 链代币链接测试
  const bscTokenCa = '0x55d398326f99059fF775485246999027B3197955';
  const bscMarket = await TokenMarketService.fetchTokenDetails(bscTokenCa, 'bsc');
  console.log('  [BSC Market Links]:', {
    dexscreener: bscMarket.dexscreenerUrl,
    dextools: bscMarket.dextoolsUrl,
    gmgn: bscMarket.gmgnUrl
  });

  assert.ok(bscMarket.dexscreenerUrl.includes('dexscreener.com/bsc/'), 'BSC Dexscreener URL must use /bsc/ prefix');
  assert.ok(bscMarket.dextoolsUrl.includes('/app/cn/bnb/pair-explorer/'), 'BSC DexTools MUST use "bnb" slug (NOT bsc)');
  assert.ok(bscMarket.gmgnUrl?.includes('gmgn.ai/bsc/token/'), 'BSC GMGN URL must use /bsc/token/ format');

  const bscTradeText = TradeMenu.renderText({
    market: bscMarket,
    chain: 'bsc',
    walletName: 'BSC_Wallet',
    walletAddress: mockWallets[0].address,
    walletBalance: 5.0,
    userHolding: 0,
    lang: 'zh-hans'
  });
  assert.ok(bscTradeText.includes('BscScan'), 'BSC TradeMenu must include BscScan');
  assert.ok(bscTradeText.includes('Dexscreener'), 'BSC TradeMenu must include Dexscreener');
  assert.ok(bscTradeText.includes('GMGN'), 'BSC TradeMenu must include GMGN');

  // 3.2 Solana 链代币链接测试 (含 Pump.fun 识别)
  const solPumpCa = '6p6xgHyF7AeQHyVaJmm95bY82LCeqTLn8dQ8pn4qpump';
  const solMarket = await TokenMarketService.fetchTokenDetails(solPumpCa, 'solana');
  console.log('  [Solana Market Links]:', {
    dexscreener: solMarket.dexscreenerUrl,
    dextools: solMarket.dextoolsUrl,
    gmgn: solMarket.gmgnUrl
  });

  assert.ok(solMarket.dexscreenerUrl.includes('dexscreener.com/solana/'), 'Solana Dexscreener URL must use /solana/');
  assert.ok(solMarket.dextoolsUrl.includes('/app/cn/solana/pair-explorer/'), 'Solana DexTools must use "solana" slug');
  assert.ok(solMarket.gmgnUrl?.includes('gmgn.ai/sol/token/'), 'Solana GMGN MUST use "sol" slug (NOT solana)');

  const solTradeText = TradeMenu.renderText({
    market: solMarket,
    chain: 'solana',
    walletName: 'Sol_Wallet',
    walletAddress: 'SolanaWalletAddressMock11111111111111111111',
    walletBalance: 10.0,
    userHolding: 0,
    lang: 'zh-hans'
  });
  assert.ok(solTradeText.includes('Solscan'), 'Solana TradeMenu must include Solscan');
  assert.ok(solTradeText.includes('Dexscreener'), 'Solana TradeMenu must include Dexscreener');
  assert.ok(solTradeText.includes('GMGN'), 'Solana TradeMenu must include GMGN');
  assert.ok(solTradeText.includes('Pump.fun'), 'Solana pump token must include Pump.fun direct link');

  // 3.3 Base 链代币链接测试
  const baseTokenCa = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const baseMarket = await TokenMarketService.fetchTokenDetails(baseTokenCa, 'base');
  console.log('  [Base Market Links]:', {
    dexscreener: baseMarket.dexscreenerUrl,
    dextools: baseMarket.dextoolsUrl,
    gmgn: baseMarket.gmgnUrl
  });

  assert.ok(baseMarket.dexscreenerUrl.includes('dexscreener.com/base/'), 'Base Dexscreener URL must use /base/');
  assert.ok(baseMarket.dextoolsUrl.includes('/app/cn/base/pair-explorer/'), 'Base DexTools must use "base" slug');
  assert.ok(baseMarket.gmgnUrl?.includes('gmgn.ai/base/token/'), 'Base GMGN must use /base/token/ format');

  const baseTradeText = TradeMenu.renderText({
    market: baseMarket,
    chain: 'base',
    walletName: 'Base_Wallet',
    walletAddress: mockWallets[0].address,
    walletBalance: 2.0,
    userHolding: 0,
    lang: 'zh-hans'
  });
  assert.ok(baseTradeText.includes('Basescan'), 'Base TradeMenu must include Basescan');
  assert.ok(baseTradeText.includes('Dexscreener'), 'Base TradeMenu must include Dexscreener');
  assert.ok(baseTradeText.includes('GMGN'), 'Base TradeMenu must include GMGN');

  // 3.4 Ethereum 链 DexTools slug 特殊校验 (ether vs ethereum)
  const ethTokenCa = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const ethMarket = await TokenMarketService.fetchTokenDetails(ethTokenCa, 'ethereum');
  assert.ok(ethMarket.dextoolsUrl.includes('/app/cn/ether/pair-explorer/'), 'ETH DexTools MUST use "ether" slug (NOT ethereum)');
  assert.ok(ethMarket.gmgnUrl?.includes('gmgn.ai/eth/token/'), 'ETH GMGN MUST use "eth" slug (NOT ethereum)');
  console.log('  ✅ Test 3 Passed: BSC (bnb), Solana (sol), Base, and ETH (ether) link slugs verified!\n');

  // =========================================================================
  // Test 4: 全网主流公链生态与内盘发射台模块完整性测试
  // =========================================================================
  console.log('--- Test 4: Multi-Chain Ecosystem & Launchpad Guides ---');
  const solText = ChainEcosystemMenu.renderText('solana', 'zh-hans');
  assert.ok(solText.includes('Pump.fun'), 'Solana guide must cover Pump.fun');
  assert.ok(solText.includes('Moonshot'), 'Solana guide must cover Moonshot');
  assert.ok(solText.includes('Jito Anti-MEV'), 'Solana guide must cover Jito Anti-MEV');

  const bscText = ChainEcosystemMenu.renderText('bsc', 'zh-hans');
  assert.ok(bscText.includes('Four.meme'), 'BSC guide must cover Four.meme');
  assert.ok(bscText.includes('Gra.fun'), 'BSC guide must cover Gra.fun');
  assert.ok(bscText.includes('48Club 防夹节点'), 'BSC guide must cover 48Club anti-sandwich node');

  const baseText = ChainEcosystemMenu.renderText('base', 'zh-hans');
  assert.ok(baseText.includes('Virtuals Protocol'), 'Base guide must cover Virtuals Protocol');
  assert.ok(baseText.includes('Clanker'), 'Base guide must cover Clanker');
  assert.ok(baseText.includes('Flashbots MEV-Share'), 'Base guide must cover Flashbots MEV-Share');

  const suiText = ChainEcosystemMenu.renderText('sui', 'zh-hans');
  assert.ok(suiText.includes('MovePump'), 'Sui guide must cover MovePump');

  const tonText = ChainEcosystemMenu.renderText('ton', 'zh-hans');
  assert.ok(tonText.includes('GasPump'), 'TON guide must cover GasPump');

  const arcGuideText = ArcGuideMenu.renderText('zh-hans');
  assert.ok(arcGuideText.includes('Across Protocol'), 'ARC guide must cover Across Protocol');
  assert.ok(arcGuideText.includes('Axelar Interchain'), 'ARC guide must cover Axelar Interchain');
  assert.ok(arcGuideText.includes('WheelX'), 'ARC guide must cover WheelX Bridge');
  assert.ok(arcGuideText.includes('Wormhole Portal') || arcGuideText.includes('portalbridge.com'), 'ARC guide must cover Wormhole Portal');
  console.log('  ✅ Test 4 Passed: Multi-Chain launchpads, bridges, and node guides validated!\n');

  // =========================================================================
  // Test 5: MainMenu 动态生态入口按键测试
  // =========================================================================
  console.log('--- Test 5: MainMenu Dynamic Ecosystem Button ---');
  const arcKb = MainMenu.renderKeyboard(mockWallets, 'zh-hans', 'arc');
  const arcBtns = arcKb.inline_keyboard.flat();
  const arcBtn = arcBtns.find(b => b.callback_data === 'menu_arc_guide');
  assert.ok(arcBtn, 'ARC MainMenu must have menu_arc_guide');
  assert.ok(arcBtn.text.includes('ARC 跨链指引'));

  const solKb = MainMenu.renderKeyboard(mockWallets, 'zh-hans', 'solana');
  const solBtns = solKb.inline_keyboard.flat();
  const solBtn = solBtns.find(b => b.callback_data === 'menu_chain_guide_solana');
  assert.ok(solBtn, 'Solana MainMenu must have menu_chain_guide_solana');
  assert.ok(solBtn.text.includes('Solana 生态与内盘指引'));

  const bscKb = MainMenu.renderKeyboard(mockWallets, 'zh-hans', 'bsc');
  const bscBtns = bscKb.inline_keyboard.flat();
  const bscBtn = bscBtns.find(b => b.callback_data === 'menu_chain_guide_bsc');
  assert.ok(bscBtn, 'BSC MainMenu must have menu_chain_guide_bsc');
  assert.ok(bscBtn.text.includes('BSC 生态与内盘指引'));
  console.log('  ✅ Test 5 Passed: MainMenu dynamically adapts ecosystem button per chain!\n');

  console.log('=========================================================================');
  console.log('🎉 ALL MULTI-CHAIN, TRADEMENU LINKS & LAUNCHPAD TESTS 100% PASSED!');
  console.log('=========================================================================\n');
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
