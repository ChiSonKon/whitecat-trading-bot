-- ==============================================================================
-- 白猫打狗机器人 (WhiteCat Trading Bot)
-- PostgreSQL 16 核心生产级表结构设计
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. 用户基础表与交易个性化设置 (users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    tg_id BIGINT UNIQUE NOT NULL,                       -- Telegram 用户唯一 ID
    username VARCHAR(128),                              -- Telegram @username
    first_name VARCHAR(128),
    active_chain VARCHAR(32) DEFAULT 'robinhood',       -- 当前所选链 (robinhood, solana, base, eth, bsc, etc.)
    referral_code VARCHAR(32) UNIQUE NOT NULL,          -- 个人专属邀请码
    referred_by BIGINT REFERENCES users(tg_id),         -- 邀请人 tg_id
    
    -- 交易个性化偏好
    slippage_pct NUMERIC(5, 2) DEFAULT 5.00,            -- 默认滑点百分比 (5%)
    auto_slippage BOOLEAN DEFAULT TRUE,                 -- 是否启用动态智能防夹滑点
    anti_mev BOOLEAN DEFAULT TRUE,                      -- 是否启用私密交易通道 (Anti-MEV)
    gas_priority VARCHAR(16) DEFAULT 'turbo',           -- 矿工费加速挡位: normal, fast, turbo, ultra
    auto_buy_amount NUMERIC(18, 6) DEFAULT 0.1,         -- 贴 CA 自动买入默认金额
    auto_buy_enabled BOOLEAN DEFAULT FALSE,             -- 是否开启贴合约立即自动买入
    
    -- 统计与返佣
    total_volume_usd NUMERIC(24, 6) DEFAULT 0.00,
    total_trades_count INT DEFAULT 0,
    total_rebate_earned_eth NUMERIC(18, 8) DEFAULT 0.0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_tg_id ON users(tg_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- ------------------------------------------------------------------------------
-- 2. 多链多钱包矩阵表 (wallets) - 单用户单链最多支持 10 个独立钱包隔离
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    chain VARCHAR(32) NOT NULL,                         -- robinhood, solana, base, eth, bsc, sui, ton, etc.
    wallet_index SMALLINT NOT NULL CHECK (wallet_index >= 0 AND wallet_index < 10), -- 0~9 槽位
    address VARCHAR(128) NOT NULL,                      -- 链上公开地址 (EVM: 0x..., Solana: Base58)
    encrypted_private_key TEXT NOT NULL,                -- AES-256-GCM 硬件加密私钥
    nonce_iv VARCHAR(64) NOT NULL,                      -- 加密向量
    is_default BOOLEAN DEFAULT FALSE,                   -- 是否为该链默认开火主钱包
    label VARCHAR(64) DEFAULT '主钱包',                  -- 钱包备注别名
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, chain, wallet_index),
    UNIQUE(chain, address)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_chain ON wallets(user_id, chain);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);

-- ------------------------------------------------------------------------------
-- 3. 交易订单流水表 (orders)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL REFERENCES users(tg_id),
    chain VARCHAR(32) NOT NULL,
    wallet_address VARCHAR(128) NOT NULL,
    
    -- 交易标的与方向
    token_in_address VARCHAR(128) NOT NULL,             -- 买入输入代币 (通常为 WETH / SOL / USDT)
    token_out_address VARCHAR(128) NOT NULL,            -- 目标代币合约 (CA)
    token_symbol VARCHAR(32),                           -- 代币符号
    amount_in NUMERIC(36, 18) NOT NULL,                 -- 投入金额 (原生币 Wei/Lamports)
    min_amount_out NUMERIC(36, 18) DEFAULT 0,           -- 预期最低获得代币数
    received_amount_out NUMERIC(36, 18) DEFAULT 0,      -- 实际获得代币数
    
    -- 订单类型与状态
    order_type VARCHAR(32) NOT NULL,                    -- FAST_BUY, FAST_SELL, SNIPE, LIMIT, DCA, COPY_TRADE
    status VARCHAR(32) DEFAULT 'PENDING',               -- PENDING, EXECUTING, SUCCESS, FAILED, CANCELLED
    
    -- 链上执行回执
    tx_hash VARCHAR(128),                               -- 交易哈希
    block_number BIGINT,                                -- 打包区块高度
    gas_used BIGINT,                                    -- 实际消耗 Gas
    gas_price_gwei NUMERIC(12, 4),
    
    -- 盈亏与出本记录
    cost_basis_eth NUMERIC(36, 18) DEFAULT 0,           -- 初始买入成本 (用于一键保本出本计算)
    pnl_pct NUMERIC(8, 2) DEFAULT 0.00,                 -- 盈亏百分比
    pnl_amount_eth NUMERIC(36, 18) DEFAULT 0.00,
    
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_chain ON orders(user_id, chain);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_tx_hash ON orders(tx_hash);

-- ------------------------------------------------------------------------------
-- 4. 开盘狙击任务表 (snipes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL REFERENCES users(tg_id),
    chain VARCHAR(32) NOT NULL,
    token_address VARCHAR(128) NOT NULL,                -- 目标代币 CA
    token_symbol VARCHAR(32),
    
    snipe_type VARCHAR(32) DEFAULT 'LIQUIDITY',         -- LIQUIDITY (池子上线加池), METHOD_ID (方法签名调用)
    target_method_id VARCHAR(16),                       -- 例如: 0x8f32d59b (enableTrading)
    
    amount_in NUMERIC(36, 18) NOT NULL,                 -- 狙击下注金额
    tip_priority_fee_gwei NUMERIC(12, 4) DEFAULT 10.0,  -- 矿工打赏 / Jito Tip
    max_buy_tax_pct NUMERIC(5, 2) DEFAULT 15.00,        -- 容忍最高买税，超过则放弃
    
    -- 自动出局策略
    auto_sell_tp_pct NUMERIC(8, 2),                     -- 自动止盈百分比 (如 +100%)
    auto_sell_sl_pct NUMERIC(8, 2),                     -- 自动止损百分比 (如 -30%)
    
    status VARCHAR(32) DEFAULT 'WAITING',               -- WAITING, TRIGGERED, SUCCESS, FAILED, CANCELLED
    triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_snipes_status ON snipes(status);
CREATE INDEX IF NOT EXISTS idx_snipes_token ON snipes(chain, token_address);

-- ------------------------------------------------------------------------------
-- 5. 条件单与网格追踪止损表 (limit_orders)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS limit_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL REFERENCES users(tg_id),
    chain VARCHAR(32) NOT NULL,
    token_address VARCHAR(128) NOT NULL,
    
    order_type VARCHAR(32) NOT NULL,                    -- TP (止盈), SL (止损), TRAILING_STOP (移动止损), LIMIT_BUY
    trigger_price_usd NUMERIC(24, 12),                  -- 固定触发价
    peak_price_usd NUMERIC(24, 12),                     -- 历史最高价 (追踪止损用)
    trailing_delta_pct NUMERIC(5, 2),                   -- 从峰值回撤百分比 (如 15%)
    
    sell_ratio_pct NUMERIC(5, 2) DEFAULT 100.00,        -- 触发后平仓比例 (25%, 50%, 100%)
    sell_initial_cost BOOLEAN DEFAULT FALSE,            -- 是否为一键保本出本单
    
    status VARCHAR(32) DEFAULT 'ACTIVE',                -- ACTIVE, TRIGGERED, EXECUTED, CANCELLED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_limit_orders_active ON limit_orders(status, chain);

-- ------------------------------------------------------------------------------
-- 6. 聪明钱雷达与实时跟单表 (copy_trades)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS copy_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL REFERENCES users(tg_id),
    chain VARCHAR(32) NOT NULL,
    target_wallet VARCHAR(128) NOT NULL,                -- 监控的巨鲸/聪明钱地址
    target_label VARCHAR(64) DEFAULT '聪明钱巨鲸',
    
    copy_mode VARCHAR(16) DEFAULT 'FIXED',              -- FIXED (固定金额), RATIO (按比例跟投)
    fixed_amount NUMERIC(36, 18) DEFAULT 0.1,           -- 每次跟单固定金额
    copy_ratio_pct NUMERIC(5, 2) DEFAULT 10.0,          -- 跟单巨鲸金额百分比
    max_follow_per_day NUMERIC(36, 18) DEFAULT 2.0,     -- 每日跟单上限
    
    anti_dump_enabled BOOLEAN DEFAULT TRUE,             -- 防巨鲸砸盘: 巨鲸卖出时自己立刻优先全抛
    filter_min_liquidity_usd NUMERIC(18, 2) DEFAULT 10000.0, -- 过滤虚假小池
    status VARCHAR(32) DEFAULT 'ACTIVE',                -- ACTIVE, PAUSED, STOPPED
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_copy_trades_target ON copy_trades(chain, target_wallet);

-- ------------------------------------------------------------------------------
-- 7. 多级邀请裂变返佣账本 (referrals & commissions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commission_logs (
    id BIGSERIAL PRIMARY KEY,
    referrer_id BIGINT NOT NULL REFERENCES users(tg_id),-- 受益邀请人
    referee_id BIGINT NOT NULL REFERENCES users(tg_id), -- 产生交易的被邀请人
    order_id UUID REFERENCES orders(id),
    chain VARCHAR(32) NOT NULL,
    
    trade_volume_usd NUMERIC(18, 4) NOT NULL,
    platform_fee_collected NUMERIC(36, 18) NOT NULL,    -- 平台收取的 1% 交易手续费
    rebate_rate_pct NUMERIC(5, 2) DEFAULT 30.00,        -- 返佣比例 (例如 30%)
    commission_amount NUMERIC(36, 18) NOT NULL,         -- 实际发放到邀请人账户的佣金
    
    is_settled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commission_referrer ON commission_logs(referrer_id);

-- ------------------------------------------------------------------------------
-- 8. 貔貅盘与合约安全沙盒报告表 (honeypot_cache)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS honeypot_cache (
    id BIGSERIAL PRIMARY KEY,
    chain VARCHAR(32) NOT NULL,
    token_address VARCHAR(128) NOT NULL,
    is_honeypot BOOLEAN NOT NULL,                       -- 是否为貔貅
    can_buy BOOLEAN NOT NULL DEFAULT TRUE,
    can_sell BOOLEAN NOT NULL DEFAULT TRUE,
    buy_tax_pct NUMERIC(5, 2) DEFAULT 0.00,
    sell_tax_pct NUMERIC(5, 2) DEFAULT 0.00,
    is_mintable BOOLEAN DEFAULT FALSE,
    is_blacklisted BOOLEAN DEFAULT FALSE,
    risk_level VARCHAR(16) DEFAULT 'LOW',               -- LOW, MEDIUM, HIGH, CRITICAL
    reason TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(chain, token_address)
);

CREATE INDEX IF NOT EXISTS idx_honeypot_lookup ON honeypot_cache(chain, token_address);
