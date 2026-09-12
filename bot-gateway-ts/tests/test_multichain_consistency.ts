import { OnChainSwapService } from '../src/services/onChainSwapService.js';
import { ChainBalanceService } from '../src/services/chainBalanceService.js';
import { ethers } from 'ethers';
import { Keypair as SolKeypair } from '@solana/web3.js';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import bs58 from 'bs58';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

async function runTests() {
  console.log('==================================================================');
  console.log('🐾 白猫打狗机器人 (WhiteCat Trading Bot) 全公链对齐一致性自检套件');
  console.log('==================================================================\n');

  // 测试 1: 0 余额拦截一致性 (对齐 Sui 行为)
  console.log('🧪 [Test 1] 全公链 0 余额买入拦截一致性测试');
  const dummyEvmWallet = ethers.Wallet.createRandom();
  const dummySolKeypair = SolKeypair.generate();
  const dummySolAddress = dummySolKeypair.publicKey.toBase58();
  const dummySuiKeypair = new Ed25519Keypair();
  const dummySuiAddress = dummySuiKeypair.toSuiAddress();

  const testChains = [
    { chain: 'sui', address: dummySuiAddress, ca: '0x2::sui::SUI' },
    { chain: 'bsc', address: dummyEvmWallet.address, ca: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82' },
    { chain: 'base', address: dummyEvmWallet.address, ca: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { chain: 'solana', address: dummySolAddress, ca: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' }
  ];

  for (const tc of testChains) {
    const buyRes = await OnChainSwapService.executeFastBuy({
      userId: 99999,
      chain: tc.chain,
      walletAddress: tc.address,
      tokenAddress: tc.ca,
      amountNative: 1.0,
      slippagePct: 5
    });

    assert(buyRes.status === 'FAILED', `${tc.chain.toUpperCase()} 0 余额买入必须被拦截 (status === FAILED)`);
    assert(
      (buyRes.error || '').includes('链上可用余额不足'),
      `${tc.chain.toUpperCase()} 拦截错误信息包含 '链上可用余额不足' (实际输出: ${buyRes.error})`
    );
  }

  // 测试 2: 原生代币转账 0 余额拦截一致性
  console.log('\n🧪 [Test 2] 全公链原生转账 0 余额拦截一致性测试');
  for (const tc of testChains) {
    const transferRes = await OnChainSwapService.executeTransferNative({
      chain: tc.chain,
      fromAddress: tc.address,
      toAddress: tc.address,
      amount: 1.0
    });

    assert(transferRes.success === false, `${tc.chain.toUpperCase()} 0 余额转账必须被拦截 (success === false)`);
    assert(
      (transferRes.error || '').includes('链上可用余额不足'),
      `${tc.chain.toUpperCase()} 转账错误提示符合规范 (实际输出: ${transferRes.error})`
    );
  }

  // 测试 3: EVM 交易本地签名构建有效性
  console.log('\n🧪 [Test 3] EVM 私钥本地签名与 Raw Transaction 合规性验证');
  const evmWallet = ethers.Wallet.createRandom();
  const tx = await evmWallet.signTransaction({
    to: '0x0000000000000000000000000000000000000000',
    value: ethers.parseEther('0.01'),
    nonce: 0,
    gasLimit: 21000n,
    gasPrice: ethers.parseUnits('3', 'gwei'),
    chainId: 56
  });
  assert(tx.startsWith('0x') && tx.length > 100, 'EVM 钱包能正确签名标准 0x Raw Transaction');

  // 测试 4: Solana 私钥本地签名有效性
  console.log('\n🧪 [Test 4] Solana Base58 私钥解析与签名测试');
  const solKp = SolKeypair.generate();
  const solPrivBase58 = bs58.encode(solKp.secretKey);
  const decoded = bs58.decode(solPrivBase58);
  const restoredKp = SolKeypair.fromSecretKey(decoded);
  assert(restoredKp.publicKey.toBase58() === solKp.publicKey.toBase58(), 'Solana Ed25519 秘钥对编解码无损还原');

  // 测试 5: 各链主网 RPC 实时连通性
  console.log('\n🧪 [Test 5] 多链 RPC 真实网络连通性自检');
  const bscBal = await ChainBalanceService.getNativeBalance('bsc', '0x8894e0a0c962cb723c1976a4421c95949be2d4e3');
  console.log(`  ℹ️ BSC 币安热钱包实时余额: ${bscBal.toFixed(2)} BNB`);
  assert(bscBal > 0, 'BSC 主网 RPC 能够实时读取真实链上余额');

  console.log('\n==================================================================');
  console.log('🎉 恭喜！全公链一致性测试全部 100% 通过，与 Sui 链行为完全对齐！');
  console.log('==================================================================');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
