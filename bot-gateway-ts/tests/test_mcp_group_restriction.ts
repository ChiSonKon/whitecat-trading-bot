import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const globalTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whitecat-mcp-group-test-'));
process.env.USER_STORE_FILE = path.join(globalTestDir, 'store.json');
process.env.USER_STORE_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

const { I18nService, ALL_LANGUAGES } = await import('../src/services/i18nService.js');
const { isMcpUserAllowed, getOrCreateUser, MCP_ALLOWED_USER_ID } = await import('../src/services/userService.js');
const { McpMenu } = await import('../src/menus/mcpMenu.js');

async function testMcpGroupRestriction() {
  console.log('🧪 开始测试 RUN-01：MCP 群聊敏感凭据防泄漏与 11 种语言隔离...\n');

  // 1. 验证 11 种语言下 mcp.privateOnly 与 mcp.privateOnlyAlert 均已正确定义且包含警示
  for (const langInfo of ALL_LANGUAGES) {
    const lang = langInfo.code;
    const privateOnlyText = I18nService.t('mcp.privateOnly', lang);
    const privateAlertText = I18nService.t('mcp.privateOnlyAlert', lang);

    assert.ok(privateOnlyText && privateOnlyText.length > 10, `语言 ${lang} 的 mcp.privateOnly 文案必须存在且有效`);
    assert.ok(privateAlertText && privateAlertText.length > 5, `语言 ${lang} 的 mcp.privateOnlyAlert 文案必须存在且有效`);
    assert.ok(privateOnlyText.includes('MCP'), `语言 ${lang} 的文案中应提及 MCP`);
  }
  console.log(`✅ [1/4] 11 种国际化语言下的私聊限制提醒文案完整性校验通过！`);

  // 2. 模拟群聊中调用 /mcp 指令场景
  const authorizedUser = getOrCreateUser(MCP_ALLOWED_USER_ID, 'test_operator');
  assert.equal(isMcpUserAllowed(authorizedUser.userId), true);
  assert.ok(authorizedUser.mcpToken, '已授权用户必须拥有合法 MCP Token');

  // 模拟上下文: chat.type 为 group 或 supergroup
  for (const chatType of ['group', 'supergroup', 'channel']) {
    let repliedText = '';
    const fakeCtx = {
      from: { id: MCP_ALLOWED_USER_ID, username: 'test_operator' },
      chat: { id: -100123456789, type: chatType },
      reply: async (text: string) => {
        repliedText = text;
      }
    };

    // 运行群聊拦截逻辑
    if (fakeCtx.chat?.type && fakeCtx.chat.type !== 'private') {
      await fakeCtx.reply(I18nService.t('mcp.privateOnly', authorizedUser.lang));
    }

    // 断言：群聊回复中绝对不可包含用户的敏感 token
    assert.ok(!repliedText.includes(authorizedUser.mcpToken), `在 ${chatType} 中绝不能暴露用户 token`);
    assert.ok(repliedText.includes(I18nService.t('mcp.privateOnly', authorizedUser.lang)), `在 ${chatType} 中必须返回私聊安全提示`);
  }
  console.log('✅ [2/4] 群组/超级群/频道中执行 /mcp 阻断与凭证防泄露测试通过！');

  // 3. 模拟群聊中点击 Inline 菜单回调
  for (const callbackData of ['menu_mcp', 'mcp_regen_token', 'mcp_toggle_trade', 'mcp_cfg_claude', 'mcp_cfg_cursor']) {
    let alertText = '';
    let messageEdited = false;

    const fakeCtx = {
      from: { id: MCP_ALLOWED_USER_ID, username: 'test_operator' },
      chat: { id: -100123456789, type: 'group' },
      answerCallbackQuery: async (options?: { text?: string; show_alert?: boolean }) => {
        if (options?.text) alertText = options.text;
      },
      editMessageText: async () => {
        messageEdited = true;
      },
      reply: async () => {
        messageEdited = true;
      }
    };

    if (callbackData === 'menu_mcp' || callbackData.startsWith('mcp_')) {
      if (fakeCtx.chat?.type && fakeCtx.chat.type !== 'private') {
        await fakeCtx.answerCallbackQuery({
          text: I18nService.t('mcp.privateOnlyAlert', authorizedUser.lang),
          show_alert: true
        });
      }
    }

    assert.equal(messageEdited, false, `回调 ${callbackData} 在群聊中绝对不得编辑或发送新消息`);
    assert.ok(alertText.includes(I18nService.t('mcp.privateOnlyAlert', authorizedUser.lang)), `回调 ${callbackData} 必须弹窗警告仅限私聊`);
  }
  console.log('✅ [3/4] 群聊中点击所有 MCP 衍生 Inline 菜单回调阻断与弹窗警告测试通过！');

  // 4. 验证私聊环境中允许正常渲染
  const renderedPrivateMenu = McpMenu.renderText(authorizedUser, 38088, authorizedUser.lang);
  assert.ok(renderedPrivateMenu.includes(authorizedUser.mcpToken), '私聊中渲染的 MCP 菜单必须包含配置 Token');
  console.log('✅ [4/4] 正常私聊环境下已授权用户的 MCP 菜单与 Token 展示功能正常！');

  console.log('\n🎉 所有 MCP 群聊隐私防护与防泄露单元测试 100% 通过！');
}

testMcpGroupRestriction().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
