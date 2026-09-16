import { InlineKeyboard } from 'grammy';
import { E, ButtonIcons, createStyledBtn } from '../ui/emojis.js';
import { ArcGuideMenu } from './arcGuideMenu.js';

export interface ChainEcosystemInfo {
  id: string;
  name: string;
  nativeSymbol: string;
  chainId: string | number;
  rpcUrl: string;
  mevRpcUrl?: string;
  explorerUrl: string;
  launchpads: { name: string; descZh: string; descEn: string; url: string }[];
  bridges?: { name: string; url: string }[];
}

export class ChainEcosystemMenu {
  public static ECOSYSTEM_DATA: Record<string, ChainEcosystemInfo> = {
    solana: {
      id: 'solana',
      name: 'Solana',
      nativeSymbol: 'SOL',
      chainId: 501,
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      mevRpcUrl: 'https://mainnet.block-engine.jito.wtf (Jito Anti-MEV)',
      explorerUrl: 'https://solscan.io',
      launchpads: [
        { name: 'Pump.fun', descZh: '全网交易量第一 Meme 内盘发射台', descEn: 'Leading Meme Launchpad & Bonding Curve', url: 'https://pump.fun' },
        { name: 'Moonshot', descZh: 'Dexscreener 官方原生内盘', descEn: 'Dexscreener Official Native Launchpad', url: 'https://dexscreener.com/moonshot' },
        { name: 'Raydium LaunchLab', descZh: 'Raydium 原生流动性内盘', descEn: 'Raydium Native Liquidity Launchpad', url: 'https://raydium.io/launchlab/' }
      ],
      bridges: [
        { name: 'Portal (Wormhole)', url: 'https://portalbridge.com' },
        { name: 'Allbridge Core', url: 'https://core.allbridge.io' },
        { name: 'GMGN 闪兑 (SOL)', url: 'https://gmgn.ai/r/10uwina8?chain=sol' }
      ]
    },
    bsc: {
      id: 'bsc',
      name: 'BNB Smart Chain',
      nativeSymbol: 'BNB',
      chainId: 56,
      rpcUrl: 'https://bsc-dataseed.binance.org',
      mevRpcUrl: 'https://bsc-builder.48.club (48Club 防夹节点)',
      explorerUrl: 'https://bscscan.com',
      launchpads: [
        { name: 'Four.meme', descZh: '币安生态重点扶持主流 Meme 内盘', descEn: 'Binance Ecosystem Primary Meme Launchpad', url: 'https://four.meme' },
        { name: 'Gra.fun', descZh: '公平发射曲线平台 (Fair Curve)', descEn: 'Fair Launch Bonding Curve Platform', url: 'https://gra.fun' },
        { name: 'Flap.sh', descZh: '极速创建与发射平台', descEn: 'Fast Creation & Launchpad', url: 'https://flap.sh' },
        { name: 'PancakeSwap Springboard', descZh: '薄饼官方发射跳板', descEn: 'PancakeSwap Official Springboard', url: 'https://pancakeswap.finance' }
      ],
      bridges: [
        { name: 'Debot 闪兑 (BSC)', url: 'https://debot.ai/r/220725' },
        { name: 'GMGN 兑换 (BSC)', url: 'https://gmgn.ai/r/10uwina8?chain=bsc' },
        { name: 'Across Bridge', url: 'https://across.to' }
      ]
    },
    base: {
      id: 'base',
      name: 'Base',
      nativeSymbol: 'ETH',
      chainId: 8453,
      rpcUrl: 'https://mainnet.base.org',
      mevRpcUrl: 'https://base.mev-share.flashbots.net (Flashbots MEV-Share)',
      explorerUrl: 'https://basescan.org',
      launchpads: [
        { name: 'Virtuals Protocol', descZh: 'AI Agent 生态发射台龙头', descEn: 'Leading AI Agent Co-Ownership Launchpad', url: 'https://virtuals.io' },
        { name: 'Clanker', descZh: 'Farcaster 社区爆款代币工厂', descEn: 'Farcaster Viral Autonomous Token Factory', url: 'https://clanker.world' },
        { name: 'ApeStore', descZh: 'Base 链原生公平内盘', descEn: 'Base Native Fair Launchpad', url: 'https://ape.store' }
      ],
      bridges: [
        { name: 'Base 官方跨链桥', url: 'https://bridge.base.org' },
        { name: 'Across Protocol', url: 'https://across.to' },
        { name: 'GMGN 兑换 (Base)', url: 'https://gmgn.ai/r/10uwina8?chain=base' }
      ]
    },
    sui: {
      id: 'sui',
      name: 'Sui',
      nativeSymbol: 'SUI',
      chainId: 101,
      rpcUrl: 'https://fullnode.mainnet.sui.io:443',
      explorerUrl: 'https://suiscan.xyz',
      launchpads: [
        { name: 'MovePump', descZh: 'Sui 生态最大 Meme 公平内盘', descEn: 'Primary Move Fair Launchpad on Sui', url: 'https://movepump.com' },
        { name: 'Bluefin 7k', descZh: '极速交易与聚合器', descEn: 'High-speed Trading Aggregator', url: 'https://bluefin.io' },
        { name: 'Cetus Launchpad', descZh: 'Cetus 原生发射平台', descEn: 'Cetus Native DEX Launchpad', url: 'https://cetus.zone' }
      ],
      bridges: [
        { name: 'Sui Bridge 官方桥', url: 'https://bridge.sui.io' },
        { name: 'Wormhole Portal', url: 'https://portalbridge.com' }
      ]
    },
    ton: {
      id: 'ton',
      name: 'TON',
      nativeSymbol: 'TON',
      chainId: 607,
      rpcUrl: 'https://toncenter.com/api/v2/jsonRPC',
      explorerUrl: 'https://tonviewer.com',
      launchpads: [
        { name: 'GasPump', descZh: 'Telegram 原生极速 Meme 发射内盘', descEn: 'Telegram Native Fast Meme Launchpad', url: 'https://gaspump.tg' },
        { name: 'DeDust', descZh: 'TON 生态核心 DEX 与内盘池', descEn: 'TON Core DEX & Bonding Pools', url: 'https://dedust.io' },
        { name: 'STON.fi', descZh: '主流 AMM 交易协议', descEn: 'Leading AMM Swap Protocol', url: 'https://ston.fi' }
      ],
      bridges: [
        { name: 'TON 官方跨链桥', url: 'https://bridge.ton.org' }
      ]
    },
    ethereum: {
      id: 'ethereum',
      name: 'Ethereum',
      nativeSymbol: 'ETH',
      chainId: 1,
      rpcUrl: 'https://eth.llamarpc.com',
      mevRpcUrl: 'https://rpc.flashbots.net (Flashbots Protect 防夹)',
      explorerUrl: 'https://etherscan.io',
      launchpads: [
        { name: 'Uniswap V2/V3', descZh: '全球最大去中心化交易所', descEn: 'Leading Decentralized Exchange', url: 'https://app.uniswap.org' },
        { name: 'Fjord Foundry', descZh: '流动性引导池 (LBP) 首选发射台', descEn: 'Liquidity Bootstrapping Pools (LBP)', url: 'https://fjordfoundry.com' }
      ],
      bridges: [
        { name: 'Across Protocol', url: 'https://across.to' },
        { name: 'Axelar Satellite', url: 'https://satellite.money' }
      ]
    }
  };

  public static renderText(chain: string, lang: string = 'zh-hans'): string {
    const c = (chain || 'solana').toLowerCase();
    if (c === 'arc') {
      return ArcGuideMenu.renderText(lang);
    }

    const info = this.ECOSYSTEM_DATA[c] || this.ECOSYSTEM_DATA.solana;
    const isZh = lang === 'zh-hans' || lang === 'zh-hant';

    if (isZh) {
      let launchpadText = info.launchpads
        .map((lp, idx) => `<b>${idx + 1}. <a href="${lp.url}">${lp.name}</a></b>: ${lp.descZh}`)
        .join('\n');

      let bridgeText = info.bridges && info.bridges.length > 0
        ? info.bridges.map(b => `• <a href="${b.url}">${b.name}</a>`).join('\n')
        : '• 无需跨链或使用全链通用桥';

      return (
        `${E.WHITECAT} <b>${info.name} 全网主流内盘与节点生态指引</b>\n\n` +
        `🚀 <b>一、主流内盘与公平发射台 (Launchpad)：</b>\n` +
        `${launchpadText}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 <b>二、高速防夹 (Anti-MEV) 与钱包节点配置：</b>\n` +
        `<pre>\n` +
        `┌─────────────────────────────────┐\n` +
        `│ 网络公链: ${info.name.padEnd(21)} │\n` +
        `│ 链 ID   : ${String(info.chainId).padEnd(21)} │\n` +
        `│ 基础代币: ${info.nativeSymbol.padEnd(21)} │\n` +
        `│ 公共 RPC: ${info.rpcUrl}\n` +
        (info.mevRpcUrl ? `│ 防夹 RPC: ${info.mevRpcUrl}\n` : '') +
        `│ 区块浏览: ${info.explorerUrl}\n` +
        `└─────────────────────────────────┘\n` +
        `</pre>\n` +
        `• 钱包推荐：<a href="https://web3.okx.com/join/10UWINA8">OKX Web3 钱包</a> ｜ <a href="https://web3.binance.com/referral?ref=10UWINA8">币安 Web3</a>\n` +
        `• 白猫已原生开启 <b>Jito / Flashbots 极速抢单与防夹通道</b>，秒级直达矿工！\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🌉 <b>三、主流跨链桥与内置极速闪兑：</b>\n` +
        `${bridgeText}\n\n` +
        `<i>👇 点击下方按钮直达内盘平台或切换公链生态！</i>`
      );
    }

    let launchpadTextEn = info.launchpads
      .map((lp, idx) => `<b>${idx + 1}. <a href="${lp.url}">${lp.name}</a></b>: ${lp.descEn}`)
      .join('\n');

    let bridgeTextEn = info.bridges && info.bridges.length > 0
      ? info.bridges.map(b => `• <a href="${b.url}">${b.name}</a>`).join('\n')
      : '• Universal bridges supported';

    return (
      `${E.WHITECAT} <b>${info.name} Ecosystem & Node Guide</b>\n\n` +
      `🚀 <b>1. Popular Launchpads & Bonding Curves:</b>\n` +
      `${launchpadTextEn}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 <b>2. Anti-MEV & High-Speed Node Config:</b>\n` +
      `<pre>\n` +
      `┌─────────────────────────────────┐\n` +
      `│ Network : ${info.name.padEnd(21)} │\n` +
      `│ Chain ID: ${String(info.chainId).padEnd(21)} │\n` +
      `│ Currency: ${info.nativeSymbol.padEnd(21)} │\n` +
      `│ RPC URL : ${info.rpcUrl}\n` +
      (info.mevRpcUrl ? `│ Anti-MEV: ${info.mevRpcUrl}\n` : '') +
      `│ Explorer: ${info.explorerUrl}\n` +
      `└─────────────────────────────────┘\n` +
      `</pre>\n\n` +
      `🌉 <b>3. Bridges & In-Wallet Swaps:</b>\n` +
      `${bridgeTextEn}\n\n` +
      `<i>👇 Select a launchpad or switch chain below!</i>`
    );
  }

  public static renderKeyboard(chain: string, lang: string = 'zh-hans'): InlineKeyboard {
    const c = (chain || 'solana').toLowerCase();
    if (c === 'arc') {
      return ArcGuideMenu.renderKeyboard(lang);
    }

    const info = this.ECOSYSTEM_DATA[c] || this.ECOSYSTEM_DATA.solana;
    const isZh = lang === 'zh-hans' || lang === 'zh-hant';

    const kbRows: any[] = [];

    // 发射台直达按钮 (最多 2 个一排)
    const lpButtons = info.launchpads.map(lp => ({
      text: `🚀 ${lp.name}`,
      url: lp.url
    }));
    for (let i = 0; i < lpButtons.length; i += 2) {
      kbRows.push(lpButtons.slice(i, i + 2));
    }

    // 跨链与浏览器按钮
    const extraRow: any[] = [];
    if (info.bridges && info.bridges.length > 0) {
      extraRow.push({ text: `🌉 ${info.bridges[0].name}`, url: info.bridges[0].url });
    }
    extraRow.push({ text: isZh ? '🔍 区块浏览器' : '🔍 Explorer', url: info.explorerUrl });
    kbRows.push(extraRow);

    // 切换查看其他主流链生态
    kbRows.push([
      { text: '🟣 Solana', callback_data: 'menu_chain_guide_solana' },
      { text: '🟡 BSC', callback_data: 'menu_chain_guide_bsc' },
      { text: '🔵 Base', callback_data: 'menu_chain_guide_base' }
    ]);
    kbRows.push([
      { text: '🏛️ Arc Network', callback_data: 'menu_arc_guide' },
      { text: '💧 Sui', callback_data: 'menu_chain_guide_sui' },
      { text: '💎 TON', callback_data: 'menu_chain_guide_ton' }
    ]);

    // 返回主菜单
    kbRows.push([
      createStyledBtn(isZh ? '🔙 返回主菜单' : '🔙 Main Menu', {
        callback_data: 'menu_main',
        style: 'primary',
        icon_custom_emoji_id: ButtonIcons.BACK
      })
    ]);

    return InlineKeyboard.from(kbRows);
  }
}
