import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import axios from 'axios';
import { OnChainSwapService as Swap } from '../dist/services/onChainSwapService.js';
import { BackendClient } from '../dist/services/backendClient.js';
import { TokenMarketService } from '../dist/services/tokenMarketService.js';
import { ChainBalanceService } from '../dist/services/chainBalanceService.js';
const originals = [Swap.callEvmRpc, Swap.pollEvmReceipt, BackendClient.checkHoneypot, TokenMarketService.fetchTokenDetails, ChainBalanceService.getNativeBalance, axios.post];
afterEach(() => {
  [Swap.callEvmRpc, Swap.pollEvmReceipt, BackendClient.checkHoneypot, TokenMarketService.fetchTokenDetails, ChainBalanceService.getNativeBalance, axios.post] = originals;
});
const quoteInterface = new ethers.Interface(['function getAmountsOut(uint,address[]) view returns (uint[])']);
test('BUG-001 minimum output uses integer quote, rejects zero and invalid slippage', async () => {
  Swap.callEvmRpc = async (_, method) => method === 'eth_chainId' ? '0x38' : method === 'eth_getCode' ? '0x1234' : quoteInterface.encodeFunctionResult('getAmountsOut', [[100n, 1000n]]);
  const path = [ethers.ZeroAddress, ethers.Wallet.createRandom().address];
  assert.equal(await Swap.minimumOutput('bsc', 100n, path, 5), 950n);
  for (const slippage of [100, -1, NaN, Infinity]) await assert.rejects(Swap.minimumOutput('bsc', 100n, path, slippage));
  await assert.rejects(Swap.minimumOutput('bsc', 100n, path, 99.999));
  await assert.rejects(Swap.minimumOutput('sei', 100n, path, 5));
});
test('BUG-001 wrong chain and empty router fail closed', async () => {
  Swap.callEvmRpc = async () => '0x1';
  await assert.rejects(Swap.minimumOutput('bsc', 1n, [], 5), /chain ID/);
  Swap.callEvmRpc = async (_, method) => method === 'eth_chainId' ? '0x38' : '0x';
  await assert.rejects(Swap.minimumOutput('bsc', 1n, [], 5), /deployed code/);
});
test('BUG-002 buy and sell preserve pending hash without reporting success', async () => {
  const wallet = ethers.Wallet.createRandom();
  BackendClient.checkHoneypot = async () => ({ risk_level: 'SAFE', can_buy: true, can_sell: true, is_honeypot: false });
  TokenMarketService.fetchTokenDetails = async () => ({ symbol: 'TEST', name: 'Test', priceNative: 1 });
  ChainBalanceService.getNativeBalance = async () => 10;
  const hash = '0x' + 'ab'.repeat(32);
  Swap.pollEvmReceipt = async () => ({ status: 'PENDING' });
  Swap.callEvmRpc = async (_, method, params) => {
    if (method === 'eth_chainId') return '0x38';
    if (method === 'eth_getCode') return '0x1234';
    if (method === 'eth_estimateGas') return '0x5208';
    if (method === 'eth_getTransactionCount') return '0x0';
    if (method === 'eth_gasPrice') return '0x1';
    if (method === 'eth_sendRawTransaction') return hash;
    if (method === 'eth_call') {
      if (params[0].data.startsWith(quoteInterface.getFunction('getAmountsOut').selector)) {
        const [amount] = quoteInterface.decodeFunctionData('getAmountsOut', params[0].data);
        return quoteInterface.encodeFunctionResult('getAmountsOut', [[amount, 1000000n]]);
      }
      return '0x' + 'ff'.repeat(32);
    }
    throw new Error(`Unexpected RPC ${method}`);
  };
  const params = { userId: 1, chain: 'bsc', privateKey: wallet.privateKey, walletAddress: wallet.address, tokenAddress: ethers.Wallet.createRandom().address, amountNative: 1, slippagePct: 5 };
  const buy = await Swap.executeFastBuy(params);
  assert.equal(buy.status, 'PENDING'); assert.equal(buy.txHash, hash);
  // Decimals/allowance responses are distinct selectors.
  const rpc = Swap.callEvmRpc;
  Swap.callEvmRpc = async (chain, method, args) => method === 'eth_call' && args[0].data === '0x313ce567' ? '0x12' : rpc(chain, method, args);
  const sell = await Swap.executeFastSell({ ...params, sellPercentage: 100, totalTokenBalance: 1, costBasisNative: 1 });
  assert.equal(sell.status, 'PENDING'); assert.equal(sell.txHash, hash);
});
test('BUG-003/004 unsupported swaps never call network or broadcast', async () => {
  TokenMarketService.fetchTokenDetails = async () => { throw new Error('Must not call network'); };
  for (const chain of ['sei', 'xlayer']) {
    const params = { chain, tokenAddress: 'unused' };
    assert.equal((await Swap.executeFastBuy(params)).status, 'FAILED');
    assert.equal((await Swap.executeFastSell(params)).status, 'FAILED');
  }
});
test('BUG-005 backend failure and malformed response are UNKNOWN and block buys', async () => {
  axios.post = async () => { throw new Error('offline'); };
  assert.equal((await BackendClient.checkHoneypot('bsc', 'token')).risk_level, 'UNKNOWN');
  axios.post = async () => ({ data: '<html>wrong service</html>' });
  assert.equal((await BackendClient.checkHoneypot('bsc', 'token')).can_buy, false);
  TokenMarketService.fetchTokenDetails = async () => { throw new Error('Must not proceed'); };
  const result = await Swap.executeFastBuy({ chain: 'bsc', tokenAddress: 'token', amountNative: 1 });
  assert.equal(result.status, 'FAILED'); assert.match(result.error, /UNKNOWN/);
});
