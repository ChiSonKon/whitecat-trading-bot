import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import axios from 'axios';
import { OnChainSwapService as Swap } from '../dist/services/onChainSwapService.js';
import { CONFIG } from '../dist/config.js';
import { BackendClient } from '../dist/services/backendClient.js';
import { TokenMarketService } from '../dist/services/tokenMarketService.js';
import { ChainBalanceService } from '../dist/services/chainBalanceService.js';

const originals = [
  Swap.callEvmRpc,
  Swap.pollEvmReceipt,
  Swap.callSolanaRpc,
  Swap.pollSolanaReceipt,
  BackendClient.checkHoneypot,
  TokenMarketService.fetchTokenDetails,
  ChainBalanceService.getNativeBalance,
  axios.get,
  axios.post
];

afterEach(() => {
  [
    Swap.callEvmRpc,
    Swap.pollEvmReceipt,
    Swap.callSolanaRpc,
    Swap.pollSolanaReceipt,
    BackendClient.checkHoneypot,
    TokenMarketService.fetchTokenDetails,
    ChainBalanceService.getNativeBalance,
    axios.get,
    axios.post
  ] = originals;
});

test('BUG-015 default backend core URL points to Rust core port 8085', () => {
  assert.match(CONFIG.BACKEND_CORE_URL, /:8085$/);
});

test('BUG-010 EVM approve approves exact amount and halts on FAILED/PENDING receipt', async () => {
  const wallet = ethers.Wallet.createRandom();
  const tokenAddress = ethers.Wallet.createRandom().address;
  const erc20Iface = new ethers.Interface([
    'function decimals() view returns (uint8)',
    'function allowance(address,address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
    'function balanceOf(address) view returns (uint256)'
  ]);
  const quoteInterface = new ethers.Interface([
    'function getAmountsOut(uint,address[]) view returns (uint[])'
  ]);

  let approvedAmount = 0n;
  const approveTxHash = '0x' + '11'.repeat(32);

  Swap.callEvmRpc = async (chain, method, params) => {
    if (method === 'eth_chainId') return '0x38';
    if (method === 'eth_getCode') return '0x1234';
    if (method === 'eth_getTransactionCount') return '0x0';
    if (method === 'eth_gasPrice') return '0x1';
    if (method === 'eth_sendRawTransaction') {
      const parsedTx = ethers.Transaction.from(params[0]);
      if (parsedTx.data && parsedTx.data.startsWith(erc20Iface.getFunction('approve').selector)) {
        const decoded = erc20Iface.decodeFunctionData('approve', parsedTx.data);
        approvedAmount = decoded[1];
      }
      return approveTxHash;
    }
    if (method === 'eth_call') {
      const data = params[0].data;
      if (data === '0x313ce567') return '0x12'; // decimals: 18
      if (data.startsWith(erc20Iface.getFunction('allowance').selector)) return '0x0'; // 0 allowance -> triggers approve
      if (data.startsWith(erc20Iface.getFunction('balanceOf').selector)) {
        return '0x' + 1000000000000000000n.toString(16); // 1 token
      }
      if (data.startsWith(quoteInterface.getFunction('getAmountsOut').selector)) {
        return quoteInterface.encodeFunctionResult('getAmountsOut', [[1000000000000000000n, 500000000000000000n]]);
      }
    }
    throw new Error(`Unexpected RPC call: ${method}`);
  };

  // 1. Check approve aborts on FAILED receipt
  Swap.pollEvmReceipt = async () => ({ status: 'FAILED' });

  const sellParams = {
    userId: 1,
    chain: 'bsc',
    privateKey: wallet.privateKey,
    walletAddress: wallet.address,
    tokenAddress,
    sellPercentage: 100,
    totalTokenBalance: 1,
    costBasisNative: 0.1,
    slippagePct: 5
  };

  const failedResult = await Swap.executeFastSell(sellParams);
  assert.equal(failedResult.status, 'FAILED');
  assert.equal(failedResult.txHash, approveTxHash);
  assert.match(failedResult.error, /授权交易被合约回滚/);
  assert.equal(approvedAmount, 1000000000000000000n); // Exact token amount, NOT MaxUint256!
  assert.notEqual(approvedAmount, ethers.MaxUint256);

  // 2. Check approve aborts on PENDING receipt
  Swap.pollEvmReceipt = async () => ({ status: 'PENDING' });
  const pendingResult = await Swap.executeFastSell(sellParams);
  assert.equal(pendingResult.status, 'PENDING');
  assert.equal(pendingResult.txHash, approveTxHash);
  assert.match(pendingResult.error, /等待上链确认/);
});

test('BUG-016 100% sell queries on-chain balance without 6-decimal truncation', async () => {
  const wallet = ethers.Wallet.createRandom();
  const tokenAddress = ethers.Wallet.createRandom().address;
  const quoteInterface = new ethers.Interface([
    'function getAmountsOut(uint,address[]) view returns (uint[])'
  ]);
  const erc20Iface = new ethers.Interface([
    'function allowance(address,address) view returns (uint256)',
    'function balanceOf(address) view returns (uint256)'
  ]);

  // Exact 18-decimal token balance with fine dust: 1.000000123456789123 tokens
  const exactWeiBalance = 1000000123456789123n;
  let swappedAmountIn = 0n;

  Swap.pollEvmReceipt = async () => ({ status: 'SUCCESS' });
  Swap.callEvmRpc = async (chain, method, params) => {
    if (method === 'eth_chainId') return '0x38';
    if (method === 'eth_getCode') return '0x1234';
    if (method === 'eth_estimateGas') return '0x5208';
    if (method === 'eth_getTransactionCount') return '0x0';
    if (method === 'eth_gasPrice') return '0x1';
    if (method === 'eth_sendRawTransaction') {
      const parsedTx = ethers.Transaction.from(params[0]);
      const routerIface = new ethers.Interface([
        'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external'
      ]);
      if (parsedTx.data && parsedTx.data.startsWith(routerIface.getFunction('swapExactTokensForETHSupportingFeeOnTransferTokens').selector)) {
        const decoded = routerIface.decodeFunctionData('swapExactTokensForETHSupportingFeeOnTransferTokens', parsedTx.data);
        swappedAmountIn = decoded[0];
      }
      return '0x' + '22'.repeat(32);
    }
    if (method === 'eth_call') {
      const data = params[0].data;
      if (data === '0x313ce567') return '0x12'; // decimals: 18
      if (data.startsWith(erc20Iface.getFunction('allowance').selector)) {
        return '0x' + exactWeiBalance.toString(16); // sufficient allowance
      }
      if (data.startsWith(erc20Iface.getFunction('balanceOf').selector)) {
        return '0x' + exactWeiBalance.toString(16);
      }
      if (data.startsWith(quoteInterface.getFunction('getAmountsOut').selector)) {
        return quoteInterface.encodeFunctionResult('getAmountsOut', [[exactWeiBalance, 500000000000000000n]]);
      }
    }
    throw new Error(`Unexpected RPC call: ${method}`);
  };

  const res = await Swap.executeFastSell({
    userId: 1,
    chain: 'bsc',
    privateKey: wallet.privateKey,
    walletAddress: wallet.address,
    tokenAddress,
    sellPercentage: 100,
    totalTokenBalance: 1.000000123456789,
    costBasisNative: 0.1,
    slippagePct: 5
  });

  assert.equal(res.status, 'SUCCESS');
  assert.equal(swappedAmountIn, exactWeiBalance); // Exact wei used, no truncation to 6 decimals!
});

test('BUG-018 token transfer and native transfer reject unsupported chains without fake hashes', async () => {
  ChainBalanceService.getNativeBalance = async () => 10;
  const randomWallet = ethers.Wallet.createRandom();
  for (const chain of ['ton', 'aptos']) {
    const tokenRes = await Swap.executeTransferToken({
      chain,
      fromAddress: '0x1111111111111111111111111111111111111111',
      privateKey: randomWallet.privateKey,
      toAddress: '0x2222222222222222222222222222222222222222',
      tokenAddress: '0x3333333333333333333333333333333333333333',
      amount: 10
    });
    assert.equal(tokenRes.success, false);
    assert.equal(tokenRes.txHash, '');
    assert.equal(tokenRes.isRealOnChain, false);
    assert.match(tokenRes.error, /暂不支持/);

    const nativeRes = await Swap.executeTransferNative({
      chain,
      fromAddress: '0x1111111111111111111111111111111111111111',
      privateKey: randomWallet.privateKey,
      toAddress: '0x2222222222222222222222222222222222222222',
      amount: 0.1
    });
    assert.equal(nativeRes.success, false);
    assert.equal(nativeRes.txHash, '');
    assert.equal(nativeRes.isRealOnChain, false);
    assert.match(nativeRes.error, /暂不支持/);
  }
});

test('BUG-017 pollSolanaReceipt handles confirmed, finalized, err, and timeout', async () => {
  // 1. Confirmed -> SUCCESS
  Swap.callSolanaRpc = async (method) => {
    if (method === 'getSignatureStatuses') {
      return { value: [{ confirmationStatus: 'confirmed', err: null }] };
    }
  };
  const successRes = await Swap.pollSolanaReceipt('test-sig', 1600);
  assert.equal(successRes.status, 'SUCCESS');

  // 2. Errored -> FAILED
  Swap.callSolanaRpc = async (method) => {
    if (method === 'getSignatureStatuses') {
      return { value: [{ confirmationStatus: 'confirmed', err: { InstructionError: [0, 'Custom(1)'] } }] };
    }
  };
  const failedRes = await Swap.pollSolanaReceipt('test-sig', 1600);
  assert.equal(failedRes.status, 'FAILED');
  assert.ok(failedRes.err);

  // 3. Timeout -> PENDING
  Swap.callSolanaRpc = async (method) => {
    if (method === 'getSignatureStatuses') {
      return { value: [null] };
    }
  };
  const pendingRes = await Swap.pollSolanaReceipt('test-sig', 1600);
  assert.equal(pendingRes.status, 'PENDING');
});
