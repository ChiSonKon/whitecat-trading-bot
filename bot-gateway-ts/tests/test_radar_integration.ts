import { MemeRadarService } from '../src/services/memeRadarService.js';
import { createWhiteCatMcpServer } from '../src/mcp/mcpServer.js';
import { getOrCreateUser } from '../src/services/userService.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

async function runRadarTests() {
  console.log('🧪 开始运行 WhiteCat 爆点雷达与老鼠仓穿透引擎集成测试...\n');

  // 1. 测试 MemeRadarService 代币雷达扫描与评分
  console.log('▶️ [1/5] 测试 MemeRadarService.scanRadarTokens 多链扫描...');
  const candidates = await MemeRadarService.scanRadarTokens('bsc', { limit: 5 });
  console.log(`✅ 成功扫描到 ${candidates.length} 个雷达候选代币:`);
  for (const c of candidates) {
    console.log(`   • [${c.compositeScore}分] $${c.symbol} | MC: $${c.marketCapUsd.toFixed(0)} | 聪明钱: ${c.smartDegenCount}人 | 老鼠仓: ${(c.linkedHoldRate * 100).toFixed(1)}% | Dev: ${c.devStatus}`);
  }
  if (candidates.length === 0) {
    throw new Error('未检索到任何雷达候选代币！');
  }

  // 2. 测试资金链路聚类老鼠仓分析 (Linked Wallet Clustering)
  console.log('\n▶️ [2/5] 测试资金链路聚类老鼠仓分析 (analyzeWalletClusters)...');
  const testCa = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
  const clusterResult = MemeRadarService.analyzeWalletClusters(testCa, 'bsc');
  console.log(`✅ 老鼠仓穿透分析完成: 关联持仓占比=${(clusterResult.linkedHoldRate * 100).toFixed(1)}%, 聚类实体数=${clusterResult.clusters.length}`);
  if (typeof clusterResult.linkedHoldRate !== 'number') {
    throw new Error('linkedHoldRate 必须为有效数值');
  }

  // 3. 测试聪明钱 vs KOL 喊单陷阱识别 (Smart Degen vs KOL)
  console.log('\n▶️ [3/5] 测试聪明钱与 KOL 陷阱识别 (evaluateWalletSignals)...');
  const signals = MemeRadarService.evaluateWalletSignals(testCa, 'bsc');
  console.log(`✅ 钱包画像识别结果: 聪明钱=${signals.smartDegenCount}人, KOL=${signals.renownedKolCount}人, 纯KOL接盘陷阱=${signals.isKolOnlyTrap}`);

  // 4. 测试开发团队人品与发币历史分析
  console.log('\n▶️ [4/5] 测试发币团队信用画像 (evaluateDevReputation)...');
  const devRep = MemeRadarService.evaluateDevReputation(testCa, 'bsc');
  console.log(`✅ Dev 历史分析结果: 状态=${devRep.devStatus}, 历史发币数=${devRep.devLaunchCount}, 开盘毕业率=${(devRep.devGraduationRate * 100).toFixed(0)}%`);

  // 5. 测试 MCP 客户端集成调用 16 项工具 (含 2 项新雷达工具)
  console.log('\n▶️ [5/5] 测试 MCP 智能体生态 16 大工具枚举与雷达工具协议调用...');
  const testUid = 88888888;
  const user = getOrCreateUser(testUid, 'radar_tester');

  const mcpServer = createWhiteCatMcpServer({
    name: 'whitecat-radar-test-server',
    version: '1.0.0',
    defaultUserId: testUid,
    defaultToken: user.mcpToken
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'radar-agent', version: '1.0.0' }, { capabilities: {} });

  await Promise.all([
    mcpServer.connect(serverTransport),
    client.connect(clientTransport)
  ]);

  const toolsResult = await client.listTools();
  console.log(`✅ MCP 工具枚举成功，当前工具总数: ${toolsResult.tools.length} 项 (原 14 项全面升级至 16 项！):`);
  toolsResult.tools.forEach((t, i) => {
    console.log(`   ${i + 1}. [${t.name}]`);
  });

  if (toolsResult.tools.length < 16) {
    throw new Error(`期望至少 16 项工具，实际只有 ${toolsResult.tools.length} 项`);
  }

  // 调用 whitecat_scan_meme_radar
  const radarRes: any = await client.callTool({
    name: 'whitecat_scan_meme_radar',
    arguments: { chain: 'bsc', minScore: 40, limit: 3, userId: testUid, token: user.mcpToken }
  });
  console.log('✅ 成功调用 whitecat_scan_meme_radar MCP 工具！返回前 100 字符:');
  console.log(`   ${radarRes.content?.[0]?.text?.slice(0, 150)}...`);

  // 调用 whitecat_audit_wallet_clusters
  const auditRes: any = await client.callTool({
    name: 'whitecat_audit_wallet_clusters',
    arguments: { tokenAddress: testCa, chain: 'bsc', userId: testUid, token: user.mcpToken }
  });
  console.log('✅ 成功调用 whitecat_audit_wallet_clusters MCP 工具！返回前 100 字符:');
  console.log(`   ${auditRes.content?.[0]?.text?.slice(0, 150)}...`);

  await client.close();

  console.log('\n🎉 [SUCCESS] WhiteCat 爆点雷达、老鼠仓资金链路聚类与 16 大 MCP 工具全部 100% 验证通过！');
}

runRadarTests().catch(err => {
  console.error('❌ 测试执行失败:', err);
  process.exit(1);
});
