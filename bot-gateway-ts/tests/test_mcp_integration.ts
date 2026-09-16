import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const globalTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whitecat-mcp-integ-'));
process.env.USER_STORE_FILE = path.join(globalTestDir, 'store.json');
process.env.USER_STORE_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

const { createWhiteCatMcpServer } = await import('../src/mcp/mcpServer.js');
const { WhiteCatSseServer } = await import('../src/mcp/sseServer.js');
const { getOrCreateUser, toggleMcpAutoTrade, regenerateMcpToken } = await import('../src/services/userService.js');
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
import axios from 'axios';

async function runMcpTests() {
  console.log('🧪 开始运行 WhiteCat MCP 完整集成与协议调用测试...\n');

  // 1. 初始化测试用户 (内部特邀用户 7031963354)
  const testUid = 7031963354;
  const user = getOrCreateUser(testUid, 'mcp_tester');
  console.log(`✅ [1/7] 内部特邀用户初始化成功: UID=${user.userId}, MCP Token=${user.mcpToken}, 活跃链=${user.activeChain}`);

  // 2. 验证非内部用户权限拦截 (Unauthorized User Rejection)
  const unauthorizedUid = 12345678;
  const unauthorizedUser = getOrCreateUser(unauthorizedUid, 'unauthorized_user');
  const unauthServer = createWhiteCatMcpServer({
    name: 'whitecat-unauth-test',
    defaultUserId: unauthorizedUid,
    defaultToken: unauthorizedUser.mcpToken
  });
  const [cTransportUnauth, sTransportUnauth] = InMemoryTransport.createLinkedPair();
  const unauthClient = new Client({ name: 'unauth-agent', version: '1.0.0' }, { capabilities: {} });
  await Promise.all([unauthServer.connect(sTransportUnauth), unauthClient.connect(cTransportUnauth)]);

  const unauthCall: any = await unauthClient.callTool({
    name: 'whitecat_get_account_info',
    arguments: { userId: unauthorizedUid, token: unauthorizedUser.mcpToken }
  });
  if (unauthCall.isError && unauthCall.content?.[0]?.text?.includes('oxbaimao')) {
    console.log(`✅ [2/7] 非授权用户拦截生效: 成功提示联系作者 https://t.me/oxbaimao 开启测试`);
  } else {
    throw new Error('未对非授权用户触发内测联系作者拦截！');
  }
  await unauthClient.close();

  // 3. 创建 MCP Server 实例与客户端内存通道连接 (内部用户)
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

  console.log('✅ [3/7] MCP 客户端与服务端通过协议成功连接！');

  // 4. 列出所有工具，验证 14 个工具均正确注册
  const toolsResult = await client.listTools();
  console.log(`✅ [4/7] 工具枚举成功，共发现 ${toolsResult.tools.length} 项 MCP 工具：`);
  toolsResult.tools.forEach((t, i) => {
    console.log(`   ${i + 1}. [${t.name}]: ${t.description.slice(0, 45)}...`);
  });

  if (toolsResult.tools.length < 14) {
    throw new Error(`期望至少 14 个工具，实际只找到 ${toolsResult.tools.length} 个`);
  }

  // 5. 调用 whitecat_get_account_info
  const accRes: any = await client.callTool({
    name: 'whitecat_get_account_info',
    arguments: { userId: testUid, token: user.mcpToken }
  });
  const accText = accRes.content?.[0]?.text;
  console.log('✅ [5/7] 成功调用 whitecat_get_account_info 工具，返回摘要:');
  const parsedAcc = JSON.parse(accText);
  console.log(`   活跃公链: ${parsedAcc.activeChainDisplayName}, 钱包数: ${parsedAcc.wallets?.length}`);

  // 6. 验证自主交易权限拦截机制
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
    console.log(`✅ [6/7] 交易安全拦截验证通过: 成功阻止未经授权的 Agent 自主交易！`);
  } else {
    throw new Error('自主交易权限关闭时未能触发拦截！');
  }
  user.mcpAutoTradeEnabled = true;

  // 7. 测试 HTTP/SSE 服务启动与健康端点响应
  const testPort = 38099;
  const sseServer = new WhiteCatSseServer({ port: testPort });
  await sseServer.start();
  console.log(`📡 [7/7] MCP SSE 服务成功在端口 ${testPort} 启动！`);

  try {
    const healthRes = await axios.get(`http://127.0.0.1:${testPort}/health`);
    if (healthRes.status === 200 && healthRes.data.status === 'healthy') {
      console.log('🎉 [Health Check] SSE 服务端点健康状态正常:', JSON.stringify(healthRes.data));
    } else {
      throw new Error(`Health check 响应异常: ${healthRes.status}`);
    }

    // 验证 SSE 拒绝未授权用户
    try {
      await axios.get(`http://127.0.0.1:${testPort}/sse?user=${unauthorizedUid}&token=${unauthorizedUser.mcpToken}`);
      throw new Error('SSE 应当拒绝未授权用户');
    } catch (sseErr: any) {
      if (sseErr.response?.status === 403) {
        console.log('🔒 [SSE Auth] SSE 成功阻断未授权用户连接并返回 403 Forbidden！');
      } else {
        throw sseErr;
      }
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
