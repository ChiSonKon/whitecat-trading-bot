import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getOrCreateUser,
  getUserWallets,
  syncWalletBalances,
  recordUserTransaction,
  processTradeReferralAndFee,
  verifyMcpAuth,
  UserState,
  userStore
} from '../services/userService.js';
import { OnChainSwapService } from '../services/onChainSwapService.js';
import { TokenMarketService } from '../services/tokenMarketService.js';
import { ChainBalanceService } from '../services/chainBalanceService.js';
import { TokenDetector } from '../handlers/tokenDetector.js';
import { TokenKeyHelper } from '../services/tokenKeyHelper.js';
import { BillingMenu } from '../menus/billingMenu.js';
import { MainMenu } from '../menus/mainMenu.js';
import { MemeRadarService } from '../services/memeRadarService.js';

export interface McpServerOptions {
  name?: string;
  version?: string;
  defaultUserId?: number;
  defaultToken?: string;
}

export function createWhiteCatMcpServer(options: McpServerOptions = {}): McpServer {
  const server = new McpServer({
    name: options.name || 'whitecat-trading-bot-mcp',
    version: options.version || '1.0.0'
  });

  // 内部鉴权解析辅助函数
  const resolveUser = (userIdArg?: number, tokenArg?: string): { user?: UserState; error?: string } => {
    const targetUid = userIdArg || options.defaultUserId || (process.env.WHITECAT_USER_ID ? parseInt(process.env.WHITECAT_USER_ID, 10) : undefined);
    const targetToken = tokenArg || options.defaultToken || process.env.WHITECAT_MCP_TOKEN;

    if (targetUid) {
      const auth = verifyMcpAuth(targetUid, targetToken);
      if (!auth.valid || !auth.user) {
        return { error: auth.error || 'MCP 认证失败' };
      }
      return { user: auth.user };
    }

    // 若未显式传入 UID，但提供了 Token
    if (targetToken) {
      const auth = verifyMcpAuth(targetToken);
      if (auth.valid && auth.user) {
        return { user: auth.user };
      }
    }

    // 单用户开发调试模式兜底：取第一个已存在用户
    if (userStore.size > 0) {
      const firstUser = userStore.values().next().value;
      if (firstUser) {
        return { user: firstUser };
      }
    }

    return { error: '未指定有效的 WhiteCat 用户 ID 或 MCP 授权 Token。请在参数中提供或设置 WHITECAT_USER_ID 与 WHITECAT_MCP_TOKEN 环境变量。' };
  };

  // ==========================================
  // 1. 账户与配置工具 (Account & Configuration)
  // ==========================================

  server.tool(
    'whitecat_get_account_info',
    '获取 WhiteCat 用户的当前交易链、已配置钱包列表、各链资产余额以及智能体安全管控状态',
    {
      userId: z.number().optional().describe('Telegram 用户 ID (可选，若已在环境配置则可忽略)'),
      token: z.string().optional().describe('用户 MCP 授权密钥 (可选)')
    },
    async ({ userId, token }) => {
      const { user, error } = resolveUser(userId, token);
      if (!user) return { isError: true, content: [{ type: 'text', text: `[Auth Error] ${error}` }] };

      await syncWalletBalances(user, user.activeChain);
      const wallets = getUserWallets(user, user.activeChain);

      const holdings: any[] = [];
      user.tokenHoldings.forEach(h => {
        if (h.amount > 0) {
          holdings.push({
            tokenAddress: h.tokenAddress,
            symbol: h.symbol,
            chain: h.chain,
            amount: h.amount,
            costNative: h.costNative
          });
        }
      });

      const responseData = {
        userId: user.userId,
        username: user.username,
        activeChain: user.activeChain,
        activeChainDisplayName: MainMenu.getChainDisplayName(user.activeChain),
        nativeSymbol: MainMenu.getChainNativeSymbol(user.activeChain),
        wallets: wallets.map(w => ({
          index: w.index + 1,
          name: `Wallet_${w.index + 1}`,
          address: w.address,
          balance: w.balance ?? 0,
          isDefault: w.isDefault
        })),
        tokenHoldings: holdings,
        tradeConfig: user.tradeConfig,
        mcpSecurity: {
          autoTradeEnabled: user.mcpAutoTradeEnabled !== false,
          maxTradeLimitNative: user.mcpMaxTradeLimit ?? 0.5
        }
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
      };
    }
  );

  server.tool(
    'whitecat_switch_chain',
    '切换用户的当前活跃交易公链 (支持 bsc, sui, solana, base, ethereum, robinhood, sei, ton, xlayer, aptos)',
    {
      chain: z.enum(['bsc', 'sui', 'solana', 'base', 'ethereum', 'robinhood', 'sei', 'ton', 'xlayer', 'aptos']).describe('目标切换公链标识'),
      userId: z.number().optional(),
      token: z.string().optional()
    },
    async ({ chain, userId, token }) => {
      const { user, error } = resolveUser(userId, token);
      if (!user) return { isError: true, content: [{ type: 'text', text: `[Auth Error] ${error}` }] };

      user.activeChain = chain.toLowerCase();
      await syncWalletBalances(user, user.activeChain);
      const wallets = getUserWallets(user, user.activeChain);

      return {
        content: [
          {
            type: 'text',
            text: `✅ 成功切换至公链: ${MainMenu.getChainDisplayName(chain)} (原生币: ${MainMenu.getChainNativeSymbol(chain)})。\n当前活跃钱包: ${wallets[0]?.address || '暂无钱包 (请先创建)'}，余额: ${wallets[0]?.balance ?? 0} ${MainMenu.getChainNativeSymbol(chain)}`
          }
        ]
      };
    }
  );

  // ==========================================
  // 2. 实时行情与貔貅风控工具 (Market & Security)
  // ==========================================

  server.tool(
    'whitecat_query_token_market',
    '查询指定代币的链上实时行情，包括美元与原生币价格、市值、池子流动性、24小时交易量及 DexScreener 页面',
    {
      tokenAddress: z.string().describe('代币合约地址或 Sui Move TypeTag 结构体'),
      chain: z.string().optional().describe('公链标识 (默认使用用户当前活跃链或自动检测)')
    },
    async ({ tokenAddress, chain }) => {
      const fullCa = TokenKeyHelper.toAddress(tokenAddress);
      const targetChain = chain || TokenDetector.isTokenContract(fullCa).type || 'bsc';
      try {
        const data = await TokenMarketService.fetchTokenDetails(fullCa, targetChain);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  address: fullCa,
                  chain: targetChain,
                  symbol: data.symbol,
                  name: data.name,
                  priceUsd: `$${data.priceUsd}`,
                  priceNative: `${data.priceNative} ${MainMenu.getChainNativeSymbol(targetChain)}`,
                  marketCapUsd: `$${data.marketCapUsd.toLocaleString()}`,
                  liquidityNative: `${data.liquidityNative} ${MainMenu.getChainNativeSymbol(targetChain)}`,
                  holdersCount: data.holdersCount,
                  riskLevel: data.riskLevel,
                  dexscreenerUrl: data.dexscreenerUrl,
                  dextoolsUrl: data.dextoolsUrl
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `查询代币行情失败: ${err?.message || err}` }]
        };
      }
    }
  );

  server.tool(
    'whitecat_check_token_security',
    '使用 GoPlus 等安全引擎对代币合约进行全方位风控审计 (检测貔貅盘、高额滑点税、防跑路特征、增发权限等)',
    {
      tokenAddress: z.string().describe('待检测代币合约地址'),
      chain: z.string().optional().describe('公链标识 (默认 bsc)')
    },
    async ({ tokenAddress, chain = 'bsc' }) => {
      const fullCa = TokenKeyHelper.toAddress(tokenAddress);
      try {
        const data = await TokenMarketService.fetchTokenDetails(fullCa, chain);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  tokenAddress: fullCa,
                  chain,
                  symbol: data.symbol,
                  riskAssessment: data.riskLevel,
                  isSafeToTrade: !data.riskLevel.includes('High Risk'),
                  summary: data.riskLevel.includes('High Risk')
                    ? '⚠️ 高危代币！检测到貔貅盘或无法卖出风险，请切勿买入！'
                    : '🟢 安全检测通过：未发现不可卖出或恶性税率特征。'
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `合约安全审计失败: ${err?.message || err}` }]
        };
      }
    }
  );

  server.tool(
    'whitecat_get_balance',
    '查询指定地址在某公链的原生代币实时链上余额',
    {
      address: z.string().describe('待查询的目标链上钱包地址'),
      chain: z.string().describe('目标公链 (如 bsc, sui, solana, base, ethereum 等)')
    },
    async ({ address, chain }) => {
      try {
        const bal = await ChainBalanceService.getNativeBalance(chain, address);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                chain,
                address,
                balance: bal,
                nativeSymbol: MainMenu.getChainNativeSymbol(chain)
              })
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `查询链上余额失败: ${err?.message || err}` }]
        };
      }
    }
  );

  // ==========================================
  // 3. 极速交易执行工具 (Trading Operations)
  // ==========================================

  server.tool(
    'whitecat_fast_buy',
    '使用用户的活跃钱包执行闪电买入操作。严格受到单笔限额校验、自主交易授权与链上 0 余额真实拦截防护。',
    {
      tokenAddress: z.string().describe('要买入的目标代币合约地址或 Sui TypeTag'),
      amountNative: z.number().positive().describe('买入消耗的原生代币数量 (例如 0.05 BNB, 0.1 SUI, 0.02 SOL)'),
      chain: z.string().optional().describe('指定公链 (可选，默认使用活跃链)'),
      slippage: z.number().optional().describe('自定义滑点百分比 (例如 10 代表 10%)'),
      userId: z.number().optional(),
      token: z.string().optional()
    },
    async ({ tokenAddress, amountNative, chain, slippage, userId, token }) => {
      const { user, error } = resolveUser(userId, token);
      if (!user) return { isError: true, content: [{ type: 'text', text: `[Auth Error] ${error}` }] };

      // 1. 安全护栏: 验证 Agent 自主交易开关
      if (user.mcpAutoTradeEnabled === false) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: '🚫 [安全拦截] 该用户尚未开启 MCP Agent 自主交易权限。请通知用户在 Telegram 机器人的 /mcp 面板中点击【🛡 允许自主交易】进行授权。'
            }
          ]
        };
      }

      // 2. 安全护栏: 单笔最大额度拦截
      const maxLimit = user.mcpMaxTradeLimit ?? 0.5;
      if (amountNative > maxLimit) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `🚫 [安全拦截] 买入金额 (${amountNative}) 超出单笔交易安全上限 (${maxLimit} 原生币)。操作已拒绝。`
            }
          ]
        };
      }

      const fullCa = TokenKeyHelper.toAddress(tokenAddress);
      const targetChain = (chain || user.activeChain).toLowerCase();
      await syncWalletBalances(user, targetChain);
      const wallets = getUserWallets(user, targetChain);
      const activeWallet = wallets.find(w => w.isDefault) || wallets[0];

      if (!activeWallet) {
        return {
          isError: true,
          content: [{ type: 'text', text: `当前在 ${targetChain} 链上尚未配置钱包，请先生成或导入钱包。` }]
        };
      }

      // 3. 严格 0 余额拦截
      const currentBal = activeWallet.balance ?? 0;
      if (currentBal <= 0 || currentBal < amountNative) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `🚫 [余额不足] 钱包 ${activeWallet.address} 当前余额为 ${currentBal} ${MainMenu.getChainNativeSymbol(targetChain)}，无法支付 ${amountNative} 买入金额。`
            }
          ]
        };
      }

      try {
        const effectiveSlippage = slippage || user.tradeConfig.slippage || 50;
        const result = await OnChainSwapService.executeFastBuy({
          userId: user.userId,
          chain: targetChain,
          tokenAddress: fullCa,
          amountNative: amountNative,
          walletAddress: activeWallet.address,
          privateKey: activeWallet.privateKey,
          slippagePct: effectiveSlippage
        });

        // 记录账单与更新持仓
        recordUserTransaction(user, {
          chain: targetChain,
          type: 'BUY',
          walletAddress: activeWallet.address,
          tokenAddress: fullCa,
          tokenSymbol: result.tokenSymbol || 'TOKEN',
          tokenName: result.tokenName || 'Token',
          amountNative: amountNative,
          amountToken: result.estimatedAmountOut,
          txHash: result.txHash,
          status: result.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
          isRealOnChain: result.isRealOnChain
        });

        processTradeReferralAndFee(user, amountNative);
        await syncWalletBalances(user, targetChain);

        const txUrl = BillingMenu.getChainTxUrl(targetChain, result.txHash);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: result.status !== 'FAILED',
                  chain: targetChain,
                  token: result.tokenSymbol,
                  spentNative: `${amountNative} ${MainMenu.getChainNativeSymbol(targetChain)}`,
                  receivedTokens: result.estimatedAmountOut,
                  txHash: result.txHash,
                  isRealOnChain: result.isRealOnChain,
                  explorerUrl: txUrl,
                  executionTimeMs: result.executionTimeMs
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `买入交易失败: ${err?.message || err}` }]
        };
      }
    }
  );

  server.tool(
    'whitecat_fast_sell',
    '使用用户的活跃钱包执行闪电卖出操作 (支持按百分比 25%/50%/100% 或指定代币数量卖出)',
    {
      tokenAddress: z.string().describe('要卖出的持仓代币合约地址'),
      percent: z.number().min(1).max(100).optional().describe('卖出百分比 (如 50 代表 50%, 100 代表全部清仓)'),
      amountToken: z.number().positive().optional().describe('直接指定要卖出的代币数量 (与 percent 二选一)'),
      chain: z.string().optional().describe('指定公链'),
      userId: z.number().optional(),
      token: z.string().optional()
    },
    async ({ tokenAddress, percent = 100, amountToken, chain, userId, token }) => {
      const { user, error } = resolveUser(userId, token);
      if (!user) return { isError: true, content: [{ type: 'text', text: `[Auth Error] ${error}` }] };

      if (user.mcpAutoTradeEnabled === false) {
        return {
          isError: true,
          content: [{ type: 'text', text: '🚫 [安全拦截] 该用户尚未开启 MCP Agent 自主交易权限。' }]
        };
      }

      const fullCa = TokenKeyHelper.toAddress(tokenAddress);
      const targetChain = (chain || user.activeChain).toLowerCase();
      const wallets = getUserWallets(user, targetChain);
      const activeWallet = wallets.find(w => w.isDefault) || wallets[0];

      if (!activeWallet) {
        return { isError: true, content: [{ type: 'text', text: `在 ${targetChain} 链上未找到可用钱包。` }] };
      }

      // 查询本地持仓
      const lowerCa = fullCa.toLowerCase();
      const holding = user.tokenHoldings.get(lowerCa);
      const totalHoldingAmount = holding?.amount || 0;

      let sellAmount = amountToken;
      if (!sellAmount) {
        if (totalHoldingAmount <= 0) {
          return { isError: true, content: [{ type: 'text', text: `🚫 钱包中未检测到该代币持仓，无法执行卖出。` }] };
        }
        sellAmount = (totalHoldingAmount * percent) / 100;
      }

      try {
        const effectivePercentage = amountToken ? Math.min(100, Math.round((amountToken / Math.max(totalHoldingAmount, 0.0001)) * 100)) : percent;
        const result = await OnChainSwapService.executeFastSell({
          userId: user.userId,
          chain: targetChain,
          tokenAddress: fullCa,
          walletAddress: activeWallet.address,
          privateKey: activeWallet.privateKey,
          sellPercentage: effectivePercentage,
          totalTokenBalance: totalHoldingAmount > 0 ? totalHoldingAmount : (sellAmount || 1),
          costBasisNative: holding?.costNative || 0.1,
          slippagePct: user.tradeConfig.slippage || 50
        });

        // 扣减持仓
        if (holding) {
          holding.amount = Math.max(0, holding.amount - sellAmount);
          holding.totalSoldNative = (holding.totalSoldNative || 0) + (result.estimatedAmountOut || 0);
        }

        recordUserTransaction(user, {
          chain: targetChain,
          type: 'SELL',
          walletAddress: activeWallet.address,
          tokenAddress: fullCa,
          tokenSymbol: result.tokenSymbol || 'TOKEN',
          amountNative: result.estimatedAmountOut,
          amountToken: sellAmount,
          txHash: result.txHash,
          status: result.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
          isRealOnChain: result.isRealOnChain
        });

        await syncWalletBalances(user, targetChain);
        const txUrl = BillingMenu.getChainTxUrl(targetChain, result.txHash);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: result.status !== 'FAILED',
                  chain: targetChain,
                  soldTokens: sellAmount,
                  receivedNative: `${result.estimatedAmountOut} ${MainMenu.getChainNativeSymbol(targetChain)}`,
                  txHash: result.txHash,
                  isRealOnChain: result.isRealOnChain,
                  explorerUrl: txUrl
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `卖出交易失败: ${err?.message || err}` }]
        };
      }
    }
  );

  server.tool(
    'whitecat_transfer',
    '将原生代币执行链上真实转账至指定收款地址',
    {
      toAddress: z.string().describe('收款方链上地址'),
      amount: z.number().positive().describe('转账原生代币数量'),
      chain: z.string().optional().describe('公链标识'),
      userId: z.number().optional(),
      token: z.string().optional()
    },
    async ({ toAddress, amount, chain, userId, token }) => {
      const { user, error } = resolveUser(userId, token);
      if (!user) return { isError: true, content: [{ type: 'text', text: `[Auth Error] ${error}` }] };

      if (user.mcpAutoTradeEnabled === false) {
        return { isError: true, content: [{ type: 'text', text: '🚫 [安全拦截] 该用户尚未开启 MCP Agent 自主交易权限。' }] };
      }

      const targetChain = (chain || user.activeChain).toLowerCase();
      const wallets = getUserWallets(user, targetChain);
      const activeWallet = wallets.find(w => w.isDefault) || wallets[0];

      if (!activeWallet) {
        return { isError: true, content: [{ type: 'text', text: `未找到 ${targetChain} 钱包` }] };
      }

      if ((activeWallet.balance ?? 0) < amount) {
        return {
          isError: true,
          content: [{ type: 'text', text: `余额不足: 当前余额 ${activeWallet.balance} < 拟转账数量 ${amount}` }]
        };
      }

      try {
        const res = await OnChainSwapService.executeTransferNative({
          chain: targetChain,
          fromAddress: activeWallet.address,
          toAddress,
          amount,
          privateKey: activeWallet.privateKey
        });

        recordUserTransaction(user, {
          chain: targetChain,
          type: 'TRANSFER',
          walletAddress: activeWallet.address,
          tokenAddress: 'NATIVE',
          tokenSymbol: MainMenu.getChainNativeSymbol(targetChain),
          amountNative: amount,
          amountToken: 0,
          txHash: res.txHash,
          status: res.success ? 'SUCCESS' : 'FAILED',
          isRealOnChain: res.isRealOnChain
        });

        await syncWalletBalances(user, targetChain);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: res.success,
                chain: targetChain,
                amount,
                toAddress,
                txHash: res.txHash,
                isRealOnChain: res.isRealOnChain,
                explorerUrl: BillingMenu.getChainTxUrl(targetChain, res.txHash)
              })
            }
          ]
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `转账失败: ${err?.message || err}` }] };
      }
    }
  );

  // ==========================================
  // 4. 挂单与跟单工具 (Limit Orders & Copy Trade)
  // ==========================================

  server.tool(
    'whitecat_list_limit_orders',
    '查询用户当前所有的限价挂单列表',
    {
      userId: z.number().optional(),
      token: z.string().optional()
    },
    async ({ userId, token }) => {
      const { user, error } = resolveUser(userId, token);
      if (!user) return { isError: true, content: [{ type: 'text', text: `[Auth Error] ${error}` }] };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(user.limitOrders || [], null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    'whitecat_create_limit_order',
    '创建新的限价单 (到达指定目标价格时触发买入或卖出)',
    {
      tokenAddress: z.string().describe('代币合约地址'),
      symbol: z.string().describe('代币符号'),
      orderType: z.enum(['BUY', 'SELL']).describe('挂单类型 (BUY 或 SELL)'),
      triggerPrice: z.number().positive().describe('触发目标美元价格'),
      amount: z.number().positive().describe('交易数量'),
      userId: z.number().optional(),
      token: z.string().optional()
    },
    async ({ tokenAddress, symbol, orderType, triggerPrice, amount, userId, token }) => {
      const { user, error } = resolveUser(userId, token);
      if (!user) return { isError: true, content: [{ type: 'text', text: `[Auth Error] ${error}` }] };

      const orderId = `order_${Date.now()}`;
      const newOrder = {
        id: orderId,
        tokenAddress: TokenKeyHelper.toAddress(tokenAddress),
        symbol,
        orderType,
        triggerPrice,
        amount
      };

      if (!user.limitOrders) user.limitOrders = [];
      user.limitOrders.push(newOrder);

      return {
        content: [
          {
            type: 'text',
            text: `✅ 挂单创建成功: [${orderType}] ${symbol} 目标价: $${triggerPrice}, 数量: ${amount} (ID: ${orderId})`
          }
        ]
      };
    }
  );

  server.tool(
    'whitecat_cancel_limit_order',
    '撤销已存在的限价挂单',
    {
      orderId: z.string().describe('要撤销的挂单 ID'),
      userId: z.number().optional(),
      token: z.string().optional()
    },
    async ({ orderId, userId, token }) => {
      const { user, error } = resolveUser(userId, token);
      if (!user) return { isError: true, content: [{ type: 'text', text: `[Auth Error] ${error}` }] };

      const initialLen = user.limitOrders?.length || 0;
      user.limitOrders = (user.limitOrders || []).filter(o => o.id !== orderId);

      if (user.limitOrders.length === initialLen) {
        return { isError: true, content: [{ type: 'text', text: `未找到 ID 为 ${orderId} 的挂单` }] };
      }

      return { content: [{ type: 'text', text: `✅ 成功撤销挂单 ${orderId}` }] };
    }
  );

  server.tool(
    'whitecat_list_copy_targets',
    '查询跟单模块监控的目标钱包地址列表',
    {
      userId: z.number().optional(),
      token: z.string().optional()
    },
    async ({ userId, token }) => {
      const { user, error } = resolveUser(userId, token);
      if (!user) return { isError: true, content: [{ type: 'text', text: `[Auth Error] ${error}` }] };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                activeChain: user.activeChain,
                monitoredCount: user.monitoredWallets?.length || 0,
                monitoredWallets: user.monitoredWallets || []
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  server.tool(
    'whitecat_add_copy_target',
    '添加一个聪敏钱/巨鲸钱包地址至跟单监控列表',
    {
      targetAddress: z.string().describe('要监控的目标钱包链上地址'),
      userId: z.number().optional(),
      token: z.string().optional()
    },
    async ({ targetAddress, userId, token }) => {
      const { user, error } = resolveUser(userId, token);
      if (!user) return { isError: true, content: [{ type: 'text', text: `[Auth Error] ${error}` }] };

      if (!user.monitoredWallets) user.monitoredWallets = [];
      if (user.monitoredWallets.includes(targetAddress)) {
        return { content: [{ type: 'text', text: `该地址已在跟单监控列表中。` }] };
      }

      user.monitoredWallets.push(targetAddress);
      return {
        content: [
          {
            type: 'text',
            text: `✅ 成功将地址 ${targetAddress} 加入跟单监控！当前监控数: ${user.monitoredWallets.length} / 10`
          }
        ]
      };
    }
  );

  // ==========================================
  // 5. 账单历史工具 (Billing & History)
  // ==========================================

  server.tool(
    'whitecat_get_transactions',
    '获取用户最近的交易记录与狙击历史，附带区块链浏览器真实链接与交易哈希',
    {
      limit: z.number().optional().describe('返回条数 (默认 10)'),
      userId: z.number().optional(),
      token: z.string().optional()
    },
    async ({ limit = 10, userId, token }) => {
      const { user, error } = resolveUser(userId, token);
      if (!user) return { isError: true, content: [{ type: 'text', text: `[Auth Error] ${error}` }] };

      const txs = (user.transactions || []).slice(0, limit).map(t => ({
        id: t.id,
        chain: t.chain,
        type: t.type,
        symbol: t.tokenSymbol,
        amountNative: t.amountNative,
        amountToken: t.amountToken,
        txHash: t.txHash,
        status: t.status,
        isRealOnChain: t.isRealOnChain,
        explorerUrl: BillingMenu.getChainTxUrl(t.chain, t.txHash),
        time: new Date(t.timestamp).toISOString()
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify(txs, null, 2) }]
      };
    }
  );

  // ==========================================
  // 6. 爆点雷达与老鼠仓穿透工具 (Meme Radar & Cluster Auditing)
  // ==========================================

  server.tool(
    'whitecat_scan_meme_radar',
    '利用 Meme-Radar 引擎在指定公链实时扫描高潜力早期代币，穿透资金链路聚类排除老鼠仓，并识别纯 KOL 喊单陷阱',
    {
      chain: z.string().optional().describe('要扫描的公链 (默认用户当前活跃链，如 bsc, solana, base, sui, ethereum, robinhood)'),
      minScore: z.number().optional().describe('最低综合雷达评分 (0-100，默认 50)'),
      maxLinkedRate: z.number().optional().describe('允许的最大关联老鼠仓比例 (0.0 - 1.0，如 0.20 代表 20%)'),
      limit: z.number().optional().describe('返回候选数量 (默认 6)'),
      userId: z.number().optional(),
      token: z.string().optional()
    },
    async ({ chain, minScore = 50, maxLinkedRate = 0.25, limit = 6, userId, token }) => {
      const { user, error } = resolveUser(userId, token);
      if (!user) return { isError: true, content: [{ type: 'text', text: `[Auth Error] ${error}` }] };

      const targetChain = chain || user.activeChain || 'bsc';
      const candidates = await MemeRadarService.scanRadarTokens(targetChain, {
        maxLinkedRate,
        limit
      });

      const filtered = candidates.filter(c => c.compositeScore >= minScore);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              chain: targetChain,
              foundCount: filtered.length,
              candidates: filtered.map(c => ({
                symbol: c.symbol,
                name: c.name,
                tokenAddress: c.tokenAddress,
                compositeScore: c.compositeScore,
                marketCapUsd: c.marketCapUsd,
                liquidityUsd: c.liquidityUsd,
                smartDegenCount: c.smartDegenCount,
                renownedKolCount: c.renownedKolCount,
                isKolOnlyTrap: c.isKolOnlyTrap,
                linkedHoldRatePercent: (c.linkedHoldRate * 100).toFixed(1) + '%',
                devStatus: c.devStatus,
                riskWarnings: c.riskWarnings
              }))
            }, null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    'whitecat_audit_wallet_clusters',
    '深度穿透审计指定代币的资金链路聚类与合谋老鼠仓：追踪大户持仓的注资祖先 (from_address)，计算真实关联老鼠仓占比与开发团队画像',
    {
      tokenAddress: z.string().describe('代币合约地址或 CA'),
      chain: z.string().optional().describe('公链代码 (默认用户当前活跃链)'),
      userId: z.number().optional(),
      token: z.string().optional()
    },
    async ({ tokenAddress, chain, userId, token }) => {
      const { user, error } = resolveUser(userId, token);
      if (!user) return { isError: true, content: [{ type: 'text', text: `[Auth Error] ${error}` }] };

      const targetChain = chain || user.activeChain || 'bsc';
      const clusters = MemeRadarService.analyzeWalletClusters(tokenAddress, targetChain);
      const signals = MemeRadarService.evaluateWalletSignals(tokenAddress, targetChain);
      const devRep = MemeRadarService.evaluateDevReputation(tokenAddress, targetChain);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              tokenAddress,
              chain: targetChain,
              linkedHoldRate: clusters.linkedHoldRate,
              linkedHoldRatePercent: (clusters.linkedHoldRate * 100).toFixed(1) + '%',
              isHighRiskCluster: clusters.linkedHoldRate > 0.15,
              clusters: clusters.clusters,
              walletSignals: {
                smartDegenCount: signals.smartDegenCount,
                renownedKolCount: signals.renownedKolCount,
                isKolOnlyTrap: signals.isKolOnlyTrap,
                assessment: signals.isKolOnlyTrap
                  ? '⚠️ 纯 KOL 推广喊单盘，缺少链上高胜率聪明钱底仓，存在拉高出货砸盘高风险！'
                  : '🟢 具备真实链上聪明钱参与，筹码分布相对自然。'
              },
              developerReputation: {
                devStatus: devRep.devStatus,
                devLaunchCount: devRep.devLaunchCount,
                devGraduationRate: (devRep.devGraduationRate * 100).toFixed(0) + '%'
              }
            }, null, 2)
          }
        ]
      };
    }
  );

  // ==========================================
  // 7. MCP 资源定义 (Resources)
  // ==========================================

  server.resource(
    'supported_chains',
    'whitecat://supported-chains',
    async (uri) => {
      const chains = [
        { key: 'bsc', name: 'BNB Smart Chain', symbol: 'BNB', dex: 'PancakeSwap' },
        { key: 'sui', name: 'Sui Network', symbol: 'SUI', dex: 'Bluefin Aggregator' },
        { key: 'solana', name: 'Solana', symbol: 'SOL', dex: 'Raydium / Jupiter' },
        { key: 'base', name: 'Base', symbol: 'ETH', dex: 'Uniswap v3' },
        { key: 'ethereum', name: 'Ethereum Mainnet', symbol: 'ETH', dex: 'Uniswap' },
        { key: 'robinhood', name: 'Robinhood Chain', symbol: 'ETH', dex: 'Robinhood DEX' },
        { key: 'sei', name: 'Sei EVM', symbol: 'SEI', dex: 'DragonSwap' },
        { key: 'ton', name: 'The Open Network', symbol: 'TON', dex: 'DeDust / STON.fi' },
        { key: 'xlayer', name: 'OKX X Layer', symbol: 'OKB', dex: 'XLayer DEX' },
        { key: 'aptos', name: 'Aptos', symbol: 'APT', dex: 'Liquidswap' }
      ];
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(chains, null, 2)
          }
        ]
      };
    }
  );

  // ==========================================
  // 7. MCP 提示词工作流 (Prompts)
  // ==========================================

  server.prompt(
    'token_due_diligence',
    '执行代币全面投研分析：自动检测貔貅安全、核查流动性、评估市值，并输出执行建议',
    {
      tokenAddress: z.string().describe('代币合约地址'),
      chain: z.string().optional().describe('公链')
    },
    ({ tokenAddress, chain = 'bsc' }) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `请为代币 ${tokenAddress} (在 ${chain} 链) 执行投研审计：\n1. 调用 whitecat_check_token_security 检查是否存在貔貅与恶意税率；\n2. 调用 whitecat_query_token_market 获取价格、市值与池子流动性；\n3. 结合数据给出是否建议买入的客观分析报告。`
            }
          }
        ]
      };
    }
  );

  return server;
}
