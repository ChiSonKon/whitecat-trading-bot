import { I18nService } from './services/i18nService.js';
import { Bot, GrammyError, HttpError, InlineKeyboard, InputFile } from 'grammy';
import { SocksProxyAgent } from 'socks-proxy-agent';
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
  toggleMcpAutoTrade
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

  const randomHex = (len: number) => {
    let s = '';
    const hexChars = '0123456789abcdef';
    for (let i = 0; i < len; i++) {
      s += hexChars[Math.floor(Math.random() * 16)];
    }
    return s;
  };

  let newAddress = '';
  let privateKey = '';

  // 各链专属原生地址与私钥格式定义
  if (targetChain === 'solana') {
    newAddress = '';
    privateKey = '';
  } else if (targetChain === 'sui') {
    try {
      const { Ed25519Keypair } = await import('@mysten/sui/keypairs/ed25519');
      const kp = new Ed25519Keypair();
      newAddress = kp.toSuiAddress();
      privateKey = kp.getSecretKey();
    } catch {
      newAddress = `0x${randomHex(64)}`;
      privateKey = `suiprivkey1${randomHex(58)}`;
    }
  } else if (targetChain === 'ton') {
    newAddress = `UQ${randomHex(46)}`;
    privateKey = `0x${randomHex(64)}`;
  } else if (targetChain === 'aptos') {
    newAddress = `0x${randomHex(64)}`;
    privateKey = `0x${randomHex(64)}`;
  } else {
    // EVM: robinhood, bsc, base, ethereum, xlayer, sei
    newAddress = `0x${randomHex(40)}`;
    privateKey = `0x${randomHex(64)}`;
  }

  try {
    const gen = await BackendClient.generateWallet(targetChain);
    if (gen && gen.address && gen.private_key) {
      newAddress = gen.address;
      privateKey = gen.private_key;
    }
  } catch (err: any) {
    console.error(`[Wallet] Backend generation fallback for ${targetChain}:`, err?.message);
  }

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
  console.log(`[Wallet] Created ${targetChain} wallet: ${newAddress} (length: ${newAddress.length}, PK: ${privateKey.slice(0, 14)}...)`);
  return newEntry;
}

const proxyUri = process.env.SOCKS_PROXY || 'socks5h://127.0.0.1:1080';
const bot = new Bot(CONFIG.BOT_TOKEN, {
  client: {
    baseFetchConfig: {
      agent: proxyUri ? new SocksProxyAgent(proxyUri) : undefined
    }
  }
});

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
  const userId = ctx.from?.id || 10001;
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
      tokenKey = parts[0];
      if (parts.length >= 3) {
        inviterId = parseInt(parts[1], 10) || null;
        chainIdOrName = parts[2];
      } else if (parts.length === 2) {
        chainIdOrName = parts[1];
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

    // 同步钱包余额并直接展示该代币交易面板
    await syncWalletBalances(user, targetChain);
    const currentWallets = getUserWallets(user);
    const { text: panelText, keyboard } = await TokenDetector.analyzeAndBuildView(
      targetChain,
      resolvedTokenAddress,
      currentWallets,
      user.lang,
      0,
      0,
      0,
      0,
      userId,
      botUser
    );

    return ctx.reply(panelText, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
  }

  // 2. 普通好友邀请注册深度链接 (/start ref_{inviterId})
  if (startPayload.startsWith('ref_') && !user.inviterId) {
    const inviterIdStr = startPayload.replace('ref_', '');
    const inviterId = parseInt(inviterIdStr, 10);
    if (!isNaN(inviterId) && inviterId !== userId) {
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
    reply_markup: MainMenu.renderKeyboard(wallets, user.lang),
    parse_mode: 'HTML'
  });
});

// 2. /faucet 或 /deposit 指令: 充值测试代币 (支持多链)
bot.command(['faucet', 'deposit'], async ctx => {
  const userId = ctx.from?.id || 10001;
  const user = getOrCreateUser(userId, ctx.from?.username);
  
  const rawArgs = ctx.match?.trim() || '';
  const parts = rawArgs.split(/\s+/);
  let depositAmt = 1.0;
  let targetChain = user.activeChain;

  if (parts.length > 0 && parts[0] && !isNaN(parseFloat(parts[0]))) {
    depositAmt = parseFloat(parts[0]);
    if (parts.length > 1 && parts[1]) {
      targetChain = parts[1].toLowerCase();
    }
  }

  console.log(`[Faucet] Received /faucet from user ${userId}: ${depositAmt} on ${targetChain}`);

  const symbol = MainMenu.getChainNativeSymbol(targetChain);
  const wallets = getUserWallets(user, targetChain);

  if (wallets.length === 0) {
    await createWalletForUser(user, targetChain);
  }

  const activeWallet = wallets.find(w => w.isDefault) || wallets[0];
  activeWallet.balance = (activeWallet.balance || 0) + depositAmt;

  return ctx.reply(I18nService.t('msg.faucetSuccess', user.lang, { address: activeWallet.address, chain: MainMenu.getChainDisplayName(targetChain), amt: depositAmt, symbol: symbol, bal: activeWallet.balance }), { parse_mode: 'HTML' });
});

// 3. /switch_chain 指令: 切换链
bot.command('switch_chain', async ctx => {
  const user = getOrCreateUser(ctx.from?.id || 10001, ctx.from?.username);
  return ctx.reply(ChainMenu.renderText(user.lang), {
    reply_markup: ChainMenu.renderKeyboard(user.lang),
    parse_mode: 'HTML'
  });
});

// 4. /asset 指令: 查看代币持仓
bot.command('asset', async ctx => {
  const user = getOrCreateUser(ctx.from?.id || 10001, ctx.from?.username);
  await syncWalletBalances(user, user.activeChain);
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
  const user = getOrCreateUser(ctx.from?.id || 10001, ctx.from?.username);
  user.pendingAction = { type: 'query_ca' };
  return ctx.reply(
    `<b>💰 ${I18nService.getCommandDesc('buy_sell', user.lang)}</b>\n\n` +
    `${I18nService.t('trade.enterTokenAddress', user.lang) || '🔍 请在此发送目标代币合约地址 (CA) 进行快速买卖：'}`,
    { parse_mode: 'HTML' }
  );
});

// 6. /limit_order 指令: 查看挂单
bot.command('limit_order', async ctx => {
  const user = getOrCreateUser(ctx.from?.id || 10001, ctx.from?.username);
  const activeWallet = getUserWallets(user, user.activeChain).find(w => w.isDefault) || getUserWallets(user, user.activeChain)[0];
  return ctx.reply(LimitOrderMenu.renderText(activeWallet, user.limitOrders, user.lang), {
    reply_markup: LimitOrderMenu.renderKeyboard(user.lang),
    parse_mode: 'HTML'
  });
});

// 7. /copy_trade 指令: 查看跟单设置
bot.command('copy_trade', async ctx => {
  const user = getOrCreateUser(ctx.from?.id || 10001, ctx.from?.username);
  const activeWallet = getUserWallets(user, user.activeChain).find(w => w.isDefault) || getUserWallets(user, user.activeChain)[0];
  return ctx.reply(CopyTradeMenu.renderText(activeWallet, user.monitoredWallets.length, user.lang), {
    reply_markup: CopyTradeMenu.renderKeyboard(user.lang),
    parse_mode: 'HTML'
  });
});

// 8. /sniper 指令: 代币开盘狙击
bot.command('sniper', async ctx => {
  const user = getOrCreateUser(ctx.from?.id || 10001, ctx.from?.username);
  return ctx.reply(SnipeMenu.renderText(user.lang), {
    reply_markup: SnipeMenu.renderKeyboard(user.lang),
    parse_mode: 'HTML'
  });
});

// 9. /billing 指令: 查看历史交易&狙击记录
bot.command('billing', async ctx => {
  const user = getOrCreateUser(ctx.from?.id || 10001, ctx.from?.username);
  const activeWallet = getUserWallets(user, user.activeChain).find(w => w.isDefault) || getUserWallets(user, user.activeChain)[0];
  return ctx.reply(BillingMenu.renderText(user.activeChain, activeWallet, user.transactions, user.lang), {
    reply_markup: BillingMenu.renderKeyboard(user.activeChain, activeWallet, user.lang),
    parse_mode: 'HTML'
  });
});

// 10. /wallet_setting 指令: 钱包设置
bot.command('wallet_setting', async ctx => {
  const user = getOrCreateUser(ctx.from?.id || 10001, ctx.from?.username);
  await syncWalletBalances(user, user.activeChain);
  const wallets = getUserWallets(user, user.activeChain);
  return ctx.reply(WalletMenu.renderText(user.activeChain, wallets, user.lang), {
    reply_markup: WalletMenu.renderKeyboard(wallets, user.lang),
    parse_mode: 'HTML'
  });
});

// 11. /trade_setting 指令: 全局交易设置
bot.command('trade_setting', async ctx => {
  const user = getOrCreateUser(ctx.from?.id || 10001, ctx.from?.username);
  return ctx.reply(SettingsMenu.renderText(user.activeChain, user.tradeConfig, user.lang), {
    reply_markup: SettingsMenu.renderKeyboard(user.activeChain, user.tradeConfig, user.lang),
    parse_mode: 'HTML'
  });
});

// 12. /referral 指令: 查看邀请信息和奖励
bot.command('referral', async ctx => {
  const user = getOrCreateUser(ctx.from?.id || 10001, ctx.from?.username);
  return ctx.reply(ReferralMenu.renderText(user.userId, user.activeChain, user, user.lang), {
    reply_markup: ReferralMenu.renderKeyboard(user.lang),
    parse_mode: 'HTML'
  });
});

// 13. /mini_futures 指令: 迷你合约交易
bot.command('mini_futures', async ctx => {
  const user = getOrCreateUser(ctx.from?.id || 10001, ctx.from?.username);
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

// 14. /mcp 指令: MCP 智能体接入与接口配置
bot.command('mcp', async ctx => {
  const user = getOrCreateUser(ctx.from?.id || 10001, ctx.from?.username);
  const mcpPort = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 38088;
  return ctx.reply(McpMenu.renderText(user, mcpPort, user.lang), {
    reply_markup: McpMenu.renderKeyboard(user, user.lang),
    parse_mode: 'HTML'
  });
});

// 15. /radar 或 /hot 指令: Meme 爆点雷达实时候选榜
bot.command(['radar', 'hot'], async ctx => {
  const user = getOrCreateUser(ctx.from?.id || 10001, ctx.from?.username);
  const candidates = await MemeRadarService.scanRadarTokens(user.activeChain, { limit: 6 });
  return ctx.reply(RadarMenu.renderText(user.activeChain, candidates, user.lang), {
    reply_markup: RadarMenu.renderKeyboard(user.activeChain, candidates, user.lang),
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

    const { text, keyboard } = renderOnboardingChainView(selectedLang);
    return ctx.editMessageText(text, {
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

    // 如果该链尚未生成钱包，立即为用户生成首个原生钱包
    let currentWallets = getUserWallets(user, targetChain);
    if (currentWallets.length === 0) {
      await createWalletForUser(user, targetChain);
      currentWallets = getUserWallets(user, targetChain);
    }
    await syncWalletBalances(user, targetChain);
    saveUserStore();

    const chainName = MainMenu.getChainDisplayName(targetChain);
    const toast = user.lang === 'zh-hans' || user.lang === 'zh-hant'
      ? `🎉 已切换至 ${chainName}`
      : user.lang === 'vi'
      ? `🎉 Đã chuyển sang ${chainName}`
      : user.lang === 'ru'
      ? `🎉 Переключено на ${chainName}`
      : `🎉 Switched to ${chainName}`;

    await ctx.answerCallbackQuery({ text: toast });
    return ctx.editMessageText(MainMenu.renderText(targetChain, currentWallets, user.lang), {
      reply_markup: MainMenu.renderKeyboard(currentWallets, user.lang),
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

      let targetWallets = getUserWallets(user, targetChain);
      if (targetWallets.length === 0) {
        await createWalletForUser(user, targetChain);
        targetWallets = getUserWallets(user, targetChain);
      }
      await syncWalletBalances(user, targetChain);

      const resolvedAddress = TokenKeyHelper.toAddress(tokenKey);
      const botUser = bot.botInfo?.username || 'whitecat_doge_yr3ybv_bot';
      const { text: panelText, keyboard } = await TokenDetector.analyzeAndBuildView(
        targetChain,
        resolvedAddress,
        targetWallets,
        user.lang,
        0, 0, 0, 0,
        userId,
        botUser
      );

      await ctx.answerCallbackQuery({
        text: `✅ ${MainMenu.getChainDisplayName(targetChain)}`
      });

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
    return ctx.editMessageText(MainMenu.renderText(user.activeChain, currentWallets, user.lang), {
      reply_markup: MainMenu.renderKeyboard(currentWallets, user.lang),
      parse_mode: 'HTML'
    });
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
      reply_markup: MainMenu.renderKeyboard(currentWallets, user.lang),
      parse_mode: 'HTML'
    });
  }

  // F. 导入钱包
  if (data === 'import_wallet') {
    await ctx.answerCallbackQuery();
    return ctx.reply(
      I18nService.t('msg.importWalletHint', user.lang)
    );
  }

  // G. 刷新主页 / 返回
  if (data === 'menu_main' || data === 'menu_close' || data === 'close') {
    await syncWalletBalances(user, user.activeChain);
    await ctx.answerCallbackQuery();
    const currentWallets = getUserWallets(user);
    return ctx.editMessageText(MainMenu.renderText(user.activeChain, currentWallets, user.lang), {
      reply_markup: MainMenu.renderKeyboard(currentWallets, user.lang),
      parse_mode: 'HTML'
    });
  }

  // G.1 🤖 MCP 智能体接入面板
  if (data === 'menu_mcp') {
    await ctx.answerCallbackQuery();
    const mcpPort = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 38088;
    return ctx.editMessageText(McpMenu.renderText(user, mcpPort, user.lang), {
      reply_markup: McpMenu.renderKeyboard(user, user.lang),
      parse_mode: 'HTML'
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
    const currentWallets = getUserWallets(user);
    const holding = user.tokenHoldings.get(tokenAddress.toLowerCase());
    const userHolding = holding?.amount || 0;
    const userHoldingNative = holding?.costNative || 0;
    const botUser = ctx.me?.username || 'whitecat_doge_yr3ybv_bot';

    const { text: panelText, keyboard } = await TokenDetector.analyzeAndBuildView(
      user.activeChain,
      tokenAddress,
      currentWallets,
      user.lang,
      userHolding,
      userHoldingNative,
      0,
      0,
      user.userId,
      botUser
    );

    return ctx.editMessageText(panelText, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
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
    await syncWalletBalances(user, user.activeChain);
    await ctx.answerCallbackQuery({ text: I18nService.t('msg.refreshedBalances', user.lang) });
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
    return ctx.reply(I18nService.t('msg.enterNewLabel', user.lang));
  }

  if (data === 'export_private_key') {
    await ctx.answerCallbackQuery();
    if (!activeWallet) return;
    const pk = activeWallet.privateKey || '' ;
    return ctx.reply(
      I18nService.t('msg.privateKeyWarning', user.lang, { index: activeWallet.index + 1, address: activeWallet.address, pk: pk }),
      { parse_mode: 'HTML' }
    );
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

  if (data.startsWith('set_buy_') || data.startsWith('set_sell_')) {
    await ctx.answerCallbackQuery();
    return ctx.reply(
      I18nService.t('msg.enterPreset', user.lang)
    );
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
    return ctx.editMessageText(LimitOrderMenu.renderText(activeWallet, user.limitOrders, user.lang), {
      reply_markup: LimitOrderMenu.renderKeyboard(user.lang),
      parse_mode: 'HTML'
    });
  }

  if (data === 'limit_add') {
    await ctx.answerCallbackQuery();
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
    await syncWalletBalances(user, targetChain);
    await ctx.answerCallbackQuery({ text: I18nService.t('msg.refreshingLive', user.lang) });
    const market = await TokenMarketService.fetchTokenDetails(ca, targetChain);
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
      reply_markup: TradeMenu.renderKeyboard(targetChain, ca, user.lang),
      parse_mode: 'HTML'
    });
  }

  // Q. 买入操作指令响应 (Fast Buy)
  if (data.startsWith('buy_') && !data.startsWith('buy_x_') || data.startsWith('mbac?')) {
    let rawToken = '';
    let presetIdx = 1;
    let explicitBuyAmount: number | null = null;

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
      const parts = data.split('_');
      // Format: buy_${tKey}_${idx} or buy_${chain}_${tKey}_${idx}
      if (parts.length === 3) {
        rawToken = parts[1];
        presetIdx = parseInt(parts[2]) || 1;
      } else if (parts.length >= 4) {
        rawToken = parts[2];
        presetIdx = parseInt(parts[3]) || 1;
      }
    }

    const tokenAddress = TokenKeyHelper.toAddress(rawToken);
    const targetChain = resolveChainForToken(tokenAddress, user.activeChain);
    await syncWalletBalances(user, targetChain);
    const chainSymbol = MainMenu.getChainNativeSymbol(targetChain);

    const solPresets = [0.1, 0.5, 1, 2, 5];
    const suiPresets = [0.05, 0.1, 0.2, 0.5, 1];
    const bscPresets = user.tradeConfig.buyPresets || [0.02, 0.05, 0.1, 0.2, 0.5];

    let buyAmount = explicitBuyAmount !== null
      ? explicitBuyAmount
      : (targetChain === 'solana'
          ? (solPresets[presetIdx - 1] || 0.1)
          : targetChain === 'sui'
          ? (suiPresets[presetIdx - 1] || 0.1)
          : (bscPresets[presetIdx - 1] || 0.02));

    const targetWallets = getUserWallets(user, targetChain);
    const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];

    if (!targetWallet || (targetWallet.balance || 0) < buyAmount) {
      await ctx.answerCallbackQuery({ text: I18nService.t('msg.insufficientBalance', user.lang), show_alert: true });
      return ctx.reply(I18nService.t('msg.insufficientBalance', user.lang));
    }

    await ctx.answerCallbackQuery({ text: I18nService.t('msg.turboExecuting', user.lang) });

    const result = await OnChainSwapService.executeFastBuy({
      userId: user.userId,
      chain: targetChain,
      walletAddress: targetWallet.address,
      privateKey: targetWallet.privateKey,
      tokenAddress,
      amountNative: buyAmount,
      slippagePct: user.tradeConfig.slippage,
      priorityFeeTier: user.tradeConfig.mode === 'fast' ? 'turbo' : 'normal'
    });

    if (result.status !== 'SUCCESS' || result.error) {
      return ctx.reply(
        I18nService.t('msg.buyFailed', user.lang, { error: result.error || 'Execution failed' }),
        { parse_mode: 'HTML' }
      );
    }

    if (result.isRealOnChain) {
      await new Promise(r => setTimeout(r, 1500));
      await syncWalletBalances(user, targetChain);
      await syncTokenHoldings(user, targetChain);
    } else {
      targetWallet.balance = parseFloat(Math.max((targetWallet.balance || 0) - buyAmount, 0).toFixed(4));

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
    const rawToken = data.startsWith('mbai?') ? data.replace('mbai?', '') : data.replace('buy_x_', '');
    const tokenAddress = TokenKeyHelper.toAddress(rawToken);
    const targetChain = resolveChainForToken(tokenAddress, user.activeChain);
    await syncWalletBalances(user, targetChain);
    const chainSymbol = MainMenu.getChainNativeSymbol(targetChain);

    await ctx.answerCallbackQuery();
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

    if (data.startsWith('msac?')) {
      const payload = data.replace('msac?', '');
      const parts = payload.includes('&') ? payload.split('&') : payload.split('-');
      rawToken = parts[0];
      sellPct = parseInt(parts[1]) || 50;
    } else {
      const parts = data.split('_');
      // Format: sell_${tKey}_${pct} or sell_${chain}_${tKey}_${pct}
      if (parts.length === 3) {
        rawToken = parts[1];
        sellPct = parseInt(parts[2]) || 50;
      } else if (parts.length >= 4) {
        rawToken = parts[2];
        sellPct = parseInt(parts[3]) || 50;
      }
    }

    const tokenAddress = TokenKeyHelper.toAddress(rawToken);
    const targetChain = resolveChainForToken(tokenAddress, user.activeChain);
    await syncWalletBalances(user, targetChain);
    const chainSymbol = MainMenu.getChainNativeSymbol(targetChain);
    const targetWallets = getUserWallets(user, targetChain);
    const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];

    const lowerCa = tokenAddress.toLowerCase();
    const holdingObj = user.tokenHoldings.get(lowerCa);
    const holding = holdingObj ? holdingObj.amount : 0;
    if (holding <= 0) {
      await ctx.answerCallbackQuery({ text: I18nService.t('msg.insufficientBalance', user.lang), show_alert: true });
      return ctx.reply(I18nService.t('msg.insufficientBalance', user.lang));
    }

    await ctx.answerCallbackQuery({ text: I18nService.t('msg.sellingExecuting', user.lang) });

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
      slippagePct: user.tradeConfig.slippage
    });

    if (result.status !== 'SUCCESS' || result.error) {
      return ctx.reply(
        I18nService.t('msg.sellFailed', user.lang, { error: result.error || 'Execution failed' }),
        { parse_mode: 'HTML' }
      );
    }

    if (result.isRealOnChain) {
      await new Promise(r => setTimeout(r, 1500));
      await syncWalletBalances(user, targetChain);
      await syncTokenHoldings(user, targetChain);
    } else {
      const remainingTokens = holding * (1 - sellPct / 100);
      if (remainingTokens <= 0.0001) {
        user.tokenHoldings.delete(lowerCa);
      } else if (holdingObj) {
        holdingObj.amount = remainingTokens;
        holdingObj.costNative = parseFloat((holdingObj.costNative * (1 - sellPct / 100)).toFixed(4));
        holdingObj.totalSoldNative = parseFloat(((holdingObj.totalSoldNative ?? 0) + result.estimatedAmountOut).toFixed(4));
        user.tokenHoldings.set(lowerCa, holdingObj);
      }

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
    const rawToken = data.startsWith('msai?') ? data.replace('msai?', '') : data.replace('sell_x_', '');
    const tokenAddress = TokenKeyHelper.toAddress(rawToken);
    const targetChain = resolveChainForToken(tokenAddress, user.activeChain);
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
    user.limitOrders.push({
      id: `tp1_${Date.now()}`,
      tokenAddress,
      symbol: holdingObj?.symbol || 'TOKEN',
      orderType: 'SELL',
      triggerPrice: 0.00004,
      amount: holding * 0.5
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
    user.limitOrders.push({
      id: `tp2_${Date.now()}`,
      tokenAddress,
      symbol: holdingObj?.symbol || 'TOKEN',
      orderType: 'SELL',
      triggerPrice: 0.0002,
      amount: holding
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
      const targetChain = action.data.chain || resolveChainForToken(tokenAddress, user.activeChain);
      const chainSymbol = MainMenu.getChainNativeSymbol(targetChain);
      const targetWallets = getUserWallets(user, targetChain);
      const targetWallet = targetWallets.find(w => w.isDefault) || targetWallets[0];

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

      if (result.status !== 'SUCCESS' || result.error) {
        return ctx.reply(
          I18nService.t('msg.buyFailed', user.lang, { error: result.error || 'Execution failed' }),
          { parse_mode: 'HTML' }
        );
      }

      if (result.isRealOnChain) {
        await new Promise(r => setTimeout(r, 1500));
        await syncWalletBalances(user, targetChain);
        await syncTokenHoldings(user, targetChain);
      } else {
        targetWallet.balance = parseFloat(Math.max((targetWallet.balance || 0) - amt, 0).toFixed(4));

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
      const holdingObj = user.tokenHoldings.get(lowerCa);
      const holding = holdingObj ? holdingObj.amount : 0;
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
        slippagePct: user.tradeConfig.slippage
      });

      if (result.status !== 'SUCCESS' || result.error) {
        return ctx.reply(
          I18nService.t('msg.sellFailed', user.lang, { error: result.error || 'Execution failed' }),
          { parse_mode: 'HTML' }
        );
      }

      if (result.isRealOnChain) {
        await new Promise(r => setTimeout(r, 1500));
        await syncWalletBalances(user, targetChain);
        await syncTokenHoldings(user, targetChain);
      } else {
        const remainingTokens = holding * (1 - pct / 100);
        if (remainingTokens <= 0.0001) {
          user.tokenHoldings.delete(lowerCa);
        } else if (holdingObj) {
          holdingObj.amount = remainingTokens;
          holdingObj.costNative = parseFloat((holdingObj.costNative * (1 - pct / 100)).toFixed(4));
          holdingObj.totalSoldNative = parseFloat(((holdingObj.totalSoldNative ?? 0) + result.estimatedAmountOut).toFixed(4));
          user.tokenHoldings.set(lowerCa, holdingObj);
        }

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
        user.tradeConfig.gasTip = tip;
      }
      return ctx.reply(
        I18nService.t('msg.gasTipUpdated', user.lang, { tip: user.tradeConfig.gasTip, symbol: nativeSymbol }),
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
      // 6. 转账 token (代币)
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
          const txHash = OnChainSwapService.generateChainTxHash(user.activeChain);
          const txUrl = getChainTxUrl(user.activeChain, txHash);
          const shortHash = txHash.length > 16 ? `${txHash.slice(0, 8)}...${txHash.slice(-6)}` : txHash;

          if (amt > 0 && targetWallet) {
            recordUserTransaction(user, {
              chain: user.activeChain,
              type: 'TRANSFER',
              walletAddress: targetWallet.address,
              tokenAddress: ca,
              tokenSymbol: 'TOKEN',
              tokenName: 'Token',
              amountNative: 0,
              amountToken: amt,
              txHash
            });
            saveUserStore();
          }

          return ctx.reply(
            isZh
              ? `✅ <b>代币转账指令已成功广播至区块链网络！</b>\n\n` +
                `📈 数量: <b>${amt}</b>\n` +
                `📥 目标地址: <code>${toAddr}</code>\n` +
                `🔗 交易哈希: <a href="${txUrl}">${shortHash}</a>`
              : `✅ <b>Token transfer broadcasted successfully!</b>\n\n` +
                `📈 Amount: <b>${amt}</b>\n` +
                `📥 Recipient: <code>${toAddr}</code>\n` +
                `🔗 Tx Hash: <a href="${txUrl}">${shortHash}</a>`,
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
        const txHash = OnChainSwapService.generateChainTxHash(user.activeChain);
        const txUrl = getChainTxUrl(user.activeChain, txHash);
        const shortHash = txHash.length > 16 ? `${txHash.slice(0, 8)}...${txHash.slice(-6)}` : txHash;

        if (targetWallet) {
          recordUserTransaction(user, {
            chain: user.activeChain,
            type: 'TRANSFER',
            walletAddress: targetWallet.address,
            tokenAddress: ca,
            tokenSymbol: 'TOKEN',
            tokenName: 'Token',
            amountNative: 0,
            amountToken: amt,
            txHash
          });
          saveUserStore();
        }

        return ctx.reply(
          isZh
            ? `✅ <b>代币转账指令已成功广播至区块链网络！</b>\n\n` +
              `📈 数量: <b>${amt}</b>\n` +
              `📥 目标地址: <code>${toAddr}</code>\n` +
              `🔗 交易哈希: <a href="${txUrl}">${shortHash}</a>`
            : `✅ <b>Token transfer broadcasted successfully!</b>\n\n` +
              `📈 Amount: <b>${amt}</b>\n` +
              `📥 Recipient: <code>${toAddr}</code>\n` +
              `🔗 Tx Hash: <a href="${txUrl}">${shortHash}</a>`,
          { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
        );
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
      // 同步链上最新真实余额 (例如用户充值的 1 SUI)
      await syncWalletBalances(user, targetChain);

    const lowerCa = resolvedAddress.toLowerCase();
    const holdingObj = user.tokenHoldings.get(lowerCa);
    const userHolding = holdingObj && holdingObj.amount > 1e-4 ? holdingObj.amount : 0;
    const userHoldingNative = holdingObj && holdingObj.amount > 1e-4 ? holdingObj.costNative : 0;

    console.log(`[TokenDetector] Querying token ${resolvedAddress} on chain ${targetChain} for user ${userId} (holding: ${userHolding}, cost: ${userHoldingNative})...`);
    const botUser = bot.botInfo?.username || 'whitecat_doge_yr3ybv_bot';
    const { text: panelText, keyboard } = await TokenDetector.analyzeAndBuildView(
      targetChain,
      resolvedAddress,
      currentWallets,
      user.lang,
      userHolding,
      userHoldingNative,
      0,
      0,
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
