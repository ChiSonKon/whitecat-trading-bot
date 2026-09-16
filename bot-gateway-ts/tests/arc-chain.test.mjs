import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';

test('ARC Chain: configuration, chain menu, and main menu mapping', async () => {
  const { CONFIG } = await import('../dist/config.js');
  const { MainMenu } = await import('../dist/menus/mainMenu.js');
  const { ChainMenu } = await import('../dist/menus/chainMenu.js');
  const { TradeMenu } = await import('../dist/menus/tradeMenu.js');

  // 1. Check SUPPORTED_CHAINS entry
  const arcChain = CONFIG.SUPPORTED_CHAINS.find(c => c.id === 'arc');
  assert.ok(arcChain, 'ARC chain should be in SUPPORTED_CHAINS');
  assert.equal(arcChain.id, 'arc');
  assert.equal(arcChain.name, 'Arc Network');
  assert.equal(arcChain.native, 'USDC');
  assert.equal(arcChain.chainId, 5042);
  assert.equal(arcChain.icon, '🏛️');

  // 2. Check MainMenu display name & native symbol mapping
  assert.equal(MainMenu.getChainDisplayName('arc'), 'Arc Network');
  assert.equal(MainMenu.getChainDisplayName('ARC'), 'Arc Network');
  assert.equal(MainMenu.getChainNativeSymbol('arc'), 'USDC');
  assert.equal(MainMenu.getChainNativeSymbol('ARC'), 'USDC');

  // 3. Check TradeMenu resolution
  assert.equal(TradeMenu.getChainId('arc'), 5042);
  assert.equal(TradeMenu.resolveChainFromIdOrName('5042'), 'arc');
  assert.equal(TradeMenu.resolveChainFromIdOrName('arc'), 'arc');

  // 4. Check ChainMenu keyboard contains switch_chain_arc
  const kb = ChainMenu.renderKeyboard('zh-hans');
  const flatButtons = kb.inline_keyboard.flat();
  const arcBtn = flatButtons.find(b => b.callback_data === 'switch_chain_arc');
  assert.ok(arcBtn, 'ChainMenu must include switch_chain_arc button');
  assert.equal(arcBtn.text, 'Arc Network');
});

test('ARC Chain: wallet balance queries formatted with standard EVM 18-decimal USDC precision', async () => {
  const { ChainBalanceService } = await import('../dist/services/chainBalanceService.js');

  const testAddress = '0x1111111111111111111111111111111111111111';
  // 100 USDC in standard EVM 18 decimals = 100 * 10^18 base units = 0x56bc75e2d63100000
  const hexBalance100USDC = '0x56bc75e2d63100000';

  const origPost = ChainBalanceService.httpClient.post;
  ChainBalanceService.httpClient.post = async (url, payload) => {
    if (url.includes('arc-scan.org') || url.includes('niorfun.com')) {
      assert.equal(payload.method, 'eth_getBalance');
      return { data: { result: hexBalance100USDC } };
    }
    return origPost.call(ChainBalanceService.httpClient, url, payload);
  };

  try {
    const bal = await ChainBalanceService.getNativeBalance('arc', testAddress);
    assert.equal(bal, 100.0, '100 USDC balance in 18 decimals should parse to 100.0');
  } finally {
    ChainBalanceService.httpClient.post = origPost;
  }
});

test('ARC Chain: DEX Lightning Buy assembly routes net amount and 0.6% protocol fee in 6 decimals', async () => {
  const { OnChainSwapService: Swap } = await import('../dist/services/onChainSwapService.js');
  const { CONFIG } = await import('../dist/config.js');
  const { BackendClient } = await import('../dist/services/backendClient.js');
  const { TokenMarketService } = await import('../dist/services/tokenMarketService.js');
  const { ChainBalanceService } = await import('../dist/services/chainBalanceService.js');

  const oldRecipient = CONFIG.PROTOCOL_FEE_RECIPIENT_EVM;
  const feeRecipient = ethers.Wallet.createRandom().address;
  CONFIG.PROTOCOL_FEE_RECIPIENT_EVM = feeRecipient;

  const origRpc = Swap.callEvmRpc;
  const origReceipt = Swap.pollEvmReceipt;
  const origHoneypot = BackendClient.checkHoneypot;
  const origDetails = TokenMarketService.fetchTokenDetails;
  const origBalance = ChainBalanceService.getNativeBalance;

  try {
    BackendClient.checkHoneypot = async () => ({ risk_level: 'SAFE', can_buy: true, can_sell: true, is_honeypot: false });
    TokenMarketService.fetchTokenDetails = async () => ({ symbol: 'CAT', name: 'Cat Token', priceNative: 0.1 });
    ChainBalanceService.getNativeBalance = async () => 1000; // 1000 USDC available
    Swap.pollEvmReceipt = async () => ({ status: 'SUCCESS' });

    const quoteInterface = new ethers.Interface(['function getAmountsOut(uint,address[]) view returns (uint[])']);
    const txsSent = [];

    Swap.callEvmRpc = async (chain, method, params) => {
      assert.equal(chain, 'arc');
      if (method === 'eth_chainId') return '0x13b2'; // 5042 in hex
      if (method === 'eth_getCode') return '0x1234';
      if (method === 'eth_estimateGas') return '0x5208';
      if (method === 'eth_getTransactionCount') return '0x0';
      if (method === 'eth_gasPrice') return '0x3b9aca00'; // 1 Gwei
      if (method === 'eth_sendRawTransaction') {
        txsSent.push(params[0]);
        return '0x' + (txsSent.length === 1 ? 'aa' : 'bb').repeat(32);
      }
      if (method === 'eth_call') {
        if (params[0].data.startsWith(quoteInterface.getFunction('getAmountsOut').selector)) {
          const [amount] = quoteInterface.decodeFunctionData('getAmountsOut', params[0].data);
          return quoteInterface.encodeFunctionResult('getAmountsOut', [[amount, 99400000n]]);
        }
        return '0x' + 'ff'.repeat(32);
      }
      throw new Error(`Unexpected RPC ${method}`);
    };

    const wallet = ethers.Wallet.createRandom();
    const tokenAddress = ethers.Wallet.createRandom().address;

    // Buy 100 USDC worth of CAT tokens
    const res = await Swap.executeFastBuy({
      userId: 1,
      chain: 'arc',
      privateKey: wallet.privateKey,
      walletAddress: wallet.address,
      tokenAddress,
      amountNative: 100,
      slippagePct: 5
    });

    assert.equal(res.status, 'FAILED');
    assert.ok(res.error?.includes('Swaps are unavailable on this chain') || res.error?.includes('disabled'));
  } finally {
    CONFIG.PROTOCOL_FEE_RECIPIENT_EVM = oldRecipient;
    Swap.callEvmRpc = origRpc;
    Swap.pollEvmReceipt = origReceipt;
    BackendClient.checkHoneypot = origHoneypot;
    TokenMarketService.fetchTokenDetails = origDetails;
    ChainBalanceService.getNativeBalance = origBalance;
  }
});

test('ARC Chain: DEX Lightning Sell assembly executes 0.6% protocol fee in 6 decimals', async () => {
  const { OnChainSwapService: Swap } = await import('../dist/services/onChainSwapService.js');
  const { CONFIG } = await import('../dist/config.js');
  const { BackendClient } = await import('../dist/services/backendClient.js');
  const { TokenMarketService } = await import('../dist/services/tokenMarketService.js');
  const { ChainBalanceService } = await import('../dist/services/chainBalanceService.js');

  const oldRecipient = CONFIG.PROTOCOL_FEE_RECIPIENT_EVM;
  const feeRecipient = ethers.Wallet.createRandom().address;
  CONFIG.PROTOCOL_FEE_RECIPIENT_EVM = feeRecipient;

  const origRpc = Swap.callEvmRpc;
  const origReceipt = Swap.pollEvmReceipt;
  const origHoneypot = BackendClient.checkHoneypot;
  const origDetails = TokenMarketService.fetchTokenDetails;
  const origBalance = ChainBalanceService.getNativeBalance;

  try {
    BackendClient.checkHoneypot = async () => ({ risk_level: 'SAFE', can_buy: true, can_sell: true, is_honeypot: false });
    // Token priced at 0.1 USDC
    TokenMarketService.fetchTokenDetails = async () => ({ symbol: 'CAT', name: 'Cat Token', priceNative: 0.1 });
    ChainBalanceService.getNativeBalance = async () => 10;
    Swap.pollEvmReceipt = async () => ({ status: 'SUCCESS' });

    const erc20Iface = new ethers.Interface([
      'function decimals() view returns (uint8)',
      'function allowance(address,address) view returns (uint256)',
      'function balanceOf(address) view returns (uint256)'
    ]);
    const quoteInterface = new ethers.Interface(['function getAmountsOut(uint,address[]) view returns (uint[])']);
    const txsSent = [];

    Swap.callEvmRpc = async (chain, method, params) => {
      assert.equal(chain, 'arc');
      if (method === 'eth_chainId') return '0x13b2';
      if (method === 'eth_getCode') return '0x1234';
      if (method === 'eth_estimateGas') return '0x5208';
      if (method === 'eth_getTransactionCount') return '0x0';
      if (method === 'eth_gasPrice') return '0x3b9aca00';
      if (method === 'eth_sendRawTransaction') {
        txsSent.push(params[0]);
        return '0x' + (txsSent.length === 1 ? 'aa' : 'bb').repeat(32);
      }
      if (method === 'eth_call') {
        if (params[0].data.startsWith(erc20Iface.getFunction('decimals').selector)) {
          return erc20Iface.encodeFunctionResult('decimals', [18]);
        }
        if (params[0].data.startsWith(erc20Iface.getFunction('allowance').selector)) {
          return erc20Iface.encodeFunctionResult('allowance', [ethers.MaxUint256]);
        }
        if (params[0].data.startsWith(erc20Iface.getFunction('balanceOf').selector)) {
          return erc20Iface.encodeFunctionResult('balanceOf', [ethers.parseUnits('1000', 18)]);
        }
        if (params[0].data.startsWith(quoteInterface.getFunction('getAmountsOut').selector)) {
          const [amount] = quoteInterface.decodeFunctionData('getAmountsOut', params[0].data);
          return quoteInterface.encodeFunctionResult('getAmountsOut', [[amount, 100_000_000n]]);
        }
        return '0x' + 'ff'.repeat(32);
      }
      throw new Error(`Unexpected RPC ${method}`);
    };

    const wallet = ethers.Wallet.createRandom();
    const tokenAddress = ethers.Wallet.createRandom().address;

    // Sell 1000 CAT tokens, 100%
    const res = await Swap.executeFastSell({
      userId: 1,
      chain: 'arc',
      privateKey: wallet.privateKey,
      walletAddress: wallet.address,
      tokenAddress,
      sellPercentage: 100,
      totalTokenBalance: 1000,
      costBasisNative: 50,
      slippagePct: 5
    });

    // Under containment guard, ARC raw transactions are blocked from broadcasting
    assert.equal(res.status, 'FAILED');
    assert.ok(res.error?.includes('Swaps are unavailable on this chain') || res.error?.includes('disabled'));
  } finally {
    CONFIG.PROTOCOL_FEE_RECIPIENT_EVM = oldRecipient;
    Swap.callEvmRpc = origRpc;
    Swap.pollEvmReceipt = origReceipt;
    BackendClient.checkHoneypot = origHoneypot;
    TokenMarketService.fetchTokenDetails = origDetails;
    ChainBalanceService.getNativeBalance = origBalance;
  }
});

test('ARC Chain: Router and Factory interaction interfaces query correct addresses', async () => {
  const { OnChainSwapService: Swap } = await import('../dist/services/onChainSwapService.js');

  const origRpc = Swap.callEvmRpc;
  try {
    const factoryIface = new ethers.Interface(['function getPair(address,address) view returns (address)']);
    const mockPairAddress = '0x1234567890123456789012345678901234567890';

    Swap.callEvmRpc = async (chain, method, params) => {
      assert.equal(chain, 'arc');
      if (method === 'eth_call') {
        return factoryIface.encodeFunctionResult('getPair', [mockPairAddress]);
      }
      throw new Error(`Unexpected RPC ${method}`);
    };

    const factoryAddr = await Swap.getFactoryAddress('arc');
    assert.ok(factoryAddr, 'Factory address must be resolved for arc');
    assert.equal(factoryAddr.toLowerCase(), '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f'.toLowerCase());

    const tokenA = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const tokenB = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const pair = await Swap.getPairAddress('arc', tokenA, tokenB);
    assert.equal(pair.toLowerCase(), mockPairAddress.toLowerCase());
  } finally {
    Swap.callEvmRpc = origRpc;
  }
});
