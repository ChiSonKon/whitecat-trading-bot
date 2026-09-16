import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProtocolFeeRate, splitProtocolFee, nativeBaseUnits, requireBuyBalance } from '../dist/services/protocolFee.js';
import { MainMenu } from '../dist/menus/mainMenu.js';
import { ReferralMenu } from '../dist/menus/referralMenu.js';
import { GITHUB_URL, githubLabel, githubDescription } from '../dist/ui/openSource.js';
import { createSuiBuyFeeTransaction, suiSellCommission } from '../dist/services/suiProtocolFee.js';

test('protocol rate defaults, increases, decreases and disables without floating point', () => {
  assert.equal(splitProtocolFee(1000000000000000000n, parseProtocolFeeRate()).fee, 6000000000000000n);
  for (const [rate, expected] of [['0', 0n], ['0.000', 0n], ['0.001', 1000n], ['0.020', 20000n]]) {
    assert.equal(splitProtocolFee(1000000n, parseProtocolFeeRate(rate)).fee, expected);
  }
  for (const value of ['', '-0.1', '0.0201', '1', 'NaN', 'Infinity', '6e-3', '0.006x']) {
    assert.throws(() => parseProtocolFeeRate(value));
  }
});

test('EVM, Solana and Sui integer splits conserve every base unit including dust', () => {
  for (const decimals of [18, 9, 9]) {
    const gross = nativeBaseUnits('123456789.123456789', decimals);
    const {fee, net} = splitProtocolFee(gross, parseProtocolFeeRate());
    assert.equal(fee, gross * 6n / 1000n);
    assert.equal(fee + net, gross);
    assert.equal(splitProtocolFee(1n, parseProtocolFeeRate()).net, 1n);
  }
  assert.equal(nativeBaseUnits(1e-9, 9), 1n);
  assert.equal(nativeBaseUnits('0.100000000000000001', 18), 100000000000000001n);
  assert.throws(() => nativeBaseUnits('0.0000000001', 9));
  assert.throws(() => nativeBaseUnits(NaN, 9));
  assert.throws(() => splitProtocolFee(-1n, 0n));
});

test('buy reserve counts gross once and rejects insufficient gas', () => {
  requireBuyBalance(105n, 100n, 5n);
  assert.throws(() => requireBuyBalance(104n, 100n, 5n));
  assert.throws(() => requireBuyBalance(100n, 100n, 5n));
  assert.throws(() => requireBuyBalance(100n, 0n, 5n));
});

test('Sui PTB contains an atomic fee split and transfer; disabled rate adds no commands', () => {
  const recipient = '0x' + '11'.repeat(32);
  const plan = createSuiBuyFeeTransaction(1000000000n, parseProtocolFeeRate(), recipient);
  assert.equal(plan.fee, 6000000n);
  assert.equal(plan.net, 994000000n);
  const commands = plan.tx.getData().commands;
  assert.deepEqual(commands.map(c => c.$kind), ['SplitCoins', 'TransferObjects']);
  assert.equal(createSuiBuyFeeTransaction(100n, 0n, '').tx.getData().commands.length, 0);
  assert.throws(() => createSuiBuyFeeTransaction(100n, parseProtocolFeeRate(), ''));
  assert.throws(() => createSuiBuyFeeTransaction(100n, parseProtocolFeeRate(), '0x' + '00'.repeat(32)));
  assert.deepEqual(suiSellCommission(parseProtocolFeeRate(), recipient, recipient), {partner:recipient, commissionBps:60});
  assert.throws(() => suiSellCommission(parseProtocolFeeRate('0.00001'), recipient, recipient));
});

test('GitHub navigation is a URL for every supported language and wallet state', () => {
  for (const lang of ['zh-hans','zh-hant','en','ru','vi','ko','ja','es','tr','pl','de']) {
    assert.ok(githubLabel(lang).includes('GitHub'));
    assert.ok(githubDescription(lang).includes('GitHub'));
    for (const wallets of [[], [{index:0, address:'unused', isDefault:true}]]) {
      assert.ok(MainMenu.renderKeyboard(wallets, lang).inline_keyboard.flat().some(b => b.url === GITHUB_URL && !b.callback_data));
    }
    assert.ok(ReferralMenu.renderText(1, 'bsc', {}, lang).includes(GITHUB_URL));
    assert.ok(ReferralMenu.renderKeyboard(lang).inline_keyboard.flat().some(b => b.url === GITHUB_URL));
  }
});

test('EVM fee plan validates recipient and splits wei without loss', async () => {
  const { requireEvmFeeRecipient, createEvmBuyFeePlan, createEvmSellFeePlan } = await import('../dist/services/evmProtocolFee.js');
  const validRecipient = '0x1111111111111111111111111111111111111111';
  const zeroAddress = '0x0000000000000000000000000000000000000000';

  assert.equal(requireEvmFeeRecipient(0n, ''), '');
  assert.equal(requireEvmFeeRecipient(0n, zeroAddress), '');
  assert.equal(requireEvmFeeRecipient(parseProtocolFeeRate(), validRecipient).toLowerCase(), validRecipient.toLowerCase());

  assert.throws(() => requireEvmFeeRecipient(parseProtocolFeeRate(), ''));
  assert.throws(() => requireEvmFeeRecipient(parseProtocolFeeRate(), zeroAddress));
  assert.throws(() => requireEvmFeeRecipient(parseProtocolFeeRate(), 'not-an-address'));

  const oneEth = 1000000000000000000n;
  const buyPlan = createEvmBuyFeePlan(oneEth, parseProtocolFeeRate('0.006'), validRecipient);
  assert.equal(buyPlan.fee, 6000000000000000n);
  assert.equal(buyPlan.net, 994000000000000000n);
  assert.equal(buyPlan.fee + buyPlan.net, oneEth);

  const disabledBuy = createEvmBuyFeePlan(oneEth, 0n, '');
  assert.equal(disabledBuy.fee, 0n);
  assert.equal(disabledBuy.net, oneEth);

  const unconfiguredBuy = createEvmBuyFeePlan(oneEth, parseProtocolFeeRate(), '');
  assert.equal(unconfiguredBuy.fee, 0n);
  assert.equal(unconfiguredBuy.net, oneEth);

  const sellPlan = createEvmSellFeePlan(oneEth, parseProtocolFeeRate('0.006'), validRecipient);
  assert.equal(sellPlan.fee, 6000000000000000n);
  assert.equal(sellPlan.net, 994000000000000000n);
});

test('Solana fee plan validates recipient and splits lamports without loss', async () => {
  const { requireSolanaFeeRecipient, createSolanaBuyFeePlan, createSolanaSellFeePlan } = await import('../dist/services/solanaProtocolFee.js');
  const { Keypair: SolKeypair } = await import('@solana/web3.js');
  const validRecipient = SolKeypair.generate().publicKey.toBase58();
  const defaultAddress = '11111111111111111111111111111111';

  assert.equal(requireSolanaFeeRecipient(0n, ''), '');
  assert.equal(requireSolanaFeeRecipient(parseProtocolFeeRate(), validRecipient), validRecipient);

  assert.throws(() => requireSolanaFeeRecipient(parseProtocolFeeRate(), ''));
  assert.throws(() => requireSolanaFeeRecipient(parseProtocolFeeRate(), defaultAddress));
  assert.throws(() => requireSolanaFeeRecipient(parseProtocolFeeRate(), 'invalid-base58-solana-addr'));

  const oneSol = 1000000000n;
  const buyPlan = createSolanaBuyFeePlan(oneSol, parseProtocolFeeRate('0.006'), validRecipient);
  assert.equal(buyPlan.fee, 6000000n);
  assert.equal(buyPlan.net, 994000000n);
  assert.equal(buyPlan.fee + buyPlan.net, oneSol);

  const disabledBuy = createSolanaBuyFeePlan(oneSol, 0n, '');
  assert.equal(disabledBuy.fee, 0n);
  assert.equal(disabledBuy.net, oneSol);

  const unconfiguredBuy = createSolanaBuyFeePlan(oneSol, parseProtocolFeeRate(), '');
  assert.equal(unconfiguredBuy.fee, 0n);
  assert.equal(unconfiguredBuy.net, oneSol);

  const sellPlan = createSolanaSellFeePlan(oneSol, parseProtocolFeeRate('0.006'), validRecipient);
  assert.equal(sellPlan.fee, 6000000n);
  assert.equal(sellPlan.net, 994000000n);
});

test('EVM executeFastBuy routes net amount to router and dispatches fee transfer', async () => {
  const { ethers } = await import('ethers');
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
    TokenMarketService.fetchTokenDetails = async () => ({ symbol: 'TEST', name: 'Test', priceNative: 1 });
    ChainBalanceService.getNativeBalance = async () => 10;
    Swap.pollEvmReceipt = async () => ({ status: 'SUCCESS' });

    const quoteInterface = new ethers.Interface(['function getAmountsOut(uint,address[]) view returns (uint[])']);
    const txsSent = [];

    Swap.callEvmRpc = async (chain, method, params) => {
      if (method === 'eth_chainId') return '0x38';
      if (method === 'eth_getCode') return '0x1234';
      if (method === 'eth_estimateGas') return '0x5208';
      if (method === 'eth_getTransactionCount') return '0x0';
      if (method === 'eth_gasPrice') return '0x1';
      if (method === 'eth_sendRawTransaction') {
        txsSent.push(params[0]);
        return '0x' + (txsSent.length === 1 ? 'aa' : 'bb').repeat(32);
      }
      if (method === 'eth_call') {
        if (params[0].data.startsWith(quoteInterface.getFunction('getAmountsOut').selector)) {
          const [amount] = quoteInterface.decodeFunctionData('getAmountsOut', params[0].data);
          return quoteInterface.encodeFunctionResult('getAmountsOut', [[amount, 1000000n]]);
        }
        return '0x' + 'ff'.repeat(32);
      }
      throw new Error(`Unexpected RPC ${method}`);
    };

    const wallet = ethers.Wallet.createRandom();
    const tokenAddress = ethers.Wallet.createRandom().address;

    const res = await Swap.executeFastBuy({
      userId: 1,
      chain: 'bsc',
      privateKey: wallet.privateKey,
      walletAddress: wallet.address,
      tokenAddress,
      amountNative: 1,
      slippagePct: 5
    });

    assert.equal(res.status, 'SUCCESS');
    assert.equal(txsSent.length, 2); // 1. Swap tx, 2. Fee transfer tx!

    // Parse decoded transactions
    const parsedSwap = ethers.Transaction.from(txsSent[0]);
    const parsedFee = ethers.Transaction.from(txsSent[1]);

    assert.equal(parsedSwap.value, 994000000000000000n); // Net input: 1 ETH - 0.006 = 0.994 ETH
    assert.equal(parsedFee.to.toLowerCase(), feeRecipient.toLowerCase()); // To fee recipient
    assert.equal(parsedFee.value, 6000000000000000n); // Fee amount: 0.006 ETH
  } finally {
    CONFIG.PROTOCOL_FEE_RECIPIENT_EVM = oldRecipient;
    Swap.callEvmRpc = origRpc;
    Swap.pollEvmReceipt = origReceipt;
    BackendClient.checkHoneypot = origHoneypot;
    TokenMarketService.fetchTokenDetails = origDetails;
    ChainBalanceService.getNativeBalance = origBalance;
  }
});

test('EVM executeFastSell dispatches fee transfer and returns net native output', async () => {
  const { ethers } = await import('ethers');
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
    TokenMarketService.fetchTokenDetails = async () => ({ symbol: 'TEST', name: 'Test', priceNative: 1 });
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
      if (method === 'eth_chainId') return '0x38';
      if (method === 'eth_getCode') return '0x1234';
      if (method === 'eth_estimateGas') return '0x5208';
      if (method === 'eth_getTransactionCount') return '0x0';
      if (method === 'eth_gasPrice') return '0x1';
      if (method === 'eth_sendRawTransaction') {
        txsSent.push(params[0]);
        return '0x' + (txsSent.length === 1 ? 'aa' : 'bb').repeat(32);
      }
      if (method === 'eth_call') {
        const data = params[0].data;
        if (data === '0x313ce567') return '0x12'; // 18 decimals
        if (data.startsWith(erc20Iface.getFunction('allowance').selector)) return '0x' + (10n ** 20n).toString(16);
        if (data.startsWith(erc20Iface.getFunction('balanceOf').selector)) return '0x' + (10n ** 18n).toString(16);
        if (data.startsWith(quoteInterface.getFunction('getAmountsOut').selector)) {
          const [amount] = quoteInterface.decodeFunctionData('getAmountsOut', data);
          return quoteInterface.encodeFunctionResult('getAmountsOut', [[amount, 1000000000000000000n]]);
        }
        return '0x' + 'ff'.repeat(32);
      }
      throw new Error(`Unexpected RPC ${method}`);
    };

    const wallet = ethers.Wallet.createRandom();
    const tokenAddress = ethers.Wallet.createRandom().address;

    const res = await Swap.executeFastSell({
      userId: 1,
      chain: 'bsc',
      privateKey: wallet.privateKey,
      walletAddress: wallet.address,
      tokenAddress,
      sellPercentage: 100,
      totalTokenBalance: 1,
      costBasisNative: 0.1,
      slippagePct: 5
    });

    assert.equal(res.status, 'SUCCESS');
    assert.equal(txsSent.length, 2); // 1. Swap tx, 2. Fee transfer tx
    const parsedFee = ethers.Transaction.from(txsSent[1]);
    assert.equal(parsedFee.to.toLowerCase(), feeRecipient.toLowerCase());
    assert.ok(parsedFee.value > 0n);
    assert.ok(res.estimatedAmountOut > 0);
  } finally {
    CONFIG.PROTOCOL_FEE_RECIPIENT_EVM = oldRecipient;
    Swap.callEvmRpc = origRpc;
    Swap.pollEvmReceipt = origReceipt;
    BackendClient.checkHoneypot = origHoneypot;
    TokenMarketService.fetchTokenDetails = origDetails;
    ChainBalanceService.getNativeBalance = origBalance;
  }
});

test('Solana executeFastBuy queries quote with net amount and dispatches fee transfer', async () => {
  const { Keypair: SolKeypair } = await import('@solana/web3.js');
  const bs58 = (await import('bs58')).default;
  const axios = (await import('axios')).default;
  const { OnChainSwapService: Swap } = await import('../dist/services/onChainSwapService.js');
  const { CONFIG } = await import('../dist/config.js');
  const { BackendClient } = await import('../dist/services/backendClient.js');
  const { TokenMarketService } = await import('../dist/services/tokenMarketService.js');
  const { ChainBalanceService } = await import('../dist/services/chainBalanceService.js');

  const oldRecipient = CONFIG.PROTOCOL_FEE_RECIPIENT_SOLANA;
  const feeKeypair = SolKeypair.generate();
  CONFIG.PROTOCOL_FEE_RECIPIENT_SOLANA = feeKeypair.publicKey.toBase58();

  const origSolRpc = Swap.callSolanaRpc;
  const origReceipt = Swap.pollSolanaReceipt;
  const origHoneypot = BackendClient.checkHoneypot;
  const origDetails = TokenMarketService.fetchTokenDetails;
  const origBalance = ChainBalanceService.getNativeBalance;
  const origGet = Swap.httpClient.get;
  const origPost = Swap.httpClient.post;

  try {
    BackendClient.checkHoneypot = async () => ({ risk_level: 'SAFE', can_buy: true, can_sell: true, is_honeypot: false });
    TokenMarketService.fetchTokenDetails = async () => ({ symbol: 'SOLTEST', name: 'SolTest', priceNative: 0.01 });
    ChainBalanceService.getNativeBalance = async () => 10;
    Swap.pollSolanaReceipt = async () => ({ status: 'SUCCESS' });

    let quotedAmount = '';
    Swap.httpClient.get = async (url) => {
      if (url.includes('quote-api.jup.ag')) {
        const urlObj = new URL(url);
        quotedAmount = urlObj.searchParams.get('amount');
        return { data: { outAmount: '100000000' } };
      }
      return origGet.call(Swap.httpClient, url);
    };

    const userKeypair = SolKeypair.generate();
    Swap.httpClient.post = async (url, data, config) => {
      if (url.includes('quote-api.jup.ag')) {
        const { Transaction: SolTx, SystemProgram: SolSys } = await import('@solana/web3.js');
        const dummyTx = new SolTx().add(SolSys.transfer({ fromPubkey: userKeypair.publicKey, toPubkey: userKeypair.publicKey, lamports: 1 }));
        dummyTx.recentBlockhash = '11111111111111111111111111111111';
        dummyTx.feePayer = userKeypair.publicKey;
        return { data: { swapTransaction: Buffer.from(dummyTx.serialize({ requireAllSignatures: false })).toString('base64') } };
      }
      return origPost.call(Swap.httpClient, url, data, config);
    };

    const solTxsSent = [];
    Swap.callSolanaRpc = async (method, params) => {
      if (method === 'sendTransaction') {
        solTxsSent.push(params[0]);
        return 'sig_' + solTxsSent.length;
      }
      if (method === 'getTokenSupply') {
        return { value: { decimals: 6 } };
      }
      if (method === 'getLatestBlockhash') {
        return { value: { blockhash: '11111111111111111111111111111111' } };
      }
      throw new Error(`Unexpected Solana RPC ${method}`);
    };

    const res = await Swap.executeFastBuy({
      userId: 1,
      chain: 'solana',
      privateKey: bs58.encode(userKeypair.secretKey),
      walletAddress: userKeypair.publicKey.toBase58(),
      tokenAddress: 'So11111111111111111111111111111111111111112',
      amountNative: 1,
      slippagePct: 5
    });

    assert.equal(res.status, 'SUCCESS');
    assert.equal(quotedAmount, '994000000'); // 1 SOL - 0.006 = 0.994 SOL (net lamports)
    assert.equal(solTxsSent.length, 2); // 1. Swap tx, 2. Fee transfer tx
  } finally {
    CONFIG.PROTOCOL_FEE_RECIPIENT_SOLANA = oldRecipient;
    Swap.callSolanaRpc = origSolRpc;
    Swap.pollSolanaReceipt = origReceipt;
    BackendClient.checkHoneypot = origHoneypot;
    TokenMarketService.fetchTokenDetails = origDetails;
    ChainBalanceService.getNativeBalance = origBalance;
    Swap.httpClient.get = origGet;
    Swap.httpClient.post = origPost;
  }
});

test('Solana executeFastSell dispatches fee transfer and returns net SOL output', async () => {
  const { Keypair: SolKeypair } = await import('@solana/web3.js');
  const bs58 = (await import('bs58')).default;
  const { OnChainSwapService: Swap } = await import('../dist/services/onChainSwapService.js');
  const { CONFIG } = await import('../dist/config.js');
  const { BackendClient } = await import('../dist/services/backendClient.js');
  const { TokenMarketService } = await import('../dist/services/tokenMarketService.js');
  const { ChainBalanceService } = await import('../dist/services/chainBalanceService.js');

  const oldRecipient = CONFIG.PROTOCOL_FEE_RECIPIENT_SOLANA;
  const feeKeypair = SolKeypair.generate();
  CONFIG.PROTOCOL_FEE_RECIPIENT_SOLANA = feeKeypair.publicKey.toBase58();

  const origSolRpc = Swap.callSolanaRpc;
  const origReceipt = Swap.pollSolanaReceipt;
  const origHoneypot = BackendClient.checkHoneypot;
  const origDetails = TokenMarketService.fetchTokenDetails;
  const origBalance = ChainBalanceService.getNativeBalance;
  const origGet = Swap.httpClient.get;
  const origPost = Swap.httpClient.post;

  try {
    BackendClient.checkHoneypot = async () => ({ risk_level: 'SAFE', can_buy: true, can_sell: true, is_honeypot: false });
    TokenMarketService.fetchTokenDetails = async () => ({ symbol: 'SOLTEST', name: 'SolTest', priceNative: 0.01 });
    ChainBalanceService.getNativeBalance = async () => 10;
    Swap.pollSolanaReceipt = async () => ({ status: 'SUCCESS' });

    Swap.httpClient.get = async (url) => {
      if (url.includes('quote-api.jup.ag')) {
        return { data: { outAmount: '1000000000' } }; // 1 SOL gross out
      }
      return origGet.call(Swap.httpClient, url);
    };

    const userKeypair = SolKeypair.generate();
    Swap.httpClient.post = async (url, data, config) => {
      if (url.includes('quote-api.jup.ag')) {
        const { Transaction: SolTx, SystemProgram: SolSys } = await import('@solana/web3.js');
        const dummyTx = new SolTx().add(SolSys.transfer({ fromPubkey: userKeypair.publicKey, toPubkey: userKeypair.publicKey, lamports: 1 }));
        dummyTx.recentBlockhash = '11111111111111111111111111111111';
        dummyTx.feePayer = userKeypair.publicKey;
        return { data: { swapTransaction: Buffer.from(dummyTx.serialize({ requireAllSignatures: false })).toString('base64') } };
      }
      return origPost.call(Swap.httpClient, url, data, config);
    };

    const solTxsSent = [];
    Swap.callSolanaRpc = async (method, params) => {
      if (method === 'sendTransaction') {
        solTxsSent.push(params[0]);
        return 'sig_' + solTxsSent.length;
      }
      if (method === 'getTokenSupply') {
        return { value: { decimals: 6 } };
      }
      if (method === 'getTokenAccountsByOwner') {
        return { value: [{ account: { data: { parsed: { info: { tokenAmount: { amount: '1000000' } } } } } }] };
      }
      if (method === 'getLatestBlockhash') {
        return { value: { blockhash: '11111111111111111111111111111111' } };
      }
      throw new Error(`Unexpected Solana RPC ${method}`);
    };

    const res = await Swap.executeFastSell({
      userId: 1,
      chain: 'solana',
      privateKey: bs58.encode(userKeypair.secretKey),
      walletAddress: userKeypair.publicKey.toBase58(),
      tokenAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      sellPercentage: 100,
      totalTokenBalance: 1,
      costBasisNative: 0.1,
      slippagePct: 5
    });

    assert.equal(res.status, 'SUCCESS');
    assert.equal(solTxsSent.length, 2); // 1. Swap tx, 2. Fee transfer tx
    assert.equal(res.estimatedAmountOut, 0.994); // 1 SOL - 0.6% = 0.994 SOL
  } finally {
    CONFIG.PROTOCOL_FEE_RECIPIENT_SOLANA = oldRecipient;
    Swap.callSolanaRpc = origSolRpc;
    Swap.pollSolanaReceipt = origReceipt;
    BackendClient.checkHoneypot = origHoneypot;
    TokenMarketService.fetchTokenDetails = origDetails;
    ChainBalanceService.getNativeBalance = origBalance;
    Swap.httpClient.get = origGet;
    Swap.httpClient.post = origPost;
  }
});

test('Sui balanceChanges parsing correctly matches both modern address and legacy AddressOwner', () => {
  const wallet = '0x' + 'aa'.repeat(32);
  const otherWallet = '0x' + 'bb'.repeat(32);

  const modernChanges = [
    { address: otherWallet, coinType: '0x2::sui::SUI', amount: '500000000' },
    { address: wallet, coinType: '0x2::sui::SUI', amount: '9940000000' }
  ];

  const legacyChanges = [
    { owner: { AddressOwner: otherWallet }, coinType: '0x2::sui::SUI', amount: '500000000' },
    { owner: { AddressOwner: wallet }, coinType: '0x2::sui::SUI', amount: '9940000000' }
  ];

  const matcher = (b, addr, coin) =>
    (b.address === addr || b.owner?.AddressOwner === addr || (!b.address && !b.owner)) &&
    (b.coinType === coin || b.coinType?.endsWith('::sui::SUI'));

  const foundModern = modernChanges.find(b => matcher(b, wallet, '0x2::sui::SUI'));
  assert.ok(foundModern);
  assert.equal(foundModern.amount, '9940000000');

  const foundLegacy = legacyChanges.find(b => matcher(b, wallet, '0x2::sui::SUI'));
  assert.ok(foundLegacy);
  assert.equal(foundLegacy.amount, '9940000000');
});



