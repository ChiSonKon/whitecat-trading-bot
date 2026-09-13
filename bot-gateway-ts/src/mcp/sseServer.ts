import http from 'http';
import { URL } from 'url';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createWhiteCatMcpServer } from './mcpServer.js';
import { verifyMcpAuth } from '../services/userService.js';

export interface SseServerConfig {
  port?: number;
  host?: string;
  defaultUserId?: number;
}

export class WhiteCatSseServer {
  private server: http.Server | null = null;
  private transports: Map<string, SSEServerTransport> = new Map();
  private port: number;
  private host: string;

  constructor(config: SseServerConfig = {}) {
    this.port = config.port || (process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 38088);
    this.host = config.host || process.env.MCP_HOST || '0.0.0.0';
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // 设置跨域头部支持 Web 客户端与各类外部工具
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-whitecat-user-id, x-whitecat-token');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const pathname = reqUrl.pathname;

        // 1. 健康检查与概览端点: GET / or GET /health
        if (pathname === '/' || pathname === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify(
              {
                status: 'healthy',
                service: 'WhiteCat Trading Bot MCP Server',
                version: '1.0.0',
                activeSessions: this.transports.size,
                mcpEndpoints: {
                  sse: `http://${req.headers.host || '127.0.0.1:' + this.port}/sse`,
                  message: `http://${req.headers.host || '127.0.0.1:' + this.port}/message`
                },
                documentation: 'https://t.me/oxbaimao'
              },
              null,
              2
            )
          );
          return;
        }

        // 2. 建立 SSE 连接: GET /sse
        if (pathname === '/sse' && req.method === 'GET') {
          const authHeader = req.headers['authorization'];
          let token = reqUrl.searchParams.get('token') || (req.headers['x-whitecat-token'] as string);
          if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.replace('Bearer ', '').trim();
          }

          const userParam = reqUrl.searchParams.get('user') || (req.headers['x-whitecat-user-id'] as string);
          const userId = userParam ? parseInt(userParam, 10) : undefined;

          // 校验鉴权凭证
          if (token || userId) {
            const auth = verifyMcpAuth(userId || token || '', token);
            if (!auth.valid) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: auth.error || 'MCP 认证失败，请检查 Token 或 User ID' }));
              return;
            }
          }

          try {
            const mcpInstance = createWhiteCatMcpServer({
              defaultUserId: userId,
              defaultToken: token
            });

            const transport = new SSEServerTransport('/message', res);
            this.transports.set(transport.sessionId, transport);

            transport.onclose = () => {
              this.transports.delete(transport.sessionId);
              console.log(`[MCP SSE] Session closed: ${transport.sessionId} (Active: ${this.transports.size})`);
            };

            await mcpInstance.connect(transport);
            console.log(`[MCP SSE] New Agent connected: ${transport.sessionId} (User: ${userId || 'Token-Auth'})`);
          } catch (err: any) {
            console.error('[MCP SSE] Failed to establish SSE transport:', err?.message);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err?.message || 'Internal SSE Error' }));
            }
          }
          return;
        }

        // 3. 接收客户端 JSON-RPC 消息: POST /message
        if (pathname === '/message' && req.method === 'POST') {
          const sessionId = reqUrl.searchParams.get('sessionId');
          if (!sessionId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing sessionId query parameter in POST /message' }));
            return;
          }

          const transport = this.transports.get(sessionId);
          if (!transport) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Session not found: ${sessionId}` }));
            return;
          }

          try {
            await transport.handlePostMessage(req, res);
          } catch (err: any) {
            console.error('[MCP SSE] Error handling POST message:', err?.message);
          }
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      });

      this.server.listen(this.port, this.host, () => {
        console.log(`🚀 [WhiteCat MCP] SSE Server listening on http://${this.host}:${this.port} (SSE: /sse, Message: /message)`);
        resolve();
      });

      this.server.on('error', (err: any) => {
        console.error('[WhiteCat MCP] Server error:', err?.message);
        reject(err);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[WhiteCat MCP] SSE Server stopped.');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
