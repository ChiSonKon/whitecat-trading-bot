import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { encodeStore, decodeStore, writeStoreAtomic } from '../dist/services/encryptedStore.js';

test('BUG-009 encrypts secrets, authenticates ciphertext, refuses missing/wrong keys, migrates atomically', () => {
  const prior = process.env.USER_STORE_ENCRYPTION_KEY;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whitecat-security-'));
  try {
    process.env.USER_STORE_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    const data = { 1: { privateKey: 'test-only-secret', mcpToken: 'test-only-token' } };
    const encoded = encodeStore(data);
    assert.ok(!encoded.includes('test-only-secret'));
    assert.ok(!encoded.includes('test-only-token'));
    assert.deepEqual(decodeStore(encoded).data, data);
    assert.notEqual(encodeStore(data), encoded);
    const corrupt = JSON.parse(encoded); corrupt.tag = '00'.repeat(16);
    assert.throws(() => decodeStore(JSON.stringify(corrupt)));
    const file = path.join(dir, 'users.json');
    fs.writeFileSync(file, JSON.stringify(data));
    const legacy = decodeStore(fs.readFileSync(file, 'utf8'));
    assert.equal(legacy.legacy, true);
    writeStoreAtomic(file, legacy.data);
    assert.deepEqual(decodeStore(fs.readFileSync(file, 'utf8')).data, data);
    assert.equal(fs.readdirSync(dir).length, 1);
    process.env.USER_STORE_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    assert.throws(() => decodeStore(encoded));
    delete process.env.USER_STORE_ENCRYPTION_KEY;
    assert.throws(() => encodeStore(data));
    assert.throws(() => decodeStore(JSON.stringify(data)));
  } finally {
    if (prior === undefined) delete process.env.USER_STORE_ENCRYPTION_KEY; else process.env.USER_STORE_ENCRYPTION_KEY = prior;
    fs.rmSync(dir, { recursive: true });
  }
});

test('BUG-007/008 SSE authentication and bound session ownership', async () => {
  // Never import the real persisted store in tests.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whitecat-auth-'));
  process.env.USER_STORE_FILE = path.join(dir, 'absent.json');
  process.env.MCP_ALLOWED_USERS = '1,2';
  const { userStore } = await import('../dist/services/userService.js');
  const { WhiteCatSseServer } = await import('../dist/mcp/sseServer.js');
  const { createWhiteCatMcpServer } = await import('../dist/mcp/mcpServer.js');
  const token = 'wc_sec_' + crypto.randomBytes(32).toString('hex');
  userStore.set(1, { userId: 1, mcpToken: token });
  const server = new WhiteCatSseServer({ port: 0, host: '127.0.0.1' });
  server.port = 0;
  let controller;
  try {
    await server.start();
    const base = `http://127.0.0.1:${server.server.address().port}`;
    for (const suffix of ['/sse', '/sse?user=1', '/sse?token=invalid']) {
      assert.equal((await fetch(base + suffix)).status, 401);
    }
    controller = new AbortController();
    const response = await fetch(base + '/sse', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
    assert.equal(response.status, 200);
    const chunk = await response.body.getReader().read();
    const endpoint = new TextDecoder().decode(chunk.value).match(/data: (.+)/)[1].trim();
    assert.equal((await fetch(base + endpoint, { method: 'POST', body: '{}' })).status, 401);
    const otherToken = 'wc_sec_' + crypto.randomBytes(32).toString('hex');
    userStore.set(2, { userId: 2, mcpToken: otherToken });
    assert.equal((await fetch(base + endpoint, { method: 'POST', headers: { Authorization: `Bearer ${otherToken}` }, body: '{}' })).status, 401);
    const mcp = createWhiteCatMcpServer();
    const result = await mcp._registeredTools.whitecat_get_account_info.handler({});
    assert.equal(result.isError, true);
    const badToken = await mcp._registeredTools.whitecat_get_account_info.handler({ token: 'invalid' });
    assert.equal(badToken.isError, true);
    const bound = createWhiteCatMcpServer({ defaultUserId: 1, defaultToken: token });
    const crossUser = await bound._registeredTools.whitecat_get_account_info.handler({ userId: 2, token: otherToken });
    assert.equal(crossUser.isError, true);
    await mcp.close(); await bound.close();
  } finally {
    controller?.abort();
    for (const transport of server.transports.values()) await transport.close();
    await server.stop();
    userStore.clear();
    fs.rmSync(dir, { recursive: true });
  }
});
