import { InlineKeyboard } from 'grammy';
import { I18nService } from '../services/i18nService.js';
import { UserState } from '../services/userService.js';
import { MainMenu } from './mainMenu.js';
import path from 'path';

export class McpMenu {
  public static renderText(user: UserState, port: number = 38088, lang: string = 'en'): string {
    const title = I18nService.t('mcp.title', lang);
    const statusLine = I18nService.t('mcp.active', lang, { port });
    const uidLabel = I18nService.t('mcp.userId', lang);
    const tokenLabel = I18nService.t('mcp.token', lang);
    const autoTradeLabel = I18nService.t('mcp.autoTrade', lang);
    const maxLimitLabel = I18nService.t('mcp.maxLimit', lang);
    const hint = I18nService.t('mcp.hint', lang);

    const autoTradeStatus = user.mcpAutoTradeEnabled !== false
      ? I18nService.t('mcp.enabled', lang)
      : I18nService.t('mcp.disabled', lang);

    const nativeSymbol = MainMenu.getChainNativeSymbol(user.activeChain);
    const maxLimit = user.mcpMaxTradeLimit ?? 0.5;

    const botDir = process.cwd();
    const stdioEntry = path.join(botDir, 'dist', 'mcp', 'index.js');
    const publicHost = process.env.MCP_PUBLIC_HOST || process.env.SERVER_IP || '127.0.0.1';

    return (
      `🤖 <b>${title}</b>\n\n` +
      `📡 <b>${I18nService.t('mcp.serverStatus', lang)}</b>: ${statusLine}\n` +
      `🌐 <b>HTTP/SSE 端点</b>: <code>http://${publicHost}:${port}/sse</code>\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🆔 <b>${uidLabel}</b>: <code>${user.userId}</code>\n` +
      `🔑 <b>${tokenLabel}</b>:\n<code>${user.mcpToken || '未生成'}</code>\n\n` +
      `⚙️ <b>${autoTradeLabel}</b>: ${autoTradeStatus}\n` +
      `⚠️ <b>${maxLimitLabel}</b>: <b>${maxLimit} ${nativeSymbol}</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `💻 <b>STDIO 本地命令</b>:\n` +
      `<code>node ${stdioEntry} --user=${user.userId} --token=${user.mcpToken}</code>\n\n` +
      `${hint}`
    );
  }

  public static renderKeyboard(user: UserState, lang: string = 'en'): InlineKeyboard {
    const kb = new InlineKeyboard();

    // Row 1: 重置密钥 & 切换交易权限
    kb.text(I18nService.t('mcp.btnRegenToken', lang), 'mcp_regen_token')
      .text(I18nService.t('mcp.btnToggleTrade', lang), 'mcp_toggle_trade')
      .row();

    // Row 2: Claude Desktop 配置 & Cursor / IDE 配置
    kb.text(I18nService.t('mcp.btnClaudeCfg', lang), 'mcp_cfg_claude')
      .text(I18nService.t('mcp.btnCursorCfg', lang), 'mcp_cfg_cursor')
      .row();

    // Row 3: 查看 14 项 MCP 工具清单
    kb.text(I18nService.t('mcp.btnToolsList', lang), 'mcp_list_tools')
      .row();

    // Row 4: 返回主菜单
    kb.text(I18nService.btnBack(lang), 'menu_main');

    return kb;
  }

  /**
   * 渲染 MCP 内测权限限制提示文案
   * 若配置了 MCP_ALLOWED_USERS 白名单，未授权用户显示联系开启测试
   */
  public static renderAccessRestrictedText(lang: string = 'en'): string {
    const title = I18nService.t('mcp.restrictedTitle', lang);
    const desc = I18nService.t('mcp.restrictedDesc', lang);
    const prompt = I18nService.t('mcp.restrictedPrompt', lang);

    return (
      `🤖 <b>${title}</b>\n\n` +
      `${desc}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👉 <b>${prompt}</b>\n` +
      `联系作者 <a href="https://t.me/oxbaimao">https://t.me/oxbaimao</a> 开启测试\n` +
      `━━━━━━━━━━━━━━━━━━`
    );
  }

  /**
   * 渲染 MCP 权限限制界面按键 (直达作者联系方式及返回主菜单)
   */
  public static renderAccessRestrictedKeyboard(lang: string = 'en'): InlineKeyboard {
    const kb = new InlineKeyboard();
    kb.url(I18nService.btnMcpContactAuthor(lang), 'https://t.me/oxbaimao').row();
    kb.text(I18nService.btnBack(lang), 'menu_main');
    return kb;
  }

  public static renderClaudeConfig(user: UserState, port: number = 38088): string {
    const stdioEntry = path.join(process.cwd(), 'dist', 'mcp', 'index.js');
    const config = {
      mcpServers: {
        whitecat: {
          command: 'node',
          args: [
            stdioEntry,
            `--user=${user.userId}`,
            `--token=${user.mcpToken}`
          ],
          env: {
            WHITECAT_MCP_TOKEN: user.mcpToken
          }
        }
      }
    };

    const publicHost = process.env.MCP_PUBLIC_HOST || process.env.SERVER_IP || '127.0.0.1';
    return (
      `📋 <b>Claude Desktop 配置文件 (claude_desktop_config.json)</b>：\n\n` +
      `将以下配置复制并粘贴到您的 Claude Desktop 配置文件中：\n\n` +
      `<pre><code class="language-json">${JSON.stringify(config, null, 2)}</code></pre>\n\n` +
      `💡 也可以选择 SSE 远程连接模式：\n` +
      `<code>http://${publicHost}:${port}/sse?user=${user.userId}&token=${user.mcpToken}</code>`
    );
  }

  public static renderCursorConfig(user: UserState, port: number = 38088): string {
    const stdioEntry = path.join(process.cwd(), 'dist', 'mcp', 'index.js');
    const publicHost = process.env.MCP_PUBLIC_HOST || process.env.SERVER_IP || '127.0.0.1';
    return (
      `📋 <b>Cursor / Antigravity / Cline 智能体接入配置</b>：\n\n` +
      `<b>方式 1：标准 STDIO 命令行启动（推荐本地）</b>\n` +
      `• 命令 (Command): <code>node</code>\n` +
      `• 参数 (Args): <code>${stdioEntry} --user=${user.userId} --token=${user.mcpToken}</code>\n\n` +
      `<b>方式 2：HTTP / SSE 模式（支持远程与多智能体）</b>\n` +
      `• 类型 (Type): <code>sse</code>\n` +
      `• URL: <code>http://${publicHost}:${port}/sse?user=${user.userId}&token=${user.mcpToken}</code>\n\n` +
      `配置保存后，您的 AI 助手将在聊天对话中直接获取白猫打狗交易与风控工具！`
    );
  }

  public static renderToolsList(lang: string = 'en'): string {
    return (
      `🛠 <b>${I18nService.t('mcp.toolsTitle', lang)} (共 16 项核心工具)</b>\n\n` +
      `1. <code>whitecat_get_account_info</code>\n   - 获取用户活跃公链、钱包列表、链上原生余额与持仓\n` +
      `2. <code>whitecat_switch_chain</code>\n   - 切换 10 条公链 (BSC, Sui, Solana, Base, ETH, Robinhood 等)\n` +
      `3. <code>whitecat_query_token_market</code>\n   - 实时行情：价格、市值、流动性、24h成交量及 DexScreener 链接\n` +
      `4. <code>whitecat_check_token_security</code>\n   - GoPlus 貔貅检测：买卖滑点税、恶意代码、增发防跑路审计\n` +
      `5. <code>whitecat_get_balance</code>\n   - 查询任意公链地址的原生代币链上余额\n` +
      `6. <code>whitecat_fast_buy</code>\n   - 闪电买入：支持防MEV、滑点控制与 0 余额真实拦截\n` +
      `7. <code>whitecat_fast_sell</code>\n   - 闪电卖出：支持百分比 25%/50%/100% 或指定数量卖出\n` +
      `8. <code>whitecat_transfer</code>\n   - 链上原生币或代币快速转账至目标地址\n` +
      `9. <code>whitecat_list_limit_orders</code>\n   - 查询当前所有生效中的限价挂单\n` +
      `10. <code>whitecat_create_limit_order</code>\n   - 创建到达目标价自动触发的买入/卖出限价单\n` +
      `11. <code>whitecat_cancel_limit_order</code>\n   - 撤销指定限价单\n` +
      `12. <code>whitecat_list_copy_targets</code>\n   - 查询跟单监控的目标巨鲸钱包列表\n` +
      `13. <code>whitecat_add_copy_target</code>\n   - 添加新的跟单目标地址\n` +
      `14. <code>whitecat_get_transactions</code>\n   - 查询最近交易与狙击账单历史及区块链浏览器 TX 哈希\n` +
      `15. <code>whitecat_scan_meme_radar</code>\n   - Meme 爆点雷达：实时多链搜狗，自动排除老鼠仓与 KOL 接盘陷阱\n` +
      `16. <code>whitecat_audit_wallet_clusters</code>\n   - 资金链路聚类审计：穿透持仓注资祖先，计算真实合谋老鼠仓与 Dev 信用画像`
    );
  }
}
