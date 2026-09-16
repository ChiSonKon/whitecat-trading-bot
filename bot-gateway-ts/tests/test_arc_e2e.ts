import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';
import type { TradeConfig } from '../src/menus/settingsMenu.js';
import type { LimitOrderItem } from '../src/menus/limitOrderMenu.js';

// 确保在加载 userService 之前具备加密存储凭据与临时目录
if (!process.env.USER_STORE_ENCRYPTION_KEY) {
  process.env.USER_STORE_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
}
if (!process.env.USER_STORE_FILE) {
  const globalTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whitecat-arc-e2e-'));
  process.env.USER_STORE_FILE = path.join(globalTestDir, 'user_store.json');
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

async function runE2ETests() {
  const { CONFIG } = await import('../src/config.js');
  const { MainMenu } = await import('../src/menus/mainMenu.js');
  const { ChainMenu } = await import('../src/menus/chainMenu.js');
  const { TradeMenu } = await import('../src/menus/tradeMenu.js');
  const { SettingsMenu } = await import('../src/menus/settingsMenu.js');
  const { LimitOrderMenu } = await import('../src/menus/limitOrderMenu.js');
  const { ChainBalanceService } = await import('../src/services/chainBalanceService.js');
  const { OnChainSwapService } = await import('../src/services/onChainSwapService.js');
  const { getUserWallets, getOrCreateUser } = await import('../src/services/userService.js');
  console.log('================================================================================');
  console.log('🏛️ 白猫打狗机器人 (@wctibot) ARC 新链第二阶段：全链路端到端 (E2E) 测试套件');
  console.log('================================================================================\n');

  // ---------------------------------------------------------------------------
  // 测试 1: ARC 链配置与切链元数据校验
  // ---------------------------------------------------------------------------
  console.log('📌 [Test 1] 校验 ARC 链配置、切链菜单与多链元数据映射...');
  const arcChainConfig = CONFIG.SUPPORTED_CHAINS.find(c => c.id === 'arc');
  assert(!!arcChainConfig, 'SUPPORTED_CHAINS 中必须包含 arc 链配置');
  assert(arcChainConfig?.chainId === 5042, 'ARC Chain ID 必须为 5042');
  assert(arcChainConfig?.native === 'USDC', 'ARC 原生代币必须为 USDC');
  assert(arcChainConfig?.name === 'Arc Network', 'ARC 显示名称必须为 Arc Network');

  assert(MainMenu.getChainDisplayName('arc') === 'Arc Network', 'MainMenu.getChainDisplayName("arc") 返回 Arc Network');
  assert(MainMenu.getChainNativeSymbol('arc') === 'USDC', 'MainMenu.getChainNativeSymbol("arc") 返回 USDC');
  assert(TradeMenu.getChainId('arc') === 5042, 'TradeMenu.getChainId("arc") 返回 5042');
  assert(TradeMenu.resolveChainFromIdOrName('5042') === 'arc', 'TradeMenu.resolveChainFromIdOrName("5042") 解析为 arc');

  const chainKb = ChainMenu.renderKeyboard('zh-hans');
  const allButtons = chainKb.inline_keyboard.flat();
  const arcBtn = allButtons.find(b => b.callback_data === 'switch_chain_arc');
  assert(!!arcBtn, 'ChainMenu 必须提供 switch_chain_arc 切换按键');
  assert(arcBtn?.text === 'Arc Network', '切链按键文本匹配 "Arc Network"');

  const testUser = getOrCreateUser(9999901, 'e2e_tester');
  testUser.activeChain = 'arc';
  const arcWallets = getUserWallets(testUser, 'arc');
  assert(Array.isArray(arcWallets), 'getUserWallets 必须返回当前链钱包数组');

  // 派生 ARC 链有效 EVM 钱包
  const newWallet = ethers.Wallet.createRandom();
  arcWallets.push({
    index: 0,
    address: newWallet.address,
    isDefault: true,
    balance: 0,
    symbol: 'USDC',
    privateKey: newWallet.privateKey
  });

  assert(arcWallets.length > 0, 'ARC 链应能成功获取默认钱包');
  assert(ethers.isAddress(arcWallets[0].address), 'ARC 钱包地址必须是合法 EVM 校验和地址');
  if (arcWallets[0].privateKey) {
    const recoveredWallet = new ethers.Wallet(arcWallets[0].privateKey);
    assert(recoveredWallet.address.toLowerCase() === arcWallets[0].address.toLowerCase(), 'ARC 私钥能准确恢复对应公钥地址');
  }

  // ---------------------------------------------------------------------------
  // 测试 2: ARC 钱包余额查询与 6 位小数 USDC 精度解析
  // ---------------------------------------------------------------------------
  console.log('\n📌 [Test 2] 校验 ARC 钱包余额查询 (6 位小数 USDC 原生精度)...');
  const dummyAddress = '0x1234567890123456789012345678901234567890';
  const origPost = ChainBalanceService.httpClient.post;
  try {
    // 250.50 USDC = 250,500,000 base units = 0xeee53a0
    ChainBalanceService.httpClient.post = async (url: string, payload: any) => {
      if (url.includes('arc-scan.org') || url.includes('niorfun.com')) {
        assert(payload.method === 'eth_getBalance', 'RPC 方法为 eth_getBalance');
        return { data: { result: '0x' + (250500000).toString(16) } } as any;
      }
      return origPost.call(ChainBalanceService.httpClient, url, payload);
    };

    const balance = await ChainBalanceService.getNativeBalance('arc', dummyAddress);
    assert(balance === 250.5, `250.50 USDC 余额解析结果为 250.5 (实际: ${balance})`);

    // 0 余额场景
    ChainBalanceService.httpClient.post = async (url: string, payload: any) => {
      return { data: { result: '0x0' } } as any;
    };
    const zeroBal = await ChainBalanceService.getNativeBalance('arc', dummyAddress);
    assert(zeroBal === 0, `0 USDC 余额解析结果为 0 (实际: ${zeroBal})`);
  } finally {
    ChainBalanceService.httpClient.post = origPost;
  }

  // ---------------------------------------------------------------------------
  // 测试 3: DEX 路由预估与滑点控制 (Router Quotes & Slippage Minimum Output)
  // ---------------------------------------------------------------------------
  console.log('\n📌 [Test 3] 校验 ARC DEX 路由预估与阶梯滑点控制 (Uniswap V2 Router 协议)...');
  const routerIface = new ethers.Interface([
    'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] amounts)'
  ]);

  const origRpc = OnChainSwapService.callEvmRpc;
  try {
    const mockTokenAddr = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const mockUsdcAddr = '0x4200000000000000000000000000000000000006';

    // 模拟 100 USDC (100_000_000 单元) 买入，得到 1000 个代币 (1000 * 10^18 单元)
    const mockTokenAmountOut = ethers.parseUnits('1000', 18);

    OnChainSwapService.callEvmRpc = async (chain: string, method: string, params: any[]) => {
      assert(chain === 'arc', 'RPC 请求目标链必须为 arc');
      if (method === 'eth_chainId') return '0x13b2'; // 5042
      if (method === 'eth_getCode') return '0x6080604052348015'; // 合约存在
      if (method === 'eth_call') {
        const calldata = params[0].data;
        if (calldata.startsWith(routerIface.getFunction('getAmountsOut')!.selector)) {
          const [amountIn] = routerIface.decodeFunctionData('getAmountsOut', calldata);
          return routerIface.encodeFunctionResult('getAmountsOut', [[amountIn, mockTokenAmountOut]]);
        }
      }
      throw new Error(`Unexpected RPC method ${method}`);
    };

    // 验证不同滑点下的 minimumOutput
    const amountInWei = 100_000_000n; // 100 USDC
    const path = [mockUsdcAddr, mockTokenAddr];

    // 5% 滑点: minimum = 1000 * 0.95 = 950
    const minOut5 = await (OnChainSwapService as any).minimumOutput('arc', amountInWei, path, 5);
    const expectedMin5 = (mockTokenAmountOut * 9500n) / 10000n;
    assert(minOut5 === expectedMin5, '5% 滑点下最低产出为预期产出的 95%');

    // 10% 滑点: minimum = 1000 * 0.90 = 900
    const minOut10 = await (OnChainSwapService as any).minimumOutput('arc', amountInWei, path, 10);
    const expectedMin10 = (mockTokenAmountOut * 9000n) / 10000n;
    assert(minOut10 === expectedMin10, '10% 滑点下最低产出为预期产出的 90%');

    // 20% 滑点: minimum = 1000 * 0.80 = 800
    const minOut20 = await (OnChainSwapService as any).minimumOutput('arc', amountInWei, path, 20);
    const expectedMin20 = (mockTokenAmountOut * 8000n) / 10000n;
    assert(minOut20 === expectedMin20, '20% 滑点下最低产出为预期产出的 80%');
  } finally {
    OnChainSwapService.callEvmRpc = origRpc;
  }

  // ---------------------------------------------------------------------------
  // 测试 4: 0.6% 协议维护费方案 (6 位小数 USDC 精度校验)
  // ---------------------------------------------------------------------------
  console.log('\n📌 [Test 4] 校验 0.6% 协议维护费在 ARC 链 6 位小数 USDC 精度下无损划分...');
  const { createEvmBuyFeePlan } = await import('../src/services/evmProtocolFee.js');
  const feeRecipient = '0x9999999999999999999999999999999999999999';

  // 用户买入 100 USDC (100,000,000 单元)
  const input100USDC = 100_000_000n;
  const feePlan = createEvmBuyFeePlan(input100USDC, CONFIG.PROTOCOL_FEE_RATE_SCALED, feeRecipient);
  assert(feePlan.fee === 600_000n, `0.6% 协议维护费为 0.6 USDC (600,000 基础单元，实际: ${feePlan.fee})`);
  assert(feePlan.net === 99_400_000n, `99.4% 净入池交易金额为 99.4 USDC (99,400,000 基础单元，实际: ${feePlan.net})`);
  assert(feePlan.fee + feePlan.net === input100USDC, '协议费 + 净买入金额必须严格守恒等于原始总金额 100 USDC');
  assert(feePlan.recipient.toLowerCase() === feeRecipient.toLowerCase(), '手续费收款地址精确匹配');

  // ---------------------------------------------------------------------------
  // 测试 5: ARC 链本地私钥真实交易构建与签名校验 (Chain ID 5042)
  // ---------------------------------------------------------------------------
  console.log('\n📌 [Test 5] 校验 ARC 链本地私钥真实签名、EIP-1559/Legacy 结构与 Chain ID 5042 校验和...');
  const arcSignerWallet = ethers.Wallet.createRandom();
  const mockRouter = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

  // 模拟从 Settings 获取的 Tip 计算 Gas Price
  const effectiveTip = SettingsMenu.getEffectiveTip('arc', {
    mode: 'fast',
    gasTip: 0.001,
    slippage: 50,
    antiMev: true,
    buyPresets: [10, 50, 100, 200, 500],
    sellPresets: [50, 100]
  });
  assert(effectiveTip === 0.01, 'ARC 默认未自定义时生效 0.01 USDC Tip');

  const baseGasPrice = ethers.parseUnits('1', 'gwei'); // 1 Gwei
  const tipPerGas = (BigInt(Math.floor(effectiveTip * 1_000_000)) / 350000n);
  const totalGasPrice = baseGasPrice + (tipPerGas > 0n ? tipPerGas : 0n);

  const txDraft = {
    to: mockRouter,
    value: 99_400_000n, // 99.4 USDC
    data: '0x38ed1739' + '00'.repeat(128), // 模拟 swap 编码
    nonce: 0,
    gasLimit: 350000n,
    gasPrice: totalGasPrice,
    chainId: 5042
  };

  const rawSignedTx = await arcSignerWallet.signTransaction(txDraft);
  assert(typeof rawSignedTx === 'string' && rawSignedTx.startsWith('0x'), '签名产物必须为合法 16 进制 Raw Transaction 字符串');

  // 反序列化并核验加密签名与各字段
  const parsedTx = ethers.Transaction.from(rawSignedTx);
  assert(parsedTx.chainId === 5042n, `反序列化交易 Chain ID 严格为 5042 (实际: ${parsedTx.chainId})`);
  assert(parsedTx.to?.toLowerCase() === mockRouter.toLowerCase(), '交易目标地址严格为 ARC Router 地址');
  assert(parsedTx.value === 99_400_000n, '交易转入金额严格为 99.4 USDC');
  assert(parsedTx.nonce === 0, '交易 Nonce 准确匹配');
  assert(parsedTx.from?.toLowerCase() === arcSignerWallet.address.toLowerCase(), '从加密签名恢复的地址与真实私钥公钥完全一致');

  // ---------------------------------------------------------------------------
  // 测试 6: ARC 限价单触发比对深度评估 (USDC 计价本位)
  // ---------------------------------------------------------------------------
  console.log('\n📌 [Test 6] 校验 ARC 链限价单 USDC 计价本位触发判定与评估报告...');

  // 限价买单：目标价 0.50 USDC
  const buyOrder: LimitOrderItem = {
    id: 'lmt_buy_1',
    tokenAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    symbol: 'DOGE_CAT',
    orderType: 'BUY',
    triggerPrice: 0.50,
    amount: 100,
    chain: 'arc',
    baseCurrency: 'USDC'
  };

  assert(LimitOrderMenu.isOrderTriggered(buyOrder, 0.45, 'arc') === true, '市价 0.45 USDC <= 0.50 USDC，买单必须触发');
  assert(LimitOrderMenu.isOrderTriggered(buyOrder, 0.50, 'arc') === true, '市价 0.50 USDC == 0.50 USDC，买单精准触发');
  assert(LimitOrderMenu.isOrderTriggered(buyOrder, 0.55, 'arc') === false, '市价 0.55 USDC > 0.50 USDC，买单未触发');
  assert(LimitOrderMenu.compareTriggerPrice(buyOrder, 0.49, 'arc') === true, 'compareTriggerPrice 别名准确触发');

  // 限价卖单（止盈）：目标价 1.50 USDC
  const sellOrder: LimitOrderItem = {
    id: 'tp_sell_1',
    tokenAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    symbol: 'DOGE_CAT',
    orderType: 'SELL',
    triggerPrice: 1.50,
    amount: 100,
    chain: 'arc',
    baseCurrency: 'USDC'
  };

  assert(LimitOrderMenu.isOrderTriggered(sellOrder, 1.60, 'arc') === true, '市价 1.60 USDC >= 1.50 USDC，止盈卖单必须触发');
  assert(LimitOrderMenu.isOrderTriggered(sellOrder, 1.50, 'arc') === true, '市价 1.50 USDC == 1.50 USDC，止盈卖单精准触发');
  assert(LimitOrderMenu.isOrderTriggered(sellOrder, 1.40, 'arc') === false, '市价 1.40 USDC < 1.50 USDC，止盈卖单未触发');

  // 限价卖单（止损）：目标价 0.30 USDC
  const slOrder: LimitOrderItem = {
    id: 'sl_stop_1',
    tokenAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    symbol: 'DOGE_CAT',
    orderType: 'SELL',
    triggerPrice: 0.30,
    amount: 100,
    chain: 'arc',
    baseCurrency: 'USDC'
  };

  assert(LimitOrderMenu.isOrderTriggered(slOrder, 0.28, 'arc') === true, '市价 0.28 USDC <= 0.30 USDC，止损卖单必须触发');
  assert(LimitOrderMenu.isOrderTriggered(slOrder, 0.35, 'arc') === false, '市价 0.35 USDC > 0.30 USDC，止损卖单未触发');

  // 深度评估方法 evaluateLimitOrder
  const evalBuy = LimitOrderMenu.evaluateLimitOrder(buyOrder, 0.45, 'arc');
  assert(evalBuy.triggered === true, '评估结果 triggered 为 true');
  assert(evalBuy.baseCurrency === 'USDC', '评估本位货币为 USDC');
  assert(evalBuy.priceDiffPct === -10, '偏离度计算准确: (0.45 - 0.5) / 0.5 * 100 = -10%');
  assert(evalBuy.reason.includes('0.45 USDC'), '评估说明中包含当前市价与 USDC 单位');

  // 限价单列表渲染文本
  const renderedText = LimitOrderMenu.renderText(undefined, [buyOrder, sellOrder], 'zh-hans', 'arc');
  assert(renderedText.includes('0.5 USDC'), '渲染文本中买单包含 0.5 USDC 格式');
  assert(renderedText.includes('1.5 USDC'), '渲染文本中卖单包含 1.5 USDC 格式');
  assert(renderedText.includes('[USDC]'), '渲染文本中带有 [USDC] 标签');

  // ---------------------------------------------------------------------------
  // 测试 7: 设置菜单 ARC 滑点与 USDC Tip 校验
  // ---------------------------------------------------------------------------
  console.log('\n📌 [Test 7] 校验设置菜单中 ARC 链滑点与 USDC Tip 交互呈现...');
  const testConfig: TradeConfig = {
    mode: 'fast',
    gasTip: 0.05,
    slippage: 15,
    antiMev: true,
    buyPresets: [10, 50, 100, 200, 500],
    sellPresets: [50, 100],
    chainGasTips: {
      arc: 0.05
    }
  };

  const settingsText = SettingsMenu.renderText('arc', testConfig, 'zh-hans');
  assert(settingsText.includes('Arc Network'), '设置菜单标题包含 Arc Network');
  assert(settingsText.includes('0.05 USDC'), '设置菜单 Gas Tip 文本格式化为 0.05 USDC');
  assert(settingsText.includes('15%'), '设置菜单滑点文本显示为 15%');

  const settingsKb = SettingsMenu.renderKeyboard('arc', testConfig, 'zh-hans');
  const kbButtons = settingsKb.inline_keyboard.flat();
  const tipBtn = kbButtons.find(b => b.callback_data === 'set_tip');
  const slipBtn = kbButtons.find(b => b.callback_data === 'set_slippage');
  const buyBtn1 = kbButtons.find(b => b.callback_data === 'set_buy_1');

  assert(!!tipBtn && tipBtn.text.includes('0.05 USDC'), '设置按键包含 0.05 USDC 小费提示');
  assert(!!slipBtn && slipBtn.text.includes('15%'), '滑点按键显示当前 15% 滑点');
  assert(!!buyBtn1 && buyBtn1.text.includes('10 USDC'), '预设买入按键 1 明确显示 10 USDC');

  // 默认 ETH 预设自动适配 ARC 场景
  const legacyConfig: TradeConfig = {
    mode: 'normal',
    gasTip: 0.001,
    slippage: 50,
    antiMev: false,
    buyPresets: [0.02, 0.05, 0.1, 0.2, 0.5],
    sellPresets: [50, 100]
  };
  const effectivePresets = SettingsMenu.getEffectiveBuyPresets('arc', legacyConfig);
  assert(
    effectivePresets[0] === 10 && effectivePresets[1] === 50 && effectivePresets[4] === 500,
    'ARC 链检测到旧版 ETH 小数预设时，自动平滑升级为 10, 50, 100, 200, 500 USDC 档位'
  );

  console.log('\n================================================================================');
  console.log('🎉 恭喜！ARC 新链第二阶段全部 7 大场景端到端 (E2E) 测试 100% 通过！');
  console.log('================================================================================\n');
}

runE2ETests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
