#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createWhiteCatMcpServer } from './mcpServer.js';

// 解析命令行参数: --user=10001 --token=wc_sec_...
function parseArgs(): { userId?: number; token?: string } {
  const args = process.argv.slice(2);
  let userId: number | undefined;
  let token: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--user=')) {
      const val = parseInt(arg.replace('--user=', ''), 10);
      if (!isNaN(val)) userId = val;
    } else if (arg.startsWith('--token=')) {
      token = arg.replace('--token=', '').trim();
    }
  }

  if (!userId && process.env.WHITECAT_USER_ID) {
    const val = parseInt(process.env.WHITECAT_USER_ID, 10);
    if (!isNaN(val)) userId = val;
  }
  if (!token && process.env.WHITECAT_MCP_TOKEN) {
    token = process.env.WHITECAT_MCP_TOKEN.trim();
  }

  return { userId, token };
}

async function main() {
  const { userId, token } = parseArgs();
  const server = createWhiteCatMcpServer({
    name: 'whitecat-trading-bot',
    version: '1.0.0',
    defaultUserId: userId,
    defaultToken: token
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[WhiteCat MCP] STDIO Server connected and ready! (Target User ID: ${userId || 'Auto/Default'})`);
}

main().catch((err) => {
  console.error('[WhiteCat MCP] Fatal error starting STDIO server:', err);
  process.exit(1);
});
