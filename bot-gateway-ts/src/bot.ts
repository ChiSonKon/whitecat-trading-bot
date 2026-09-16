import { I18nService } from './services/i18nService.js';
import { Bot, GrammyError, HttpError, InlineKeyboard, InputFile } from 'grammy';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { ethers } from 'ethers';
import bs58 from 'bs58';
import { Keypair as SolKeypair } from '@solana/web3.js';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';
import { MainMenu } from './menus/mainMenu.js';
import { ChainMenu } from './menus/chainMenu.js';
import { LangMenu } from './menus/langMenu.js';
import { WalletMenu, WalletEntry } from './menus/walletMenu.js';
import { CopyTradeMenu } from './menus/copyTradeMenu.js';
import { AssetMenu, TokenHoldingItem } from './menus/assetMenu.js';
import { SettingsMenu, TradeConfig } from './menus/settingsMenu.js';
import { ReferralMenu } from './menus/referralMenu.js';
import { LimitOrderMenu, LimitOrderItem } from './menus/limitOrderMenu.js';
import { TokenDetector } from './handlers/tokenDetector.js';
import { TokenMarketService } from './services/tokenMarketService.js';
import { TradeMenu } from './menus/tradeMenu.js';
import { BackendClient } from './services/backendClient.js';
import { OnChainSwapService } from './services/onChainSwapService.js';
import { ChainBalanceService } from './services/chainBalanceService.js';
import { TokenKeyHelper } from './services/tokenKeyHelper.js';
import { PosterService } from './services/posterService.js';
import { BillingMenu, UserTransactionRecord } from './menus/billingMenu.js';
import { SnipeMenu } from './menus/snipeMenu.js';
import { McpMenu } from './menus/mcpMenu.js';
import { RadarMenu } from './menus/radarMenu.js';
import { ArcGuideMenu } from './menus/arcGuideMenu.js';
import { ChainEcosystemMenu } from './menus/chainEcosystemMenu.js';
import { MemeRadarService } from './services/memeRadarService.js';
import { WhiteCatSseServer } from './mcp/sseServer.js';
import {
  UserState,
  UserTokenHolding,
  PendingAction,
  userStore,
  saveUserStore,
  loadUserStore,
  getOrCreateUser,
  getUserWallets,
  syncWalletBalances,
  syncTokenHoldings,
  recordUserTransaction,
  processTradeReferralAndFee,
  regenerateMcpToken,
  toggleMcpAutoTrade,
  isMcpUserAllowed
} from './services/userService.js';

console.log('🤖 正在启动白猫打狗机器人 (WhiteCat Trading Bot Gateway)...');

function getChainTxUrl(chain: string, txHash: string): string {
  return BillingMenu.getChainTxUrl(chain, txHash);
}

function resolveChainForToken(tokenAddress: string, userActiveChain: string = 'bsc'): string {
  const fullAddress = TokenKeyHelper.toAddress(tokenAddress);
  const detection = TokenDetector.isTokenContract(fullAddress);
  if (detection.type === 'solana') {
    return 'solana';
  }
  if (detection.type === 'sui') {
    return userActiveChain.toLowerCase() === 'aptos' ? 'aptos' : 'sui';
  }
  if (detection.type === 'ton') {
    return 'ton';
  }
  if (detection.type === 'evm') {
    if (TokenDetector.isEvmChain(userActiveChain)) {
      return userActiveChain.toLowerCase();
    }
    return 'ethereum';
  }
  return userActiveChain.toLowerCase();
}

async function createWalletForUser(user: UserState, chain: string): Promise<WalletEntry> {
  const targetChain = chain.toLowerCase();
  const currentWallets = getUserWallets(user, targetChain);
  const symbol = MainMenu.getChainNativeSymbol(targetChain);
  const newIndex = currentWallets.length;

  const gen = await BackendClient.generateWallet(targetChain);
  if (!gen?.address || !gen?.private_key) throw new Error('Wallet generation failed');
  const newAddress = gen.address;
  const privateKey = gen.private_key;

  const newEntry: WalletEntry = {
    index: newIndex,
    address: newAddress,
    isDefault: newIndex === 0,
    balance: 0,
    symbol,
    privateKey
  };
  currentWallets.push(newEntry);
  saveUserStore();
  console.log(`[Wallet] Created ${targetChain} wallet: ${newAddress} (length: ${newAddress.length})`);
  return newEntry;
}

const proxyUri = process.env.SOCKS_PROXY && process.env.SOCKS_PROXY !== 'none' ? process.env.SOCKS_PROXY : undefined;
const bot = new Bot(CONFIG.BOT_TOKEN, {
  client: {
    baseFetchConfig: {
      agent: proxyUri ? new SocksProxyAgent(proxyUri) : undefined
    }
  }
});

const keyExportRequests = new Map<number, { nonce: string; address: string; chain: string; expires: number }>();

function renderOnboardingLangView() {
  const text =
    '👋 <b>欢迎使用白猫打狗交易机器人！</b>\n' +
    '<b>Welcome to WhiteCat Trading Bot!</b>\n\n' +
    '🌐 请选择您的首选界面语言 / Please select your preferred language:';

  const kb = LangMenu.renderOnboardingKeyboard();
  return { text, keyboard: kb };
}

function renderOnboardingChainView(lang: string = 'en') {
  const text = ChainMenu.renderText(lang);
  const keyboard = ChainMenu.renderKeyboard(lang, true);
  return { text, keyboard };
}

// 1. /start 指令 (新用户弹出语言与链选择，老用户直达主菜单)
bot.command(['start', 'setup', 'menu'], async ctx => {
  if (!ctx.from?.id) return;
  const userId = ctx.from.id;
  const username = ctx.from?.username || 'trader';
  const user = getOrCreateUser(userId, username);
  console.log(`[Start] Received /start from user ${userId} (@${username}), onboarded: ${user.onboarded}`);

  // Parse referral deep link: /start ref_{inviterId} or /start referTrade_{...}
  const startPayload = ctx.match?.trim() || '';

  // 1. 代币推荐交易深度链接 (referTrade / refTrade)
  if (startPayload.startsWith('referTrade_') || startPayload.startsWith('refTrade_')) {
    const rawPayload = startPayload.replace(/^(referTrade_|refTrade_)/, '');
    let tokenKey = '';
    let inviterId: number | null = null;
    let chainIdOrName: string | number = user.activeChain;

    if (rawPayload.includes('_')) {
      const parts = rawPayload.split('_');
      if (parts.length >= 4 && parts[0] === 'tk') {
        tokenKey = `tk_${parts[1]}`;
        inviterId = parseInt(parts[2], 10) || null;
        chainIdOrName = parts[3];
      } else if (parts.length === 3 && parts[0] === 'tk') {
        tokenKey = `tk_${parts[1]}`;
        chainIdOrName = parts[2];
      } else {
        tokenKey = parts[0];
        if (parts.length >= 3) {
          inviterId = parseInt(parts[1], 10) || null;
          chainIdOrName = parts[2];
        } else if (parts.length === 2) {
          chainIdOrName = parts[1];
        }
      }
    } else if (rawPayload.includes('-')) {
      const parts = rawPayload.split('-');
      tokenKey = parts[0];
      if (parts.length >= 3) {
        inviterId = parseInt(parts[1], 10) || null;
        chainIdOrName = parts[2];
      } else if (parts.length === 2) {
        chainIdOrName = parts[1];
      }
    } else {
      tokenKey = rawPayload;
    }

    // 绑定推荐人
    if (inviterId && !isNaN(inviterId) && inviterId !== userId && !user.inviterId) {
      user.inviterId = inviterId;
      const inviter = userStore.get(inviterId);
      if (inviter) {
        inviter.invitedCount = (inviter.invitedCount || 0) + 1;
        saveUserStore();
      }
      console.log(`[ReferTrade] User ${userId} bound to inviter ${inviterId}`);
    }

    // 切换到目标链并保存
    const targetChain = TradeMenu.resolveChainFromIdOrName(chainIdOrName);
    user.activeChain = targetChain;
    user.onboarded = true;
    saveUserStore();

    // 解析出目标代币完整合约地址
    const resolvedTokenAddress = TokenKeyHelper.toAddress(tokenKey);
    const botUser = bot.botInfo?.username || 'whitecat_doge_yr3ybv_bot';
    const cId = TradeMenu.getChainId(targetChain);
    const registeredKey = TokenKeyHelper.register(resolvedTokenAddress);
    const myShareLink = `https://t.me/${botUser}?start=referTrade_${registeredKey}_${userId}_${cId}`;
    const shareText = I18nService.getShareTradeText(user.lang, resolvedTokenAddress, '', MainMenu.getChainDisplayName(targetChain), resolvedTokenAddress);
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(myShareLink)}&text=${encodeURIComponent(shareText)}`;

    // 如果是自己点击了自己生成/旧消息的链接，先回复复制链接提示卡片（带原生一键分享到私聊按钮）
    if (!inviterId || inviterId === userId) {
      const copyPrompt = I18nService.t('trade.copyReferralLink', user.lang);
      const shareBtnText = I18nService.t('trade.shareToChat', user.lang);
      const kb = new InlineKeyboard().url(shareBtnText, shareUrl);
      await ctx.reply(`<b>${copyPrompt}</b>\n<code>${myShareLink}</code>`, {
        reply_markup: kb,
        parse_mode: 'HTML'
      });
    }

    // 同步钱包余额与代币真实持仓并展示该代币交易面板
    await syncWalletBalances(user, targetChain);
    await syncTokenHoldings(user, targetChain, resolvedTokenAddress);
    const currentWallets = getUserWallets(user, targetChain);
    const holdingObj = user.tokenHoldings.get(resolvedTokenAddress.toLowerCase());
    const userHolding = holdingObj ? holdingObj.amount : 0;
    const userHoldingNative = holdingObj ? holdingObj.costNative : 0;
    const boughtNative = holdingObj?.totalBoughtNative ?? userHoldingNative;
    const soldNative = holdingObj?.totalSoldNative ?? 0;
    const { text: panelText, keyboard } = await TokenDetector.analyzeAndBuildView(
      targetChain,
      resolvedTokenAddress,
      currentWallets,
      user.lang,
      userHolding,
      userHoldingNative,
      boughtNative,
      soldNative,
      userId,
      botUser
    );

    return ctx.reply(panelText, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
  }

  // 2. 好友邀请注册深度链接 (/start ref_{inviterId} 或 /start {referralCode} BUG-025)
  if (startPayload && !user.inviterId) {
    let inviterId: number | undefined;
    if (startPayload.startsWith('ref_')) {
      const parsed = parseInt(startPayload.replace('ref_', ''), 10);
      if (!isNaN(parsed) && parsed !== userId) inviterId = parsed;
    } else {
      for (const [uid, u] of userStore.entries()) {
        if (u.referralCode && u.referralCode.toUpperCase() === startPayload.toUpperCase() && uid !== userId) {
          inviterId = uid;
          break;
        }
      }
    }
    if (inviterId && inviterId !== userId) {
      user.inviterId = inviterId;
      const inviter = userStore.get(inviterId);
      if (inviter) {
        inviter.invitedCount = (inviter.invitedCount || 0) + 1;
        saveUserStore();
      }
      console.log(`[Referral] User ${userId} bound to inviter ${inviterId}`);
    }
  }

  // 如果用户尚未完成首次入驻向导，或者显式输入 /setup 或 /start reset，弹出语言与公链初始化选择
  const forceOnboarding = startPayload === 'reset' || startPayload === 'setup' || startPayload === 'init' || ctx.message?.text?.startsWith('/setup');
  if (!user.onboarded || forceOnboarding) {
    // 首次向导前下发底部快捷键盘以设定客户端占位符与快捷入口
    await ctx.reply(I18nService.getDockPlaceholder(user.lang), {
      reply_markup: MainMenu.getBottomKeyboard(user.lang)
    });
    const { text, keyboard } = renderOnboardingLangView();
    return ctx.reply(text, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
  }

  // 异步同步该链上最新真实余额
  await syncWalletBalances(user, user.activeChain);
  const wallets = getUserWallets(user);

  // 下发底部常驻回复键盘及占位符
  await ctx.reply(I18nService.getDockPlaceholder(user.lang), {
    reply_markup: MainMenu.getBottomKeyboard(user.lang)
  });

  await ctx.reply(MainMenu.renderText(user.activeChain, wallets, user.lang), {
    reply_markup: MainMenu.renderKeyboard(wallets, user.lang, user.activeChain),
    parse_mode: 'HTML'
  });
});

// 2. /faucet 或 /deposit 指令: 充值测试代币 (支持多链，增加白名单与频率限制 BUG-021)
const faucetRateLimitMap = new Map<number, number>();

bot.command(['faucet', 'deposit'], async ctx => {
  if (!ctx.from?.id) return;
  const userId = ctx.from.id;
  const user = getOrCreateUser(userId, ctx.from?.username);
  const isZh = user.lang === 'zh-hans' || user.lang === 'zh-hant';

  // 1. 权限校验: 白名单检查 (环境变量 FAUCET_WHITELIST_USERS 或 ADMIN_USER_IDS)
  const whitelistEnv = process.env.FAUCET_WHITELIST_USERS || process.env.ADMIN_USER_IDS || '';
  const whitelist = whitelistEnv.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  const isDev = process.env.NODE_ENV !== 'production';

  if (!isDev && !whitelist.includes(userId)) {
    return ctx.reply(
      isZh
        ? '⚠️ <b>水龙头已关闭</b>\n\n水龙头充值功能仅限测试白名单管理员使用。'
        : '⚠️ <b>Faucet Access Denied</b>\n\nFaucet command is restricted to authorized test administrators.',
      { parse_mode: 'HTML' }
    );
  }

  // 2. 速率限制: 每用户 60 秒限领一次
  const now = Date.now();
  const lastClaim = faucetRateLimitMap.get(userId) || 0;
  if (now - lastClaim < 60000) {
    const remainingSec = Math.ceil((60000 - (now - lastClaim)) / 1000);
    return ctx.reply(
      isZh
        ? `⏳ 领取过于频繁，请等待 ${remainingSec} 秒后再试。`
        : `⏳ Rate limit reached. Please wait ${remainingSec}s before claiming again.`,
      { parse_mode: 'HTML' }
    );
  }

  const rawArgs = ctx.match?.trim() || '';
  const parts = rawArgs.split(/\s+/);
  let depositAmt = 0.5;
  let targetChain = user.activeChain;

  if (parts.length > 0 && parts[0] && !isNaN(parseFloat(parts[0]))) {
    depositAmt = parseFloat(parts[0]);
    if (parts.length > 1 && parts[1]) {
      targetChain = parts[1].toLowerCase();
    }
  }

  // 3. 单次最大领水量严格限制 (0.001 ~ 1.0)
  if (isNaN(depositAmt) || depositAmt <= 0) {
    depositAmt = 0.1;
  } else if (depositAmt > 1.0) {
    depositAmt = 1.0;
  }

  faucetRateLimitMap.set(userId, now);
  console.log(`[Faucet] Received /faucet from user ${userId}: ${depositAmt} on ${targetChain}`);

  const symbol = MainMenu.getChainNativeSymbol(targetChain);
  const wallets = getUserWallets(user, targetChain);

  if (wallets.length === 0) {
    await createWalletForUser(user, targetChain);
  }

  const activeWallet = wallets.find(w => w.isDefault) || wallets[0];
  activeWallet.balance = (activeWallet.balance || 0) + depositAmt;
  saveUserStore();

  return ctx.reply(I18nService.t('msg.faucetSuccess', user.lang, { address: activeWallet.address, chain: MainMenu.getChainDisplayName(targetChain), amt: depositAmt, symbol: symbol, bal: activeWallet.balance }), { parse_mode: 'HTML' });
});

// 2.5 /lang 或 /language 指令: 切换语言
bot.command(['lang', 'language'], async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  return ctx.reply(LangMenu.renderText(user.lang), {
    reply_markup: LangMenu.renderKeyboard(user.lang),
    parse_mode: 'HTML'
  });
});

// 3. /switch_chain 指令: 切换链
bot.command('switch_chain', async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  return ctx.reply(ChainMenu.renderText(user.lang), {
    reply_markup: ChainMenu.renderKeyboard(user.lang),
    parse_mode: 'HTML'
  });
});

// 4. /asset 指令: 查看代币持仓
bot.command('asset', async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  await syncWalletBalances(user, user.activeChain);
  await syncTokenHoldings(user, user.activeChain);
  const holdings: TokenHoldingItem[] = [];
  user.tokenHoldings.forEach((holding) => {
    if (holding && holding.amount > 1e-4) {
      const isCurrentChain = !holding.chain || holding.chain.toLowerCase() === user.activeChain.toLowerCase();
      if (isCurrentChain) {
        holdings.push({
          address: holding.tokenAddress,
          symbol: holding.symbol || 'TOKEN',
          balance: holding.amount,
          nativeValue: holding.costNative || 0.1,
          pnlNative: 0,
          pnlPct: 0
        });
      }
    }
  });
  const activeWallet = getUserWallets(user, user.activeChain).find(w => w.isDefault) || getUserWallets(user, user.activeChain)[0];
  if (!activeWallet) {
    return ctx.reply(I18nService.t('msg.noWallet', user.lang));
  }
  return ctx.reply(AssetMenu.renderText(user.activeChain, activeWallet, holdings, user.lang), {
    reply_markup: AssetMenu.renderKeyboard(user.activeChain, holdings, user.lang),
    parse_mode: 'HTML'
  });
});

// 5. /buy_sell 指令: 买/卖代币
bot.command('buy_sell', async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  user.pendingAction = { type: 'query_ca' };
  return ctx.reply(
    `<b>💰 ${I18nService.getCommandDesc('buy_sell', user.lang)}</b>\n\n` +
    `${I18nService.t('trade.enterTokenAddress', user.lang) || '🔍 请在此发送目标代币合约地址 (CA) 进行快速买卖：'}`,
    { parse_mode: 'HTML' }
  );
});

// 6. /limit_order 指令: 查看挂单
bot.command('limit_order', async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  const activeWallet = getUserWallets(user, user.activeChain).find(w => w.isDefault) || getUserWallets(user, user.activeChain)[0];
  return ctx.reply(LimitOrderMenu.renderText(activeWallet, user.limitOrders, user.lang, user.activeChain), {
    reply_markup: LimitOrderMenu.renderKeyboard(user.lang),
    parse_mode: 'HTML'
  });
});

// 7. /copy_trade 指令: 查看跟单设置
bot.command('copy_trade', async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  const activeWallet = getUserWallets(user, user.activeChain).find(w => w.isDefault) || getUserWallets(user, user.activeChain)[0];
  return ctx.reply(CopyTradeMenu.renderText(activeWallet, user.monitoredWallets.length, user.lang), {
    reply_markup: CopyTradeMenu.renderKeyboard(user.lang),
    parse_mode: 'HTML'
  });
});

// 8. /sniper 指令: 代币开盘狙击
bot.command('sniper', async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  return ctx.reply(SnipeMenu.renderText(user.lang), {
    reply_markup: SnipeMenu.renderKeyboard(user.lang),
    parse_mode: 'HTML'
  });
});

// 9. /billing 指令: 查看历史交易&狙击记录
bot.command('billing', async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  const activeWallet = getUserWallets(user, user.activeChain).find(w => w.isDefault) || getUserWallets(user, user.activeChain)[0];
  return ctx.reply(BillingMenu.renderText(user.activeChain, activeWallet, user.transactions, user.lang), {
    reply_markup: BillingMenu.renderKeyboard(user.activeChain, activeWallet, user.lang),
    parse_mode: 'HTML'
  });
});

// 10. /wallet_setting 指令: 钱包设置
bot.command('wallet_setting', async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  await syncWalletBalances(user, user.activeChain);
  const wallets = getUserWallets(user, user.activeChain);
  return ctx.reply(WalletMenu.renderText(user.activeChain, wallets, user.lang), {
    reply_markup: WalletMenu.renderKeyboard(wallets, user.lang),
    parse_mode: 'HTML'
  });
});

// 11. /trade_setting 指令: 全局交易设置
bot.command('trade_setting', async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  return ctx.reply(SettingsMenu.renderText(user.activeChain, user.tradeConfig, user.lang), {
    reply_markup: SettingsMenu.renderKeyboard(user.activeChain, user.tradeConfig, user.lang),
    parse_mode: 'HTML'
  });
});

// 12. /referral 指令: 查看邀请信息和奖励
bot.command('referral', async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  return ctx.reply(ReferralMenu.renderText(user.userId, user.activeChain, user, user.lang), {
    reply_markup: ReferralMenu.renderKeyboard(user.lang),
    parse_mode: 'HTML'
  });
});

// 13. /mini_futures 指令: 迷你合约交易
bot.command('mini_futures', async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  const kb = new InlineKeyboard()
    .url(I18nService.btnDevTechSupport(user.lang), 'https://t.me/biqrxnxiYW/667')
    .row()
    .text(I18nService.btnBack(user.lang), 'menu_main');
  return ctx.reply(
    `🚀 <b>${I18nService.getCommandDesc('mini_futures', user.lang)}</b>\n\n` +
    `${I18nService.t('msg.miniFuturesSoon', user.lang)}\n\n` +
    `🛠️ 商业定制与技术支持：<a href="https://t.me/biqrxnxiYW/667">WhiteCat Technical Support</a>`,
    {
      reply_markup: kb,
      parse_mode: 'HTML'
    }
  );
});

// 14. /mcp 指令: MCP 智能体接入与接口配置 (内部特邀用户受限访问，严禁在群聊中输出凭据)
bot.command('mcp', async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  if (ctx.chat?.type && ctx.chat.type !== 'private') {
    return ctx.reply(I18nService.t('mcp.privateOnly', user.lang), {
      parse_mode: 'HTML'
    });
  }
  if (!isMcpUserAllowed(user.userId)) {
    return ctx.reply(McpMenu.renderAccessRestrictedText(user.lang), {
      reply_markup: McpMenu.renderAccessRestrictedKeyboard(user.lang),
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    });
  }
  const mcpPort = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 38088;
  return ctx.reply(McpMenu.renderText(user, mcpPort, user.lang), {
    reply_markup: McpMenu.renderKeyboard(user, user.lang),
    parse_mode: 'HTML'
  });
});

// 15. /radar 或 /hot 指令: Meme 爆点雷达实时候选榜
bot.command(['radar', 'hot'], async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  const candidates = await MemeRadarService.scanRadarTokens(user.activeChain, { limit: 6 });
  return ctx.reply(RadarMenu.renderText(user.activeChain, candidates, user.lang), {
    reply_markup: RadarMenu.renderKeyboard(user.activeChain, candidates, user.lang),
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true }
  });
});

// 16. /arc 或 /arc_guide 指令: ARC 生态与跨链指引
bot.command(['arc', 'arc_guide'], async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  return ctx.reply(ArcGuideMenu.renderText(user.lang), {
    reply_markup: ArcGuideMenu.renderKeyboard(user.lang),
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true }
  });
});

// 17. /guide, /ecosystem, /sol, /bsc, /base, /sui, /ton 指令: 全网主流公链内盘与节点生态指引
bot.command(['guide', 'ecosystem', 'chain_guide', 'sol', 'solana', 'bsc', 'base', 'sui', 'ton'], async ctx => {
  if (!ctx.from?.id) return;
  const user = getOrCreateUser(ctx.from.id, ctx.from.username);
  const rawText = ctx.message?.text?.trim() || '';
  const cmd = rawText.split(' ')[0]?.replace('/', '')?.toLowerCase() || '';

  let targetChain = user.activeChain;
  if (['sol', 'solana'].includes(cmd)) targetChain = 'solana';
  else if (cmd === 'bsc') targetChain = 'bsc';
  else if (cmd === 'base') targetChain = 'base';
  else if (cmd === 'sui') targetChain = 'sui';
  else if (cmd === 'ton') targetChain = 'ton';

  if (targetChain.toLowerCase() === 'arc') {
    return ctx.reply(ArcGuideMenu.renderText(user.lang), {
      reply_markup: ArcGuideMenu.renderKeyboard(user.lang),
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    });
  }

  return ctx.reply(ChainEcosystemMenu.renderText(targetChain, user.lang), {
    reply_markup: ChainEcosystemMenu.renderKeyboard(targetChain, user.lang),
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true }
  });
});

// 14. 回调交互分发 (Callback Queries)
bot.on('callback_query:data', async ctx => {
  
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  const user = getOrCreateUser(userId, ctx.from.username);
  const isZh = user.lang === 'zh-hans' || user.lang === 'zh-hant';
  const wallets = getUserWallets(user);
  const activeWallet = wallets.find(w => w.isDefault) || wallets[0];
    const nativeSymbol = MainMenu.getChainNativeSymbol(user.activeChain);

  // 0.1 新用户向导：语言选择 (支持 onboard_lang_ 与 init_lang_)
  if (data.startsWith('onboard_lang_') || data.startsWith('init_lang_')) {
    const selectedLang = data.replace(/^onboard_lang_|^init_lang_/, '');
    user.lang = selectedLang;
    saveUserStore();
    await ctx.answerCallbackQuery();

    // 同步下发新语言对应的底部常驻键盘与占位符
    await ctx.reply(I18nService.getDockPlaceholder(user.lang), {
      reply_markup: MainMenu.getBottomKeyboard(user.lang)
    });

    const { text, keyboard } = renderOnboardingChainView(selectedLang);
    return ctx.reply(text, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
  }

  // 0.2 新用户向导：返回修改语言
  if (data === 'onboard_back_lang' || data === 'init_back_lang') {
    await ctx.answerCallbackQuery();
    const { text, keyboard } = renderOnboardingLangView();
    return ctx.editMessageText(text, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
  }

  // A. 切换主链选单
  if (data === 'chain_change') {
    await ctx.answerCallbackQuery();
    return ctx.editMessageText(ChainMenu.renderText(user.lang), {
      reply_markup: ChainMenu.renderKeyboard(user.lang),
      parse_mode: 'HTML'
    });
  }

  // B. 确认切换具体链 (支持 switch_chain_, onboard_chain_, init_chain_)
  if (data.startsWith('switch_chain_') || data.startsWith('onboard_chain_') || data.startsWith('init_chain_')) {
    const targetChain = data.replace(/^switch_chain_|^onboard_chain_|^init_chain_/, '').toLowerCase();
    user.activeChain = targetChain;
    user.onboarded = true;

    const chainName = MainMenu.getChainDisplayName(targetChain);
    const toast = user.lang === 'zh-hans' || user.lang === 'zh-hant'
      ? `🎉 已切换至 ${chainName}`
      : user.lang === 'vi'
      ? `🎉 Đã chuyển sang ${chainName}`
      : user.lang === 'ru'
      ? `🎉 Переключено на ${chainName}`
      : `🎉 Switched to ${chainName}`;

    // 优先即时应答 Telegram 回调，消除前端按钮转圈等待
    await ctx.answerCallbackQuery({ text: toast }).catch(() => {});

    // 如果该链尚未生成钱包，立即为用户生成首个原生钱包
    let currentWallets = getUserWallets(user, targetChain);
    if (currentWallets.length === 0) {
      await createWalletForUser(user, targetChain);
      currentWallets = getUserWallets(user, targetChain);
    }
    await syncWalletBalances(user, targetChain);
    saveUserStore();

    // 确保底部常驻快捷键盘同步更新并设定占位符
    await ctx.reply(I18nService.getDockPlaceholder(user.lang), {
      reply_markup: MainMenu.getBottomKeyboard(user.lang)
    });

    return ctx.reply(MainMenu.renderText(targetChain, currentWallets, user.lang), {
      reply_markup: MainMenu.renderKeyboard(currentWallets, user.lang, targetChain),
      parse_mode: 'HTML'
    });
  }

  // B.2 确认切换具体链并直接打开代币交易面板 (跨链代币一键跳转)
  if (data.startsWith('switch_to_')) {
    const raw = data.replace('switch_to_', '');
    const parts = raw.split('_');
    const targetChain = parts[0]?.toLowerCase();
    const tokenKey = parts.slice(1).join('_');

    if (targetChain) {
      user.activeChain = targetChain;
      user.onboarded = true;
      saveUserStore();

      // 优先即时应答 Telegram 回调
      await ctx.answerCallbackQuery({
        text: `✅ ${MainMenu.getChainDisplayName(targetChain)}`
      }).catch(() => {});

      let targetWallets = getUserWallets(user, targetChain);
      if (targetWallets.length === 0) {
        await createWalletForUser(user, targetChain);
        targetWallets = getUserWallets(user, targetChain);
      }
      await syncWalletBalances(user, targetChain);

      const resolvedAddress = TokenKeyHelper.toAddress(tokenKey);
      await syncTokenHoldings(user, targetChain, resolvedAddress);
      const holding = user.tokenHoldings.get(resolvedAddress.toLowerCase()) || user.tokenHoldings.get(resolvedAddress);
      const userHolding = holding ? holding.amount : 0;
      const userHoldingNative = holding ? (holding.costNative || 0) : 0;
      const boughtNative = holding ? (holding.totalBoughtNative || 0) : 0;
      const soldNative = holding ? (holding.totalSoldNative || 0) : 0;

      const botUser = bot.botInfo?.username || 'whitecat_doge_yr3ybv_bot';
      const { text: panelText, keyboard } = await TokenDetector.analyzeAndBuildView(
        targetChain,
        resolvedAddress,
        targetWallets,
        user.lang,
        userHolding,
        userHoldingNative,
        boughtNative,
        soldNative,
        userId,
        botUser
      );

      try {
        return ctx.editMessageText(panelText, {
          reply_markup: keyboard,
          parse_mode: 'HTML'
        });
      } catch {
        return ctx.reply(panelText, {
          reply_markup: keyboard,
          parse_mode: 'HTML'
        });
      }
    }
  }

  // C. 语言选择菜单
  if (data === 'lang') {
    await ctx.answerCallbackQuery();
    return ctx.editMessageText(LangMenu.renderText(user.lang), {
      reply_markup: LangMenu.renderKeyboard(user.lang),
      parse_mode: 'HTML'
    });
  }

  // D. 确认切换具体语言
  if (data.startsWith('lang_click?')) {
    const langId = parseInt(data.replace('lang_click?', ''), 10);
    const selected = LangMenu.getLangById(langId);
    user.lang = selected.code;
    saveUserStore();
    await ctx.answerCallbackQuery({ text: `Switched to ${selected.name}` });
    const currentWallets = getUserWallets(user);
    // 同步下发新语言对应的底部常驻键盘与输入框占位符
    await ctx.reply(I18nService.getDockPlaceholder(user.lang), {
      reply_markup: MainMenu.getBottomKeyboard(user.lang)
    });
    try {
      return await ctx.editMessageText(MainMenu.renderText(user.activeChain, currentWallets, user.lang), {
        reply_markup: MainMenu.renderKeyboard(currentWallets, user.lang, user.activeChain),
        parse_mode: 'HTML'
      });
    } catch {
      return await ctx.reply(MainMenu.renderText(user.activeChain, currentWallets, user.lang), {
        reply_markup: MainMenu.renderKeyboard(currentWallets, user.lang, user.activeChain),
        parse_mode: 'HTML'
      });
    }
  }

  // E. 创建新钱包
  if (data === 'create_wallet') {
    const currentWallets = getUserWallets(user);
    if (currentWallets.length >= 10) {
      return ctx.answerCallbackQuery({ text: 'You have a total of 10 linked wallets(10/10)', show_alert: true });
    }

    const newEntry = await createWalletForUser(user, user.activeChain);
    await ctx.answerCallbackQuery({ text: I18nService.t('msg.walletCreated', user.lang) });

    const chainName = MainMenu.getChainDisplayName(user.activeChain);
    const successText = I18nService.t('msg.walletCreatedDetail', user.lang, { address: newEntry.address, chain: chainName, count: currentWallets.length });

    return ctx.editMessageText(successText, {
      reply_markup: MainMenu.renderKeyboard(currentWallets, user.lang, user.activeChain),
      parse_mode: 'HTML'
    });
  }

  // F. 导入钱包 (BUG-022)
  if (data === 'import_wallet') {
    await ctx.answerCallbackQuery();
    const isZh = user.lang === 'zh-hans' || user.lang === 'zh-hant';
    if (ctx.chat?.type !== 'private') {
      return ctx.reply(
        isZh
          ? '⚠️ <b>安全警告</b>: 为防私钥在群聊泄露，导入私钥仅支持在与 Bot 的私聊中进行。'
          : '⚠️ <b>Security Alert</b>: Private key import is only supported in a private chat with the Bot.',
        { parse_mode: 'HTML' }
      );
    }
    user.pendingAction = {
      type: 'import_wallet',
      data: { chain: user.activeChain },
      createdAt: Date.now()
    };
    saveUserStore();
    return ctx.reply(
      I18nService.t('msg.importWalletHint', user.lang) ||
      (isZh
        ? `🔑 <b>导入私钥</b>\n\n当前目标公链: <b>${MainMenu.getChainDisplayName(user.activeChain)}</b>\n\n请直接回复待导入的私钥（支持 64位十六进制 EVM 私钥、Solana Base58 私钥或 Sui 私钥）。\n\n<i>🛡️ 安全防护：Bot 读取后会尝试立即删除您发送的私钥消息。</i>`
        : `🔑 <b>Import Private Key</b>\n\nTarget Chain: <b>${MainMenu.getChainDisplayName(user.activeChain)}</b>\n\nPlease reply with the private key (supports 64-char EVM hex, Solana Base58, or Sui private key).\n\n<i>🛡️ The message will be purged automatically for safety.</i>`),
      { parse_mode: 'HTML' }
    );
  }

  // G. 刷新主页 / 返回
  if (data === 'menu_main' || data === 'menu_close' || data === 'close') {
    await ctx.answerCallbackQuery().catch(() => {});
    await syncWalletBalances(user, user.activeChain);
    const currentWallets = getUserWallets(user);
    return ctx.editMessageText(MainMenu.renderText(user.activeChain, currentWallets, user.lang), {
      reply_markup: MainMenu.renderKeyboard(currentWallets, user.lang, user.activeChain),
      parse_mode: 'HTML'
    });
  }

  // G.1 🤖 MCP 智能体接入面板 (内部特邀用户权限限制，严格限制私聊)
  if (data === 'menu_mcp' || data.startsWith('mcp_')) {
    if (ctx.chat?.type && ctx.chat.type !== 'private') {
      return ctx.answerCallbackQuery({
        text: I18nService.t('mcp.privateOnlyAlert', user.lang),
        show_alert: true
      });
    }
  }

  if (data === 'menu_mcp') {
    await ctx.answerCallbackQuery();
    if (!isMcpUserAllowed(user.userId)) {
      return ctx.editMessageText(McpMenu.renderAccessRestrictedText(user.lang), {
        reply_markup: McpMenu.renderAccessRestrictedKeyboard(user.lang),
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true }
      });
    }
    const mcpPort = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 38088;
    return ctx.editMessageText(McpMenu.renderText(user, mcpPort, user.lang), {
      reply_markup: McpMenu.renderKeyboard(user, user.lang),
      parse_mode: 'HTML'
    });
  }

  // 内部特邀权限安全拦截：非授权用户禁止操作任何 MCP 衍生子功能
  if (data.startsWith('mcp_') && !isMcpUserAllowed(user.userId)) {
    await ctx.answerCallbackQuery({ text: '联系作者 https://t.me/oxbaimao 开启测试', show_alert: true });
    return ctx.editMessageText(McpMenu.renderAccessRestrictedText(user.lang), {
      reply_markup: McpMenu.renderAccessRestrictedKeyboard(user.lang),
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    });
  }

  // G.2 MCP 重置密钥
  if (data === 'mcp_regen_token') {
    regenerateMcpToken(user.userId);
    await ctx.answerCallbackQuery({ text: I18nService.t('mcp.btnRegenToken', user.lang) + ' ✅', show_alert: true });
    const mcpPort = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 38088;
    return ctx.editMessageText(McpMenu.renderText(user, mcpPort, user.lang), {
      reply_markup: McpMenu.renderKeyboard(user, user.lang),
      parse_mode: 'HTML'
    });
  }

  // G.3 MCP 切换自主交易权限
  if (data === 'mcp_toggle_trade') {
    const newState = toggleMcpAutoTrade(user.userId);
    const stateText = newState ? I18nService.t('mcp.enabled', user.lang) : I18nService.t('mcp.disabled', user.lang);
    await ctx.answerCallbackQuery({ text: `${stateText}`, show_alert: true });
    const mcpPort = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 38088;
    return ctx.editMessageText(McpMenu.renderText(user, mcpPort, user.lang), {
      reply_markup: McpMenu.renderKeyboard(user, user.lang),
      parse_mode: 'HTML'
    });
  }

  // G.4 MCP Claude Desktop 配置查看
  if (data === 'mcp_cfg_claude') {
    await ctx.answerCallbackQuery();
    const mcpPort = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 38088;
    const kb = new InlineKeyboard().text(I18nService.btnBack(user.lang), 'menu_mcp');
    return ctx.reply(McpMenu.renderClaudeConfig(user, mcpPort), {
      reply_markup: kb,
      parse_mode: 'HTML'
    });
  }

  // G.5 MCP Cursor / IDE 配置查看
  if (data === 'mcp_cfg_cursor') {
    await ctx.answerCallbackQuery();
    const mcpPort = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 38088;
    const kb = new InlineKeyboard().text(I18nService.btnBack(user.lang), 'menu_mcp');
    return ctx.reply(McpMenu.renderCursorConfig(user, mcpPort), {
      reply_markup: kb,
      parse_mode: 'HTML'
    });
  }

  // G.6 MCP 14 项工具清单查看
  if (data === 'mcp_list_tools') {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard().text(I18nService.btnBack(user.lang), 'menu_mcp');
    return ctx.reply(McpMenu.renderToolsList(user.lang), {
      reply_markup: kb,
      parse_mode: 'HTML'
    });
  }

  // G.7 🔥 Meme 爆点雷达 (Meme Radar)
  if (data === 'menu_radar' || data === 'radar_refresh') {
    await ctx.answerCallbackQuery();
    const candidates = await MemeRadarService.scanRadarTokens(user.activeChain, { limit: 6 });
    return ctx.editMessageText(RadarMenu.renderText(user.activeChain, candidates, user.lang), {
      reply_markup: RadarMenu.renderKeyboard(user.activeChain, candidates, user.lang),
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    });
  }

  // G.8 雷达代币一键直达交易面板
  if (data.startsWith('radar_pick_')) {
    const shortKey = data.replace('radar_pick_', '');
    const tokenAddress = TokenKeyHelper.toAddress(shortKey);
    await ctx.answerCallbackQuery();
    await syncWalletBalances(user, user.activeChain);
    await syncTokenHoldings(user, user.activeChain, tokenAddress);
    const currentWallets = getUserWallets(user);
    const holding = user.tokenHoldings.get(tokenAddress.toLowerCase()) || user.tokenHoldings.get(tokenAddress);
    const userHolding = holding?.amount || 0;
    const userHoldingNative = holding?.costNative || 0;
    const boughtNative = holding?.totalBoughtNative || 0;
    const soldNative = holding?.totalSoldNative || 0;
    const botUser = ctx.me?.username || 'whitecat_doge_yr3ybv_bot';

    const { text: panelText, keyboard } = await TokenDetector.analyzeAndBuildView(
      user.activeChain,
      tokenAddress,
      currentWallets,
      user.lang,
      userHolding,
      userHoldingNative,
      boughtNative,
      soldNative,
      user.userId,
      botUser
    );

    return ctx.editMessageText(panelText, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    });
  }

  // G.9 🌐 ARC 生态与跨链指引菜单
  if (data === 'menu_arc_guide' || data === 'menu_chain_guide_arc') {
    await ctx.answerCallbackQuery();
    return ctx.reply(ArcGuideMenu.renderText(user.lang), {
      reply_markup: ArcGuideMenu.renderKeyboard(user.lang),
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    });
  }

  // G.9.1 🌐 全网主流公链生态与内盘指引菜单 (Solana, BSC, Base, Sui, TON 等)
  if (data.startsWith('menu_chain_guide_')) {
    const targetChain = data.replace('menu_chain_guide_', '');
    await ctx.answerCallbackQuery();
    return ctx.reply(ChainEcosystemMenu.renderText(targetChain, user.lang), {
      reply_markup: ChainEcosystemMenu.renderKeyboard(targetChain, user.lang),
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    });
  }

  // G.10 ARC 生态一键直达代币交易 (如 $ARCAT / $SHARCFUN)
  if (data.startsWith('arc_open_')) {
    const shortKey = data.replace('arc_open_', '');
    const tokenAddress = TokenKeyHelper.toAddress(shortKey);
    await ctx.answerCallbackQuery();

    // 自动切换至 arc 链
    user.activeChain = 'arc';
    user.onboarded = true;
    saveUserStore();

    let currentWallets = getUserWallets(user, 'arc');
    if (currentWallets.length === 0) {
      await createWalletForUser(user, 'arc');
      currentWallets = getUserWallets(user, 'arc');
    }
    await syncWalletBalances(user, 'arc');
    await syncTokenHoldings(user, 'arc', tokenAddress);

    const holding = user.tokenHoldings.get(tokenAddress.toLowerCase()) || user.tokenHoldings.get(tokenAddress);
    const userHolding = holding?.amount || 0;
    const userHoldingNative = holding?.costNative || 0;
    const boughtNative = holding?.totalBoughtNative || 0;
    const soldNative = holding?.totalSoldNative || 0;
    const botUser = ctx.me?.username || 'whitecat_doge_yr3ybv_bot';

    const { text: panelText, keyboard } = await TokenDetector.analyzeAndBuildView(
      'arc',
      tokenAddress,
      currentWallets,
      user.lang,
      userHolding,
      userHoldingNative,
      boughtNative,
      soldNative,
      user.userId,
      botUser
    );

    return ctx.reply(panelText, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
  }

  // G.11 钱包面板强制作为代币交易 (规避误判或预买)
  if (data.startsWith('trade_force_')) {
    const shortKey = data.replace('trade_force_', '');
    const tokenAddress = TokenKeyHelper.toAddress(shortKey);
    await ctx.answerCallbackQuery();

    await syncWalletBalances(user, user.activeChain);
    await syncTokenHoldings(user, user.activeChain, tokenAddress);

    const currentWallets = getUserWallets(user, user.activeChain);
    const holding = user.tokenHoldings.get(tokenAddress.toLowerCase()) || user.tokenHoldings.get(tokenAddress);
    const userHolding = holding?.amount || 0;
    const userHoldingNative = holding?.costNative || 0;
    const boughtNative = holding?.totalBoughtNative || 0;
    const soldNative = holding?.totalSoldNative || 0;
    const botUser = ctx.me?.username || 'whitecat_doge_yr3ybv_bot';

    const { text: panelText, keyboard } = await TokenDetector.analyzeAndBuildView(
      user.activeChain,
      tokenAddress,
      currentWallets,
      user.lang,
      userHolding,
      userHoldingNative,
      boughtNative,
      soldNative,
      user.userId,
      botUser
    );

    return ctx.reply(panelText, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
  }

  // H. 💰 买/卖 (buy_sell) & 🔫 狙击 (sniper_token)
  if (data === 'buy_sell' || data === 'sniper_token') {
    await ctx.answerCallbackQuery();
    user.pendingAction = { type: 'query_ca' };
    return ctx.reply(
      I18nService.t('msg.enterTokenCA', user.lang)
    );
  }

  // I. ⚡️ 跟单 (copy_trade)
  if (data === 'copy_trade') {
    await ctx.answerCallbackQuery();
    return ctx.editMessageText(CopyTradeMenu.renderText(activeWallet, user.monitoredWallets.length, user.lang), {
      reply_markup: CopyTradeMenu.renderKeyboard(user.lang),
      parse_mode: 'HTML'
    });
  }

  if (data === 'copy_add') {
    await ctx.answerCallbackQuery();
    user.pendingAction = { type: 'add_copy' };
    return ctx.reply(
      I18nService.t('msg.enterSmartMoney', user.lang)
    );
  }

  // J. 🏦 资产 (asset)
  if (data === 'asset' || data === 'asset_refresh') {
    await ctx.answerCallbackQuery({ text: I18nService.t('msg.refreshedBalances', user.lang) }).catch(() => {});
    await syncWalletBalances(user, user.activeChain);
    const holdings: TokenHoldingItem[] = [];
    user.tokenHoldings.forEach((holding) => {
      if (holding && holding.amount > 1e-4) {
        const isCurrentChain = !holding.chain || holding.chain.toLowerCase() === user.activeChain.toLowerCase();
        if (isCurrentChain) {
          const nativeVal = holding.costNative || 0.1;
          holdings.push({
            address: holding.tokenAddress,
            symbol: holding.symbol || 'TOKEN',
            balance: holding.amount,
            nativeValue: nativeVal,
            pnlNative: 0,
            pnlPct: 0
          });
        }
      }
    });

    const activeWallet = getUserWallets(user, user.activeChain).find(w => w.isDefault) || getUserWallets(user, user.activeChain)[0];
    if (!activeWallet) {
      return ctx.reply(I18nService.t('msg.noWallet', user.lang));
    }

    return ctx.editMessageText(AssetMenu.renderText(user.activeChain, activeWallet, holdings, user.lang), {
      reply_markup: AssetMenu.renderKeyboard(user.activeChain, holdings, user.lang),
      parse_mode: 'HTML'
    });
  }

  if (data === 'transfer_native') {
    await ctx.answerCallbackQuery();
    user.pendingAction = { type: 'transfer_native' };
    const currentWallets = getUserWallets(user, user.activeChain);
    const currWallet = currentWallets.find(w => w.isDefault) || currentWallets[0];
    const currBalance = currWallet?.balance || 0;
    const nativeSymbol = MainMenu.getChainNativeSymbol(user.activeChain);

    return ctx.reply(
      isZh
        ? `✏️ 请输入接收 <b>${nativeSymbol}</b> 的目标钱包地址：\n\n` +
          `💳 当前钱包可用余额: <b>${currBalance} ${nativeSymbol}</b>\n` +
          `💡 提示: 您可以直接发送目标地址，也可以附带金额（例如 <code>0x... 0.05</code>）\n` +
          `❌ 回复 /cancel 可随时取消。`
        : `✏️ Please enter recipient address for <b>${nativeSymbol}</b>:\n\n` +
          `💳 Current Balance: <b>${currBalance} ${nativeSymbol}</b>\n` +
          `💡 Tip: Send address only, or with amount (e.g. <code>0x... 0.05</code>)\n` +
          `❌ Type /cancel to cancel.`,
      { parse_mode: 'HTML' }
    );
  }

  if (data === 'transfer_token') {
    await ctx.answerCallbackQuery();
    user.pendingAction = { type: 'transfer_token' };
    return ctx.reply(
      isZh
        ? `✏️ 请输入要转账的代币合约地址 (CA)：\n\n` +
          `💡 提示: 您可以逐步输入，或单行输入: <code>CA 接收地址 数量</code>\n` +
          `❌ 回复 /cancel 可随时取消。`
        : `✏️ Please enter token contract address (CA):\n\n` +
          `💡 Tip: Enter step-by-step, or single line: <code>CA toAddress amount</code>\n` +
          `❌ Type /cancel to cancel.`,
      { parse_mode: 'HTML' }
    );
  }

  if (data === 'show_tokens' || data === 'show_token') {
    await ctx.answerCallbackQuery();
    user.pendingAction = { type: 'query_ca' };
    return ctx.reply(
      I18nService.t('msg.enterTokenDisplay', user.lang)
    );
  }

  // 识别到钱包地址后的快捷转账
  if (data.startsWith('transfer_to_')) {
    await ctx.answerCallbackQuery();
    const toAddr = data.replace('transfer_to_', '').trim();
    await syncWalletBalances(user, user.activeChain);
    const targetWallets = getUserWallets(user, user.activeChain);
    const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];
    const currentBalance = targetWallet?.balance || 0;
    const nativeSymbol = MainMenu.getChainNativeSymbol(user.activeChain);

    user.pendingAction = {
      type: 'transfer_native_amount',
      data: { toAddress: toAddr }
    };

    return ctx.reply(
      I18nService.t('msg.transferTargetRecorded', user.lang, { toAddr, balance: currentBalance, symbol: nativeSymbol }),
      { parse_mode: 'HTML' }
    );
  }

  // 识别到钱包地址后的快捷跟单
  if (data.startsWith('copy_add_')) {
    await ctx.answerCallbackQuery();
    const targetAddr = data.replace('copy_add_', '').trim();
    user.pendingAction = undefined;

    if (!user.monitoredWallets.includes(targetAddr)) {
      user.monitoredWallets.push(targetAddr);
      saveUserStore();
    }

    return ctx.reply(
      I18nService.t('msg.copyTargetAdded', user.lang, { targetAddr, chain: MainMenu.getChainDisplayName(user.activeChain) }),
      { parse_mode: 'HTML' }
    );
  }

  // K. 💳 钱包管理 (setting)
  if (data === 'setting') {
    await ctx.answerCallbackQuery();
    return ctx.editMessageText(WalletMenu.renderText(user.activeChain, wallets, user.lang), {
      reply_markup: WalletMenu.renderKeyboard(wallets, user.lang, user.activeChain),
      parse_mode: 'HTML'
    });
  }

  if (data === 'switch_wallet') {
    if (wallets.length <= 1) {
      return ctx.answerCallbackQuery({ text: I18nService.t('msg.onlyOneWallet', user.lang) });
    }
    const currentIdx = wallets.findIndex(w => w.isDefault);
    wallets.forEach(w => (w.isDefault = false));
    const nextIdx = (currentIdx + 1) % wallets.length;
    wallets[nextIdx].isDefault = true;
    await ctx.answerCallbackQuery({ text: `Switched to Wallet_${wallets[nextIdx].index + 1}` });
    return ctx.editMessageText(WalletMenu.renderText(user.activeChain, wallets, user.lang), {
      reply_markup: WalletMenu.renderKeyboard(wallets, user.lang, user.activeChain),
      parse_mode: 'HTML'
    });
  }

  if (data === 'rename_wallet') {
    await ctx.answerCallbackQuery();
    if (activeWallet) {
      user.pendingAction = {
        type: 'rename_wallet',
        data: { address: activeWallet.address, chain: user.activeChain }
      };
    }
    return ctx.reply(I18nService.t('msg.enterNewLabel', user.lang));
  }

  if (data === 'export_private_key') {
    await ctx.answerCallbackQuery();
    if (ctx.chat?.type !== 'private' || !activeWallet?.privateKey) return;
    const { randomBytes } = await import('node:crypto');
    const nonce = randomBytes(16).toString('hex');
    keyExportRequests.set(user.userId, { nonce, address: activeWallet.address,
      chain: user.activeChain, expires: Date.now() + 60000 });
    const expiry = setTimeout(() => {
      if (keyExportRequests.get(user.userId)?.nonce === nonce) keyExportRequests.delete(user.userId);
    }, 60000);
    expiry.unref();
    return ctx.reply('Exporting shares your private key with Telegram. Confirm within 60 seconds. The key message will be deleted after 30 seconds.', {
      protect_content: true,
      reply_markup: new InlineKeyboard().text('Confirm key export', `confirm_key_export_${nonce}`)
    });
  }

  if (data.startsWith('confirm_key_export_')) {
    await ctx.answerCallbackQuery();
    const request = keyExportRequests.get(user.userId);
    keyExportRequests.delete(user.userId);
    if (ctx.chat?.type !== 'private' || !request || request.expires < Date.now() ||
        data !== `confirm_key_export_${request.nonce}` || request.chain !== user.activeChain ||
        request.address !== activeWallet?.address || !activeWallet.privateKey) return;
    const message = await ctx.reply(activeWallet.privateKey, { protect_content: true });
    const chatId = ctx.chat.id;
    const deletion = setTimeout(() => {
      void ctx.api.deleteMessage(chatId, message.message_id).catch(() => {
        console.error('[Wallet] Key export message deletion failed');
      });
    }, 30000);
    deletion.unref();
    return;
  }

  if (data === 'delete_wallet') {
    if (wallets.length <= 1) {
      return ctx.answerCallbackQuery({ text: I18nService.t('msg.mustKeepOneWallet', user.lang), show_alert: true });
    }
    const idx = wallets.findIndex(w => w.isDefault);
    if (idx !== -1) wallets.splice(idx, 1);
    if (wallets.length > 0) wallets[0].isDefault = true;
    await ctx.answerCallbackQuery({ text: I18nService.t('msg.walletDeleted', user.lang) });
    return ctx.editMessageText(WalletMenu.renderText(user.activeChain, wallets, user.lang), {
      reply_markup: WalletMenu.renderKeyboard(wallets, user.lang, user.activeChain),
      parse_mode: 'HTML'
    });
  }

  if (data === 'wallet_billing' || data === 'billing_refresh') {
    const isRefresh = data === 'billing_refresh';
    if (isRefresh) {
      await ctx.answerCallbackQuery({ text: I18nService.t('msg.billingRefreshed', user.lang) });
    } else {
      await ctx.answerCallbackQuery();
    }
    const targetWallets = getUserWallets(user, user.activeChain);
    const activeWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];
    const billingText = BillingMenu.renderText(user.activeChain, activeWallet, user.transactions || [], user.lang);
    const billingKb = BillingMenu.renderKeyboard(user.activeChain, activeWallet, user.lang);

    if (isRefresh) {
      return ctx.editMessageText(billingText, {
        reply_markup: billingKb,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true }
      });
    }
    return ctx.reply(billingText, {
      reply_markup: billingKb,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    });
  }

  // L. ⚙️ 交易设置 (trade_setting)
  if (data === 'trade_setting') {
    await ctx.answerCallbackQuery();
    return ctx.editMessageText(SettingsMenu.renderText(user.activeChain, user.tradeConfig, user.lang), {
      reply_markup: SettingsMenu.renderKeyboard(user.activeChain, user.tradeConfig, user.lang),
      parse_mode: 'HTML'
    });
  }

  if (data === 'set_mode_fast') {
    user.tradeConfig.mode = 'fast';
    await ctx.answerCallbackQuery({ text: I18nService.t('msg.fastModeSwitched', user.lang) });
    return ctx.editMessageText(SettingsMenu.renderText(user.activeChain, user.tradeConfig, user.lang), {
      reply_markup: SettingsMenu.renderKeyboard(user.activeChain, user.tradeConfig, user.lang),
      parse_mode: 'HTML'
    });
  }

  if (data === 'set_mode_normal') {
    user.tradeConfig.mode = 'normal';
    await ctx.answerCallbackQuery({ text: I18nService.t('msg.normalModeSwitched', user.lang) });
    return ctx.editMessageText(SettingsMenu.renderText(user.activeChain, user.tradeConfig, user.lang), {
      reply_markup: SettingsMenu.renderKeyboard(user.activeChain, user.tradeConfig, user.lang),
      parse_mode: 'HTML'
    });
  }

  if (data === 'set_tip') {
    await ctx.answerCallbackQuery();
    user.pendingAction = { type: 'set_tip' };
    return ctx.reply(
      I18nService.t('msg.enterGasTip', user.lang, { symbol: nativeSymbol })
    );
  }

  if (data === 'set_slippage') {
    const sls = [10, 20, 50, 100];
    const curIdx = sls.indexOf(user.tradeConfig.slippage);
    user.tradeConfig.slippage = sls[(curIdx + 1) % sls.length];
    await ctx.answerCallbackQuery({ text: `Slippage: ${user.tradeConfig.slippage}%` });
    return ctx.editMessageText(SettingsMenu.renderText(user.activeChain, user.tradeConfig, user.lang), {
      reply_markup: SettingsMenu.renderKeyboard(user.activeChain, user.tradeConfig, user.lang),
      parse_mode: 'HTML'
    });
  }

  if (data.startsWith('set_buy_')) {
    await ctx.answerCallbackQuery();
    const idx = parseInt(data.replace('set_buy_', '')) - 1;
    user.pendingAction = {
      type: 'set_buy_preset',
      data: { index: isNaN(idx) ? 0 : idx }
    };
    return ctx.reply(I18nService.t('msg.enterPreset', user.lang));
  }

  if (data.startsWith('set_sell_')) {
    await ctx.answerCallbackQuery();
    const idx = parseInt(data.replace('set_sell_', '')) - 1;
    user.pendingAction = {
      type: 'set_sell_preset',
      data: { index: isNaN(idx) ? 0 : idx }
    };
    return ctx.reply(I18nService.t('msg.enterPreset', user.lang));
  }

  // M. 🎁 邀请奖励 (referral)
  if (data === 'referral' || data === 'referral_refresh') {
    await ctx.answerCallbackQuery({ text: I18nService.t('msg.refreshedData', user.lang) });
    return ctx.editMessageText(ReferralMenu.renderText(user.userId, user.activeChain, { invitedCount: user.invitedCount, tradedUsersCount: user.tradedUsersCount, tradeCount: user.tradeCount, tradeVolume: user.tradeVolume, totalEarned: user.totalEarned, claimableAmount: user.claimableCommission, claimedAmount: user.claimedCommission }, user.lang), {
      reply_markup: ReferralMenu.renderKeyboard(user.lang),
      parse_mode: 'HTML'
    });
  }

  if (data === 'claim_referral') {
    if (user.claimableCommission <= 0) {
      return ctx.answerCallbackQuery({ text: I18nService.t('msg.noClaimable', user.lang), show_alert: true });
    }
    if (activeWallet) {
      activeWallet.balance += user.claimableCommission;
      user.claimedCommission = (user.claimedCommission || 0) + user.claimableCommission;
      user.claimableCommission = 0;
      saveUserStore();
    }
    await ctx.answerCallbackQuery({ text: I18nService.t('msg.claimedSuccess', user.lang), show_alert: true });
    return ctx.editMessageText(ReferralMenu.renderText(user.userId, user.activeChain, { invitedCount: user.invitedCount, tradedUsersCount: user.tradedUsersCount, tradeCount: user.tradeCount, tradeVolume: user.tradeVolume, totalEarned: user.totalEarned, claimableAmount: user.claimableCommission, claimedAmount: user.claimedCommission }, user.lang), {
      reply_markup: ReferralMenu.renderKeyboard(user.lang),
      parse_mode: 'HTML'
    });
  }

  // N. 📌 限价单 (limit_order_list)
  if (data === 'limit_order_list' || data === 'limit_refresh') {
    await ctx.answerCallbackQuery({ text: I18nService.t('msg.limitRefreshed', user.lang) });
    return ctx.editMessageText(LimitOrderMenu.renderText(activeWallet, user.limitOrders, user.lang, user.activeChain), {
      reply_markup: LimitOrderMenu.renderKeyboard(user.lang),
      parse_mode: 'HTML'
    });
  }

  if (data === 'limit_add' || data.startsWith('lmt_') || data.startsWith('limit_order_')) {
    await ctx.answerCallbackQuery();
    user.pendingAction = {
      type: 'add_limit_order',
      data: { chain: user.activeChain }
    };
    return ctx.reply(
      I18nService.t('msg.enterLimitOrder', user.lang),
      { parse_mode: 'HTML' }
    );
  }

  // O. 监听群发 (@wchjbot) & 🛠️ 开发技术支持
  if (data === 'auto_trade_bot' || data === 'free_source' || data === 'monitor_broadcast') {
    await ctx.answerCallbackQuery();
    return ctx.reply('<b>监听群发</b>：请访问 Telegram 机器人 <a href="https://t.me/wchjbot">@wchjbot</a>', {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    });
  }

  if (data === 'minifutures' || data === 'dev_support') {
    await ctx.answerCallbackQuery();
    return ctx.reply('🛠️ <b>TG机器人开发 / 群发引流 / Web3技术支持</b>：<a href="https://t.me/biqrxnxiYW/667">https://t.me/biqrxnxiYW/667</a>', {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    });
  }

  // P. 代币交易控制台刷新 (mr?...)
  if (data.startsWith('mr?')) {
    const rawToken = data.replace('mr?', '');
    const ca = TokenKeyHelper.toAddress(rawToken);
    const targetChain = resolveChainForToken(ca, user.activeChain);
    // 立即应答回调提示正在刷新，解除前端按钮等待
    await ctx.answerCallbackQuery({ text: I18nService.t('msg.refreshingLive', user.lang) }).catch(() => {});
    // 并发请求余额、持仓与市场数据，大幅缩短刷新耗时
    const [, , market] = await Promise.all([
      syncWalletBalances(user, targetChain),
      syncTokenHoldings(user, targetChain, ca),
      TokenMarketService.fetchTokenDetails(ca, targetChain)
    ]);
    const lowerCa = ca.toLowerCase();
    const holdingObj = user.tokenHoldings.get(lowerCa);
    const userHolding = holdingObj ? holdingObj.amount : 0;
    const userHoldingNative = holdingObj ? holdingObj.costNative : 0;
    const boughtNative = holdingObj?.totalBoughtNative ?? userHoldingNative;
    const soldNative = holdingObj?.totalSoldNative ?? 0;
    const targetWallets = getUserWallets(user, targetChain);
    const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];

    let currentPriceNative = market.priceNative > 0 ? market.priceNative : 0;
    if (currentPriceNative <= 0 && market.priceUsd > 0 && market.nativePriceUsd > 0) {
      currentPriceNative = market.priceUsd / market.nativePriceUsd;
    }
    const entryPriceNative = (userHolding > 0 && boughtNative > 0)
      ? (holdingObj?.costNative ?? boughtNative) / userHolding
      : 0;
    if (currentPriceNative <= 0) {
      currentPriceNative = entryPriceNative;
    }

    let pnlNative = 0;
    let pnlPct = 0;
    if (boughtNative > 0) {
      const holdingVal = userHolding * currentPriceNative;
      pnlNative = (holdingVal + soldNative) - boughtNative;
      if (Math.abs(currentPriceNative - entryPriceNative) / (entryPriceNative || 1) < 0.0005) {
        pnlNative = 0;
        pnlPct = 0;
      } else {
        pnlPct = (pnlNative / boughtNative) * 100;
      }
    }

    const botUser = bot.botInfo?.username || 'whitecat_doge_yr3ybv_bot';
    const text = TradeMenu.renderText({
      market,
      chain: targetChain,
      walletName: targetWallet ? `Wallet_${targetWallet.index + 1}` : 'Wallet_1',
      walletAddress: targetWallet ? targetWallet.address : '0x0000000000000000000000000000000000000000',
      walletBalance: targetWallet ? targetWallet.balance : 0,
      userHolding,
      userHoldingNative,
      pnlNative,
      pnlPct,
      lang: user.lang,
      userId: user.userId,
      botUsername: botUser
    });
    return ctx.editMessageText(text, {
      reply_markup: TradeMenu.renderKeyboard(targetChain, ca, user.lang, user.tradeConfig),
      parse_mode: 'HTML'
    });
  }

  // Q. 买入操作指令响应 (Fast Buy)
  if (data.startsWith('buy_') && !data.startsWith('buy_x_') || data.startsWith('mbac?')) {
    let rawToken = '';
    let presetIdx = 1;
    let explicitBuyAmount: number | null = null;
    let embeddedChain: string | null = null;

    if (data.startsWith('mbac?')) {
      const payload = data.replace('mbac?', '');
      const parts = payload.includes('&') ? payload.split('&') : payload.split('-');
      rawToken = parts[0];
      const parsedVal = parseFloat(parts[1]);
      if (!isNaN(parsedVal) && parsedVal > 0) {
        if (parsedVal > 10) {
          presetIdx = 1;
        } else {
          explicitBuyAmount = parsedVal;
        }
      }
    } else {
      const rest = data.replace(/^buy_/, '');
      const lastUnderscore = rest.lastIndexOf('_');
      if (lastUnderscore !== -1) {
        const lastPart = rest.slice(lastUnderscore + 1);
        const parsedIdx = parseInt(lastPart, 10);
        if (!isNaN(parsedIdx)) {
          presetIdx = parsedIdx;
          const tokenPart = rest.slice(0, lastUnderscore);
          const firstUnderscore = tokenPart.indexOf('_');
          if (firstUnderscore !== -1) {
            const possibleChain = tokenPart.slice(0, firstUnderscore).toLowerCase();
            const supportedChains = ['bsc', 'robinhood', 'arc', 'ethereum', 'base', 'solana', 'sui', 'ton', 'xlayer', 'sei', 'aptos'];
            if (supportedChains.includes(possibleChain)) {
              embeddedChain = possibleChain;
              rawToken = tokenPart.slice(firstUnderscore + 1);
            } else {
              rawToken = tokenPart;
            }
          } else {
            rawToken = tokenPart;
          }
        } else {
          rawToken = rest;
        }
      } else {
        rawToken = rest;
      }
    }

    const tokenAddress = TokenKeyHelper.toAddress(rawToken);
    if (embeddedChain && embeddedChain.toLowerCase() !== user.activeChain.toLowerCase()) {
      await ctx.answerCallbackQuery({
        text: (user.lang && user.lang.startsWith('zh'))
          ? `⚠️ 此按钮属于 ${MainMenu.getChainDisplayName(embeddedChain)}，与当前激活网络(${MainMenu.getChainDisplayName(user.activeChain)})不符，请刷新面板。`
          : `⚠️ This button belongs to ${MainMenu.getChainDisplayName(embeddedChain)}, not active network (${MainMenu.getChainDisplayName(user.activeChain)}). Please refresh.`,
        show_alert: true
      });
      return;
    }
    const targetChain = (embeddedChain || resolveChainForToken(tokenAddress, user.activeChain)).toLowerCase();
    const chainSymbol = MainMenu.getChainNativeSymbol(targetChain);

    const solPresets = [0.1, 0.5, 1, 2, 5];
    const suiPresets = [0.05, 0.1, 0.2, 0.5, 1];
    const arcPresets = SettingsMenu.getEffectiveBuyPresets('arc', user.tradeConfig);
    const bscPresets = user.tradeConfig.buyPresets || [0.02, 0.05, 0.1, 0.2, 0.5];

    let buyAmount = explicitBuyAmount !== null
      ? explicitBuyAmount
      : (targetChain === 'solana'
          ? (solPresets[presetIdx - 1] || 0.1)
          : targetChain === 'sui'
          ? (suiPresets[presetIdx - 1] || 0.1)
          : targetChain === 'arc'
          ? (arcPresets[presetIdx - 1] || 10)
          : (bscPresets[presetIdx - 1] || 0.02));

    const targetWallets = getUserWallets(user, targetChain);
    const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];

    // 优先基于内存/缓存余额做即时判断，避免无谓转圈等待
    if (!targetWallet || (targetWallet.balance !== undefined && targetWallet.balance < buyAmount)) {
      await syncWalletBalances(user, targetChain);
      if (!targetWallet || (targetWallet.balance || 0) < buyAmount) {
        await ctx.answerCallbackQuery({ text: I18nService.t('msg.insufficientBalance', user.lang), show_alert: true });
        return ctx.reply(I18nService.t('msg.insufficientBalance', user.lang));
      }
    }

    // 立即应答极速执行 Toast，彻底消除前端按钮转圈等待
    await ctx.answerCallbackQuery({ text: I18nService.t('msg.turboExecuting', user.lang) }).catch(() => {});

    const result = await OnChainSwapService.executeFastBuy({
      userId: user.userId,
      chain: targetChain,
      walletAddress: targetWallet.address,
      privateKey: targetWallet.privateKey,
      tokenAddress,
      amountNative: buyAmount,
      slippagePct: user.tradeConfig.slippage,
      priorityFeeTier: user.tradeConfig.mode === 'fast' ? 'turbo' : 'normal',
      gasTip: SettingsMenu.getEffectiveTip(targetChain, user.tradeConfig)
    });

    if (result.status === 'PENDING') {
      return ctx.reply(`PENDING: ${result.txHash}\nTransaction broadcast; confirmation pending. Do not resubmit.`);
    }
    if (result.status !== 'SUCCESS' || result.error) {
      let failMsg = I18nService.t('msg.buyFailed', user.lang, { error: result.error || 'Execution failed' });
      if (result.txHash && result.txHash.startsWith('0x')) {
        const txUrl = getChainTxUrl(targetChain, result.txHash);
        const shortHash = result.txHash.length > 20 ? `${result.txHash.slice(0, 10)}...${result.txHash.slice(-8)}` : result.txHash;
        failMsg += `\n\n🔗 交易哈希: <a href="${txUrl}">${shortHash}</a> (链上回滚 Reverted)`;
      }
      return ctx.reply(failMsg, { parse_mode: 'HTML' });
    }

    const lowerCa = tokenAddress.toLowerCase();
    const existingHolding = user.tokenHoldings.get(lowerCa);
    const prevAmount = existingHolding ? existingHolding.amount : 0;
    const prevCost = existingHolding ? existingHolding.costNative : 0;
    const prevBought = existingHolding?.totalBoughtNative ?? prevCost;
    const prevSold = existingHolding?.totalSoldNative ?? 0;

    user.tokenHoldings.set(lowerCa, {
      tokenAddress,
      chain: targetChain,
      symbol: result.tokenSymbol || existingHolding?.symbol || 'TOKEN',
      name: result.tokenName || existingHolding?.name || 'Token',
      amount: prevAmount + result.estimatedAmountOut,
      costNative: parseFloat((prevCost + buyAmount).toFixed(4)),
      totalBoughtNative: parseFloat((prevBought + buyAmount).toFixed(4)),
      totalSoldNative: prevSold
    });

    ChainBalanceService.invalidateCache(targetChain, targetWallet.address);
    if (result.isRealOnChain) {
      targetWallet.balance = parseFloat(Math.max((targetWallet.balance || 0) - buyAmount, 0).toFixed(4));
      await new Promise(r => setTimeout(r, 1500));
      await syncWalletBalances(user, targetChain);
      await syncTokenHoldings(user, targetChain, tokenAddress);
    } else {
      targetWallet.balance = parseFloat(Math.max((targetWallet.balance || 0) - buyAmount, 0).toFixed(4));
    }

    processTradeReferralAndFee(user, buyAmount);
    recordUserTransaction(user, {
      chain: targetChain,
      type: 'BUY',
      walletAddress: targetWallet.address,
      tokenAddress,
      tokenSymbol: result.tokenSymbol || 'TOKEN',
      tokenName: result.tokenName || 'Token',
      amountNative: buyAmount,
      amountToken: result.estimatedAmountOut,
      txHash: result.txHash,
      isRealOnChain: result.isRealOnChain
    });
    saveUserStore();

    const txUrl = getChainTxUrl(targetChain, result.txHash);
    const shortTxHash = result.txHash.length > 20
      ? `${result.txHash.slice(0, 10)}...${result.txHash.slice(-8)}`
      : result.txHash;

    if (isZh) {
      return ctx.reply(
        `🚀 <b>交易已提交并打包完成！</b>\n\n` +
        `🪙 代币: <code>${tokenAddress}</code>\n` +
        `💸 消耗: <b>${buyAmount} ${chainSymbol}</b>\n` +
        `📈 获得: <b>≈${result.estimatedAmountOut.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${result.tokenSymbol}</b>\n` +
        `⛽ 耗时: <b>${result.executionTimeMs} ms</b> (纳秒级撮合${result.isRealOnChain ? ' · 真实链上成交' : ''})\n` +
        `🔗 交易哈希: <a href="${txUrl}">${shortTxHash}</a>\n\n` +
        `💳 当前钱包余额: <b>${targetWallet.balance} ${chainSymbol}</b>`,
        { parse_mode: 'HTML' }
      );
    }

    return ctx.reply(
      `🚀 <b>Transaction executed & confirmed!</b>\n\n` +
      `🪙 Token: <code>${tokenAddress}</code>\n` +
      `💸 Spent: <b>${buyAmount} ${chainSymbol}</b>\n` +
      `📈 Received: <b>≈${result.estimatedAmountOut.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${result.tokenSymbol}</b>\n` +
      `⛽ Latency: <b>${result.executionTimeMs} ms</b> (Turbo matching${result.isRealOnChain ? ' · On-chain' : ''})\n` +
      `🔗 Tx Hash: <a href="${txUrl}">${shortTxHash}</a>\n\n` +
      `💳 Current Balance: <b>${targetWallet.balance} ${chainSymbol}</b>`,
      { parse_mode: 'HTML' }
    );
  }

  // R. 购买 X {Symbol} (buy_x_... 或 mbai?...)
  if (data.startsWith('buy_x_') || data.startsWith('mbai?')) {
    let rawToken = '';
    let embeddedChain: string | null = null;
    if (data.startsWith('mbai?')) {
      rawToken = data.replace('mbai?', '');
    } else {
      const rest = data.replace('buy_x_', '');
      const parts = rest.split('_');
      if (parts.length >= 2 && !rest.startsWith('tk_')) {
        embeddedChain = parts[0];
        rawToken = parts.slice(1).join('_');
      } else {
        rawToken = rest;
      }
    }
    const tokenAddress = TokenKeyHelper.toAddress(rawToken);
    if (embeddedChain && embeddedChain.toLowerCase() !== user.activeChain.toLowerCase()) {
      await ctx.answerCallbackQuery({
        text: (user.lang && user.lang.startsWith('zh'))
          ? `⚠️ 此按钮属于 ${MainMenu.getChainDisplayName(embeddedChain)}，与当前激活网络(${MainMenu.getChainDisplayName(user.activeChain)})不符，请刷新面板。`
          : `⚠️ This button belongs to ${MainMenu.getChainDisplayName(embeddedChain)}, not active network (${MainMenu.getChainDisplayName(user.activeChain)}). Please refresh.`,
        show_alert: true
      });
      return;
    }
    const targetChain = (embeddedChain || resolveChainForToken(tokenAddress, user.activeChain)).toLowerCase();
    // 立即应答回调释放按钮状态，后台预热更新余额
    await ctx.answerCallbackQuery().catch(() => {});
    syncWalletBalances(user, targetChain).catch(() => {});
    const chainSymbol = MainMenu.getChainNativeSymbol(targetChain);

    user.pendingAction = {
      type: 'buy_x',
      data: { tokenAddress, chain: targetChain }
    };

    return ctx.reply(
      I18nService.t('msg.enterBuyAmount', user.lang, { chainSymbol: chainSymbol })
    );
  }

  // S. 卖出操作指令响应 (Fast Sell 50% / 100%)
  if (data.startsWith('sell_') && !data.startsWith('sell_x_') || data.startsWith('msac?')) {
    let rawToken = '';
    let sellPct = 50;
    let embeddedChain: string | null = null;

    if (data.startsWith('msac?')) {
      const payload = data.replace('msac?', '');
      const parts = payload.includes('&') ? payload.split('&') : payload.split('-');
      rawToken = parts[0];
      sellPct = parseInt(parts[1]) || 50;
    } else {
      const rest = data.replace(/^sell_/, '');
      const lastUnderscore = rest.lastIndexOf('_');
      if (lastUnderscore !== -1) {
        const lastPart = rest.slice(lastUnderscore + 1);
        const parsedPct = parseInt(lastPart, 10);
        if (!isNaN(parsedPct)) {
          sellPct = parsedPct;
          const tokenPart = rest.slice(0, lastUnderscore);
          const firstUnderscore = tokenPart.indexOf('_');
          if (firstUnderscore !== -1) {
            const possibleChain = tokenPart.slice(0, firstUnderscore).toLowerCase();
            const supportedChains = ['bsc', 'robinhood', 'arc', 'ethereum', 'base', 'solana', 'sui', 'ton', 'xlayer', 'sei', 'aptos'];
            if (supportedChains.includes(possibleChain)) {
              embeddedChain = possibleChain;
              rawToken = tokenPart.slice(firstUnderscore + 1);
            } else {
              rawToken = tokenPart;
            }
          } else {
            rawToken = tokenPart;
          }
        } else {
          rawToken = rest;
        }
      } else {
        rawToken = rest;
      }
    }

    const tokenAddress = TokenKeyHelper.toAddress(rawToken);
    if (embeddedChain && embeddedChain.toLowerCase() !== user.activeChain.toLowerCase()) {
      await ctx.answerCallbackQuery({
        text: (user.lang && user.lang.startsWith('zh'))
          ? `⚠️ 此按钮属于 ${MainMenu.getChainDisplayName(embeddedChain)}，与当前激活网络(${MainMenu.getChainDisplayName(user.activeChain)})不符，请刷新面板。`
          : `⚠️ This button belongs to ${MainMenu.getChainDisplayName(embeddedChain)}, not active network (${MainMenu.getChainDisplayName(user.activeChain)}). Please refresh.`,
        show_alert: true
      });
      return;
    }
    const targetChain = (embeddedChain || resolveChainForToken(tokenAddress, user.activeChain)).toLowerCase();
    const chainSymbol = MainMenu.getChainNativeSymbol(targetChain);
    const targetWallets = getUserWallets(user, targetChain);
    const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];

    const lowerCa = tokenAddress.toLowerCase();
    let holdingObj = user.tokenHoldings.get(lowerCa) || user.tokenHoldings.get(tokenAddress);
    let holding = holdingObj ? holdingObj.amount : 0;
    if (holding <= 0) {
      await syncTokenHoldings(user, targetChain, tokenAddress);
      holdingObj = user.tokenHoldings.get(lowerCa) || user.tokenHoldings.get(tokenAddress);
      holding = holdingObj ? holdingObj.amount : 0;
    }
    if (holding <= 0) {
      await ctx.answerCallbackQuery({ text: I18nService.t('msg.insufficientBalance', user.lang), show_alert: true });
      return ctx.reply(I18nService.t('msg.insufficientBalance', user.lang));
    }

    // 立即应答卖出执行 Toast，彻底消除前端按钮转圈等待
    await ctx.answerCallbackQuery({ text: I18nService.t('msg.sellingExecuting', user.lang) }).catch(() => {});
    await syncWalletBalances(user, targetChain);

    const result = await OnChainSwapService.executeFastSell({
      userId: user.userId,
      chain: targetChain,
      walletAddress: targetWallet ? targetWallet.address : '0x0',
      privateKey: targetWallet?.privateKey,
      tokenAddress,
      sellPercentage: sellPct,
      sellInitial: false,
      totalTokenBalance: holding,
      costBasisNative: holdingObj?.costNative || 0.1,
      slippagePct: user.tradeConfig.slippage,
      gasTip: SettingsMenu.getEffectiveTip(targetChain, user.tradeConfig)
    });

    if (result.status === 'PENDING') {
      return ctx.reply(`PENDING: ${result.txHash}\nTransaction broadcast; confirmation pending. Do not resubmit.`);
    }
    if (result.status !== 'SUCCESS' || result.error) {
      let failMsg = I18nService.t('msg.sellFailed', user.lang, { error: result.error || 'Execution failed' });
      if (result.txHash && result.txHash.startsWith('0x')) {
        const txUrl = getChainTxUrl(targetChain, result.txHash);
        const shortHash = result.txHash.length > 20 ? `${result.txHash.slice(0, 10)}...${result.txHash.slice(-8)}` : result.txHash;
        failMsg += `\n\n🔗 交易哈希: <a href="${txUrl}">${shortHash}</a> (链上回滚 Reverted)`;
      }
      return ctx.reply(failMsg, { parse_mode: 'HTML' });
    }

    const remainingTokens = holding * (1 - sellPct / 100);
    if (remainingTokens <= 0.0001) {
      user.tokenHoldings.delete(lowerCa);
    } else if (holdingObj) {
      holdingObj.amount = remainingTokens;
      holdingObj.costNative = parseFloat((holdingObj.costNative * (1 - sellPct / 100)).toFixed(4));
      holdingObj.totalSoldNative = parseFloat(((holdingObj.totalSoldNative ?? 0) + result.estimatedAmountOut).toFixed(4));
      user.tokenHoldings.set(lowerCa, holdingObj);
    }

    ChainBalanceService.invalidateCache(targetChain, targetWallet.address);
    if (result.isRealOnChain) {
      if (targetWallet && result.estimatedAmountOut > 0) {
        targetWallet.balance = parseFloat(((targetWallet.balance || 0) + result.estimatedAmountOut).toFixed(4));
      }
      await new Promise(r => setTimeout(r, 1500));
      await syncWalletBalances(user, targetChain);
      await syncTokenHoldings(user, targetChain, tokenAddress);
    } else {
      if (targetWallet) {
        targetWallet.balance = parseFloat(((targetWallet.balance || 0) + result.estimatedAmountOut).toFixed(4));
      }
    }

    const soldAmount = holding * (sellPct / 100);
    processTradeReferralAndFee(user, result.estimatedAmountOut);
    recordUserTransaction(user, {
      chain: targetChain,
      type: 'SELL',
      walletAddress: targetWallet ? targetWallet.address : '0x0',
      tokenAddress,
      tokenSymbol: result.tokenSymbol || 'TOKEN',
      tokenName: result.tokenName || 'Token',
      amountNative: result.estimatedAmountOut,
      amountToken: soldAmount,
      txHash: result.txHash,
      isRealOnChain: result.isRealOnChain
    });
    saveUserStore();

    const txUrl = getChainTxUrl(targetChain, result.txHash);
    const shortTxHash = result.txHash.length > 20
      ? `${result.txHash.slice(0, 10)}...${result.txHash.slice(-8)}`
      : result.txHash;

    if (isZh) {
      return ctx.reply(
        `⚡ <b>代币出售成功并已回款！</b>\n\n` +
        `🪙 代币: <code>${tokenAddress}</code>\n` +
        `📉 出售: <b>${sellPct}% (${soldAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${result.tokenSymbol})</b>\n` +
        `💰 收到: <b>≈${result.estimatedAmountOut.toFixed(4)} ${chainSymbol}</b>\n` +
        `⛽ 耗时: <b>${result.executionTimeMs} ms</b>\n` +
        `🔗 交易哈希: <a href="${txUrl}">${shortTxHash}</a>\n\n` +
        `💳 当前钱包余额: <b>${targetWallet ? targetWallet.balance : 0} ${chainSymbol}</b>`,
        { parse_mode: 'HTML' }
      );
    }

    return ctx.reply(
      `⚡ <b>Tokens sold successfully!</b>\n\n` +
      `🪙 Token: <code>${tokenAddress}</code>\n` +
      `📉 Sold: <b>${sellPct}% (${soldAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${result.tokenSymbol})</b>\n` +
      `💰 Received: <b>≈${result.estimatedAmountOut.toFixed(4)} ${chainSymbol}</b>\n` +
      `⛽ Latency: <b>${result.executionTimeMs} ms</b>\n` +
      `🔗 Tx Hash: <a href="${txUrl}">${shortTxHash}</a>\n\n` +
      `💳 Current Balance: <b>${targetWallet ? targetWallet.balance : 0} ${chainSymbol}</b>`,
      { parse_mode: 'HTML' }
    );
  }

  // T. 出售 X % (sell_x_... 或 msai?...)
  if (data.startsWith('sell_x_') || data.startsWith('msai?')) {
    let rawToken = '';
    let embeddedChain: string | null = null;
    if (data.startsWith('msai?')) {
      rawToken = data.replace('msai?', '');
    } else {
      const rest = data.replace('sell_x_', '');
      const parts = rest.split('_');
      if (parts.length >= 2 && !rest.startsWith('tk_')) {
        embeddedChain = parts[0];
        rawToken = parts.slice(1).join('_');
      } else {
        rawToken = rest;
      }
    }
    const tokenAddress = TokenKeyHelper.toAddress(rawToken);
    if (embeddedChain && embeddedChain.toLowerCase() !== user.activeChain.toLowerCase()) {
      await ctx.answerCallbackQuery({
        text: (user.lang && user.lang.startsWith('zh'))
          ? `⚠️ 此按钮属于 ${MainMenu.getChainDisplayName(embeddedChain)}，与当前激活网络(${MainMenu.getChainDisplayName(user.activeChain)})不符，请刷新面板。`
          : `⚠️ This button belongs to ${MainMenu.getChainDisplayName(embeddedChain)}, not active network (${MainMenu.getChainDisplayName(user.activeChain)}). Please refresh.`,
        show_alert: true
      });
      return;
    }
    const targetChain = (embeddedChain || resolveChainForToken(tokenAddress, user.activeChain)).toLowerCase();
    await syncWalletBalances(user, targetChain);

    await ctx.answerCallbackQuery();
    user.pendingAction = {
      type: 'sell_x',
      data: { tokenAddress, chain: targetChain }
    };
    return ctx.reply(
      I18nService.t('msg.enterSellPercent', user.lang)
    );
  }

  // U. 翻倍出本 (tp1_... 或 lshc?...)
  if (data.startsWith('tp1_') || data.startsWith('tp_100_') || data.startsWith('lshc?')) {
    const rawToken = data.startsWith('lshc?')
      ? data.replace('lshc?', '')
      : data.startsWith('tp1_')
      ? data.replace('tp1_', '')
      : data.replace('tp_100_', '');
    const tokenAddress = TokenKeyHelper.toAddress(rawToken);
    const lowerCa = tokenAddress.toLowerCase();
    const holdingObj = user.tokenHoldings.get(lowerCa);
    const holding = holdingObj ? holdingObj.amount : 0;
    if (holding <= 0) {
      await ctx.answerCallbackQuery({ text: I18nService.t('msg.insufficientBalance', user.lang), show_alert: true });
      return ctx.reply(I18nService.t('msg.insufficientBalance', user.lang));
    }
    let entryPrice = 0;
    if (holdingObj && holdingObj.costNative > 0 && holdingObj.amount > 0) {
      entryPrice = holdingObj.costNative / holdingObj.amount;
    } else {
      const details = await TokenMarketService.fetchTokenDetails(tokenAddress, user.activeChain);
      entryPrice = details.priceNative > 0 ? details.priceNative : 0.0001;
    }
    const triggerPrice = entryPrice * 2;
    user.limitOrders.push({
      id: `tp1_${Date.now()}`,
      tokenAddress,
      symbol: holdingObj?.symbol || 'TOKEN',
      orderType: 'SELL',
      triggerPrice,
      amount: holding * 0.5,
      chain: user.activeChain,
      baseCurrency: user.activeChain.toLowerCase() === 'arc' ? 'USDC' : 'USD',
      createdAt: Date.now()
    });
    saveUserStore();
    await ctx.answerCallbackQuery();
    return ctx.reply(
      I18nService.t('msg.tpOrderPlaced', user.lang),
      { parse_mode: 'HTML' }
    );
  }

  // V. 十倍清仓 (tp2_... 或 lsac?...)
  if (data.startsWith('tp2_') || data.startsWith('tp_999_') || data.startsWith('lsac?')) {
    const rawToken = data.startsWith('lsac?')
      ? data.replace('lsac?', '')
      : data.startsWith('tp2_')
      ? data.replace('tp2_', '')
      : data.replace('tp_999_', '');
    const tokenAddress = TokenKeyHelper.toAddress(rawToken);
    const lowerCa = tokenAddress.toLowerCase();
    const holdingObj = user.tokenHoldings.get(lowerCa);
    const holding = holdingObj ? holdingObj.amount : 0;
    if (holding <= 0) {
      await ctx.answerCallbackQuery({ text: I18nService.t('msg.insufficientBalance', user.lang), show_alert: true });
      return ctx.reply(I18nService.t('msg.insufficientBalance', user.lang));
    }
    let entryPrice = 0;
    if (holdingObj && holdingObj.costNative > 0 && holdingObj.amount > 0) {
      entryPrice = holdingObj.costNative / holdingObj.amount;
    } else {
      const details = await TokenMarketService.fetchTokenDetails(tokenAddress, user.activeChain);
      entryPrice = details.priceNative > 0 ? details.priceNative : 0.0001;
    }
    const triggerPrice = entryPrice * 10;
    user.limitOrders.push({
      id: `tp2_${Date.now()}`,
      tokenAddress,
      symbol: holdingObj?.symbol || 'TOKEN',
      orderType: 'SELL',
      triggerPrice,
      amount: holding,
      chain: user.activeChain,
      baseCurrency: user.activeChain.toLowerCase() === 'arc' ? 'USDC' : 'USD',
      createdAt: Date.now()
    });
    saveUserStore();
    await ctx.answerCallbackQuery();
    return ctx.reply(
      I18nService.t('msg.tp10xOrderPlaced', user.lang),
      { parse_mode: 'HTML' }
    );
  }

  // W. 🔀 切换钱包 (对齐 PinkPunkTradingBot)
  if (data.startsWith('bscw?') || data.startsWith('actw_') || data.startsWith('active_wallet_')) {
    await ctx.answerCallbackQuery();
    const rawToken = data.startsWith('bscw?')
      ? data.replace('bscw?', '')
      : (data.startsWith('actw_') ? data.replace('actw_', '') : data.replace('active_wallet_', ''));
    const tokenAddress = TokenKeyHelper.toAddress(rawToken);
    const targetChain = resolveChainForToken(tokenAddress, user.activeChain);
    const targetWallets = getUserWallets(user, targetChain);

    const title = I18nService.t('trade.switchWalletTitle', user.lang);
    const desc = I18nService.t('trade.switchWalletDesc', user.lang, { count: targetWallets.length });
    const text = `${title}\n\n${desc}`;

    const numEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const kb = new InlineKeyboard();

    targetWallets.forEach((w, idx) => {
      const num = numEmojis[idx] || `${idx + 1}️⃣`;
      const label = `${num} Wallet_${idx + 1}`;
      kb.text(label, `sw_to_${idx}_${rawToken}`);
      if (idx % 2 === 1) kb.row();
    });
    if (targetWallets.length % 2 !== 0) kb.row();

    kb.text(I18nService.t('trade.close', user.lang), 'close_popup');

    return ctx.reply(text, {
      reply_markup: kb,
      parse_mode: 'HTML'
    });
  }

  // 切换具体钱包
  if (data.startsWith('sw_to_')) {
    const parts = data.split('_');
    const walletIdx = parseInt(parts[2], 10);
    const rawToken = parts.slice(3).join('_');
    const tokenAddress = TokenKeyHelper.toAddress(rawToken);
    const targetChain = resolveChainForToken(tokenAddress, user.activeChain);
    const targetWallets = getUserWallets(user, targetChain);

    if (walletIdx >= 0 && walletIdx < targetWallets.length) {
      targetWallets.forEach((w, i) => {
        w.isDefault = (i === walletIdx);
      });
      saveUserStore();
      await ctx.answerCallbackQuery({
        text: I18nService.t('msg.activeWalletChanged', user.lang, { index: walletIdx + 1, chain: MainMenu.getChainDisplayName(targetChain) })
      });
    } else {
      await ctx.answerCallbackQuery();
    }

    const title = I18nService.t('trade.switchWalletTitle', user.lang);
    const desc = I18nService.t('trade.switchWalletDesc', user.lang, { count: targetWallets.length });
    const text = `${title}\n\n${desc}`;

    const numEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const kb = new InlineKeyboard();

    targetWallets.forEach((w, idx) => {
      const num = numEmojis[idx] || `${idx + 1}️⃣`;
      const label = `${num} Wallet_${idx + 1}`;
      kb.text(label, `sw_to_${idx}_${rawToken}`);
      if (idx % 2 === 1) kb.row();
    });
    if (targetWallets.length % 2 !== 0) kb.row();

    kb.text(I18nService.t('trade.close', user.lang), 'close_popup');

    return ctx.editMessageText(text, {
      reply_markup: kb,
      parse_mode: 'HTML'
    }).catch(() => {});
  }

  // 关闭弹出面板
  if (data === 'close_popup' || data === 'del_msg') {
    await ctx.answerCallbackQuery();
    return ctx.deleteMessage().catch(() => {});
  }

  if (data.startsWith('lmt_') || data.startsWith('limit_order_')) {
    await ctx.answerCallbackQuery();
    return ctx.reply(
      I18nService.t('msg.enterLimitOrderSetup', user.lang),
      { parse_mode: 'HTML' }
    );
  }

  if (data.startsWith('pnl_')) {
    await ctx.answerCallbackQuery();
    const rawToken = data.replace('pnl_f_', '').replace('pnl_s_', '').replace('pnl_full_', '').replace('pnl_simple_', '');
    const tokenAddress = TokenKeyHelper.toAddress(rawToken);
    const targetChain = resolveChainForToken(tokenAddress, user.activeChain);
    const chainSymbol = MainMenu.getChainNativeSymbol(targetChain);
    const lowerCa = tokenAddress.toLowerCase();
    const holdingObj = user.tokenHoldings.get(lowerCa);

    const totalBought = holdingObj?.totalBoughtNative ?? holdingObj?.costNative ?? 0;
    const totalSold = holdingObj?.totalSoldNative ?? 0;
    const holdingAmount = holdingObj?.amount ?? 0;
    const tokenSymbol = holdingObj?.symbol || 'TOKEN';

    let currentPriceNative = 0;
    try {
      const market = await TokenMarketService.fetchTokenDetails(tokenAddress, targetChain);
      if (market.priceNative > 0) {
        currentPriceNative = market.priceNative;
      } else if (market.priceUsd > 0 && market.nativePriceUsd > 0) {
        currentPriceNative = market.priceUsd / market.nativePriceUsd;
      }
    } catch (err: any) {
      console.warn('[PnL] Failed to fetch market details:', err?.message);
    }

    const entryPriceNative = (holdingAmount > 0 && totalBought > 0)
      ? (holdingObj?.costNative ?? totalBought) / holdingAmount
      : 0;

    if (currentPriceNative <= 0) {
      currentPriceNative = entryPriceNative;
    }

    const holdingValueNative = holdingAmount * currentPriceNative;
    let pnlNative = 0;
    let pnlPct = 0;
    if (totalBought > 0) {
      pnlNative = (holdingValueNative + totalSold) - totalBought;
      if (Math.abs(currentPriceNative - entryPriceNative) / (entryPriceNative || 1) < 0.0005) {
        pnlNative = 0;
        pnlPct = 0;
      } else {
        pnlPct = (pnlNative / totalBought) * 100;
      }
    }

    try {
      const cardBuffer = await PosterService.generatePnlCard({
        symbol: tokenSymbol,
        chainSymbol,
        pnlPct,
        pnlNative,
        boughtNative: totalBought,
        soldNative: totalSold,
        holdingAmount,
        botUsername: 'whitecat_doge_yr3ybv_bot'
      });

      return ctx.replyWithPhoto(new InputFile(cardBuffer, 'pnl_card.png'), {
        caption: I18nService.t('msg.pnlCard', user.lang, { tokenSymbol: tokenSymbol, chainSymbol: chainSymbol, pct: (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2), pnl: (pnlNative >= 0 ? '+' : '') + pnlNative.toFixed(4) })
      });
    } catch (err: any) {
      console.error('[PosterService] Failed to generate PnL card:', err?.message);
      return ctx.reply(
        `🚀 <b>白猫打狗 · 战绩晒单</b>\n\n` +
        `🪙 代币: <code>${tokenAddress}</code>\n` +
        `📈 当前收益率: <b>${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% ${pnlPct >= 0 ? '🟢' : '🔴'}</b>\n` +
        `💰 累计获利: <b>${pnlNative >= 0 ? '+' : ''}${pnlNative.toFixed(4)} ${chainSymbol}</b>\n\n` +
        `🔗 交易机器人: @whitecat_doge_yr3ybv_bot`,
        { parse_mode: 'HTML' }
      );
    }
  }

  // 其余通用弹窗
  await ctx.answerCallbackQuery();
});

// 4. 消息监听: 处理用户输入 (Pending Actions) 及 代币合约 (CA)
bot.on('message:text', async ctx => {
  
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;
  const user = getOrCreateUser(userId, ctx.from.username);
  const isZh = user.lang === 'zh-hans' || user.lang === 'zh-hant';
  const wallets = getUserWallets(user);
  const activeWallet = wallets.find(w => w.isDefault) || wallets[0];
    const nativeSymbol = MainMenu.getChainNativeSymbol(user.activeChain);

  // 0. 支持用户随时发送 /cancel 或 取消 中断当前等待输入的流程
  if (text === '/cancel' || text === '取消' || text.toLowerCase() === 'cancel') {
    if (user.pendingAction) {
      user.pendingAction = undefined;
      return ctx.reply(I18nService.t('msg.cancelled', user.lang));
    }
  }

  // 0.1 优先捕获底部常驻快捷按钮 (🚀 打开主菜单 | 📊 资产持仓 | 💳 钱包设置)
  if (I18nService.isMainMenuTrigger(text)) {
    user.pendingAction = undefined;
    await syncWalletBalances(user, user.activeChain);
    const wallets = getUserWallets(user);
    return ctx.reply(MainMenu.renderText(user.activeChain, wallets, user.lang), {
      reply_markup: MainMenu.renderKeyboard(wallets, user.lang),
      parse_mode: 'HTML'
    });
  }

  if (I18nService.isAssetTrigger(text)) {
    user.pendingAction = undefined;
    await syncWalletBalances(user, user.activeChain);
    const holdings: TokenHoldingItem[] = [];
    user.tokenHoldings.forEach((holding) => {
      if (holding && holding.amount > 1e-4) {
        const isCurrentChain = !holding.chain || holding.chain.toLowerCase() === user.activeChain.toLowerCase();
        if (isCurrentChain) {
          const nativeVal = holding.costNative || 0.1;
          holdings.push({
            address: holding.tokenAddress,
            symbol: holding.symbol || 'TOKEN',
            balance: holding.amount,
            nativeValue: nativeVal,
            pnlNative: 0,
            pnlPct: 0
          });
        }
      }
    });
    const activeWallet = getUserWallets(user, user.activeChain).find(w => w.isDefault) || getUserWallets(user, user.activeChain)[0];
    if (!activeWallet) {
      return ctx.reply(I18nService.t('msg.noWallet', user.lang));
    }
    return ctx.reply(AssetMenu.renderText(user.activeChain, activeWallet, holdings, user.lang), {
      reply_markup: AssetMenu.renderKeyboard(user.activeChain, holdings, user.lang),
      parse_mode: 'HTML'
    });
  }

  if (I18nService.isWalletTrigger(text)) {
    user.pendingAction = undefined;
    await syncWalletBalances(user, user.activeChain);
    const wallets = getUserWallets(user, user.activeChain);
    return ctx.reply(WalletMenu.renderText(user.activeChain, wallets, user.lang), {
      reply_markup: WalletMenu.renderKeyboard(wallets, user.lang),
      parse_mode: 'HTML'
    });
  }

  // A. 关键修复：优先检查并处理正在等待用户输入的 Pending Actions (不包括单纯查CA)
  if (user.pendingAction && user.pendingAction.type !== 'query_ca') {
    const action = user.pendingAction;

    // 1. 购买 X {Symbol}
    if (action.type === 'buy_x') {
      const amt = parseFloat(text);
      if (isNaN(amt) || amt <= 0) {
        return ctx.reply(I18nService.t('msg.invalidNumber', user.lang));
      }

      const tokenAddress = action.data.tokenAddress;
      const targetChain = (action.data.chain || resolveChainForToken(tokenAddress, user.activeChain)).toLowerCase();
      const chainSymbol = MainMenu.getChainNativeSymbol(targetChain);
      let targetWallets = getUserWallets(user, targetChain);
      let targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];

      // 实时预检链上余额：若缓存缺失或余额小于买入量，主动触发一次链上余额同步
      if (!targetWallet || (targetWallet.balance || 0) < amt) {
        await syncWalletBalances(user, targetChain);
        targetWallets = getUserWallets(user, targetChain);
        targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];
      }

      if (!targetWallet || (targetWallet.balance || 0) < amt) {
        user.pendingAction = undefined;
        return ctx.reply(I18nService.t('msg.insufficientBalance', user.lang));
      }

      user.pendingAction = undefined;

      const result = await OnChainSwapService.executeFastBuy({
        userId: user.userId,
        chain: targetChain,
        walletAddress: targetWallet.address,
        privateKey: targetWallet.privateKey,
        tokenAddress,
        amountNative: amt,
        slippagePct: user.tradeConfig.slippage,
        priorityFeeTier: user.tradeConfig.mode === 'fast' ? 'turbo' : 'normal'
      });

      if (result.status === 'PENDING') {
      return ctx.reply(`PENDING: ${result.txHash}\nTransaction broadcast; confirmation pending. Do not resubmit.`);
    }
    if (result.status !== 'SUCCESS' || result.error) {
        let failMsg = I18nService.t('msg.buyFailed', user.lang, { error: result.error || 'Execution failed' });
        if (result.txHash && result.txHash.startsWith('0x')) {
          const txUrl = getChainTxUrl(targetChain, result.txHash);
          const shortHash = result.txHash.length > 20 ? `${result.txHash.slice(0, 10)}...${result.txHash.slice(-8)}` : result.txHash;
          failMsg += `\n\n🔗 交易哈希: <a href="${txUrl}">${shortHash}</a> (链上回滚 Reverted)`;
        }
        return ctx.reply(failMsg, { parse_mode: 'HTML' });
      }

    const lowerCa = tokenAddress.toLowerCase();
    const existingHolding = user.tokenHoldings.get(lowerCa);
    const prevAmount = existingHolding ? existingHolding.amount : 0;
    const prevCost = existingHolding ? existingHolding.costNative : 0;
    const prevBought = existingHolding?.totalBoughtNative ?? prevCost;
    const prevSold = existingHolding?.totalSoldNative ?? 0;

    user.tokenHoldings.set(lowerCa, {
      tokenAddress,
      chain: targetChain,
      symbol: result.tokenSymbol || existingHolding?.symbol || 'TOKEN',
      name: result.tokenName || existingHolding?.name || 'Token',
      amount: prevAmount + result.estimatedAmountOut,
      costNative: parseFloat((prevCost + amt).toFixed(4)),
      totalBoughtNative: parseFloat((prevBought + amt).toFixed(4)),
      totalSoldNative: prevSold
    });

    ChainBalanceService.invalidateCache(targetChain, targetWallet.address);
    if (result.isRealOnChain) {
      targetWallet.balance = parseFloat(Math.max((targetWallet.balance || 0) - amt, 0).toFixed(4));
      await new Promise(r => setTimeout(r, 1500));
      await syncWalletBalances(user, targetChain);
      await syncTokenHoldings(user, targetChain, tokenAddress);
    } else {
      targetWallet.balance = parseFloat(Math.max((targetWallet.balance || 0) - amt, 0).toFixed(4));
    }

      processTradeReferralAndFee(user, amt);
      recordUserTransaction(user, {
        chain: targetChain,
        type: 'BUY',
        walletAddress: targetWallet.address,
        tokenAddress,
        tokenSymbol: result.tokenSymbol || 'TOKEN',
        tokenName: result.tokenName || 'Token',
        amountNative: amt,
        amountToken: result.estimatedAmountOut,
        txHash: result.txHash,
        isRealOnChain: result.isRealOnChain
      });
      saveUserStore();

      const txUrl = getChainTxUrl(targetChain, result.txHash);
      const shortTxHash = result.txHash.length > 20
        ? `${result.txHash.slice(0, 10)}...${result.txHash.slice(-8)}`
        : result.txHash;

      if (isZh) {
        return ctx.reply(
          `⚡ <b>代币买入成功！</b>\n\n` +
          `🪙 代币: <code>${tokenAddress}</code>\n` +
          `📈 获得: <b>${result.estimatedAmountOut.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${result.tokenSymbol}</b>\n` +
          `💰 支付: <b>${amt} ${chainSymbol}</b>\n` +
          `⛽ 耗时: <b>${result.executionTimeMs} ms</b>\n` +
          `🔗 交易哈希: <a href="${txUrl}">${shortTxHash}</a>${result.isRealOnChain ? ' (🔥 链上真实广播)' : ''}\n\n` +
          `💳 当前钱包余额: <b>${targetWallet.balance} ${chainSymbol}</b>`,
          { parse_mode: 'HTML' }
        );
      }

      return ctx.reply(
        `⚡ <b>Tokens bought successfully!</b>\n\n` +
        `🪙 Token: <code>${tokenAddress}</code>\n` +
        `📈 Received: <b>${result.estimatedAmountOut.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${result.tokenSymbol}</b>\n` +
        `💰 Spent: <b>${amt} ${chainSymbol}</b>\n` +
        `⛽ Latency: <b>${result.executionTimeMs} ms</b>\n` +
        `🔗 Tx Hash: <a href="${txUrl}">${shortTxHash}</a>${result.isRealOnChain ? ' (🔥 On-Chain Confirmed)' : ''}\n\n` +
        `💳 Current Balance: <b>${targetWallet.balance} ${chainSymbol}</b>`,
        { parse_mode: 'HTML' }
      );
    }

    // 2. 出售自定义比例 X %
    if (action.type === 'sell_x') {
      const pct = parseFloat(text);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        return ctx.reply(I18nService.t('msg.invalidPercent', user.lang));
      }

      const tokenAddress = action.data.tokenAddress;
      const targetChain = action.data.chain || resolveChainForToken(tokenAddress, user.activeChain);
      const chainSymbol = MainMenu.getChainNativeSymbol(targetChain);
      const targetWallets = getUserWallets(user, targetChain);
      const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];

      const lowerCa = tokenAddress.toLowerCase();
      let holdingObj = user.tokenHoldings.get(lowerCa) || user.tokenHoldings.get(tokenAddress);
      let holding = holdingObj ? holdingObj.amount : 0;
      if (holding <= 0) {
        await syncTokenHoldings(user, targetChain, tokenAddress);
        holdingObj = user.tokenHoldings.get(lowerCa) || user.tokenHoldings.get(tokenAddress);
        holding = holdingObj ? holdingObj.amount : 0;
      }
      if (holding <= 0) {
        user.pendingAction = undefined;
        return ctx.reply(I18nService.t('msg.insufficientBalance', user.lang));
      }

      user.pendingAction = undefined;
      const result = await OnChainSwapService.executeFastSell({
        userId: user.userId,
        chain: targetChain,
        walletAddress: targetWallet ? targetWallet.address : '0x0',
        privateKey: targetWallet?.privateKey,
        tokenAddress,
        sellPercentage: pct,
        sellInitial: false,
        totalTokenBalance: holding,
        costBasisNative: holdingObj?.costNative || 0.1,
        slippagePct: user.tradeConfig.slippage,
        gasTip: SettingsMenu.getEffectiveTip(targetChain, user.tradeConfig)
      });

      if (result.status === 'PENDING') {
      return ctx.reply(`PENDING: ${result.txHash}\nTransaction broadcast; confirmation pending. Do not resubmit.`);
    }
    if (result.status !== 'SUCCESS' || result.error) {
        let failMsg = I18nService.t('msg.sellFailed', user.lang, { error: result.error || 'Execution failed' });
        if (result.txHash && result.txHash.startsWith('0x')) {
          const txUrl = getChainTxUrl(targetChain, result.txHash);
          const shortHash = result.txHash.length > 20 ? `${result.txHash.slice(0, 10)}...${result.txHash.slice(-8)}` : result.txHash;
          failMsg += `\n\n🔗 交易哈希: <a href="${txUrl}">${shortHash}</a> (链上回滚 Reverted)`;
        }
        return ctx.reply(failMsg, { parse_mode: 'HTML' });
      }

    const remainingTokens = holding * (1 - pct / 100);
    if (remainingTokens <= 0.0001) {
      user.tokenHoldings.delete(lowerCa);
    } else if (holdingObj) {
      holdingObj.amount = remainingTokens;
      holdingObj.costNative = parseFloat((holdingObj.costNative * (1 - pct / 100)).toFixed(4));
      holdingObj.totalSoldNative = parseFloat(((holdingObj.totalSoldNative ?? 0) + result.estimatedAmountOut).toFixed(4));
      user.tokenHoldings.set(lowerCa, holdingObj);
    }

    ChainBalanceService.invalidateCache(targetChain, targetWallet.address);
    if (result.isRealOnChain) {
      if (targetWallet && result.estimatedAmountOut > 0) {
        targetWallet.balance = parseFloat(((targetWallet.balance || 0) + result.estimatedAmountOut).toFixed(4));
      }
      await new Promise(r => setTimeout(r, 1500));
      await syncWalletBalances(user, targetChain);
      await syncTokenHoldings(user, targetChain, tokenAddress);
    } else {
      if (targetWallet) {
        targetWallet.balance = parseFloat(((targetWallet.balance || 0) + result.estimatedAmountOut).toFixed(4));
      }
    }

      const soldAmount = holding * (pct / 100);
      processTradeReferralAndFee(user, result.estimatedAmountOut);
      recordUserTransaction(user, {
        chain: targetChain,
        type: 'SELL',
        walletAddress: targetWallet ? targetWallet.address : '0x0',
        tokenAddress,
        tokenSymbol: result.tokenSymbol || 'TOKEN',
        tokenName: result.tokenName || 'Token',
        amountNative: result.estimatedAmountOut,
        amountToken: soldAmount,
        txHash: result.txHash,
        isRealOnChain: result.isRealOnChain
      });
      saveUserStore();

      const txUrl = getChainTxUrl(targetChain, result.txHash);
      const shortTxHash = result.txHash.length > 20
        ? `${result.txHash.slice(0, 10)}...${result.txHash.slice(-8)}`
        : result.txHash;

      if (isZh) {
        return ctx.reply(
          `⚡ <b>代币出售成功并已回款！</b>\n\n` +
          `🪙 代币: <code>${tokenAddress}</code>\n` +
          `📉 出售: <b>${pct}% (${soldAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${result.tokenSymbol})</b>\n` +
          `💰 收到: <b>≈${result.estimatedAmountOut.toFixed(4)} ${chainSymbol}</b>\n` +
          `⛽ 耗时: <b>${result.executionTimeMs} ms</b>\n` +
          `🔗 交易哈希: <a href="${txUrl}">${shortTxHash}</a>\n\n` +
          `💳 当前钱包余额: <b>${targetWallet ? targetWallet.balance : 0} ${chainSymbol}</b>`,
          { parse_mode: 'HTML' }
        );
      }

      return ctx.reply(
        `⚡ <b>Tokens sold successfully!</b>\n\n` +
        `🪙 Token: <code>${tokenAddress}</code>\n` +
        `📉 Sold: <b>${pct}% (${soldAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${result.tokenSymbol})</b>\n` +
        `💰 Received: <b>≈${result.estimatedAmountOut.toFixed(4)} ${chainSymbol}</b>\n` +
        `⛽ Latency: <b>${result.executionTimeMs} ms</b>\n` +
        `🔗 Tx Hash: <a href="${txUrl}">${shortTxHash}</a>\n\n` +
        `💳 Current Balance: <b>${targetWallet ? targetWallet.balance : 0} ${chainSymbol}</b>`,
        { parse_mode: 'HTML' }
      );
    }

    // 3. 跟单添加钱包
    if (action.type === 'add_copy') {
      user.pendingAction = undefined;
      user.monitoredWallets.push(text);
      return ctx.reply(
        I18nService.t('msg.smartMoneyAdded', user.lang, { text: text, count: user.monitoredWallets.length }),
        { parse_mode: 'HTML' }
      );
    }

    // 4. 设置小费
    if (action.type === 'set_tip') {
      user.pendingAction = undefined;
      const tip = parseFloat(text);
      if (!isNaN(tip) && tip >= 0) {
        if (!user.tradeConfig.chainGasTips) user.tradeConfig.chainGasTips = {};
        user.tradeConfig.chainGasTips[user.activeChain.toLowerCase()] = tip;
        user.tradeConfig.gasTip = tip;
        saveUserStore();
      }
      const effectiveTip = SettingsMenu.getEffectiveTip(user.activeChain, user.tradeConfig);
      return ctx.reply(
        I18nService.t('msg.gasTipUpdated', user.lang, { tip: effectiveTip, symbol: nativeSymbol }),
        { parse_mode: 'HTML' }
      );
    }

    // 5. 转账 native (支持单行 "0x... 0.05" 或分步输入: 先输入地址)
    if (action.type === 'transfer_native') {
      const parts = text.split(/\s+/);
      const toAddr = parts[0] || '';
      const amtPart = parts[1];

      // 验证目标地址格式 (Sui 0x... 42~66 字符, EVM 0x... 42 字符, Solana 32~44 base58 等)
      const isHexAddr = /^0x[a-fA-F0-9]{40,66}$/i.test(toAddr);
      const isBase58Addr = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(toAddr);
      if (!isHexAddr && !isBase58Addr) {
        return ctx.reply(
          I18nService.t('msg.invalidRecipient', user.lang),
          { parse_mode: 'HTML' }
        );
      }

      await syncWalletBalances(user, user.activeChain);
      const targetWallets = getUserWallets(user, user.activeChain);
      const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];
      const currentBalance = targetWallet?.balance || 0;

      // 如果用户仅输入了地址 (无金额参数)
      if (!amtPart) {
        user.pendingAction = {
          type: 'transfer_native_amount',
          data: { toAddress: toAddr }
        };
        return ctx.reply(
          isZh
            ? `📥 <b>转账目标地址已记录:</b>\n<code>${toAddr}</code>\n\n` +
              `💳 当前钱包余额: <b>${currentBalance} ${nativeSymbol}</b>\n\n` +
              `✏️ 请输入要转账的 <b>${nativeSymbol}</b> 金额 (例如 <code>0.05</code>)，或输入 <code>all</code> 全部转出:\n` +
              `<i>发送 /cancel 可随时取消</i>`
            : `📥 <b>Recipient address recorded:</b>\n<code>${toAddr}</code>\n\n` +
              `💳 Available balance: <b>${currentBalance} ${nativeSymbol}</b>\n\n` +
              `✏️ Please enter the amount of <b>${nativeSymbol}</b> to transfer (e.g. <code>0.05</code>) or type <code>all</code>:\n` +
              `<i>Type /cancel to cancel</i>`,
          { parse_mode: 'HTML' }
        );
      }

      // 如果用户同时输入了地址与金额 (例如 0x... 0.05)
      const isSui = user.activeChain.toLowerCase() === 'sui';
      const gasReserve = isSui ? 0.005 : 0.001;
      const maxTransferable = Math.max(parseFloat((currentBalance - gasReserve).toFixed(4)), 0);

      let amt = 0;
      if (amtPart.toLowerCase() === 'all' || amtPart === '全部') {
        amt = maxTransferable;
      } else {
        amt = parseFloat(amtPart);
      }

      if (isNaN(amt) || amt <= 0) {
        return ctx.reply(
          I18nService.t('msg.invalidTransferAmount', user.lang),
          { parse_mode: 'HTML' }
        );
      }

      if (!targetWallet || currentBalance < amt) {
        return ctx.reply(
          I18nService.t('msg.insufficientBalanceRetry', user.lang, { balance: currentBalance, symbol: nativeSymbol }),
          { parse_mode: 'HTML' }
        );
      }

      if (amt > maxTransferable) {
        return ctx.reply(
          isZh
            ? `⚠️ 余额不足以支付网络 Gas 费！\n\n` +
              `💳 当前余额: <b>${currentBalance} ${nativeSymbol}</b>\n` +
              `⛽️ 需预留 Gas 手续费: <b>${gasReserve} ${nativeSymbol}</b>\n` +
              `💸 最多可转账金额为: <b>${maxTransferable} ${nativeSymbol}</b>\n\n` +
              `请输入小于或等于 <b>${maxTransferable}</b> 的金额 (或输入 <code>all</code> 全部转出):`
            : `⚠️ Insufficient balance to cover gas fee!\n\n` +
              `💳 Balance: <b>${currentBalance} ${nativeSymbol}</b>\n` +
              `⛽️ Reserved Gas: <b>${gasReserve} ${nativeSymbol}</b>\n` +
              `💸 Max transferable: <b>${maxTransferable} ${nativeSymbol}</b>\n\n` +
              `Please enter an amount <= <b>${maxTransferable}</b> (or type <code>all</code>):`,
          { parse_mode: 'HTML' }
        );
      }

      user.pendingAction = undefined;

      const res = await OnChainSwapService.executeTransferNative({
        chain: user.activeChain,
        fromAddress: targetWallet.address,
        privateKey: targetWallet.privateKey,
        toAddress: toAddr,
        amount: amt
      });

      if (!res.success) {
        return ctx.reply(
          isZh
            ? `❌ <b>转账执行失败</b>\n\n` +
              `原因: <code>${res.error || '区块链网络拒绝交易'}</code>\n` +
              `当前钱包余额: <b>${targetWallet.balance} ${nativeSymbol}</b> (资金未受损失，未扣除任何资产)`
            : `❌ <b>Transfer Failed</b>\n\n` +
              `Reason: <code>${res.error || 'Network rejected transaction'}</code>\n` +
              `Current Balance: <b>${targetWallet.balance} ${nativeSymbol}</b> (No funds deducted)`,
          { parse_mode: 'HTML' }
        );
      }

      // 等待上链并严格从链上同步最新余额
      await new Promise(r => setTimeout(r, 1200));
      await syncWalletBalances(user, user.activeChain);

      recordUserTransaction(user, {
        chain: user.activeChain,
        type: 'TRANSFER',
        walletAddress: targetWallet.address,
        tokenAddress: 'NATIVE',
        tokenSymbol: nativeSymbol,
        tokenName: nativeSymbol,
        amountNative: amt,
        amountToken: amt,
        txHash: res.txHash,
        isRealOnChain: res.isRealOnChain
      });
      saveUserStore();

      const txUrl = getChainTxUrl(user.activeChain, res.txHash);
      const shortHash = res.txHash.length > 16 ? `${res.txHash.slice(0, 8)}...${res.txHash.slice(-6)}` : res.txHash;

      return ctx.reply(
        isZh
          ? `✅ <b>转账指令已成功广播至区块链网络！</b>\n\n` +
            `💸 金额: <b>${amt} ${nativeSymbol}</b>\n` +
            `📥 目标地址: <code>${toAddr}</code>\n` +
            `🔗 交易哈希: <a href="${txUrl}">${shortHash}</a>${res.isRealOnChain ? ' (🔥 链上真实广播)' : ''}\n\n` +
            `💳 当前钱包余额: <b>${targetWallet.balance} ${nativeSymbol}</b>`
          : `✅ <b>Transfer broadcasted successfully!</b>\n\n` +
            `💸 Amount: <b>${amt} ${nativeSymbol}</b>\n` +
            `📥 Recipient: <code>${toAddr}</code>\n` +
            `🔗 Tx Hash: <a href="${txUrl}">${shortHash}</a>${res.isRealOnChain ? ' (🔥 On-Chain Confirmed)' : ''}\n\n` +
            `💳 Current Balance: <b>${targetWallet.balance} ${nativeSymbol}</b>`,
        { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
      );
    }

    // 5.1 转账 native 第二步: 接收用户输入的金额
    if (action.type === 'transfer_native_amount') {
      const toAddr = action.data?.toAddress;
      if (!toAddr) {
        user.pendingAction = undefined;
        return ctx.reply(I18nService.t('msg.transferExpired', user.lang));
      }

      await syncWalletBalances(user, user.activeChain);
      const targetWallets = getUserWallets(user, user.activeChain);
      const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];
      const currentBalance = targetWallet?.balance || 0;

      const isSui = user.activeChain.toLowerCase() === 'sui';
      const gasReserve = isSui ? 0.005 : 0.001;
      const maxTransferable = Math.max(parseFloat((currentBalance - gasReserve).toFixed(4)), 0);

      let amt = 0;
      if (text.toLowerCase() === 'all' || text === '全部') {
        amt = maxTransferable;
      } else {
        amt = parseFloat(text);
      }

      if (isNaN(amt) || amt <= 0) {
        return ctx.reply(
          I18nService.t('msg.invalidNumberOrAll', user.lang),
          { parse_mode: 'HTML' }
        );
      }

      if (!targetWallet || currentBalance < amt) {
        return ctx.reply(
          I18nService.t('msg.insufficientBalanceRetry', user.lang, { balance: currentBalance, symbol: nativeSymbol }),
          { parse_mode: 'HTML' }
        );
      }

      if (amt > maxTransferable) {
        return ctx.reply(
          isZh
            ? `⚠️ 余额不足以支付网络 Gas 费！\n\n` +
              `💳 当前余额: <b>${currentBalance} ${nativeSymbol}</b>\n` +
              `⛽️ 需预留 Gas 手续费: <b>${gasReserve} ${nativeSymbol}</b>\n` +
              `💸 最多可转账金额为: <b>${maxTransferable} ${nativeSymbol}</b>\n\n` +
              `请输入小于或等于 <b>${maxTransferable}</b> 的金额 (或输入 <code>all</code> 全部转出):`
            : `⚠️ Insufficient balance to cover gas fee!\n\n` +
              `💳 Balance: <b>${currentBalance} ${nativeSymbol}</b>\n` +
              `⛽️ Reserved Gas: <b>${gasReserve} ${nativeSymbol}</b>\n` +
              `💸 Max transferable: <b>${maxTransferable} ${nativeSymbol}</b>\n\n` +
              `Please enter an amount <= <b>${maxTransferable}</b> (or type <code>all</code>):`,
          { parse_mode: 'HTML' }
        );
      }

      user.pendingAction = undefined;

      const res = await OnChainSwapService.executeTransferNative({
        chain: user.activeChain,
        fromAddress: targetWallet.address,
        privateKey: targetWallet.privateKey,
        toAddress: toAddr,
        amount: amt
      });

      if (!res.success) {
        return ctx.reply(
          isZh
            ? `❌ <b>转账执行失败</b>\n\n` +
              `原因: <code>${res.error || '区块链网络拒绝交易'}</code>\n` +
              `当前钱包余额: <b>${targetWallet.balance} ${nativeSymbol}</b> (资金未受损失，未扣除任何资产)`
            : `❌ <b>Transfer Failed</b>\n\n` +
              `Reason: <code>${res.error || 'Network rejected transaction'}</code>\n` +
              `Current Balance: <b>${targetWallet.balance} ${nativeSymbol}</b> (No funds deducted)`,
          { parse_mode: 'HTML' }
        );
      }

      // 等待上链并严格从链上同步最新余额
      await new Promise(r => setTimeout(r, 1200));
      await syncWalletBalances(user, user.activeChain);

      recordUserTransaction(user, {
        chain: user.activeChain,
        type: 'TRANSFER',
        walletAddress: targetWallet.address,
        tokenAddress: 'NATIVE',
        tokenSymbol: nativeSymbol,
        tokenName: nativeSymbol,
        amountNative: amt,
        amountToken: amt,
        txHash: res.txHash,
        isRealOnChain: res.isRealOnChain
      });
      saveUserStore();

      const txUrl = getChainTxUrl(user.activeChain, res.txHash);
      const shortHash = res.txHash.length > 16 ? `${res.txHash.slice(0, 8)}...${res.txHash.slice(-6)}` : res.txHash;

      return ctx.reply(
        isZh
          ? `✅ <b>转账指令已成功广播至区块链网络！</b>\n\n` +
            `💸 金额: <b>${amt} ${nativeSymbol}</b>\n` +
            `📥 目标地址: <code>${toAddr}</code>\n` +
            `🔗 交易哈希: <a href="${txUrl}">${shortHash}</a>${res.isRealOnChain ? ' (🔥 链上真实广播)' : ''}\n\n` +
            `💳 当前钱包余额: <b>${targetWallet.balance} ${nativeSymbol}</b>`
          : `✅ <b>Transfer broadcasted successfully!</b>\n\n` +
            `💸 Amount: <b>${amt} ${nativeSymbol}</b>\n` +
            `📥 Recipient: <code>${toAddr}</code>\n` +
            `🔗 Tx Hash: <a href="${txUrl}">${shortHash}</a>${res.isRealOnChain ? ' (🔥 On-Chain Confirmed)' : ''}\n\n` +
            `💳 Current Balance: <b>${targetWallet.balance} ${nativeSymbol}</b>`,
        { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
      );
    }
      // 6. 转账 token (代币) - 真实链上转账 (BUG-018)
      if (action.type === 'transfer_token') {
        const parts = text.split(/\s+/);
        if (parts.length >= 3) {
          // 单行输入: CA toAddr amount
          user.pendingAction = undefined;
          const ca = parts[0];
          const toAddr = parts[1];
          const amt = parseFloat(parts[2] || '0');
          const targetWallets = getUserWallets(user, user.activeChain);
          const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];

          if (!targetWallet || !targetWallet.privateKey) {
            return ctx.reply(isZh ? '❌ 钱包未配置私钥，无法转账' : '❌ Wallet has no private key configured');
          }
          if (isNaN(amt) || amt <= 0) {
            return ctx.reply(isZh ? '❌ 转账金额必须大于 0' : '❌ Amount must be greater than 0');
          }

          const res = await OnChainSwapService.executeTransferToken({
            chain: user.activeChain,
            fromAddress: targetWallet.address,
            privateKey: targetWallet.privateKey,
            tokenAddress: ca,
            toAddress: toAddr,
            amount: amt
          });

          if (!res.success && res.status !== 'PENDING') {
            return ctx.reply(
              isZh
                ? `❌ <b>代币转账失败：</b>${res.error || '未知错误'}`
                : `❌ <b>Token transfer failed:</b> ${res.error || 'Unknown error'}`,
              { parse_mode: 'HTML' }
            );
          }

          recordUserTransaction(user, {
            chain: user.activeChain,
            type: 'TRANSFER',
            walletAddress: targetWallet.address,
            tokenAddress: ca,
            tokenSymbol: 'TOKEN',
            tokenName: 'Token',
            amountNative: 0,
            amountToken: amt,
            txHash: res.txHash
          });
          saveUserStore();

          const txUrl = getChainTxUrl(user.activeChain, res.txHash);
          const shortHash = res.txHash.length > 16 ? `${res.txHash.slice(0, 8)}...${res.txHash.slice(-6)}` : res.txHash;

          if (res.status === 'PENDING') {
            return ctx.reply(
              isZh
                ? `⏳ <b>代币转账已广播，正在等待区块确认...</b>\n\n` +
                  `📈 数量: <b>${amt}</b>\n` +
                  `📥 目标地址: <code>${toAddr}</code>\n` +
                  `🔗 交易哈希: <a href="${txUrl}">${shortHash}</a>`
                : `⏳ <b>Token transfer broadcasted, awaiting confirmation...</b>\n\n` +
                  `📈 Amount: <b>${amt}</b>\n` +
                  `📥 Recipient: <code>${toAddr}</code>\n` +
                  `🔗 Tx Hash: <a href="${txUrl}">${shortHash}</a>`,
              { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
            );
          }

          return ctx.reply(
            isZh
              ? `✅ <b>代币转账成功！</b>\n\n` +
                `📈 数量: <b>${amt}</b>\n` +
                `📥 目标地址: <code>${toAddr}</code>\n` +
                `🔗 交易哈希: <a href="${txUrl}">${shortHash}</a>${res.isRealOnChain ? ' (🔥 链上真实确认)' : ''}`
              : `✅ <b>Token transfer successful!</b>\n\n` +
                `📈 Amount: <b>${amt}</b>\n` +
                `📥 Recipient: <code>${toAddr}</code>\n` +
                `🔗 Tx Hash: <a href="${txUrl}">${shortHash}</a>${res.isRealOnChain ? ' (🔥 On-Chain Confirmed)' : ''}`,
            { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
          );
        } else {
          // 分步输入：第一步收到 CA
          const ca = parts[0];
          user.pendingAction = {
            type: 'transfer_token_to',
            data: { tokenAddress: ca }
          };
          return ctx.reply(
            I18nService.t('msg.tokenAddrRecorded', user.lang, { ca: ca }),
            { parse_mode: 'HTML' }
          );
        }
      }

      if (action.type === 'transfer_token_to') {
        const ca = action.data?.tokenAddress;
        const toAddr = text;
        user.pendingAction = {
          type: 'transfer_token_amount',
          data: { tokenAddress: ca, toAddress: toAddr }
        };
        return ctx.reply(
          I18nService.t('msg.recipientRecorded', user.lang, { toAddr: toAddr }),
          { parse_mode: 'HTML' }
        );
      }

      if (action.type === 'transfer_token_amount') {
        const ca = action.data?.tokenAddress || 'TOKEN';
        const toAddr = action.data?.toAddress || '';
        const amt = parseFloat(text);
        user.pendingAction = undefined;

        if (isNaN(amt) || amt <= 0) {
          return ctx.reply(I18nService.t('msg.invalidTokenAmount', user.lang));
        }

        const targetWallets = getUserWallets(user, user.activeChain);
        const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];
        if (!targetWallet || !targetWallet.privateKey) {
          return ctx.reply(isZh ? '❌ 钱包未配置私钥，无法转账' : '❌ Wallet has no private key configured');
        }

        const res = await OnChainSwapService.executeTransferToken({
          chain: user.activeChain,
          fromAddress: targetWallet.address,
          privateKey: targetWallet.privateKey,
          tokenAddress: ca,
          toAddress: toAddr,
          amount: amt
        });

        if (!res.success && res.status !== 'PENDING') {
          return ctx.reply(
            isZh
              ? `❌ <b>代币转账失败：</b>${res.error || '未知错误'}`
              : `❌ <b>Token transfer failed:</b> ${res.error || 'Unknown error'}`,
            { parse_mode: 'HTML' }
          );
        }

        recordUserTransaction(user, {
          chain: user.activeChain,
          type: 'TRANSFER',
          walletAddress: targetWallet.address,
          tokenAddress: ca,
          tokenSymbol: 'TOKEN',
          tokenName: 'Token',
          amountNative: 0,
          amountToken: amt,
          txHash: res.txHash
        });
        saveUserStore();

        const txUrl = getChainTxUrl(user.activeChain, res.txHash);
        const shortHash = res.txHash.length > 16 ? `${res.txHash.slice(0, 8)}...${res.txHash.slice(-6)}` : res.txHash;

        if (res.status === 'PENDING') {
          return ctx.reply(
            isZh
              ? `⏳ <b>代币转账已广播，正在等待区块确认...</b>\n\n` +
                `📈 数量: <b>${amt}</b>\n` +
                `📥 目标地址: <code>${toAddr}</code>\n` +
                `🔗 交易哈希: <a href="${txUrl}">${shortHash}</a>`
              : `⏳ <b>Token transfer broadcasted, awaiting confirmation...</b>\n\n` +
                `📈 Amount: <b>${amt}</b>\n` +
                `📥 Recipient: <code>${toAddr}</code>\n` +
                `🔗 Tx Hash: <a href="${txUrl}">${shortHash}</a>`,
            { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
          );
        }

        return ctx.reply(
          isZh
            ? `✅ <b>代币转账成功！</b>\n\n` +
              `📈 数量: <b>${amt}</b>\n` +
              `📥 目标地址: <code>${toAddr}</code>\n` +
              `🔗 交易哈希: <a href="${txUrl}">${shortHash}</a>${res.isRealOnChain ? ' (🔥 链上真实确认)' : ''}`
            : `✅ <b>Token transfer successful!</b>\n\n` +
              `📈 Amount: <b>${amt}</b>\n` +
              `📥 Recipient: <code>${toAddr}</code>\n` +
              `🔗 Tx Hash: <a href="${txUrl}">${shortHash}</a>${res.isRealOnChain ? ' (🔥 On-Chain Confirmed)' : ''}`,
          { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
        );
      }

      // 7. 钱包重命名 (BUG-019)
      if (action.type === 'rename_wallet') {
        user.pendingAction = undefined;
        const newName = text.slice(0, 32).trim();
        if (!newName) {
          return ctx.reply(isZh ? '❌ 钱包名称不能为空' : '❌ Wallet name cannot be empty');
        }
        const targetAddress = action.data?.address;
        const chainWallets = getUserWallets(user, action.data?.chain || user.activeChain);
        const w = chainWallets.find(x => x.address.toLowerCase() === (targetAddress || '').toLowerCase()) || chainWallets.find(x => x.isDefault) || chainWallets[0];
        if (w) {
          w.name = newName;
          saveUserStore();
          return ctx.reply(
            isZh ? `✅ 钱包已重命名为: <b>${newName}</b>` : `✅ Wallet renamed to: <b>${newName}</b>`,
            { parse_mode: 'HTML' }
          );
        }
      }

      // 8. 买入预设设置 (BUG-019)
      if (action.type === 'set_buy_preset') {
        user.pendingAction = undefined;
        const val = parseFloat(text);
        if (isNaN(val) || val <= 0) {
          return ctx.reply(isZh ? '❌ 请输入有效的正数买入预设金额' : '❌ Please enter a valid positive buy amount');
        }
        const idx = action.data?.index ?? 0;
        if (!user.tradeConfig.buyPresets) user.tradeConfig.buyPresets = [0.02, 0.05, 0.1, 0.2, 0.5];
        user.tradeConfig.buyPresets[idx] = val;
        saveUserStore();
        return ctx.reply(
          isZh
            ? `✅ 买入预设 #${idx + 1} 已更新为: <b>${val}</b>`
            : `✅ Buy preset #${idx + 1} updated to: <b>${val}</b>`,
          { parse_mode: 'HTML' }
        );
      }

      // 9. 卖出预设设置 (BUG-019)
      if (action.type === 'set_sell_preset') {
        user.pendingAction = undefined;
        const val = parseFloat(text);
        if (isNaN(val) || val <= 0 || val > 100) {
          return ctx.reply(isZh ? '❌ 请输入 1 到 100 之间的百分比' : '❌ Please enter a percentage between 1 and 100');
        }
        const idx = action.data?.index ?? 0;
        if (!user.tradeConfig.sellPresets) user.tradeConfig.sellPresets = [50, 100];
        user.tradeConfig.sellPresets[idx] = val;
        saveUserStore();
        return ctx.reply(
          isZh
            ? `✅ 卖出预设 #${idx + 1} 已更新为: <b>${val}%</b>`
            : `✅ Sell preset #${idx + 1} updated to: <b>${val}%</b>`,
          { parse_mode: 'HTML' }
        );
      }

      // 10. 添加限价单 (BUG-019)
      if (action.type === 'add_limit_order') {
        user.pendingAction = undefined;
        const parts = text.split(/\s+/);
        if (parts.length < 3) {
          return ctx.reply(
            isZh
              ? '❌ 格式错误。正确格式: <code>&lt;代币合约CA&gt; &lt;触发价格&gt; &lt;数量&gt; [BUY|SELL]</code>'
              : '❌ Invalid format. Expected: <code>&lt;token_address&gt; &lt;target_price&gt; &lt;amount&gt; [BUY|SELL]</code>',
            { parse_mode: 'HTML' }
          );
        }
        const tokenAddress = parts[0];
        const targetPrice = parseFloat(parts[1]);
        const amount = parseFloat(parts[2]);
        const orderType = (parts[3] || 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY';

        if (isNaN(targetPrice) || targetPrice <= 0 || isNaN(amount) || amount <= 0) {
          return ctx.reply(isZh ? '❌ 价格与数量必须为有效正数' : '❌ Price and amount must be valid positive numbers');
        }

        const orderId = `lmt_${Date.now()}`;
        if (!user.limitOrders) user.limitOrders = [];
        user.limitOrders.push({
          id: orderId,
          tokenAddress,
          symbol: 'TOKEN',
          orderType,
          triggerPrice: targetPrice,
          amount,
          chain: user.activeChain,
          baseCurrency: user.activeChain.toLowerCase() === 'arc' ? 'USDC' : 'USD',
          createdAt: Date.now()
        });
        saveUserStore();
        const priceUnit = user.activeChain.toLowerCase() === 'arc' ? 'USDC' : '$';
        return ctx.reply(
          isZh
            ? `✅ <b>限价单已创建！</b>\n\n` +
              `📌 类型: <b>${orderType}</b>\n` +
              `🎯 触发价: <b>${targetPrice} ${priceUnit}</b>\n` +
              `📈 数量: <b>${amount}</b>\n` +
              `🪙 代币: <code>${tokenAddress}</code>`
            : `✅ <b>Limit order created!</b>\n\n` +
              `📌 Type: <b>${orderType}</b>\n` +
              `🎯 Trigger Price: <b>${targetPrice} ${priceUnit}</b>\n` +
              `📈 Amount: <b>${amount}</b>\n` +
              `🪙 Token: <code>${tokenAddress}</code>`,
          { parse_mode: 'HTML' }
        );
      }

      // 11. 导入私钥 (BUG-022)
      if (action.type === 'import_wallet') {
        user.pendingAction = undefined;
        try {
          await ctx.deleteMessage();
        } catch {}

        const rawKey = text.trim();
        const targetChain = (action.data?.chain || user.activeChain).toLowerCase();
        let importedAddress = '';
        let cleanPk = '';

        try {
          if (['bsc', 'base', 'ethereum', 'robinhood', 'sei', 'xlayer', 'arc'].includes(targetChain)) {
            cleanPk = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
            if (!/^0x[0-9a-fA-F]{64}$/.test(cleanPk)) {
              throw new Error('EVM 私钥格式错误 (必须为 64 位十六进制字符)');
            }
            const evmWallet = new ethers.Wallet(cleanPk);
            importedAddress = evmWallet.address;
          } else if (targetChain === 'solana') {
            cleanPk = rawKey;
            const secret = bs58.decode(cleanPk);
            if (secret.length !== 64) {
              throw new Error('Solana 私钥长度无效 (必须为 64 字节 Base58 编码)');
            }
            const keypair = SolKeypair.fromSecretKey(secret);
            importedAddress = keypair.publicKey.toBase58();
          } else if (targetChain === 'sui') {
            cleanPk = rawKey;
            if (!cleanPk.startsWith('suiprivkey1')) {
              throw new Error('Sui 私钥格式错误 (必须以 suiprivkey1 开头)');
            }
            const { secretKey } = decodeSuiPrivateKey(cleanPk);
            const keypair = Ed25519Keypair.fromSecretKey(secretKey);
            importedAddress = keypair.toSuiAddress();
          } else {
            throw new Error(`暂不支持在 ${targetChain} 链上导入私钥`);
          }

          const chainWallets = getUserWallets(user, targetChain);
          const exists = chainWallets.some(w => w.address.toLowerCase() === importedAddress.toLowerCase());
          if (exists) {
            return ctx.reply(
              isZh
                ? `⚠️ 钱包已存在，无需重复导入：<code>${importedAddress}</code>`
                : `⚠️ Wallet already exists: <code>${importedAddress}</code>`,
              { parse_mode: 'HTML' }
            );
          }

          const isFirst = chainWallets.length === 0;
          const newWalletEntry: WalletEntry = {
            index: chainWallets.length + 1,
            address: importedAddress,
            privateKey: cleanPk,
            symbol: MainMenu.getChainNativeSymbol(targetChain),
            isDefault: isFirst,
            balance: 0,
            name: `Imported ${chainWallets.length + 1}`
          };
          chainWallets.push(newWalletEntry);
          saveUserStore();

          syncWalletBalances(user, targetChain).catch(() => {});

          return ctx.reply(
            isZh
              ? `✅ <b>私钥导入成功！</b>\n\n公链: <b>${MainMenu.getChainDisplayName(targetChain)}</b>\n地址: <code>${importedAddress}</code>\n\n<i>🛡️ 原私钥消息已被安全清理。</i>`
              : `✅ <b>Wallet Imported Successfully!</b>\n\nChain: <b>${MainMenu.getChainDisplayName(targetChain)}</b>\nAddress: <code>${importedAddress}</code>\n\n<i>🛡️ The original secret message was purged.</i>`,
            { parse_mode: 'HTML' }
          );
        } catch (importErr: any) {
          return ctx.reply(
            isZh
              ? `❌ <b>私钥导入失败:</b> ${importErr?.message || '私钥格式无效'}`
              : `❌ <b>Import Failed:</b> ${importErr?.message || 'Invalid private key format'}`,
            { parse_mode: 'HTML' }
          );
        }
      }
    }

    // B. 检查是否为代币合约地址 (CA) 或主动 query_ca (此时确认没有其他 pending 交互)
    const isPendingQuery = user.pendingAction?.type === 'query_ca';
    const detection = TokenDetector.isTokenContract(text);
    if (detection.isContract || isPendingQuery) {
      user.pendingAction = undefined; // 清空 pending 状态
      const rawTarget = detection.isContract ? detection.address : text;

      // 1. 严格拦截跨链格式不兼容的合约地址 (例如在 TON 链输入了 EVM 0x... 合约)
      if (detection.isContract && !TokenDetector.isChainCompatible(user.activeChain, detection.type)) {
        const queryChain = detection.type === 'evm' ? 'ethereum' : (detection.type || 'bsc');
        const market = await TokenMarketService.fetchTokenDetails(rawTarget, queryChain);
        const currentChainName = MainMenu.getChainDisplayName(user.activeChain);
        const tokenKey = TokenKeyHelper.register(rawTarget);

        if (market.name !== 'Unknown Token' || market.pairAddress || market.priceUsd > 0) {
          const actualTargetChain = market.actualChainId || queryChain;
          const actualChainName = MainMenu.getChainDisplayName(actualTargetChain);

          const switchBtnText = I18nService.t('btn.switchToChainAndTrade', user.lang, {
            chain: actualChainName,
            symbol: market.symbol || 'TOKEN'
          });

          const msgText = I18nService.t('msg.tokenOnOtherChain', user.lang, {
            currentChain: currentChainName,
            targetChain: actualChainName,
            tokenName: market.name,
            symbol: market.symbol,
            address: rawTarget
          });

          const keyboard = new InlineKeyboard()
            .text(switchBtnText, `switch_to_${actualTargetChain}_${tokenKey}`)
            .row()
            .text(isZh ? '🌐 切换其它公链' : '🌐 Switch Chain', 'menu_switch_chain')
            .text(isZh ? '🔙 返回主菜单' : '🔙 Main Menu', 'menu_main');

          return ctx.reply(msgText, {
            reply_markup: keyboard,
            parse_mode: 'HTML'
          });
        }

        const typeLabelMap: Record<string, string> = {
          evm: 'EVM (0x...)',
          ton: 'TON (Jetton)',
          solana: 'Solana (Base58)',
          sui: 'Sui (Move)',
          aptos: 'Aptos (Move)'
        };
        const typeLabel = typeLabelMap[detection.type || ''] || (detection.type?.toUpperCase() || 'Other');

        const mismatchMsg = I18nService.t('msg.chainMismatch', user.lang, {
          currentChain: currentChainName,
          address: rawTarget,
          detectedType: typeLabel
        });

        const keyboard = new InlineKeyboard()
          .text(isZh ? '🌐 切换公链' : '🌐 Switch Chain', 'menu_switch_chain')
          .text(isZh ? '🔙 返回主菜单' : '🔙 Main Menu', 'menu_main');

        return ctx.reply(mismatchMsg, {
          reply_markup: keyboard,
          parse_mode: 'HTML'
        });
      }

      const resolvedAddress = TokenKeyHelper.toAddress(rawTarget);
      const targetChain = resolveChainForToken(resolvedAddress, user.activeChain);
      const currentWallets = getUserWallets(user, targetChain);

      // 如果该目标链还没有钱包，自动为其生成该链的原生钱包
      if (currentWallets.length === 0) {
        await createWalletForUser(user, targetChain);
      }
      // 同步链上最新真实原生余额与代币真实持仓
      await syncWalletBalances(user, targetChain);
      await syncTokenHoldings(user, targetChain, resolvedAddress);

    const lowerCa = resolvedAddress.toLowerCase();
    const holdingObj = user.tokenHoldings.get(lowerCa);
    const userHolding = holdingObj && holdingObj.amount > 1e-4 ? holdingObj.amount : 0;
    const userHoldingNative = holdingObj && holdingObj.amount > 1e-4 ? holdingObj.costNative : 0;
    const boughtNative = holdingObj?.totalBoughtNative ?? userHoldingNative;
    const soldNative = holdingObj?.totalSoldNative ?? 0;

    console.log(`[TokenDetector] Querying token ${resolvedAddress} on chain ${targetChain} for user ${userId} (holding: ${userHolding}, cost: ${userHoldingNative})...`);
    const botUser = bot.botInfo?.username || 'whitecat_doge_yr3ybv_bot';
    const { text: panelText, keyboard } = await TokenDetector.analyzeAndBuildView(
      targetChain,
      resolvedAddress,
      currentWallets,
      user.lang,
      userHolding,
      userHoldingNative,
      boughtNative,
      soldNative,
      userId,
      botUser
    );

    return ctx.reply(panelText, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
  }

  // C. 普通文本引导
  if (!text.startsWith('/')) {
    return ctx.reply(
      I18nService.t('msg.tipSendCA', user.lang),
      { parse_mode: 'HTML' }
    );
  }
});

// 全局错误捕获，避免未修改文本或网络异常导致进程挂掉
bot.catch(err => {
  const e = err.error;
  if (e instanceof GrammyError) {
    if (e.description && e.description.includes('message is not modified')) {
      return;
    }
    console.error(`Telegram API Error (${e.error_code}): ${e.description}`);
  } else if (e instanceof HttpError) {
    console.error('Network error reaching Telegram API:', e.message);
  } else {
    console.error('Unhandled Bot Error:', err);
  }
});

export { bot, getOrCreateUser };

// Process-level error handlers to prevent crashing on transient errors
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[WARN] Unhandled promise rejection:', (reason as any)?.message || reason);
});

const BOT_COMMAND_KEYS = [
  { command: 'start', key: 'start' },
  { command: 'mcp', key: 'mcp' },
  { command: 'mini_futures', key: 'mini_futures' },
  { command: 'switch_chain', key: 'switch_chain' },
  { command: 'asset', key: 'asset' },
  { command: 'buy_sell', key: 'buy_sell' },
  { command: 'limit_order', key: 'limit_order' },
  { command: 'copy_trade', key: 'copy_trade' },
  { command: 'sniper', key: 'sniper' },
  { command: 'billing', key: 'billing' },
  { command: 'wallet_setting', key: 'wallet_setting' },
  { command: 'trade_setting', key: 'trade_setting' },
  { command: 'referral', key: 'referral' }
];

async function registerBotCommands(api: any) {
  try {
    const defaultCmds = BOT_COMMAND_KEYS.map(c => ({
      command: c.command,
      description: I18nService.getCommandDesc(c.key, 'zh-hans')
    }));
    await api.setMyCommands(defaultCmds);

    const langCodeMap: Record<string, string> = {
      zh: 'zh-hans',
      en: 'en',
      ru: 'ru',
      vi: 'vi',
      ko: 'ko',
      ja: 'ja',
      es: 'es',
      tr: 'tr',
      pl: 'pl',
      de: 'de'
    };

    for (const [tgCode, appLang] of Object.entries(langCodeMap)) {
      try {
        const langCmds = BOT_COMMAND_KEYS.map(c => ({
          command: c.command,
          description: I18nService.getCommandDesc(c.key, appLang)
        }));
        await api.setMyCommands(langCmds, { language_code: tgCode });
      } catch (e: any) {
        console.warn(`[Commands] Failed to set command for lang ${tgCode}:`, e?.message);
      }
    }

    await api.setChatMenuButton({
      menu_button: { type: 'commands' }
    });
    console.log('✅ [Commands] 成功注册全量 13 项指令菜单与左下角 ≡ 指令按钮！');
  } catch (err: any) {
    console.warn('⚠️ [Commands] 注册 Telegram 菜单指令失败:', err?.message);
  }
}

if (process.env.RUN_BOT_NOW === 'true' && process.env.TEST_MODE !== 'true') {
  // 启动内置 24/7 MCP SSE 服务
  const mcpSseServer = new WhiteCatSseServer();
  mcpSseServer.start().catch((err: any) => {
    console.warn('⚠️ [MCP Server] Failed to start SSE Server:', err?.message);
  });

  const runDaemon = async () => {
    let failureCount = 0;
    while (true) {
      try {
        console.log('🤖 正在启动白猫打狗机器人 (WhiteCat Trading Bot Gateway)...');
        await bot.start({
          drop_pending_updates: true,
          onStart: async botInfo => {
            failureCount = 0;
            console.log(`✨ 白猫打狗机器人 @${botInfo.username} 成功运行！`);
            await registerBotCommands(bot.api);
          }
        });
        console.log('[Bot] Polling connection finished gracefully. Re-initiating in 2s...');
        failureCount = 0;
        await new Promise(r => setTimeout(r, 2000));
      } catch (err: any) {
        const msg = err?.message || String(err);
        failureCount++;
        const backoff = Math.min(1500 * failureCount, 15000);
        console.error(`[Bot] Polling error: ${msg}. Retrying in ${backoff / 1000}s... (failure #${failureCount})`);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
  };
  runDaemon();
}
