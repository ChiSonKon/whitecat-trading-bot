import { TradeMenu } from '../src/menus/tradeMenu.js';
import { I18nService, ALL_LANGUAGES } from '../src/services/i18nService.js';
import { TokenKeyHelper } from '../src/services/tokenKeyHelper.js';

console.log('==================================================================');
console.log('🧪 开始自检【推荐交易】原生私聊分享与深度链接跳转完整链路');
console.log('==================================================================\n');

// 1. 测试全部 11 种语言的推荐交易分享文案与国际化词条
console.log('📌 [Test 1] 校验全部 11 种语言的推荐交易词条及分享文案...');
for (const langObj of ALL_LANGUAGES) {
  const lang = langObj.code;
  const referText = I18nService.t('trade.referTrading', lang);
  const copyText = I18nService.t('trade.copyReferralLink', lang);
  const shareBtn = I18nService.t('trade.shareToChat', lang);
  const shareMsg = I18nService.getShareTradeText(lang, 'United Pug Service', 'UPS', 'Robinhood', '0xb1f8bAFB97D40A011715C1bA8a822030b20bbd81');

  if (!referText || referText.includes('trade.referTrading')) {
    throw new Error(`Lang ${lang} missing trade.referTrading`);
  }
  if (!copyText || copyText.includes('trade.copyReferralLink')) {
    throw new Error(`Lang ${lang} missing trade.copyReferralLink`);
  }
  if (!shareBtn || shareBtn.includes('trade.shareToChat')) {
    throw new Error(`Lang ${lang} missing trade.shareToChat`);
  }
  if (!shareMsg || !shareMsg.includes('United Pug Service') || !shareMsg.includes('0xb1f8bAFB97D40A011715C1bA8a822030b20bbd81')) {
    throw new Error(`Lang ${lang} shareMsg is invalid`);
  }
  console.log(`  ✓ [${lang}] ${langObj.name}: 按钮="${referText}", 复制提示="${copyText}", 私聊按钮="${shareBtn}"`);
}

// 2. 测试 TradeMenu.renderText 渲染的 HTML 链接是否为标准 Telegram 原生私聊分享 URL (t.me/share/url)
console.log('\n📌 [Test 2] 校验 TradeMenu.renderText 生成的推荐交易超链接格式...');
const dummyMarket: any = {
  address: '0xb1f8bAFB97D40A011715C1bA8a822030b20bbd81',
  name: 'United Pug Service',
  symbol: 'UPS',
  priceUsd: 0.000282,
  marketCapUsd: 275100,
  liquidityNative: 232.16,
  riskLevel: 'Low Risk',
  holdersCount: '42.76K',
  dexscreenerUrl: 'https://dexscreener.com',
  dextoolsUrl: 'https://dextools.io',
  twitterUrl: 'https://x.com'
};

const renderedZh = TradeMenu.renderText({
  market: dummyMarket,
  chain: 'robinhood',
  walletName: 'Wallet_1',
  walletAddress: '0x0048e830a4d3a383341d5fb618542dd054dbdc53',
  walletBalance: 0,
  userHolding: 0,
  lang: 'zh-hans',
  userId: 8853719880,
  botUsername: 'whitecat_doge_yr3ybv_bot'
});

console.log('渲染输出截取:\n', renderedZh.split('\n').slice(0, 3).join('\n'));

// 必须匹配 <a href="https://t.me/share/url?url=...&text=...">推荐交易</a>
const shareLinkMatch = renderedZh.match(/<a href="(https:\/\/t\.me\/share\/url\?[^"]+)">推荐交易<\/a>/);
if (!shareLinkMatch) {
  throw new Error('TradeMenu.renderText 没有正确输出 https://t.me/share/url 格式的私聊分享超链接！');
}

const fullShareUrl = shareLinkMatch[1];
const parsedUrl = new URL(fullShareUrl);
const sharedBotUrl = parsedUrl.searchParams.get('url');
const sharedText = parsedUrl.searchParams.get('text');

console.log('  ✓ 解析得到 Share Target URL:', sharedBotUrl);
console.log('  ✓ 解析得到 Share Pre-filled Text:\n', sharedText);

if (!sharedBotUrl || !sharedBotUrl.includes('referTrade_') || !sharedBotUrl.includes('8853719880') || !sharedBotUrl.includes('4663')) {
  throw new Error(`分享的目标机器人深链接不正确: ${sharedBotUrl}`);
}
if (!sharedText || !sharedText.includes('United Pug Service') || !sharedText.includes('0xb1f8bAFB97D40A011715C1bA8a822030b20bbd81')) {
  throw new Error(`分享预填文本不正确: ${sharedText}`);
}

// 3. 测试公链解析与逆向解析
console.log('\n📌 [Test 3] 校验链 ID / 链名称互转逻辑...');
const chainTests = [
  { id: 4663, expected: 'robinhood' },
  { id: '4663', expected: 'robinhood' },
  { id: 'robinhood', expected: 'robinhood' },
  { id: 56, expected: 'bsc' },
  { id: 'bsc', expected: 'bsc' },
  { id: 101, expected: 'sui' },
  { id: 'sui', expected: 'sui' },
  { id: 8453, expected: 'base' },
  { id: 501, expected: 'solana' },
  { id: 1, expected: 'ethereum' }
];

for (const t of chainTests) {
  const resolved = TradeMenu.resolveChainFromIdOrName(t.id);
  if (resolved !== t.expected) {
    throw new Error(`Chain test failed for ${t.id}: expected ${t.expected}, got ${resolved}`);
  }
}
console.log('  ✓ 全部链 ID 与链名称互转正确！');

// 4. 测试代币 Key 与原地址的无损反解
console.log('\n📌 [Test 4] 校验 TokenKeyHelper 代币 Hash / Key 反解...');
const tokenAddr = '0xb1f8bAFB97D40A011715C1bA8a822030b20bbd81';
const registeredKey = TokenKeyHelper.register(tokenAddr);
const resolvedAddr = TokenKeyHelper.toAddress(registeredKey);
if (resolvedAddr.toLowerCase() !== tokenAddr.toLowerCase()) {
  throw new Error(`TokenKeyHelper failed: expected ${tokenAddr}, got ${resolvedAddr}`);
}
console.log(`  ✓ 成功完成代币地址到短 Key 注册与还原: ${tokenAddr} -> ${registeredKey} -> ${resolvedAddr}`);

console.log('\n==================================================================');
console.log('🎉 全部自检通过！【推荐交易】已完美升级为原生 Telegram 私聊分享机制！');
console.log('==================================================================');
