/**
 * Telegram 高级自定义 Emoji 与按键图标系统
 * 遵循 Telegram Bot API 7.0+ 规范与白猫防重叠设计
 * 包含参考 Emoji 库: tgiosicons, FinanceEmoji, baimaoy1_by_fStikBot
 */

export function ce(emojiId: string, fallback: string): string {
  return `<tg-emoji emoji-id="${emojiId}">${fallback}</tg-emoji>`;
}

export class ButtonIcons {
  // 白猫定制表情 (baimaoy1_by_fStikBot / WhiteCat)
  public static readonly WHITECAT = '4974254942668720031';
  public static readonly CAT_DEV = '4981428624679765482';
  public static readonly ANNOUNCE = '4981127676321335226';
  public static readonly PERCENT_100 = '4983516352447775805';

  // 金融与资产表情 (FinanceEmoji)
  public static readonly STAR = '5267500801240092311';
  public static readonly CASH = '5197434882321567830';
  public static readonly COIN = '5377505475015235101';
  public static readonly COIN2 = '5202064723922670546';
  public static readonly CARD = '5445353829304387411';
  public static readonly DIAMOND = '6007983438294949171';
  public static readonly MONEY_BAG = '6334575946938451719';

  // 系统与功能图标 (tgiosicons)
  public static readonly PLANE = '6028346797368283073';
  public static readonly APPLE = '5775870512127283512';
  public static readonly GIFT = '5773677501825945508';
  public static readonly GEAR = '5904258298764334001';
  public static readonly DASHBOARD = '5776424837786374634';
  public static readonly FIRE = '4981137060824876553';       // 🔥 真实火苗 (修复原 6028338546736107668 误配成星号⭐️)
  public static readonly LIMIT_ORDER = '6043896193887506430'; // 📌 专属限价单定点图标 (修复与交易设置⚙️重复)
  public static readonly PIN = '6043896193887506430';         // 📌 推针
  public static readonly TARGET = '6032949275732742941';      // 🎯 靶心瞄准 (修复原 4983547984881910957 误配成紫色方块💠)
  public static readonly PLUS = '6032924188828767321';        // ➕ 加号

  // 基础操作与状态图标
  public static readonly LIGHTNING = '5884428842780594914';   // ⚡ 极速买卖
  public static readonly CROWN = '5805553606635559688';
  public static readonly FOLDER = '6039630677182254664';
  public static readonly SHIELD = '6030537007350944596';
  public static readonly SEARCH = '6032850693348399258';
  public static readonly CHAT = '6030784887093464891';
  public static readonly GROUP = '6032609071373226027';       // 👥 专属跟单
  public static readonly GLOBE = '5776233299424843260';       // 🌐 语言选择
  public static readonly BACK = '5895507195524550741';        // ↩️ 返回上一级
  public static readonly REFRESH = '5769248574499983619';     // 🔄 闭环切换/刷新 (修复原 5895507195524550741 返回箭头误用)
  public static readonly CHECK = '5774022692642492953';
  public static readonly CROSS = '6030757850274336631';
  public static readonly ROBOT = '6030400221232501136';       // 🤖 专属AI机器人 (修复原 5884428842780594914 误配成闪电⚡)
}

export class E {
  public static readonly WHITECAT = ce(ButtonIcons.WHITECAT, '🐱');
  public static readonly LIGHTNING = ce(ButtonIcons.LIGHTNING, '⚡');
  public static readonly DIAMOND = ce(ButtonIcons.DIAMOND, '💎');
  public static readonly CROWN = ce(ButtonIcons.CROWN, '👑');
  public static readonly CARD = ce(ButtonIcons.CARD, '💳');
  public static readonly MONEY = ce(ButtonIcons.CASH, '💰');
  public static readonly FIRE = ce(ButtonIcons.FIRE, '🔥');
  public static readonly SHIELD = ce(ButtonIcons.SHIELD, '🛡️');
  public static readonly TARGET = ce(ButtonIcons.TARGET, '🎯');
  public static readonly ROBOT = ce(ButtonIcons.ROBOT, '🤖');
  public static readonly GLOBE = ce(ButtonIcons.GLOBE, '🌐');
  public static readonly CHECK = ce(ButtonIcons.CHECK, '✅');
  public static readonly WARN = ce('5767199127775481841', '⚠️');
  public static readonly SEARCH = ce(ButtonIcons.SEARCH, '🔍');
  public static readonly PIN = ce(ButtonIcons.PIN, '📌');
  public static readonly GEAR = ce(ButtonIcons.GEAR, '⚙️');
}

/**
 * 彻底剔除文本前缀中的所有原生 Emoji 与特殊字符
 * 杜绝 Telegram 7.0+ 自定义图标与文字自带 Emoji 双重重叠 Bug
 */
export function stripEmojis(text: string): string {
  if (!text) return '';
  return text
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\u20E3\u25A0-\u2BFF\uE000-\uF8FF\uD83C-\uDBFF\uDC00-\uDFFF\s]+/u, '')
    .trim();
}

export function createStyledBtn(
  text: string,
  opts: {
    callback_data?: string;
    url?: string;
    style?: 'primary' | 'success' | 'danger';
    icon_custom_emoji_id?: string;
  }
) {
  const cleanText = opts.icon_custom_emoji_id ? stripEmojis(text) : text;
  const btnObj: any = { text: cleanText };
  if (opts.callback_data) btnObj.callback_data = opts.callback_data;
  if (opts.url) btnObj.url = opts.url;
  if (opts.style) btnObj.style = opts.style;
  if (opts.icon_custom_emoji_id) btnObj.icon_custom_emoji_id = opts.icon_custom_emoji_id;
  return btnObj;
}

