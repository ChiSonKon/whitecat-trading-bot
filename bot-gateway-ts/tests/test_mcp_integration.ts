import { createWhiteCatMcpServer } from '../src/mcp/mcpServer.js';
import { WhiteCatSseServer } from '../src/mcp/sseServer.js';
import { getOrCreateUser, toggleMcpAutoTrade, regenerateMcpToken } from '../src/services/userService.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import axios from 'axios';

async function runMcpTests() {
  console.log('🧪 开始运行 WhiteCat MCP 完整集成与协议调用测试...\n');

  // 1. 初始化测试用户
  const testUid = 99999999;
  const user = getOrCreateUser(testUid, 'mcp_tester');
  console.log(`✅ [1/6] 测试用户初始化成功: UID=${user.userId}, MCP Token=${user.mcpToken}, 活跃链=${user.activeChain}`);

  // 2. 创建 MCP Server 实例与客户端内存通道连接
  const mcpServer = createWhiteCatMcpServer({
    name: 'whitecat-test-server',
    version: '1.0.0',
    defaultUserId: testUid,
    defaultToken: user.mcpToken
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-agent', version: '1.0.0' }, { capabilities: {} });

  await Promise.all([
    mcpServer.connect(serverTransport),
    client.connect(clientTransport)
  ]);

  console.log('✅ [2/6] MCP 客户端与服务端通过协议成功连接！');

  // 3. 列出所有工具，验证 14 个工具均正确注册
  const toolsResult = await client.listTools();
  console.log(`✅ [3/6] 工具枚举成功，共发现 ${toolsResult.tools.length} 项 MCP 工具：`);
  toolsResult.tools.forEach((t, i) => {
    console.log(`   ${i + 1}. [${t.name}]: ${t.description.slice(0, 45)}...`);
  });

  if (toolsResult.tools.length < 14) {
    throw new Error(`期望至少 14 个工具，实际只找到 ${toolsResult.tools.length} 个`);
  }

  // 4. 调用 whitecat_get_account_info
  const accRes: any = await client.callTool({
    name: 'whitecat_get_account_info',
    arguments: { userId: testUid, token: user.mcpToken }
  });
  const accText = accRes.content?.[0]?.text;
  console.log('✅ [4/6] 成功调用 whitecat_get_account_info 工具，返回摘要:');
  const parsedAcc = JSON.parse(accText);
  console.log(`   活跃公链: ${parsedAcc.activeChainDisplayName}, 钱包数: ${parsedAcc.wallets?.length}`);

  // 5. 验证自主交易权限拦截机制
  user.mcpAutoTradeEnabled = false; // 模拟用户在 TG 面板关闭了 Agent 交易
  const buyRes: any = await client.callTool({
    name: 'whitecat_fast_buy',
    arguments: {
      tokenAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      amountNative: 0.05,
      userId: testUid,
      token: user.mcpToken
    }
  });

  if (buyRes.isError && buyRes.content?.[0]?.text?.includes('[安全拦截]')) {
    console.log(`✅ [5/6] 交易安全拦截验证通过: 成功阻止未经授权的 Agent 自主交易！`);
  } else {
    throw new Error('自主交易权限关闭时未能触发拦截！');
  }
  user.mcpAutoTradeEnabled = true;

  // 6. 测试 HTTP/SSE 服务启动与健康端点响应
  const testPort = 38099;
  const sseServer = new WhiteCatSseServer({ port: testPort });
  await sseServer.start();
  console.log(`📡 [6/6] MCP SSE 服务成功在端口 ${testPort} 启动！`);

  try {
    const healthRes = await axios.get(`http://127.0.0.1:${testPort}/health`);
    if (healthRes.status === 200 && healthRes.data.status === 'healthy') {
      console.log('🎉 [Health Check] SSE 服务端点健康状态正常:', JSON.stringify(healthRes.data));
    } else {
      throw new Error(`Health check 响应异常: ${healthRes.status}`);
    }
  } finally {
    await sseServer.stop();
    await client.close();
  }

  console.log('\n🌟 [RESULT] WhiteCat MCP 所有协议通信、工具调用与安全拦截 100% 顺利通过！');
}

runMcpTests().catch(err => {
  console.error('❌ MCP 测试失败:', err);
  process.exit(1);
});
