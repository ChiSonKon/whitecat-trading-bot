import http from 'http';
import { URL } from 'url';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createWhiteCatMcpServer } from './mcpServer.js';
import { verifyMcpAuth, isMcpUserAllowed } from '../services/userService.js';

export interface SseServerConfig {
  port?: number;
  host?: string;
  defaultUserId?: number;
}

export class WhiteCatSseServer {
  private server: http.Server | null = null;
  private transports: Map<string, SSEServerTransport> = new Map();
  private sessionUsers = new Map<string, number>();
  private port: number;
  private host: string;

  constructor(config: SseServerConfig = {}) {
    this.port = config.port !== undefined ? config.port : (process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 38088);
    this.host = config.host || process.env.MCP_HOST || '127.0.0.1';
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // 设置跨域头部支持 Web 客户端与各类外部工具 (BUG-024 限制受信任 Origins)
        const origin = req.headers.origin;
        const allowedOriginsEnv = process.env.MCP_ALLOWED_ORIGINS;
        let isOriginAllowed = false;

        if (!origin) {
          // 非浏览器环境 (无 Origin 标头) 始终允许
          isOriginAllowed = true;
        } else {
          try {
            const parsedOrigin = new URL(origin);
            if (['localhost', '127.0.0.1'].includes(parsedOrigin.hostname)) {
              isOriginAllowed = true;
            }
          } catch {}

          if (!isOriginAllowed && allowedOriginsEnv) {
            const allowedList = allowedOriginsEnv.split(',').map(s => s.trim().toLowerCase());
            if (allowedList.includes(origin.toLowerCase()) || allowedList.includes('*')) {
              isOriginAllowed = true;
            }
          }
        }

        if (origin && isOriginAllowed) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.setHeader('Vary', 'Origin');
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-whitecat-user-id, x-whitecat-token');

        if (req.method === 'OPTIONS') {
          if (origin && !isOriginAllowed) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden: Origin not allowed by CORS policy');
            return;
          }
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

          const auth = token ? (userId !== undefined ? verifyMcpAuth(userId, token) : verifyMcpAuth(token)) : { valid: false, user: undefined };
          if (!auth.valid || !auth.user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Valid MCP credentials are required' }));
            return;
          }

          if (!isMcpUserAllowed(auth.user.userId)) {
            res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              error: 'MCP 智能体功能内测中，目前只对内部受邀用户开放。请联系作者 https://t.me/oxbaimao 开启测试'
            }));
            return;
          }

          try {
            const mcpInstance = createWhiteCatMcpServer({
              defaultUserId: auth.user.userId,
              defaultToken: token
            });

            const transport = new SSEServerTransport('/message', res);
            this.transports.set(transport.sessionId, transport);
            this.sessionUsers.set(transport.sessionId, auth.user.userId);

            transport.onclose = () => {
              this.transports.delete(transport.sessionId);
              this.sessionUsers.delete(transport.sessionId);
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

          const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : undefined;
          const token = bearer || req.headers['x-whitecat-token'] as string || reqUrl.searchParams.get('token');
          const auth = token ? verifyMcpAuth(token) : { valid: false, user: undefined };
          if (!auth.valid || !auth.user || auth.user.userId !== this.sessionUsers.get(sessionId)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Session credentials are required' }));
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
