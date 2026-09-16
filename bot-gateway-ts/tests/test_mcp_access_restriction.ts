import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const globalTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whitecat-mcp-test-'));
process.env.USER_STORE_FILE = path.join(globalTestDir, 'store.json');
process.env.USER_STORE_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

const { isMcpUserAllowed, MCP_ALLOWED_USER_ID } = await import('../src/services/userService.js');
const { McpMenu } = await import('../src/menus/mcpMenu.js');

async function testMcpAccessRestriction() {
  console.log('🧪 开始测试 MCP 智能体功能权限限制与内部测试引导...\n');

  // 1. 验证内部特邀用户 7031963354 准入
  assert.equal(MCP_ALLOWED_USER_ID, 7031963354, 'MCP_ALLOWED_USER_ID 必须为 7031963354');
  assert.equal(isMcpUserAllowed(7031963354), true, '内部用户 7031963354 数字形式必须被允许');
  assert.equal(isMcpUserAllowed('7031963354'), true, '内部用户 7031963354 字符串形式必须被允许');

  // 2. 验证非内部用户被拦截
  assert.equal(isMcpUserAllowed(12345678), false, '普通用户 12345678 必须被拦截');
  assert.equal(isMcpUserAllowed('99999999'), false, '普通用户 99999999 必须被拦截');
  assert.equal(isMcpUserAllowed(0), false, '非法用户 0 必须被拦截');
  assert.equal(isMcpUserAllowed(undefined), false, '未定义用户必须被拦截');
  assert.equal(isMcpUserAllowed(null), false, '空用户必须被拦截');
  console.log('✅ [1/4] 用户白名单权限判定逻辑验证通过！');

  // 3. 验证环境变量扩展白名单
  process.env.MCP_ALLOWED_USERS = '7031963354, 88888888, 99999999';
  assert.equal(isMcpUserAllowed(88888888), true, '环境变量配置的额外内部用户必须被允许');
  assert.equal(isMcpUserAllowed(99999999), true, '环境变量配置的额外内部用户必须被允许');
  assert.equal(isMcpUserAllowed(11111111), false, '不在环境变量中的用户必须被拦截');
  delete process.env.MCP_ALLOWED_USERS;
  console.log('✅ [2/4] 环境变量 MCP_ALLOWED_USERS 动态白名单扩展验证通过！');

  // 4. 验证受限文案格式与引导链接
  const restrictedZh = McpMenu.renderAccessRestrictedText('zh-hans');
  assert.ok(restrictedZh.includes('https://t.me/oxbaimao'), '受限文案必须包含作者链接 https://t.me/oxbaimao');
  assert.ok(restrictedZh.includes('开启测试'), '受限文案必须包含「开启测试」引导');
  assert.ok(restrictedZh.includes('内测') || restrictedZh.includes('测试'), '受限文案必须说明处于测试阶段');

  const restrictedEn = McpMenu.renderAccessRestrictedText('en');
  assert.ok(restrictedEn.includes('https://t.me/oxbaimao'), '英文受限文案必须包含作者链接');
  console.log('✅ [3/4] 受限提示文案与作者引导链接验证通过:');
  console.log('--- [文案预览] ---');
  console.log(restrictedZh);
  console.log('------------------');

  // 5. 验证受限键盘按键
  const kbZh = McpMenu.renderAccessRestrictedKeyboard('zh-hans');
  const buttonsZh = kbZh.inline_keyboard.flat();
  const contactBtn = buttonsZh.find((b: any) => b.url === 'https://t.me/oxbaimao');
  assert.ok(contactBtn, '键盘中必须包含跳转至 https://t.me/oxbaimao 的 URL 按键');
  assert.ok((contactBtn as any).text.includes('开启测试') || (contactBtn as any).text.includes('联系作者'), '按键文字必须提示联系作者开启测试');

  const backBtn = buttonsZh.find((b: any) => b.callback_data === 'menu_main');
  assert.ok(backBtn, '键盘中必须包含返回主菜单按键');
  console.log('✅ [4/4] 受限界面 InlineKeyboard 跳转按键验证通过！');

  console.log('\n🎉 所有 MCP 权限限制与内部测试引导单元测试 100% 通过！');
}

testMcpAccessRestriction().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
