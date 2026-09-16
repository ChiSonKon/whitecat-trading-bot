import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const globalTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whitecat-group-test-'));
process.env.USER_STORE_FILE = path.join(globalTestDir, 'store.json');
process.env.USER_STORE_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

const { TokenDetector } = await import('../src/handlers/tokenDetector.js');
const { TradeMenu } = await import('../src/menus/tradeMenu.js');
const { TokenKeyHelper } = await import('../src/services/tokenKeyHelper.js');
const { TokenMarketService, PRESET_TOKENS } = await import('../src/services/tokenMarketService.js');
const { getOrCreateUser, userStore } = await import('../src/services/userService.js');

async function runTestSuite() {
  console.log('🚀 开始执行 WhiteCat 群聊原生集成与全公链 CA 智能嗅探测试套件...\n');

  // ==========================================
  // 测试 1: EVM 系列 CA 智能嗅探 (纯地址、推特文案、DexScreener/浏览器链接)
  // ==========================================
  console.log('--- 1. EVM 系列智能嗅探测试 ---');
  // 1.1 纯 EVM 地址
  const evm1 = TokenDetector.sniffTokenContract('0x07704b06981ea962b87296362a1281484d160000');
  assert.equal(evm1.isContract, true, '0x40 字符必须识别为合约');
  assert.equal(evm1.type, 'evm', '类型应为 evm');
  assert.equal(evm1.address.toLowerCase(), '0x07704b06981ea962b87296362a1281484d160000');

  // 1.2 夹杂在推特喊单文案中
  const tweetShill = '🚀 兄弟们速冲金狗！CA: 0x99b37b7fccaa7a1030617b6195eb3045c523bb97 目标 100M，已拉盘 50%！';
  const evm2 = TokenDetector.sniffTokenContract(tweetShill);
  assert.equal(evm2.isContract, true, '推特喊单文案中的 EVM CA 必须提取成功');
  assert.equal(evm2.address.toLowerCase(), '0x99b37b7fccaa7a1030617b6195eb3045c523bb97');

  // 1.3 DexScreener BSC 链接提取
  const dexUrlBsc = 'https://dexscreener.com/bsc/0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
  const evm3 = TokenDetector.sniffTokenContract(dexUrlBsc);
  assert.equal(evm3.isContract, true, 'DexScreener 链接中的 CA 必须提取成功');
  assert.equal(evm3.address.toLowerCase(), '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c');
  assert.equal(evm3.chainHint, 'bsc', '应识别 chainHint 为 bsc');

  // 1.4 DexScreener Arc 链接提取
  const dexUrlArc = 'https://dexscreener.com/arc/0x07704b06981ea962b87296362a1281484d160000';
  const evm4 = TokenDetector.sniffTokenContract(dexUrlArc);
  assert.equal(evm4.isContract, true);
  assert.equal(evm4.chainHint, 'arc');

  // 1.5 ArcScan 浏览器直达链接提取
  const arcScanUrl = 'https://arc-scan.org/token/0x07704b06981ea962b87296362a1281484d160000';
  const evm5 = TokenDetector.sniffTokenContract(arcScanUrl);
  assert.equal(evm5.isContract, true);
  assert.equal(evm5.chainHint, 'arc');

  console.log('✅ 测试 1 通过：EVM 系列各场景智能嗅探均精准识别！\n');

  // ==========================================
  // 测试 2: Solana 系列 CA 智能嗅探 (包含 pump 结尾与 Dexscreener/Pump.fun 链接)
  // ==========================================
  console.log('--- 2. Solana 系列智能嗅探测试 ---');
  // 2.1 纯 Solana Mint 地址 (44 字符 Base58，Ed25519 32 字节)
  const solMint = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
  const sol1 = TokenDetector.sniffTokenContract(solMint);
  assert.equal(sol1.isContract, true);
  assert.equal(sol1.type, 'solana');
  assert.equal(sol1.address, solMint);

  // 2.2 pump 结尾的 Pump.fun 代币嵌入文案
  const pumpText = 'pump 内盘刚开！抢筹地址: 6p6xgHyF7AeQHyMunfFo23m9cvpdHAQCVAz2eyBLpump 抓紧上车';
  const sol2 = TokenDetector.sniffTokenContract(pumpText);
  assert.equal(sol2.isContract, true);
  assert.equal(sol2.type, 'solana');
  assert.equal(sol2.address, '6p6xgHyF7AeQHyMunfFo23m9cvpdHAQCVAz2eyBLpump');

  // 2.3 Pump.fun 官方链接直达
  const pumpUrl = 'https://pump.fun/coin/6p6xgHyF7AeQHyMunfFo23m9cvpdHAQCVAz2eyBLpump';
  const sol3 = TokenDetector.sniffTokenContract(pumpUrl);
  assert.equal(sol3.isContract, true);
  assert.equal(sol3.type, 'solana');
  assert.equal(sol3.chainHint, 'solana');

  // 2.4 Solscan 链接直达
  const solscanUrl = 'https://solscan.io/token/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
  const sol4 = TokenDetector.sniffTokenContract(solscanUrl);
  assert.equal(sol4.isContract, true);
  assert.equal(sol4.type, 'solana');

  console.log('✅ 测试 2 通过：Solana 系列 Base58 与 Pump 代币嗅探 100% 成功！\n');

  // ==========================================
  // 测试 3: Sui 与 TON 系列 CA 智能嗅探
  // ==========================================
  console.log('--- 3. Sui 与 TON 系列智能嗅探测试 ---');
  // 3.1 Sui Move 结构体
  const suiStruct1 = '0x2::sui::SUI';
  const suiRes1 = TokenDetector.sniffTokenContract(suiStruct1);
  assert.equal(suiRes1.isContract, true);
  assert.equal(suiRes1.type, 'sui');
  assert.equal(suiRes1.address, '0x2::sui::SUI');

  // 3.2 Sui Move 结构体嵌入在聊天句子中
  const suiSentence = '大家关注一下 0x9f854b7c89a012::magma::MAGMA 这个 Sui 链的新生代币！';
  const suiRes2 = TokenDetector.sniffTokenContract(suiSentence);
  assert.equal(suiRes2.isContract, true);
  assert.equal(suiRes2.type, 'sui');
  assert.equal(suiRes2.address, '0x9f854b7c89a012::magma::MAGMA');

  // 3.3 Sui 66 位 (0x + 64 hex) 原生地址
  const suiHex = '0x0000000000000000000000000000000000000000000000000000000000000002';
  const suiRes3 = TokenDetector.sniffTokenContract(suiHex);
  assert.equal(suiRes3.isContract, true);
  assert.equal(suiRes3.type, 'sui');

  // 3.4 TON 48 字符 Friendly 地址
  const tonAddr = 'EQBynBO23ywHy_CgarY9NK9FTz0yDsGvvjNOY00cQI44uPwp';
  const tonRes1 = TokenDetector.sniffTokenContract(tonAddr);
  assert.equal(tonRes1.isContract, true);
  assert.equal(tonRes1.type, 'ton');
  assert.equal(tonRes1.address, tonAddr);

  // 3.5 TON 地址夹杂在喊单句子中
  const tonSentence = 'TON 生态爆发，快看 CA: EQBynBO23ywHy_CgarY9NK9FTz0yDsGvvjNOY00cQI44uPwp 冲！';
  const tonRes2 = TokenDetector.sniffTokenContract(tonSentence);
  assert.equal(tonRes2.isContract, true);
  assert.equal(tonRes2.type, 'ton');
  assert.equal(tonRes2.address, tonAddr);

  console.log('✅ 测试 3 通过：Sui 与 TON 系列 CA 智能识别准确无误！\n');

  // ==========================================
  // 测试 4: 普通非 CA 文本防刷屏与静默过滤
  // ==========================================
  console.log('--- 4. 普通非 CA 文本静默过滤测试 ---');
  const normalTexts = [
    'hello everyone',
    'GM friends',
    '今天行情真不错，有人推荐代币吗？',
    '大家觉得 BTC 能破 10 万刀吗',
    'https://google.com',
    '哈哈哈哈笑死我了',
    '@whitecat_bot 出来聊聊',
    '100 200 500',
    'buy 50%',
    'what is your roadmap?'
  ];

  for (const text of normalTexts) {
    const res = TokenDetector.sniffTokenContract(text);
    assert.equal(res.isContract, false, `普通文本 "${text}" 绝不能误识别为合约！`);
  }
  console.log('✅ 测试 4 通过：所有普通聊天、非行情链接均被安全识别为非 CA，保障群聊静默！\n');

  // ==========================================
  // 测试 5: 群聊专属【代币科技雷达简报卡】排版与零隐私数据断言
  // ==========================================
  console.log('--- 5. 群聊雷达卡片与零隐私泄漏断言测试 ---');
  const mockMarket = {
    name: 'Arcat',
    symbol: 'ARCAT',
    address: '0x07704b06981ea962b87296362a1281484d160000',
    priceUsd: 0.125,
    priceNative: 0.125,
    nativePriceUsd: 1.0,
    marketCapUsd: 1250000,
    liquidityNative: 85000,
    holdersCount: '15.2K',
    riskLevel: 'Safe',
    dexscreenerUrl: 'https://arc-scan.org/token/0x07704b06981ea962b87296362a1281484d160000',
    dextoolsUrl: '',
    smartDegenCount: 5,
    kolCount: 2,
    radarScore: 92,
    linkedHoldRate: 0.03,
    devStatus: 'HOLDING' as const
  };

  const groupCardText = TradeMenu.renderGroupCardText({
    market: mockMarket,
    chain: 'arc',
    lang: 'zh-hans'
  });

  // 1. 验证包含核心公开科技数据
  assert.ok(groupCardText.includes('Arcat (ARCAT)'), '卡片必须包含代币名称与Symbol');
  assert.ok(groupCardText.includes('0x07704b06981ea962b87296362a1281484d160000'), '卡片必须包含点击复制的合约地址');
  assert.ok(groupCardText.includes('Arc Network') || groupCardText.includes('ARC'), '卡片必须包含所属公链');
  assert.ok(groupCardText.includes('聪明钱: <b>5人</b>'), '卡片必须包含真聪明钱数量');
  assert.ok(groupCardText.includes('KOL喊单: <b>2人</b>'), '卡片必须包含 KOL 数量');
  assert.ok(groupCardText.includes('92 分'), '卡片必须包含雷达评分');
  assert.ok(groupCardText.includes('🟢 安全'), '卡片必须包含老鼠仓安全评级');
  assert.ok(groupCardText.includes('HOLDING'), '卡片必须包含 Dev 状态');

  // 2. 关键断言：绝对严禁出现任何个人隐私或钱包数据！
  assert.ok(!groupCardText.includes('Wallet_'), '群聊卡片绝对严禁出现用户钱包编号');
  assert.ok(!groupCardText.includes('当前钱包'), '群聊卡片绝对严禁出现用户当前钱包');
  assert.ok(!groupCardText.includes('余额:'), '群聊卡片绝对严禁出现用户个人余额');
  assert.ok(!groupCardText.includes('持仓:'), '群聊卡片绝对严禁出现用户个人持仓');
  assert.ok(!groupCardText.includes('PnL:'), '群聊卡片绝对严禁出现个人盈亏数据');

  console.log('✅ 测试 5 通过：群聊科技雷达卡片排版精美，100% 杜绝个人钱包与持仓隐私！\n');

  // ==========================================
  // 测试 6: 群聊底部按键与 Telegram 原生 DeepLink 校验
  // ==========================================
  console.log('--- 6. 群聊底部按键与 DeepLink 测试 ---');
  const groupKeyboard = TradeMenu.renderGroupCardKeyboard({
    chain: 'arc',
    tokenAddress: mockMarket.address,
    botUsername: 'whitecat_test_bot',
    lang: 'zh-hans',
    market: mockMarket
  });

  const buttons = groupKeyboard.inline_keyboard;
  assert.ok(buttons.length >= 2, '键盘应包含多行操作按键');

  // 按钮 1: 原生私聊交易 DeepLink
  const buyBtn = buttons[0][0];
  assert.ok(buyBtn.text.includes('立即买入 / 交易'), '按钮 1 文本应引导买入交易');
  assert.ok(buyBtn.url, '按钮 1 必须为原生 URL DeepLink 按钮');
  assert.ok(buyBtn.url.includes('https://t.me/whitecat_test_bot?start=trade_'), 'URL 必须使用 Telegram 原生 start=trade_ 深度链接');
  assert.ok(buyBtn.url.includes('5042'), 'URL 中必须携带 Arc Network ChainId 5042');

  // 按钮 2: K线 / 区块浏览器直达
  const chartBtn = buttons[1][0];
  assert.ok(chartBtn.text.includes('K线 / 区块浏览器直达'), '按钮 2 文本应为图表/浏览器');
  assert.ok(chartBtn.url && chartBtn.url.length > 5, '按钮 2 必须包含有效的外部链接');

  // 按钮 3: 原地刷新数据
  const refreshBtn = buttons[1][1];
  assert.ok(refreshBtn.text.includes('刷新数据'), '按钮 3 应为刷新按钮');
  assert.ok(refreshBtn.callback_data && refreshBtn.callback_data.startsWith('gr_'), '刷新按钮必须使用专属 gr_ 回调');

  console.log('✅ 测试 6 通过：原生 DeepLink 与跳转按钮结构完全符合 Telegram 规范！\n');

  // ==========================================
  // 测试 7: 私聊接收 start=trade_<tokenKey>_<chainId> 解析测试
  // ==========================================
  console.log('--- 7. DeepLink Payload 逆向解析测试 ---');
  const tokenKey = TokenKeyHelper.register(mockMarket.address);
  const rawPayload = `trade_${tokenKey}_5042`.replace(/^(referTrade_|refTrade_|trade_)/, '');

  const parts = rawPayload.split('_');
  let parsedTokenKey = '';
  let parsedChainId = '';
  if (parts.length >= 3 && parts[0] === 'tk') {
    parsedTokenKey = `tk_${parts[1]}`;
    parsedChainId = parts[2];
  } else {
    parsedTokenKey = parts[0];
    parsedChainId = parts[1];
  }

  assert.equal(parsedTokenKey, tokenKey, '必须准确解析出 tokenKey');
  assert.equal(parsedChainId, '5042', '必须准确解析出 chainId');
  const resolvedChain = TradeMenu.resolveChainFromIdOrName(parsedChainId);
  assert.equal(resolvedChain, 'arc', 'chainId 5042 必须正确解析为 arc 链');
  const resolvedAddr = TokenKeyHelper.toAddress(parsedTokenKey);
  assert.equal(resolvedAddr.toLowerCase(), mockMarket.address.toLowerCase(), 'tokenKey 必须还原为完整合约地址');

  console.log('✅ 测试 7 通过：DeepLink 唤起私聊并逆向解析代币及公链 100% 精确！\n');

  console.log('====================================================');
  console.log('🎉 所有 7 项群聊原生集成与多链 CA 嗅探测试全部通过！');
  console.log('====================================================\n');
}

runTestSuite().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
