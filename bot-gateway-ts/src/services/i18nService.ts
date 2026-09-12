export type SupportedLang =
  | 'en'
  | 'zh-hans'
  | 'zh-hant'
  | 'ru'
  | 'vi'
  | 'ko'
  | 'ja'
  | 'es'
  | 'tr'
  | 'pl'
  | 'de';

export interface LangInfo {
  code: SupportedLang;
  id: number;
  name: string;
}

export const ALL_LANGUAGES: LangInfo[] = [
  { id: 0, code: 'en', name: '🇺🇸 English' },
  { id: 1, code: 'zh-hans', name: '🇨🇳 简体中文' },
  { id: 2, code: 'ru', name: '🇷🇺 Русский' },
  { id: 3, code: 'pl', name: '🇵🇱 Polski' },
  { id: 4, code: 'tr', name: '🇹🇷 Türkçe' },
  { id: 5, code: 'ko', name: '🇰🇷 한국어' },
  { id: 6, code: 'zh-hant', name: '🇭🇰 繁體中文' },
  { id: 7, code: 'es', name: '🇪🇸 Español' },
  { id: 8, code: 'vi', name: '🇻🇳 Tiếng Việt' },
  { id: 9, code: 'de', name: '🇩🇪 Deutsch' },
  { id: 10, code: 'ja', name: '🇯🇵 日本語' }
];

const dict: Record<string, Record<string, string>> = {
  // --- 12 项 Bot 快捷指令描述 ---
  "cmd.start": {
    "en": "Open Main Menu",
    "zh-hans": "打开主菜单",
    "zh-hant": "打開主菜單",
    "vi": "Mở menu chính",
    "ru": "Открыть главное меню",
    "ko": "메인 메뉴 열기",
    "ja": "メインメニューを開く",
    "es": "Abrir menú principal",
    "tr": "Ana menüyü aç",
    "pl": "Otwórz menu główne",
    "de": "Hauptmenü öffnen"
  },
  "cmd.mini_futures": {
    "en": "Mini Futures Trading",
    "zh-hans": "迷你合约交易",
    "zh-hant": "迷你合約交易",
    "vi": "Giao dịch hợp đồng mini",
    "ru": "Торговля мини-фьючерсами",
    "ko": "미니 선물 거래",
    "ja": "ミニ先物取引",
    "es": "Trading de mini futuros",
    "tr": "Mini Vadeli İşlemler",
    "pl": "Handel mini futures",
    "de": "Mini-Futures-Handel"
  },
  "cmd.switch_chain": {
    "en": "Switch Chain",
    "zh-hans": "切换链",
    "zh-hant": "切換鏈",
    "vi": "Chuyển đổi chuỗi",
    "ru": "Переключить сеть",
    "ko": "체인 전환",
    "ja": "チェーン切り替え",
    "es": "Cambiar cadena",
    "tr": "Ağ Değiştir",
    "pl": "Przełącz sieć",
    "de": "Chain wechseln"
  },
  "cmd.asset": {
    "en": "View Token Holdings",
    "zh-hans": "查看代币持仓",
    "zh-hant": "查看代幣持倉",
    "vi": "Xem số dư token",
    "ru": "Посмотреть баланс токенов",
    "ko": "토큰 보유량 확인",
    "ja": "保有トークンを確認",
    "es": "Ver tenencias de tokens",
    "tr": "Token Bakiyelerini Gör",
    "pl": "Zobacz stan tokenów",
    "de": "Token-Bestände anzeigen"
  },
  "cmd.buy_sell": {
    "en": "Buy/Sell Tokens",
    "zh-hans": "买/卖代币",
    "zh-hant": "買/賣代幣",
    "vi": "Mua/Bán token",
    "ru": "Купить/Продать токены",
    "ko": "토큰 매수/매도",
    "ja": "トークン売買",
    "es": "Comprar/Vender tokens",
    "tr": "Token Al/Sat",
    "pl": "Kup/Sprzedaj tokeny",
    "de": "Token kaufen/verkaufen"
  },
  "cmd.limit_order": {
    "en": "View Limit Orders",
    "zh-hans": "查看挂单",
    "zh-hant": "查看掛單",
    "vi": "Xem lệnh giới hạn",
    "ru": "Посмотреть лимитные ордера",
    "ko": "지정가 주문 확인",
    "ja": "指値注文を確認",
    "es": "Ver órdenes límite",
    "tr": "Limit Emirleri Gör",
    "pl": "Zobacz zlecenia limit",
    "de": "Limit-Orders anzeigen"
  },
  "cmd.copy_trade": {
    "en": "Copy Trade Settings",
    "zh-hans": "查看跟单设置",
    "zh-hant": "查看跟單設置",
    "vi": "Cài đặt sao chép lệnh",
    "ru": "Настройки копитрейдинга",
    "ko": "카피 트레이딩 설정",
    "ja": "コピートレード設定",
    "es": "Configuración de copy trade",
    "tr": "Kopya İşlem Ayarları",
    "pl": "Ustawienia kopiowania handlu",
    "de": "Copy-Trading-Einstellungen"
  },
  "cmd.sniper": {
    "en": "Token Launch Sniper",
    "zh-hans": "代币开盘狙击",
    "zh-hant": "代幣開盤狙擊",
    "vi": "Bắn tỉa token mở bán",
    "ru": "Снайпер токенов",
    "ko": "토큰 런칭 스나이퍼",
    "ja": "トークン上場スナイパー",
    "es": "Sniper de lanzamiento de tokens",
    "tr": "Token Başlangıç Sniper",
    "pl": "Snajper debiutu tokenów",
    "de": "Token-Launch-Sniper"
  },
  "cmd.billing": {
    "en": "Trade & Sniper History",
    "zh-hans": "查看历史交易&狙击记录",
    "zh-hant": "查看歷史交易&狙擊記錄",
    "vi": "Lịch sử giao dịch & bắn tỉa",
    "ru": "История сделок и снайпинга",
    "ko": "거래 및 스나이퍼 내역",
    "ja": "取引・スナイプ履歴",
    "es": "Historial de trading y sniper",
    "tr": "İşlem ve Sniper Geçmişi",
    "pl": "Historia transakcji i snajpera",
    "de": "Handels- & Sniper-Historie"
  },
  "cmd.wallet_setting": {
    "en": "Wallet Settings",
    "zh-hans": "钱包设置",
    "zh-hant": "錢包設置",
    "vi": "Cài đặt ví",
    "ru": "Настройки кошелька",
    "ko": "지갑 설정",
    "ja": "ウォレット設定",
    "es": "Configuración de billetera",
    "tr": "Cüzdan Ayarları",
    "pl": "Ustawienia portfela",
    "de": "Wallet-Einstellungen"
  },
  "cmd.trade_setting": {
    "en": "Global Trade Settings",
    "zh-hans": "全局交易设置",
    "zh-hant": "全局交易設置",
    "vi": "Cài đặt giao dịch chung",
    "ru": "Общие настройки торговли",
    "ko": "글로벌 거래 설정",
    "ja": "全体取引設定",
    "es": "Configuración global de trading",
    "tr": "Genel İşlem Ayarları",
    "pl": "Ogólne ustawienia handlu",
    "de": "Globale Handelseinstellungen"
  },
  "cmd.referral": {
    "en": "Referral & Rewards",
    "zh-hans": "查看邀请信息和奖励",
    "zh-hant": "查看邀請信息和獎勵",
    "vi": "Thông tin mời & phần thưởng",
    "ru": "Рефералы и награды",
    "ko": "추천 정보 및 보상",
    "ja": "招待情報と報酬",
    "es": "Información de referidos y recompensas",
    "tr": "Referans Bilgileri ve Ödüller",
    "pl": "Polecenia i nagrody",
    "de": "Empfehlungen & Belohnungen"
  },

  // --- 底部 3 个并排快捷按键 ---
  "dock.mainMenu": {
    "en": "🚀 Main Menu",
    "zh-hans": "🚀 打开主菜单",
    "zh-hant": "🚀 打開主菜單",
    "vi": "🚀 Menu chính",
    "ru": "🚀 Главное меню",
    "ko": "🚀 메인 메뉴",
    "ja": "🚀 メインメニュー",
    "es": "🚀 Menú principal",
    "tr": "🚀 Ana Menü",
    "pl": "🚀 Menu główne",
    "de": "🚀 Hauptmenü"
  },
  "dock.asset": {
    "en": "📊 Assets",
    "zh-hans": "📊 资产持仓",
    "zh-hant": "📊 資產持倉",
    "vi": "📊 Tài sản",
    "ru": "📊 Активы",
    "ko": "📊 보유 자산",
    "ja": "📊 資産保有",
    "es": "📊 Activos",
    "tr": "📊 Varlıklar",
    "pl": "📊 Aktywa",
    "de": "📊 Bestände"
  },
  "dock.wallet": {
    "en": "💳 Wallets",
    "zh-hans": "💳 钱包设置",
    "zh-hant": "💳 錢包設置",
    "vi": "💳 Cài đặt ví",
    "ru": "💳 Кошелек",
    "ko": "💳 지갑 설정",
    "ja": "💳 ウォレット",
    "es": "💳 Billetera",
    "tr": "💳 Cüzdan",
    "pl": "💳 Portfel",
    "de": "💳 Wallets"
  },
  "dock.placeholder": {
    "en": "Tap buttons or send Token Address (CA)...",
    "zh-hans": "点下方按钮操作或发送代币合约 (CA)...",
    "zh-hant": "點下方按鈕操作或發送代幣合約 (CA)...",
    "vi": "Nhấn nút hoặc gửi địa chỉ token (CA)...",
    "ru": "Нажмите кнопку или отправьте адрес контракта (CA)...",
    "ko": "아래 버튼을 누르거나 토큰 계약(CA)을 전송하세요...",
    "ja": "下のボタンを押すか、コントラクトアドレス(CA)を送信...",
    "es": "Toca un botón o envía la dirección del token (CA)...",
    "tr": "Aşağıdaki butona dokunun veya token adresini (CA) gönderin...",
    "pl": "Dotknij przycisku lub wyślij adres kontraktu (CA)...",
    "de": "Schaltfläche antippen oder Token-Adresse (CA) senden..."
  },
  "trade.referTrading": {
    "en": "Refer Trading",
    "zh-hans": "推荐交易",
    "zh-hant": "推薦交易",
    "vi": "Gợi ý giao dịch",
    "ru": "Поделиться",
    "ko": "추천 거래",
    "ja": "紹介取引",
    "es": "Referir Trading",
    "tr": "Referans İşlem",
    "pl": "Poleć handel",
    "de": "Handel empfehlen"
  },
  "trade.copyReferralLink": {
    "en": "Click to copy referral link:",
    "zh-hans": "点击复制邀请链接:",
    "zh-hant": "點擊複製邀請鏈接:",
    "vi": "Nhấp để sao chép liên kết giới thiệu:",
    "ru": "Нажмите, чтобы скопировать ссылку:",
    "ko": "추천 링크 복사:",
    "ja": "紹介リンクをコピー:",
    "es": "Haz clic para copiar el enlace de referencia:",
    "tr": "Referans bağlantısını kopyalamak için tıklayın:",
    "pl": "Kliknij, aby skopiować link polecający:",
    "de": "Klicken Sie hier, um den Empfehlungslink zu kopieren:"
  },
  "trade.shareToChat": {
    "en": "📲 Share to Chat",
    "zh-hans": "📲 分享到私聊 / 群聊",
    "zh-hant": "📲 分享到私聊 / 群組",
    "vi": "📲 Chia sẻ vào trò chuyện",
    "ru": "📲 Поделиться в чат",
    "ko": "📲 대화방에 공유",
    "ja": "📲 チャットに共有",
    "es": "📲 Compartir en chat",
    "tr": "📲 Sohbette Paylaş",
    "pl": "📲 Udostępnij na czacie",
    "de": "📲 Im Chat teilen"
  },
  "trade.holding": {
    "en": "Holding",
    "zh-hans": "持仓",
    "zh-hant": "持倉",
    "vi": "Nắm giữ",
    "ru": "Баланс",
    "ko": "보유",
    "ja": "保有",
    "es": "Tenencia",
    "tr": "Elde Tutulan",
    "pl": "Posiadane",
    "de": "Bestand"
  },
  "trade.risk": {
    "en": "Risk",
    "zh-hans": "风险提示",
    "zh-hant": "風險提示",
    "vi": "Cảnh báo rủi ro",
    "ru": "Риск",
    "ko": "위험",
    "ja": "リスク",
    "es": "Riesgo",
    "tr": "Risk",
    "pl": "Ryzyko",
    "de": "Risiko"
  },
  "trade.balance": {
    "en": "Balance",
    "zh-hans": "余额",
    "zh-hant": "餘額",
    "vi": "Số dư",
    "ru": "Баланс",
    "ko": "잔액",
    "ja": "残高",
    "es": "Saldo",
    "tr": "Bakiye",
    "pl": "Saldo",
    "de": "Guthaben"
  },
  "trade.price": {
    "en": "Price",
    "zh-hans": "价格",
    "zh-hant": "價格",
    "vi": "Giá",
    "ru": "Цена",
    "ko": "가격",
    "ja": "価格",
    "es": "Precio",
    "tr": "Fiyat",
    "pl": "Cena",
    "de": "Preis"
  },
  "trade.holders": {
    "en": "Holders",
    "zh-hans": "持有人数",
    "zh-hant": "持有人數",
    "vi": "Người giữ",
    "ru": "Холдеров",
    "ko": "보유자",
    "ja": "ホルダー",
    "es": "Titulares",
    "tr": "Sahipler",
    "pl": "Posiadacze",
    "de": "Halter"
  },
  "trade.mc": {
    "en": "MC",
    "zh-hans": "市值",
    "zh-hant": "市值",
    "vi": "Vốn hóa",
    "ru": "Капитализация",
    "ko": "시가총액",
    "ja": "時価総額",
    "es": "Cap. de mercado",
    "tr": "Piyasa Değeri",
    "pl": "Kapitalizacja",
    "de": "Marktkapitalisierung"
  },
  "trade.liq": {
    "en": "Liq",
    "zh-hans": "流动性",
    "zh-hant": "流動性",
    "vi": "Bể thanh khoản",
    "ru": "Ликвидность",
    "ko": "유동성",
    "ja": "流動性",
    "es": "Liquidez",
    "tr": "Likidite",
    "pl": "Płynność",
    "de": "Liquidität"
  },
  "trade.turboMode": {
    "en": "Turbo Mode",
    "zh-hans": "极速模式",
    "zh-hant": "極速模式",
    "vi": "Chế độ siêu tốc",
    "ru": "Турбо",
    "ko": "터보 모드",
    "ja": "ターボモード",
    "es": "Modo Turbo",
    "tr": "Turbo Modu",
    "pl": "Tryb Turbo",
    "de": "Turbo-Modus"
  },
  "trade.limitOrderWarning": {
    "en": "Limit Order available only in single-wallet mode",
    "zh-hans": "限价单仅在单钱包模式下可用",
    "zh-hant": "限價單僅在單錢包模式下可用",
    "vi": "Lệnh giới hạn chỉ áp dụng trong chế độ ví đơn",
    "ru": "Лимитный ордер доступен только в режиме одного кошелька",
    "ko": "지정가 주문은 단일 지갑 모드에서만 사용 가능합니다",
    "ja": "指値注文は単一ウォレットモードでのみ利用可能です",
    "es": "Orden límite disponible solo en modo de una sola billetera",
    "tr": "Limit Emri yalnızca tek cüzdan modunda kullanılabilir",
    "pl": "Zlecenie limitowane dostępne tylko w trybie jednego portfela",
    "de": "Limit-Order nur im Einzel-Wallet-Modus verfügbar"
  },
  "trade.buy": {
    "en": "Buy",
    "zh-hans": "购买",
    "zh-hant": "購買",
    "vi": "Mua",
    "ru": "Купить",
    "ko": "매수",
    "ja": "購入",
    "es": "Comprar",
    "tr": "Satın Al",
    "pl": "Kup",
    "de": "Kaufen"
  },
  "trade.sell": {
    "en": "Sell",
    "zh-hans": "出售",
    "zh-hant": "出售",
    "vi": "Bán",
    "ru": "Продать",
    "ko": "매도",
    "ja": "売却",
    "es": "Vender",
    "tr": "Sat",
    "pl": "Sprzedaj",
    "de": "Verkaufen"
  },
  "trade.activeWallet": {
    "en": "🔀 Switch Wallet",
    "zh-hans": "🔀 切换钱包",
    "zh-hant": "🔀 切換錢包",
    "vi": "🔀 Đổi ví",
    "ru": "🔀 Переключить кошелек",
    "ko": "🔀 지갑 전환",
    "ja": "🔀 ウォレット切替",
    "es": "🔀 Cambiar billetera",
    "tr": "🔀 Cüzdan Değiştir",
    "pl": "🔀 Przełącz portfel",
    "de": "🔀 Wallet wechseln"
  },
  "trade.switchWallet": {
    "en": "🔀 Switch Wallet",
    "zh-hans": "🔀 切换钱包",
    "zh-hant": "🔀 切換錢包",
    "vi": "🔀 Đổi ví",
    "ru": "🔀 Переключить кошелек",
    "ko": "🔀 지갑 전환",
    "ja": "🔀 ウォレット切替",
    "es": "🔀 Cambiar billetera",
    "tr": "🔀 Cüzdan Değiştir",
    "pl": "🔀 Przełącz portfel",
    "de": "🔀 Wallet wechseln"
  },
  "trade.switchWalletTitle": {
    "en": "———— 🔀 Switch Wallet 🔀 ————",
    "zh-hans": "———— 🔀 切换钱包 🔀 ————",
    "zh-hant": "———— 🔀 切換錢包 🔀 ————",
    "vi": "———— 🔀 Đổi ví 🔀 ————",
    "ru": "———— 🔀 Переключить кошелек 🔀 ————",
    "ko": "———— 🔀 지갑 전환 🔀 ————",
    "ja": "———— 🔀 ウォレット切替 🔀 ————",
    "es": "———— 🔀 Cambiar billetera 🔀 ————",
    "tr": "———— 🔀 Cüzdan Değiştir 🔀 ————",
    "pl": "———— 🔀 Przełącz portfel 🔀 ————",
    "de": "———— 🔀 Wallet wechseln 🔀 ————"
  },
  "trade.switchWalletDesc": {
    "en": "You currently have {count} wallet(s) linked ({count}/10 available). Please select a wallet or create/import a new one.",
    "zh-hans": "您当前共关联了{count}个钱包 ({count}/10 可用)。请选择钱包或创建/导入新钱包",
    "zh-hant": "您當前共關聯了{count}個錢包 ({count}/10 可用)。請選擇錢包或創建/導入新錢包",
    "vi": "Bạn hiện đã liên kết {count} ví ({count}/10 khả dụng). Vui lòng chọn ví hoặc tạo/nhập ví mới.",
    "ru": "У вас привязано кошельков: {count} ({count}/10 доступно). Выберите кошелек или создайте/импортируйте новый.",
    "ko": "현재 {count}개의 지갑이 연결되어 있습니다({count}/10 사용 가능). 지갑을 선택하거나 새 지갑을 생성/가져오세요.",
    "ja": "現在{count}個のウォレットが連携されています（{count}/10利用可能）。ウォレットを選択するか、新規作成/インポートしてください。",
    "es": "Actualmente tiene {count} billetera(s) vinculada(s) ({count}/10 disponible(s)). Seleccione una billetera o cree/importe una nueva.",
    "tr": "Şu anda bağlı {count} cüzdanınız var ({count}/10 kullanılabilir). Lütfen bir cüzdan seçin veya yeni bir cüzdan oluşturun/içe aktarın.",
    "pl": "Obecnie połączono {count} portfel(i) ({count}/10 dostępnych). Wybierz portfel lub utwórz/zaimportuj nowy.",
    "de": "Sie haben derzeit {count} Wallet(s) verknüpft ({count}/10 verfügbar). Bitte wählen Sie ein Wallet oder erstellen/importieren Sie ein neues."
  },
  "trade.close": {
    "en": "❌ Close",
    "zh-hans": "❌ 关闭",
    "zh-hant": "❌ 關閉",
    "vi": "❌ Đóng",
    "ru": "❌ Закрыть",
    "ko": "❌ 닫기",
    "ja": "❌ 閉じる",
    "es": "❌ Cerrar",
    "tr": "❌ Kapat",
    "pl": "❌ Zamknij",
    "de": "❌ Schließen"
  },
  "trade.tp1": {
    "en": "At 100% Rise Sell 50%",
    "zh-hans": "翻倍出本",
    "zh-hant": "翻倍出本",
    "vi": "X2 rút vốn (50%)",
    "ru": "Безубыток 2x",
    "ko": "100% 상승시 50% 매도",
    "ja": "2倍で50%売却",
    "es": "Vender 50% al doble",
    "tr": "%100 Artışta %50 Sat",
    "pl": "Sprzedaj 50% przy 100% zysku",
    "de": "Bei 100% Anstieg 50% verkaufen"
  },
  "trade.tp2": {
    "en": "At 999% Rise Sell 100%",
    "zh-hans": "十倍清仓",
    "zh-hant": "十倍清倉",
    "vi": "X10 chốt hết (100%)",
    "ru": "Фиксация 10x",
    "ko": "999% 상승시 100% 매도",
    "ja": "10倍で全て売却",
    "es": "Vender 100% a 10x",
    "tr": "10x Yapınca %100 Sat",
    "pl": "Sprzedaj 100% przy zysku 10x",
    "de": "Bei 999% Anstieg 100% verkaufen"
  },
  "trade.pnlFull": {
    "en": "🔥 Full PnL Chart",
    "zh-hans": "🔥 晒单(详情)",
    "zh-hant": "🔥 曬單(詳情)",
    "vi": "🔥 Chia sẻ PnL (Chi tiết)",
    "ru": "🔥 Скриншот PnL",
    "ko": "🔥 전체 손익 차트",
    "ja": "🔥 PnL詳細",
    "es": "🔥 Gráfico PnL Completo",
    "tr": "🔥 Tam PnL Grafiği",
    "pl": "🔥 Pełny Wykres PnL",
    "de": "🔥 Vollständiger PnL-Chart"
  },
  "trade.pnlSimple": {
    "en": "🔥 Simple PnL Chart",
    "zh-hans": "🔥 晒单",
    "zh-hant": "🔥 曬單",
    "vi": "🔥 Chia sẻ PnL",
    "ru": "🔥 PnL",
    "ko": "🔥 요약 손익 차트",
    "ja": "🔥 PnL共有",
    "es": "🔥 Gráfico PnL Simple",
    "tr": "🔥 Basit PnL Grafiği",
    "pl": "🔥 Prosty Wykres PnL",
    "de": "🔥 Einfacher PnL-Chart"
  },
  "settings.title": {
    "en": "Trade Setting",
    "zh-hans": "交易设置",
    "zh-hant": "交易設置",
    "vi": "Cài đặt giao dịch",
    "ru": "Настройки торговли",
    "ko": "거래 설정",
    "ja": "取引設定",
    "es": "Config. de Trading",
    "tr": "İşlem Ayarları",
    "pl": "Ustawienia Handlu",
    "de": "Handelseinstellungen"
  },
  "settings.currentMode": {
    "en": "Current Mode",
    "zh-hans": "当前模式",
    "zh-hant": "當前模式",
    "vi": "Chế độ hiện tại",
    "ru": "Текущий режим",
    "ko": "현재 모드",
    "ja": "現在のモード",
    "es": "Modo actual",
    "tr": "Mevcut Mod",
    "pl": "Obecny Tryb",
    "de": "Aktueller Modus"
  },
  "settings.fastMode": {
    "en": "⚡️ Fast Mode",
    "zh-hans": "⚡️ 极速模式 (纳秒级直连节点)",
    "zh-hant": "⚡️ 極速模式 (納秒級直連節點)",
    "vi": "⚡️ Chế độ siêu tốc",
    "ru": "⚡️ Турбо режим",
    "ko": "⚡️ 터보 모드",
    "ja": "⚡️ ターボモード",
    "es": "⚡️ Modo Turbo",
    "tr": "⚡️ Turbo Modu",
    "pl": "⚡️ Tryb Szybki",
    "de": "⚡️ Turbo-Modus"
  },
  "settings.fastModeShort": {
    "en": "Fast Mode",
    "zh-hans": "极速模式",
    "zh-hant": "極速模式",
    "vi": "Chế độ siêu tốc",
    "ru": "Турбо режим",
    "ko": "터보 모드",
    "ja": "ターボモード",
    "es": "Modo Turbo",
    "tr": "Turbo Modu",
    "pl": "Tryb Szybki",
    "de": "Turbo-Modus"
  },
  "settings.normalMode": {
    "en": "🐢 Normal Mode",
    "zh-hans": "🐢 普通模式",
    "zh-hant": "🐢 普通模式",
    "vi": "🐢 Chế độ thông thường",
    "ru": "🐢 Обычный режим",
    "ko": "🐢 일반 모드",
    "ja": "🐢 通常モード",
    "es": "🐢 Modo Normal",
    "tr": "🐢 Normal Mod",
    "pl": "🐢 Tryb Normalny",
    "de": "🐢 Normaler Modus"
  },
  "settings.normalModeShort": {
    "en": "Normal Mode",
    "zh-hans": "普通模式",
    "zh-hant": "普通模式",
    "vi": "Chế độ thông thường",
    "ru": "Обычный режим",
    "ko": "일반 모드",
    "ja": "通常モード",
    "es": "Modo Normal",
    "tr": "Normal Mod",
    "pl": "Tryb Normalny",
    "de": "Normaler Modus"
  },
  "settings.gasTip": {
    "en": "Gas Tip",
    "zh-hans": "上链小费",
    "zh-hant": "上鏈小費",
    "vi": "Tiền tip Gas",
    "ru": "Чаевые Gas",
    "ko": "가스 팁",
    "ja": "ガスチップ",
    "es": "Propina de Gas",
    "tr": "Gas Bahşişi",
    "pl": "Napiwek Gas",
    "de": "Gas-Tipp"
  },
  "settings.slippage": {
    "en": "Slippage",
    "zh-hans": "默认滑点",
    "zh-hant": "默認滑點",
    "vi": "Trượt giá mặc định",
    "ru": "Проскальзывание",
    "ko": "슬리피지",
    "ja": "スリッページ",
    "es": "Deslizamiento",
    "tr": "Kayma (Slippage)",
    "pl": "Poślizg cenowy",
    "de": "Slippage"
  },
  "settings.antiMev": {
    "en": "Anti-MEV Protection",
    "zh-hans": "防夹保护 (Anti-MEV)",
    "zh-hant": "防夾保護 (Anti-MEV)",
    "vi": "Chống MEV (Anti-MEV)",
    "ru": "Защита от MEV",
    "ko": "MEV 방지",
    "ja": "アンチMEV保護",
    "es": "Protección Anti-MEV",
    "tr": "Anti-MEV Koruması",
    "pl": "Ochrona Anti-MEV",
    "de": "Anti-MEV-Schutz"
  },
  "settings.enabled": {
    "en": "Enabled",
    "zh-hans": "开启",
    "zh-hant": "開啟",
    "vi": "Bật",
    "ru": "Включено",
    "ko": "활성화",
    "ja": "有効",
    "es": "Activado",
    "tr": "Etkin",
    "pl": "Włączone",
    "de": "Aktiviert"
  },
  "settings.disabled": {
    "en": "Disabled",
    "zh-hans": "关闭",
    "zh-hant": "關閉",
    "vi": "Tắt",
    "ru": "Отключено",
    "ko": "비활성화",
    "ja": "無効",
    "es": "Desactivado",
    "tr": "Devre Dışı",
    "pl": "Wyłączone",
    "de": "Deaktiviert"
  },
  "settings.hint": {
    "en": "💡 Click below to configure custom buy/sell presets or toggle turbo broadcast.",
    "zh-hans": "💡 点击下方预设按钮可自定义一键买卖金额或切换极速广播通道。",
    "zh-hant": "💡 點擊下方預設按鈕可自定義一鍵買賣金額或切換極速廣播通道。",
    "vi": "💡 Nhấp vào các nút bên dưới để tùy chỉnh mức mua/bán hoặc chuyển kênh phát sóng siêu tốc.",
    "ru": "💡 Нажмите ниже для настройки шаблонов или переключения турбо-сети.",
    "ko": "💡 아래를 클릭하여 사용자 지정 매수/매도 사전 설정을 구성하거나 터보 브로드캐스트를 전환하세요.",
    "ja": "💡 下をクリックしてカスタム売買プリセットを設定したり、ターボブロードキャストを切り替えたりします。",
    "es": "💡 Haga clic a continuación para configurar los ajustes preestablecidos o cambiar la red.",
    "tr": "💡 Özel al/sat ön ayarlarını yapılandırmak için aşağıya tıklayın.",
    "pl": "💡 Kliknij poniżej, aby skonfigurować szablony kupna/sprzedaży.",
    "de": "💡 Klicken Sie unten, um Voreinstellungen zu konfigurieren oder auf Turbo zu wechseln."
  },
  "billing.title": {
    "en": "On-Chain Billing History",
    "zh-hans": "链上账单流水",
    "zh-hant": "鏈上賬單流水",
    "vi": "Lịch sử giao dịch trên chuỗi",
    "ru": "История транзакций",
    "ko": "온체인 거래 내역",
    "ja": "オンチェーン取引履歴",
    "es": "Historial de facturación on-chain",
    "tr": "Zincir İçi İşlem Geçmişi",
    "pl": "Historia Transakcji On-Chain",
    "de": "On-Chain-Transaktionsverlauf"
  },
  "billing.past24h": {
    "en": "Past 24h: {txCount} tx(s) completed, volume {volume}, gas consumed {gas}.",
    "zh-hans": "近 24 小时内完成交易 {txCount} 笔，累计交易额 {volume}，消耗 Gas {gas}。",
    "zh-hant": "近 24 小時內完成交易 {txCount} 筆，累計交易額 {volume}，消耗 Gas {gas}。",
    "vi": "24h qua: Đã hoàn thành {txCount} GD, khối lượng {volume}, gas đã tiêu thụ {gas}.",
    "ru": "За 24ч: {txCount} транзакций, объем {volume}, потрачено gas {gas}.",
    "ko": "최근 24시간: {txCount}건 거래 완료, 거래량 {volume}, 가스 소모량 {gas}.",
    "ja": "過去24時間: 取引{txCount}件, 取引高{volume}, ガス消費量{gas}。",
    "es": "Últimas 24h: {txCount} txs completadas, volumen {volume}, gas consumido {gas}.",
    "tr": "Son 24 saat: {txCount} işlem tamamlandı, hacim {volume}, harcanan gas {gas}.",
    "pl": "Ostatnie 24h: {txCount} wykonanych transakcji, wolumen {volume}, zużyty gas {gas}.",
    "de": "Letzte 24h: {txCount} Tx abgeschlossen, Volumen {volume}, Gas verbraucht {gas}."
  },
  "billing.noRecords": {
    "en": "💡 No billing records on this network yet.\nTrades and transfers will be tracked here in real time.",
    "zh-hans": "💡 暂无该网络的链上流水记录。\n通过快捷买入、卖出或转账后，交易流水将实时自动入账并在此呈现。",
    "zh-hant": "💡 暫無該網絡的鏈上流水記錄。\n通過快捷買入、賣出或轉賬後，交易流水將實時自動入賬並在此呈現。",
    "vi": "💡 Chưa có lịch sử giao dịch trên mạng này.\nGiao dịch sẽ được cập nhật tại đây theo thời gian thực.",
    "ru": "💡 Нет записей о транзакциях в этой сети.\nЗдесь будут отображаться сделки в реальном времени.",
    "ko": "💡 아직 이 네트워크에 거래 기록이 없습니다.\n거래 및 전송 내역이 여기에 실시간으로 표시됩니다.",
    "ja": "💡 このネットワークにはまだ取引記録がありません。\n取引と送金はここでリアルタイムに追跡されます。",
    "es": "💡 Aún no hay registros de facturación en esta red.\nLas operaciones se rastrearán aquí en tiempo real.",
    "tr": "💡 Bu ağda henüz işlem kaydı yok.\nİşlemler burada gerçek zamanlı olarak izlenecektir.",
    "pl": "💡 Brak jeszcze historii transakcji w tej sieci.\nHandel i przelewy będą tu śledzone w czasie rzeczywistym.",
    "de": "💡 Noch keine Transaktionsaufzeichnungen in diesem Netzwerk.\nHandel und Überweisungen werden hier in Echtzeit verfolgt."
  },
  "billing.recentTx": {
    "en": "📜 Recent Transactions ({count}):",
    "zh-hans": "📜 交易明细 (最近 {count} 笔):",
    "zh-hant": "📜 交易明細 (最近 {count} 筆):",
    "vi": "📜 Giao dịch gần đây ({count}):",
    "ru": "📜 Последние транзакции ({count}):",
    "ko": "📜 최근 거래 ({count}건):",
    "ja": "📜 最近の取引 ({count}件):",
    "es": "📜 Transacciones recientes ({count}):",
    "tr": "📜 Son İşlemler ({count}):",
    "pl": "📜 Ostatnie Transakcje ({count}):",
    "de": "📜 Kürzliche Transaktionen ({count}):"
  },
  "billing.typeBuy": {
    "en": "BUY",
    "zh-hans": "买入",
    "zh-hant": "買入",
    "vi": "MUA",
    "ru": "ПОКУПКА",
    "ko": "매수",
    "ja": "購入",
    "es": "COMPRA",
    "tr": "ALIM",
    "pl": "KUP",
    "de": "KAUF"
  },
  "billing.typeSell": {
    "en": "SELL",
    "zh-hans": "卖出",
    "zh-hant": "賣出",
    "vi": "BÁN",
    "ru": "ПРОДАЖА",
    "ko": "매도",
    "ja": "売却",
    "es": "VENTA",
    "tr": "SATIŞ",
    "pl": "SPRZEDAJ",
    "de": "VERKAUF"
  },
  "billing.typeTransfer": {
    "en": "TRANSFER",
    "zh-hans": "转账",
    "zh-hant": "轉賬",
    "vi": "CHUYỂN",
    "ru": "ПЕРЕВОД",
    "ko": "전송",
    "ja": "送金",
    "es": "TRANSFERENCIA",
    "tr": "TRANSFER",
    "pl": "PRZELEW",
    "de": "ÜBERWEISUNG"
  },
  "billing.spent": {
    "en": "Spent",
    "zh-hans": "消耗",
    "zh-hant": "消耗",
    "vi": "Đã chi",
    "ru": "Потрачено",
    "ko": "소비",
    "ja": "消費",
    "es": "Gastado",
    "tr": "Harcanan",
    "pl": "Wydano",
    "de": "Ausgegeben"
  },
  "billing.got": {
    "en": "Got",
    "zh-hans": "获得",
    "zh-hant": "獲得",
    "vi": "Nhận",
    "ru": "Получено",
    "ko": "획득",
    "ja": "取得",
    "es": "Obtenido",
    "tr": "Alınan",
    "pl": "Otrzymano",
    "de": "Erhalten"
  },
  "billing.sold": {
    "en": "Sold",
    "zh-hans": "卖出",
    "zh-hant": "賣出",
    "vi": "Đã bán",
    "ru": "Продано",
    "ko": "매도",
    "ja": "売却",
    "es": "Vendido",
    "tr": "Satılan",
    "pl": "Sprzedano",
    "de": "Verkauft"
  },
  "billing.received": {
    "en": "Received",
    "zh-hans": "获得",
    "zh-hant": "獲得",
    "vi": "Nhận",
    "ru": "Получено",
    "ko": "수신",
    "ja": "受取",
    "es": "Recibido",
    "tr": "Alınan",
    "pl": "Otrzymano",
    "de": "Empfangen"
  },
  "billing.sent": {
    "en": "Sent",
    "zh-hans": "转出",
    "zh-hant": "轉出",
    "vi": "Đã gửi",
    "ru": "Отправлено",
    "ko": "전송",
    "ja": "送信",
    "es": "Enviado",
    "tr": "Gönderilen",
    "pl": "Wysłano",
    "de": "Gesendet"
  },
  "billing.hash": {
    "en": "Tx",
    "zh-hans": "哈希",
    "zh-hant": "哈希",
    "vi": "Tx",
    "ru": "Tx",
    "ko": "Tx",
    "ja": "Tx",
    "es": "Tx",
    "tr": "Tx",
    "pl": "Tx",
    "de": "Tx"
  },
  "billing.refreshBilling": {
    "en": "🔄 Refresh Billing",
    "zh-hans": "🔄 刷新账单",
    "zh-hant": "🔄 刷新賬單",
    "vi": "🔄 Làm mới",
    "ru": "🔄 Обновить",
    "ko": "🔄 내역 새로고침",
    "ja": "🔄 更新",
    "es": "🔄 Actualizar",
    "tr": "🔄 Yenile",
    "pl": "🔄 Odśwież",
    "de": "🔄 Aktualisieren"
  },
  "billing.backToWallet": {
    "en": "🔙 Back to Wallet",
    "zh-hans": "🔙 返回钱包",
    "zh-hant": "🔙 返回錢包",
    "vi": "🔙 Về ví",
    "ru": "🔙 В кошелек",
    "ko": "🔙 지갑으로",
    "ja": "🔙 ウォレットへ戻る",
    "es": "🔙 Volver a la Billetera",
    "tr": "🔙 Cüzdana Dön",
    "pl": "🔙 Wróć do portfela",
    "de": "🔙 Zurück zur Wallet"
  },
  "billing.fullExplorer": {
    "en": "🔍 Full Explorer History",
    "zh-hans": "🔍 区块浏览器全流水",
    "zh-hant": "🔍 區塊瀏覽器全流水",
    "vi": "🔍 Lịch sử chi tiết",
    "ru": "🔍 Вся история",
    "ko": "🔍 익스플로러 전체 기록",
    "ja": "🔍 エクスプローラー履歴",
    "es": "🔍 Historial completo",
    "tr": "🔍 Tam Geçmiş",
    "pl": "🔍 Pełna historia",
    "de": "🔍 Gesamter Verlauf"
  },
  "copyTrade.title": {
    "en": "Copy Trade",
    "zh-hans": "跟单",
    "zh-hant": "跟單",
    "vi": "Sao chép giao dịch",
    "ru": "Копитрейдинг",
    "ko": "카피 트레이딩",
    "ja": "コピートレード",
    "es": "Copy Trade",
    "tr": "Kopya İşlem",
    "pl": "Kopiuj Handel",
    "de": "Copy Trading"
  },
  "copyTrade.instructions": {
    "en": "Instructions",
    "zh-hans": "跟单说明",
    "zh-hant": "跟單說明",
    "vi": "Hướng dẫn",
    "ru": "Инструкция",
    "ko": "이용 안내",
    "ja": "説明",
    "es": "Instrucciones",
    "tr": "Talimatlar",
    "pl": "Instrukcje",
    "de": "Anleitung"
  },
  "copyTrade.desc1": {
    "en": "1. Track smart money & whale on-chain movements",
    "zh-hans": "1. 监控聪明钱巨鲸地址链上动向",
    "zh-hant": "1. 監控聰明錢巨鯨地址鏈上動向",
    "vi": "1. Theo dõi ví cá voi & smart money",
    "ru": "1. Отслеживание китов и смарт-мани",
    "ko": "1. 스마트 머니 및 고래 온체인 움직임 추적",
    "ja": "1. スマートマネーとクジラのオンチェーン動向を追跡",
    "es": "1. Rastrear movimientos de ballenas",
    "tr": "1. Akıllı para ve balina hareketlerini izle",
    "pl": "1. Śledź ruchy wielorybów",
    "de": "1. Verfolge Smart Money & Wale"
  },
  "copyTrade.desc2": {
    "en": "2. Millisecond copy buying/selling",
    "zh-hans": "2. 毫秒级跟随买入/卖出目标代币",
    "zh-hant": "2. 毫秒級跟隨買入/賣出目標代幣",
    "vi": "2. Mua/bán sao chép phần nghìn giây",
    "ru": "2. Миллисекундное копирование сделок",
    "ko": "2. 밀리초 단위 카피 매수/매도",
    "ja": "2. ミリ秒での売買コピー",
    "es": "2. Copia de compra/venta en milisegundos",
    "tr": "2. Milisaniyelik kopya alım/satım",
    "pl": "2. Kopiowanie w milisekundach",
    "de": "2. Millisekunden-Copy-Trading"
  },
  "copyTrade.desc3": {
    "en": "3. Custom slippage, Anti-MEV & TP/SL protection",
    "zh-hans": "3. 支持独立滑点、防夹保护 (Anti-MEV) 及止盈止损策略",
    "zh-hant": "3. 支持獨立滑點、防夾保護 (Anti-MEV) 及止盈止損策略",
    "vi": "3. Tùy chỉnh trượt giá, Anti-MEV & Chốt lời/Cắt lỗ",
    "ru": "3. Кастомное проскальзывание, Anti-MEV и TP/SL",
    "ko": "3. 사용자 정의 슬리피지, Anti-MEV 및 익절/손절 보호",
    "ja": "3. カスタムスリッページ、アンチMEV、利確損切",
    "es": "3. Deslizamiento personalizado, Anti-MEV y TP/SL",
    "tr": "3. Özel kayma, Anti-MEV ve TP/SL koruması",
    "pl": "3. Niestandardowy poślizg, ochrona Anti-MEV i TP/SL",
    "de": "3. Benutzerdefinierte Slippage, Anti-MEV & TP/SL"
  },
  "copyTrade.status": {
    "en": "Status: {status}",
    "zh-hans": "运行状态: {status}",
    "zh-hant": "運行狀態: {status}",
    "vi": "Trạng thái: {status}",
    "ru": "Статус: {status}",
    "ko": "상태: {status}",
    "ja": "ステータス: {status}",
    "es": "Estado: {status}",
    "tr": "Durum: {status}",
    "pl": "Status: {status}",
    "de": "Status: {status}"
  },
  "copyTrade.active": {
    "en": "Active",
    "zh-hans": "已开启",
    "zh-hant": "已開啟",
    "vi": "Đang hoạt động",
    "ru": "Активен",
    "ko": "활성화됨",
    "ja": "アクティブ",
    "es": "Activo",
    "tr": "Aktif",
    "pl": "Aktywny",
    "de": "Aktiv"
  },
  "copyTrade.monitored": {
    "en": "Monitored Targets",
    "zh-hans": "监控地址数",
    "zh-hant": "監控地址數",
    "vi": "Mục tiêu đang theo dõi",
    "ru": "Отслеживается",
    "ko": "모니터링 대상",
    "ja": "監視ターゲット",
    "es": "Objetivos Monitoreados",
    "tr": "İzlenen Hedefler",
    "pl": "Monitorowane Cele",
    "de": "Überwachte Ziele"
  },
  "copyTrade.add": {
    "en": "➕ Add",
    "zh-hans": "➕ 新增",
    "zh-hant": "➕ 新增",
    "vi": "➕ Thêm",
    "ru": "➕ Добавить",
    "ko": "➕ 추가",
    "ja": "➕ 追加",
    "es": "➕ Agregar",
    "tr": "➕ Ekle",
    "pl": "➕ Dodaj",
    "de": "➕ Hinzufügen"
  },
  "limitOrder.noData": {
    "en": "⚠️ No data",
    "zh-hans": "⚠️ 暂无数据",
    "zh-hant": "⚠️ 暫無數據",
    "vi": "⚠️ Không có dữ liệu",
    "ru": "⚠️ Нет данных",
    "ko": "⚠️ 데이터 없음",
    "ja": "⚠️ データなし",
    "es": "⚠️ Sin datos",
    "tr": "⚠️ Veri yok",
    "pl": "⚠️ Brak danych",
    "de": "⚠️ Keine Daten"
  },
  "limitOrder.activeOrders": {
    "en": "📌 Active Limit Orders",
    "zh-hans": "📌 当前生效中的限价挂单",
    "zh-hant": "📌 當前生效中的限價掛單",
    "vi": "📌 Lệnh giới hạn đang hoạt động",
    "ru": "📌 Активные лимитные ордера",
    "ko": "📌 활성화된 지정가 주문",
    "ja": "📌 アクティブな指値注文",
    "es": "📌 Órdenes límite activas",
    "tr": "📌 Aktif Limit Emirleri",
    "pl": "📌 Aktywne zlecenia",
    "de": "📌 Aktive Limit-Orders"
  },
  "limitOrder.triggerPrice": {
    "en": "Trigger",
    "zh-hans": "触发价",
    "zh-hant": "觸發價",
    "vi": "Giá kích hoạt",
    "ru": "Триггер",
    "ko": "트리거 가격",
    "ja": "トリガー価格",
    "es": "Precio de activación",
    "tr": "Tetik Fiyatı",
    "pl": "Cena aktywacji",
    "de": "Auslösepreis"
  },
  "limitOrder.amount": {
    "en": "Amount",
    "zh-hans": "数量",
    "zh-hant": "數量",
    "vi": "Số lượng",
    "ru": "Количество",
    "ko": "수량",
    "ja": "数量",
    "es": "Cantidad",
    "tr": "Miktar",
    "pl": "Ilość",
    "de": "Menge"
  },
  "limitOrder.addOrder": {
    "en": "➕ Add Order",
    "zh-hans": "➕ 添加挂单",
    "zh-hant": "➕ 添加掛單",
    "vi": "➕ Thêm lệnh",
    "ru": "➕ Добавить ордер",
    "ko": "➕ 주문 추가",
    "ja": "➕ 注文追加",
    "es": "➕ Agregar Orden",
    "tr": "➕ Emir Ekle",
    "pl": "➕ Dodaj Zlecenie",
    "de": "➕ Order hinzufügen"
  },
  "snipe.title": {
    "en": "🎯 Sniping Engine",
    "zh-hans": "🎯 开盘狙击引擎 (Sniping Engine)",
    "zh-hant": "🎯 開盤狙擊引擎 (Sniping Engine)",
    "vi": "🎯 Bắn tỉa (Sniping Engine)",
    "ru": "🎯 Снайпер",
    "ko": "🎯 스나이핑 엔진",
    "ja": "🎯 スナイプエンジン",
    "es": "🎯 Motor de Sniping",
    "tr": "🎯 Keskin Nişancı Motoru",
    "pl": "🎯 Silnik Snajperski",
    "de": "🎯 Sniping Engine"
  },
  "snipe.desc": {
    "en": "Supports millisecond sniping capabilities:",
    "zh-hans": "白猫打狗机器人拥有毫秒级新开盘捕获能力，支持两种模式：",
    "zh-hant": "白貓打狗機器人擁有毫秒級新開盤捕獲能力，支持兩種模式：",
    "vi": "Hỗ trợ khả năng bắn tỉa phần nghìn giây:",
    "ru": "Поддерживает миллисекундный снайпинг:",
    "ko": "밀리초 스나이핑 기능 지원:",
    "ja": "ミリ秒のスナイピングをサポート:",
    "es": "Soporta sniping en milisegundos:",
    "tr": "Milisaniyelik keskin nişancılık destekler:",
    "pl": "Obsługuje snajpowanie w milisekundach:",
    "de": "Unterstützt Millisekunden-Sniping:"
  },
  "snipe.mode1": {
    "en": "1. 💧 Liquidity Migration: Snipes on the exact block liquidity is added (Block 0).",
    "zh-hans": "1. 💧 流动性添加监听 (Liquidity Migration):\n   * 自动在 Uniswap / Raydium 资金池注入的同一区块 (Block 0) 触发抢跑。",
    "zh-hant": "1. 💧 流動性添加監聽 (Liquidity Migration):\n   * 自動在 Uniswap / Raydium 資金池注入的同一區塊 (Block 0) 觸發搶跑。",
    "vi": "1. 💧 Theo dõi thanh khoản: Bắn tỉa ngay khi thanh khoản được thêm.",
    "ru": "1. 💧 Ликвидность: Снайпинг в блоке добавления ликвидности (Block 0).",
    "ko": "1. 💧 유동성 감지: 유동성이 추가되는 블록(Block 0)에서 스나이핑.",
    "ja": "1. 💧 流動性移行: 流動性が追加されたブロック(Block 0)でスナイプ。",
    "es": "1. 💧 Migración de Liquidez: Snipe en el bloque exacto (Bloque 0).",
    "tr": "1. 💧 Likidite İzleme: Likidite eklendiğinde hemen işlem yapar.",
    "pl": "1. 💧 Migracja płynności: Snajpuje dokładnie w bloku 0.",
    "de": "1. 💧 Liquiditätsmigration: Sniped genau im Block 0."
  },
  "snipe.mode2": {
    "en": "2. 🔑 MethodID Snipe: Targets hidden launches (e.g. openTrading()).",
    "zh-hans": "2. 🔑 方法签名狙击 (MethodID Snipe):\n   * 针对隐藏开盘（Owner 触发 `openTrading()` 等 4-Byte 方法签名），毫秒紧随买入。",
    "zh-hant": "2. 🔑 方法簽名狙擊 (MethodID Snipe):\n   * 針對隱藏開盤（Owner 觸發 `openTrading()` 等 4-Byte 方法簽名），毫秒緊隨買入。",
    "vi": "2. 🔑 Bắn tỉa theo MethodID: Nhắm mục tiêu ra mắt ẩn (vd: openTrading()).",
    "ru": "2. 🔑 Снайпинг метода: Нацелен на скрытые запуски (например, openTrading()).",
    "ko": "2. 🔑 MethodID 스나이핑: 숨겨진 출시(예: openTrading())를 타겟팅.",
    "ja": "2. 🔑 MethodIDスナイプ: 隠しローンチ(openTrading()など)をターゲット。",
    "es": "2. 🔑 Snipe de MethodID: Apunta a lanzamientos ocultos (ej. openTrading()).",
    "tr": "2. 🔑 MethodID Snipe: Gizli lansmanları hedefler.",
    "pl": "2. 🔑 MethodID Snipe: Celuje w ukryte starty (np. openTrading()).",
    "de": "2. 🔑 MethodID Snipe: Zielt auf versteckte Launches ab (z.B. openTrading())."
  },
  "snipe.robinhood": {
    "en": "⚡ Robinhood Chain: Direct connection to Arbitrum Orbit Sequencer for 250ms FCFS.",
    "zh-hans": "⚡ Robinhood Chain 专有特性: 直连 Arbitrum Orbit Sequencer 端口，利用 250ms FCFS 先到先得模型锁定头啖汤！",
    "zh-hant": "⚡ Robinhood Chain 專有特性: 直連 Arbitrum Orbit Sequencer 端口，利用 250ms FCFS 先到先得模型鎖定頭啖湯！",
    "vi": "⚡ Chuỗi Robinhood: Kết nối trực tiếp Arbitrum Orbit Sequencer.",
    "ru": "⚡ Сеть Robinhood: Прямое подключение к Sequencer.",
    "ko": "⚡ Robinhood 체인: 시퀀서에 직접 연결하여 250ms FCFS 지원.",
    "ja": "⚡ Robinhoodチェーン: Sequencerへの直接接続による250ms FCFS。",
    "es": "⚡ Red Robinhood: Conexión directa a Sequencer.",
    "tr": "⚡ Robinhood Ağı: 250ms FCFS için Sequencer'a doğrudan bağlantı.",
    "pl": "⚡ Sieć Robinhood: Bezpośrednie połączenie z sekwencerem.",
    "de": "⚡ Robinhood Chain: Direkte Verbindung zum Sequencer für 250ms FCFS."
  },
  "snipe.createLiquidity": {
    "en": "➕ Liquidity Snipe",
    "zh-hans": "➕ 创建加池狙击任务",
    "zh-hant": "➕ 創建加池狙擊任務",
    "vi": "➕ Bắn tỉa thanh khoản",
    "ru": "➕ Снайпинг ликвидности",
    "ko": "➕ 유동성 스나이핑",
    "ja": "➕ 流動性スナイプ",
    "es": "➕ Snipe de Liquidez",
    "tr": "➕ Likidite Keskin Nişancı",
    "pl": "➕ Snajper Płynności",
    "de": "➕ Liquiditäts-Snipe"
  },
  "snipe.createMethod": {
    "en": "🔑 Method Snipe",
    "zh-hans": "🔑 创建方法签名狙击",
    "zh-hant": "🔑 創建方法簽名狙擊",
    "vi": "🔑 Bắn tỉa MethodID",
    "ru": "🔑 Снайпинг метода",
    "ko": "🔑 MethodID 스나이핑",
    "ja": "🔑 メソッドスナイプ",
    "es": "🔑 Snipe de Método",
    "tr": "🔑 Metot Keskin Nişancı",
    "pl": "🔑 Snajper Metody",
    "de": "🔑 Methoden-Snipe"
  },
  "snipe.toggleBlast": {
    "en": "💥 Multi-Wallet Blast",
    "zh-hans": "💥 开启多钱包联合开火 (3~5钱包)",
    "zh-hant": "💥 開啟多錢包聯合開火 (3~5錢包)",
    "vi": "💥 Bắn tỉa đa ví",
    "ru": "💥 Мульти-кошелек снайпинг",
    "ko": "💥 다중 지갑 발사",
    "ja": "💥 マルチウォレットスナイプ",
    "es": "💥 Multibilletera Blast",
    "tr": "💥 Çoklu Cüzdan Ateşi",
    "pl": "💥 Uderzenie z wielu portfeli",
    "de": "💥 Multi-Wallet-Blast"
  },
  "snipe.adjustTip": {
    "en": "⚡ Adjust Bribe Tip",
    "zh-hans": "⚡ 调节贿赂打赏小费 (Tip)",
    "zh-hant": "⚡ 調節賄賂打賞小費 (Tip)",
    "vi": "⚡ Điều chỉnh tiền Tip",
    "ru": "⚡ Настроить чаевые (Tip)",
    "ko": "⚡ 뇌물 팁 조절",
    "ja": "⚡ チップ(Tip)調整",
    "es": "⚡ Ajustar propina",
    "tr": "⚡ Bahşişi Ayarla",
    "pl": "⚡ Dostosuj Napiwek",
    "de": "⚡ Bribe-Tipp anpassen"
  },
  "snipe.viewActive": {
    "en": "📋 View Active Tasks",
    "zh-hans": "📋 查看进行中的狙击任务",
    "zh-hant": "📋 查看進行中的狙擊任務",
    "vi": "📋 Xem nhiệm vụ đang chạy",
    "ru": "📋 Активные задачи",
    "ko": "📋 활성 작업 보기",
    "ja": "📋 アクティブタスク確認",
    "es": "📋 Ver Tareas Activas",
    "tr": "📋 Aktif Görevleri Görüntüle",
    "pl": "📋 Zobacz Aktywne Zadania",
    "de": "📋 Aktive Aufgaben ansehen"
  },
  "msg.walletCreated": {
    "en": "Wallet created successfully!",
    "zh-hans": "钱包创建成功！",
    "zh-hant": "錢包創建成功！",
    "vi": "Tạo ví thành công!",
    "ru": "Кошелек успешно создан!",
    "ko": "지갑이 성공적으로 생성되었습니다!",
    "ja": "ウォレットの作成に成功しました！",
    "es": "¡Billetera creada con éxito!",
    "tr": "Cüzdan başarıyla oluşturuldu!",
    "pl": "Pomyślnie utworzono portfel!",
    "de": "Wallet erfolgreich erstellt!"
  },
  "msg.walletCreatedDetail": {
    "en": "✅ Successfully created the wallet\n\n💸 Wallet Address\n <code>{address}</code>({chain})\n\nYou have a total of {count} linked wallets({count}/10)",
    "zh-hans": "✅ 成功创建钱包\n\n💸 钱包地址\n <code>{address}</code>({chain})\n\n您当前关联了 {count} 个钱包({count}/10)",
    "zh-hant": "✅ 成功創建錢包\n\n💸 錢包地址\n <code>{address}</code>({chain})\n\n您當前關聯了 {count} 個錢包({count}/10)",
    "vi": "✅ Đã tạo ví thành công\n\n💸 Địa chỉ ví\n <code>{address}</code>({chain})\n\nBạn có tổng cộng {count} ví được liên kết({count}/10)",
    "ru": "✅ Кошелек успешно создан\n\n💸 Адрес кошелька\n <code>{address}</code>({chain})\n\nУ вас всего {count} привязанных кошельков({count}/10)",
    "ko": "✅ 지갑 생성 성공\n\n💸 지갑 주소\n <code>{address}</code>({chain})\n\n총 {count}개의 연결된 지갑이 있습니다({count}/10)",
    "ja": "✅ ウォレットの作成に成功しました\n\n💸 ウォレットアドレス\n <code>{address}</code>({chain})\n\nリンクされたウォレットは合計{count}個です({count}/10)",
    "es": "✅ Billetera creada con éxito\n\n💸 Dirección\n <code>{address}</code>({chain})\n\nTiene un total de {count} billeteras vinculadas({count}/10)",
    "tr": "✅ Cüzdan başarıyla oluşturuldu\n\n💸 Cüzdan Adresi\n <code>{address}</code>({chain})\n\nToplam {count} bağlı cüzdanınız var({count}/10)",
    "pl": "✅ Pomyślnie utworzono portfel\n\n💸 Adres portfela\n <code>{address}</code>({chain})\n\nMasz łącznie {count} połączonych portfeli({count}/10)",
    "de": "✅ Wallet erfolgreich erstellt\n\n💸 Wallet-Adresse\n <code>{address}</code>({chain})\n\nSie haben insgesamt {count} verknüpfte Wallets({count}/10)"
  },
  "msg.importWalletHint": {
    "en": "🔑 Please send your private key or mnemonic in a secure environment (the message will be deleted after 30s):",
    "zh-hans": "🔑 请在安全环境下发送您的私钥或助记词（机器人将自动在 30 秒后销毁明文消息以保安全）：",
    "zh-hant": "🔑 請在安全環境下發送您的私鑰或助記詞（機器人將自動在 30 秒後銷毀明文消息以保安全）：",
    "vi": "🔑 Vui lòng gửi khóa riêng hoặc cụm từ ghi nhớ (tin nhắn sẽ tự xóa sau 30s):",
    "ru": "🔑 Пожалуйста, отправьте приватный ключ или сид-фразу (сообщение будет удалено через 30с):",
    "ko": "🔑 안전한 환경에서 개인키 또는 니모닉을 보내주세요 (메시지는 30초 후 삭제됩니다):",
    "ja": "🔑 安全な環境で秘密鍵またはニーモニックを送信してください（メッセージは30秒後に削除されます）:",
    "es": "🔑 Envíe su clave privada o frase semilla (el mensaje se eliminará en 30s):",
    "tr": "🔑 Lütfen özel anahtarınızı veya anımsatıcınızı gönderin (mesaj 30s sonra silinecektir):",
    "pl": "🔑 Prześlij swój klucz prywatny lub seed (wiadomość zostanie usunięta po 30s):",
    "de": "🔑 Bitte senden Sie Ihren privaten Schlüssel oder Mnemonic (Nachricht wird nach 30s gelöscht):"
  },
  "msg.enterTokenCA": {
    "en": "✏️ Please enter the Token contract address you want to buy or sell",
    "zh-hans": "✏️ 请输入你想买卖的Token合约地址",
    "zh-hant": "✏️ 請輸入你想買賣的Token合約地址",
    "vi": "✏️ Vui lòng nhập địa chỉ hợp đồng Token",
    "ru": "✏️ Пожалуйста, введите адрес контракта",
    "ko": "✏️ 거래할 토큰 컨트랙트 주소를 입력하세요",
    "ja": "✏️ 売買したいトークンのコントラクトアドレスを入力してください",
    "es": "✏️ Ingrese el contrato del token",
    "tr": "✏️ Lütfen işlem yapmak istediğiniz token sözleşme adresini girin",
    "pl": "✏️ Wprowadź adres kontraktu tokena",
    "de": "✏️ Bitte Token-Contract-Adresse eingeben"
  },
  "msg.enterSmartMoney": {
    "en": "✏️ Please enter the smart money wallet address to monitor:",
    "zh-hans": "✏️ 请输入要监控的聪明钱钱包地址：",
    "zh-hant": "✏️ 請輸入要監控的聰明錢錢包地址：",
    "vi": "✏️ Vui lòng nhập địa chỉ ví smart money:",
    "ru": "✏️ Введите адрес кошелька для отслеживания:",
    "ko": "✏️ 모니터링할 스마트 머니 지갑 주소를 입력하세요:",
    "ja": "✏️ 監視するスマートマネーウォレットアドレス:",
    "es": "✏️ Ingrese la dirección de billetera smart money:",
    "tr": "✏️ İzlenecek cüzdan adresini girin:",
    "pl": "✏️ Wprowadź adres portfela do monitorowania:",
    "de": "✏️ Bitte Wallet-Adresse zur Überwachung eingeben:"
  },
  "msg.refreshedBalances": {
    "en": "🔄 Refreshed balances",
    "zh-hans": "🔄 已刷新资产余额",
    "zh-hant": "🔄 已刷新資產餘額",
    "vi": "🔄 Đã làm mới số dư",
    "ru": "🔄 Баланс обновлен",
    "ko": "🔄 잔액 새로고침 완료",
    "ja": "🔄 残高を更新しました",
    "es": "🔄 Saldos actualizados",
    "tr": "🔄 Bakiyeler yenilendi",
    "pl": "🔄 Odświeżono salda",
    "de": "🔄 Guthaben aktualisiert"
  },
  "msg.noWallet": {
    "en": "No wallet created",
    "zh-hans": "您当前未创建钱包",
    "zh-hant": "您當前未創建錢包",
    "vi": "Chưa tạo ví",
    "ru": "Кошелек не создан",
    "ko": "생성된 지갑이 없습니다",
    "ja": "ウォレットが作成されていません",
    "es": "No hay billeteras",
    "tr": "Cüzdan oluşturulmadı",
    "pl": "Nie utworzono portfela",
    "de": "Keine Wallet erstellt"
  },
  "msg.enterNativeTransfer": {
    "en": "✏️ Please enter recipient address for <b>{symbol}</b>:\n\n💳 Current Balance: <b>{balance} {symbol}</b>\n💡 Tip: Send address only, or with amount (e.g. <code>0x... 0.05</code>)\n❌ Type /cancel to cancel.",
    "zh-hans": "✏️ 请输入接收 <b>{symbol}</b> 的目标钱包地址：\n\n💳 当前钱包可用余额: <b>{balance} {symbol}</b>\n💡 提示: 您可以直接发送目标地址，也可以附带金额（例如 <code>0x... 0.05</code>）\n❌ 回复 /cancel 可随时取消。",
    "zh-hant": "✏️ 請輸入接收 <b>{symbol}</b> 的目標錢包地址：\n\n💳 當前錢包可用餘額: <b>{balance} {symbol}</b>\n💡 提示: 您可以直接發送目標地址，也可以附帶金額（例如 <code>0x... 0.05</code>）\n❌ 回覆 /cancel 可隨時取消。",
    "vi": "✏️ Nhập địa chỉ nhận <b>{symbol}</b>:\n\n💳 Số dư: <b>{balance} {symbol}</b>\n💡 Gợi ý: Gửi địa chỉ hoặc kèm số lượng (vd: <code>0x... 0.05</code>)\n❌ Gửi /cancel để hủy.",
    "ru": "✏️ Введите адрес получателя для <b>{symbol}</b>:\n\n💳 Доступно: <b>{balance} {symbol}</b>\n💡 Совет: Введите адрес или адрес и сумму (например <code>0x... 0.05</code>)\n❌ Введите /cancel для отмены.",
    "ko": "✏️ <b>{symbol}</b> 수신 주소를 입력하세요:\n\n💳 현재 잔액: <b>{balance} {symbol}</b>\n💡 팁: 주소만 입력하거나 금액과 함께 입력하세요 (예: <code>0x... 0.05</code>)\n❌ 취소하려면 /cancel 입력.",
    "ja": "✏️ <b>{symbol}</b> の宛先アドレスを入力してください:\n\n💳 現在の残高: <b>{balance} {symbol}</b>\n💡 ヒント: アドレスのみ、または金額付き（例: <code>0x... 0.05</code>）\n❌ キャンセルするには /cancel。",
    "es": "✏️ Ingrese la dirección para <b>{symbol}</b>:\n\n💳 Saldo actual: <b>{balance} {symbol}</b>\n💡 Tip: Envíe dirección o dirección y monto (ej. <code>0x... 0.05</code>)\n❌ Escriba /cancel para cancelar.",
    "tr": "✏️ <b>{symbol}</b> için alıcı adresini girin:\n\n💳 Mevcut Bakiye: <b>{balance} {symbol}</b>\n💡 İpucu: Sadece adres veya miktar ile gönderin (örn. <code>0x... 0.05</code>)\n❌ İptal için /cancel yazın.",
    "pl": "✏️ Wprowadź adres odbiorcy dla <b>{symbol}</b>:\n\n💳 Dostępne saldo: <b>{balance} {symbol}</b>\n💡 Wskazówka: Wyślij adres lub adres i kwotę (np. <code>0x... 0.05</code>)\n❌ Wpisz /cancel aby anulować.",
    "de": "✏️ Empfängeradresse für <b>{symbol}</b> eingeben:\n\n💳 Aktuelles Guthaben: <b>{balance} {symbol}</b>\n💡 Tipp: Nur Adresse oder mit Betrag (z.B. <code>0x... 0.05</code>)\n❌ Zum Abbrechen /cancel tippen."
  },
  "msg.enterTokenTransfer": {
    "en": "✏️ Please enter token contract address (CA):\n\n💡 Tip: Enter step-by-step, or single line: <code>CA toAddress amount</code>\n❌ Type /cancel to cancel.",
    "zh-hans": "✏️ 请输入要转账的代币合约地址 (CA)：\n\n💡 提示: 您可以逐步输入，或单行输入: <code>CA 接收地址 数量</code>\n❌ 回复 /cancel 可随时取消。",
    "zh-hant": "✏️ 請輸入要轉賬的代幣合約地址 (CA)：\n\n💡 提示: 您可以逐步輸入，或單行輸入: <code>CA 接收地址 數量</code>\n❌ 回覆 /cancel 可隨時取消。",
    "vi": "✏️ Nhập địa chỉ hợp đồng token (CA):\n\n💡 Gợi ý: Nhập từng bước hoặc 1 dòng: <code>CA Địa_chỉ_nhận Số_lượng</code>\n❌ Gửi /cancel để hủy.",
    "ru": "✏️ Введите адрес контракта токена (CA):\n\n💡 Совет: Введите пошагово или одной строкой: <code>CA адрес сумма</code>\n❌ Введите /cancel для отмены.",
    "ko": "✏️ 토큰 컨트랙트 주소(CA)를 입력하세요:\n\n💡 팁: 단계별로 입력하거나 한 줄에 입력: <code>CA 수신주소 수량</code>\n❌ 취소하려면 /cancel 입력.",
    "ja": "✏️ トークンのコントラクトアドレス(CA)を入力してください:\n\n💡 ヒント: ステップバイステップ、または1行で: <code>CA 宛先アドレス 数量</code>\n❌ キャンセルするには /cancel。",
    "es": "✏️ Ingrese el contrato del token (CA):\n\n💡 Tip: Ingrese paso a paso o en una línea: <code>CA Dirección Monto</code>\n❌ Escriba /cancel para cancelar.",
    "tr": "✏️ Token sözleşme adresini (CA) girin:\n\n💡 İpucu: Adım adım veya tek satırda: <code>CA AlıcıAdres Miktar</code>\n❌ İptal için /cancel yazın.",
    "pl": "✏️ Wprowadź adres kontraktu tokena (CA):\n\n💡 Wskazówka: Krok po kroku, lub w jednej linii: <code>CA Adres_odbiorcy Kwota</code>\n❌ Wpisz /cancel aby anulować.",
    "de": "✏️ Bitte Token-Contract-Adresse (CA) eingeben:\n\n💡 Tipp: Schrittweise oder einzeilig: <code>CA Empfängeradresse Menge</code>\n❌ Zum Abbrechen /cancel tippen."
  },
  "msg.enterTokenDisplay": {
    "en": "✏️ Please enter the contract address of the token to display",
    "zh-hans": "✏️ 请输入要显示代币的合约地址",
    "zh-hant": "✏️ 請輸入要顯示代幣的合約地址",
    "vi": "✏️ Vui lòng nhập địa chỉ hợp đồng token",
    "ru": "✏️ Введите адрес контракта для отображения",
    "ko": "✏️ 표시할 토큰 컨트랙트 주소를 입력하세요",
    "ja": "✏️ 表示するトークンのコントラクトアドレスを入力してください",
    "es": "✏️ Ingrese el contrato del token para mostrar",
    "tr": "✏️ Görüntülenecek tokenın sözleşme adresini girin",
    "pl": "✏️ Wprowadź adres kontraktu tokena",
    "de": "✏️ Bitte Token-Contract-Adresse zur Anzeige eingeben"
  },
  "msg.transferTargetRecorded": {
    "en": "📥 <b>Recipient address recorded:</b>\n<code>{toAddr}</code>\n\n💳 Available balance: <b>{balance} {symbol}</b>\n\n✏️ Please enter the amount of <b>{symbol}</b> to transfer (e.g. <code>0.05</code>) or type <code>all</code>:\n<i>Type /cancel to cancel</i>",
    "zh-hans": "📥 <b>转账目标地址已设定:</b>\n<code>{toAddr}</code>\n\n💳 当前钱包可用余额: <b>{balance} {symbol}</b>\n\n✏️ 请输入要转账的 <b>{symbol}</b> 金额 (例如 <code>0.05</code>)，或输入 <code>all</code> 全部转出:\n<i>发送 /cancel 可随时取消</i>",
    "zh-hant": "📥 <b>轉賬目標地址已設定:</b>\n<code>{toAddr}</code>\n\n💳 當前錢包可用餘額: <b>{balance} {symbol}</b>\n\n✏️ 請輸入要轉賬的 <b>{symbol}</b> 金額 (例如 <code>0.05</code>)，或輸入 <code>all</code> 全部轉出:\n<i>發送 /cancel 可隨時取消</i>",
    "vi": "📥 <b>Địa chỉ nhận đã lưu:</b>\n<code>{toAddr}</code>\n\n💳 Số dư khả dụng: <b>{balance} {symbol}</b>\n\n✏️ Vui lòng nhập số lượng <b>{symbol}</b> cần chuyển (vd: <code>0.05</code>) hoặc <code>all</code>:\n<i>Gửi /cancel để hủy</i>",
    "ru": "📥 <b>Адрес получателя:</b>\n<code>{toAddr}</code>\n\n💳 Доступно: <b>{balance} {symbol}</b>\n\n✏️ Введите сумму <b>{symbol}</b> (например <code>0.05</code>) или <code>all</code>:\n<i>Введите /cancel для отмены</i>",
    "ko": "📥 <b>수신 주소 기록됨:</b>\n<code>{toAddr}</code>\n\n💳 사용 가능한 잔액: <b>{balance} {symbol}</b>\n\n✏️ 전송할 <b>{symbol}</b> 수량을 입력하거나(예: <code>0.05</code>) <code>all</code>을 입력하세요:\n<i>취소하려면 /cancel 입력</i>",
    "ja": "📥 <b>宛先アドレス記録済:</b>\n<code>{toAddr}</code>\n\n💳 利用可能残高: <b>{balance} {symbol}</b>\n\n✏️ 送金する <b>{symbol}</b> の金額を入力してください（例: <code>0.05</code>）または <code>all</code> と入力:\n<i>キャンセルするには /cancel</i>",
    "es": "📥 <b>Dirección registrada:</b>\n<code>{toAddr}</code>\n\n💳 Saldo disponible: <b>{balance} {symbol}</b>\n\n✏️ Ingrese el monto de <b>{symbol}</b> (ej. <code>0.05</code>) o <code>all</code>:\n<i>Escriba /cancel para cancelar</i>",
    "tr": "📥 <b>Alıcı adres kaydedildi:</b>\n<code>{toAddr}</code>\n\n💳 Mevcut Bakiye: <b>{balance} {symbol}</b>\n\n✏️ Transfer edilecek <b>{symbol}</b> miktarını girin (örn. <code>0.05</code>) veya <code>all</code> yazın:\n<i>İptal için /cancel yazın</i>",
    "pl": "📥 <b>Zapisano adres odbiorcy:</b>\n<code>{toAddr}</code>\n\n💳 Dostępne saldo: <b>{balance} {symbol}</b>\n\n✏️ Wprowadź kwotę <b>{symbol}</b> do przelewu (np. <code>0.05</code>) lub wpisz <code>all</code>:\n<i>Wpisz /cancel aby anulować</i>",
    "de": "📥 <b>Empfängeradresse gespeichert:</b>\n<code>{toAddr}</code>\n\n💳 Verfügbares Guthaben: <b>{balance} {symbol}</b>\n\n✏️ Bitte Überweisungsbetrag in <b>{symbol}</b> eingeben (z.B. <code>0.05</code>) oder <code>all</code> tippen:\n<i>Zum Abbrechen /cancel tippen</i>"
  },
  "msg.copyTargetAdded": {
    "en": "👥 <b>Copy Trade Target Added!</b>\n\nTarget Address: <code>{targetAddr}</code>\n🌐 Chain: <b>{chain}</b>\n\nTransactions will be automatically monitored and copied.",
    "zh-hans": "👥 <b>聪明钱跟单已生效！</b>\n\n目标监控地址: <code>{targetAddr}</code>\n🌐 当前所在链: <b>{chain}</b>\n\n当该地址在链上发生买入或卖出交易时，机器人将自动为您执行跟单策略。",
    "zh-hant": "👥 <b>聰明錢跟單已生效！</b>\n\n目標監控地址: <code>{targetAddr}</code>\n🌐 當前所在鏈: <b>{chain}</b>\n\n當該地址在鏈上發生買入或賣出交易時，機器人將自動為您執行跟單策略。",
    "vi": "👥 <b>Đã thêm mục tiêu sao chép!</b>\n\nĐịa chỉ: <code>{targetAddr}</code>\n🌐 Chuỗi: <b>{chain}</b>\n\nGiao dịch sẽ tự động được theo dõi và sao chép.",
    "ru": "👥 <b>Копитрейдинг активирован!</b>\n\nАдрес: <code>{targetAddr}</code>\n🌐 Сеть: <b>{chain}</b>\n\nТранзакции будут автоматически отслеживаться и копироваться.",
    "ko": "👥 <b>카피 트레이드 대상 추가됨!</b>\n\n타겟 주소: <code>{targetAddr}</code>\n🌐 체인: <b>{chain}</b>\n\n거래가 자동으로 모니터링되고 복사됩니다.",
    "ja": "👥 <b>コピートレードターゲット追加！</b>\n\nターゲットアドレス: <code>{targetAddr}</code>\n🌐 チェーン: <b>{chain}</b>\n\n取引は自動的に監視およびコピーされます。",
    "es": "👥 <b>¡Objetivo Copy Trade Agregado!</b>\n\nDirección: <code>{targetAddr}</code>\n🌐 Red: <b>{chain}</b>\n\nLas transacciones se monitorearán y copiarán automáticamente.",
    "tr": "👥 <b>Kopya İşlem Hedefi Eklendi!</b>\n\nHedef Adres: <code>{targetAddr}</code>\n🌐 Ağ: <b>{chain}</b>\n\nİşlemler otomatik olarak izlenecek ve kopyalanacaktır.",
    "pl": "👥 <b>Dodano Cel Copy Trade!</b>\n\nAdres: <code>{targetAddr}</code>\n🌐 Sieć: <b>{chain}</b>\n\nTransakcje będą automatycznie monitorowane i kopiowane.",
    "de": "👥 <b>Copy-Trading-Ziel hinzugefügt!</b>\n\nZieladresse: <code>{targetAddr}</code>\n🌐 Chain: <b>{chain}</b>\n\nTransaktionen werden automatisch überwacht und kopiert."
  },
  "msg.onlyOneWallet": {
    "en": "Only 1 wallet exists",
    "zh-hans": "当前仅有一个钱包",
    "zh-hant": "當前僅有一個錢包",
    "vi": "Chỉ có 1 ví",
    "ru": "Существует только 1 кошелек",
    "ko": "지갑이 1개뿐입니다",
    "ja": "ウォレットは1つしかありません",
    "es": "Solo existe 1 billetera",
    "tr": "Yalnızca 1 cüzdan var",
    "pl": "Istnieje tylko 1 portfel",
    "de": "Nur 1 Wallet vorhanden"
  },
  "msg.enterNewLabel": {
    "en": "✏️ Please enter new wallet label:",
    "zh-hans": "✏️ 请输入钱包的新别名：",
    "zh-hant": "✏️ 請輸入錢包的新別名：",
    "vi": "✏️ Vui lòng nhập tên ví mới:",
    "ru": "✏️ Введите новое имя кошелька:",
    "ko": "✏️ 새 지갑 별칭을 입력하세요:",
    "ja": "✏️ 新しいウォレットラベルを入力してください:",
    "es": "✏️ Ingrese el nuevo alias:",
    "tr": "✏️ Lütfen yeni cüzdan adını girin:",
    "pl": "✏️ Wprowadź nową etykietę portfela:",
    "de": "✏️ Bitte neues Wallet-Label eingeben:"
  },
  "msg.privateKeyWarning": {
    "en": "⚠️ <b>Security Alert</b>: The private key has absolute control over your assets. Never disclose it to anyone!\n\n💳 Wallet_{index}\n<code>{address}</code>\n\n🔑 <b>Private Key</b>:\n<code>{pk}</code>",
    "zh-hans": "⚠️ <b>安全警告</b>：私钥拥有钱包资产的绝对控制权，请勿泄露给任何人！\n\n💳 Wallet_{index}\n<code>{address}</code>\n\n🔑 <b>私钥</b>:\n<code>{pk}</code>",
    "zh-hant": "⚠️ <b>安全警告</b>：私鑰擁有錢包資產的絕對控制權，請勿泄露給任何人！\n\n💳 Wallet_{index}\n<code>{address}</code>\n\n🔑 <b>私鑰</b>:\n<code>{pk}</code>",
    "vi": "⚠️ <b>Cảnh báo</b>: Khóa riêng có quyền kiểm soát tuyệt đối tài sản của bạn. Không bao giờ tiết lộ cho bất kỳ ai!\n\n💳 Wallet_{index}\n<code>{address}</code>\n\n🔑 <b>Khóa riêng</b>:\n<code>{pk}</code>",
    "ru": "⚠️ <b>Внимание</b>: Приватный ключ дает полный доступ к активам. Никому его не передавайте!\n\n💳 Wallet_{index}\n<code>{address}</code>\n\n🔑 <b>Приватный ключ</b>:\n<code>{pk}</code>",
    "ko": "⚠️ <b>보안 경고</b>: 개인키는 자산에 대한 절대적인 통제권을 가집니다. 누구에게도 유출하지 마세요!\n\n💳 Wallet_{index}\n<code>{address}</code>\n\n🔑 <b>개인키</b>:\n<code>{pk}</code>",
    "ja": "⚠️ <b>セキュリティ警告</b>: 秘密鍵は資産を完全に制御します。絶対に誰にも教えないでください！\n\n💳 Wallet_{index}\n<code>{address}</code>\n\n🔑 <b>秘密鍵</b>:\n<code>{pk}</code>",
    "es": "⚠️ <b>Alerta</b>: La clave privada controla sus activos. ¡Nunca la comparta!\n\n💳 Wallet_{index}\n<code>{address}</code>\n\n🔑 <b>Clave Privada</b>:\n<code>{pk}</code>",
    "tr": "⚠️ <b>Güvenlik Uyarısı</b>: Özel anahtar varlıklarınız üzerinde mutlak kontrole sahiptir. Kimseyle paylaşmayın!\n\n💳 Wallet_{index}\n<code>{address}</code>\n\n🔑 <b>Özel Anahtar</b>:\n<code>{pk}</code>",
    "pl": "⚠️ <b>Ostrzeżenie</b>: Klucz prywatny daje pełną kontrolę nad aktywami. Nigdy go nikomu nie ujawniaj!\n\n💳 Wallet_{index}\n<code>{address}</code>\n\n🔑 <b>Klucz Prywatny</b>:\n<code>{pk}</code>",
    "de": "⚠️ <b>Sicherheitswarnung</b>: Der private Schlüssel kontrolliert Ihre Vermögenswerte. Niemals weitergeben!\n\n💳 Wallet_{index}\n<code>{address}</code>\n\n🔑 <b>Privater Schlüssel</b>:\n<code>{pk}</code>"
  },
  "msg.mustKeepOneWallet": {
    "en": "Must keep at least 1 wallet!",
    "zh-hans": "至少保留一个钱包！",
    "zh-hant": "至少保留一個錢包！",
    "vi": "Phải giữ ít nhất 1 ví!",
    "ru": "Должен остаться хотя бы 1 кошелек!",
    "ko": "지갑은 최소 1개 이상이어야 합니다!",
    "ja": "少なくとも1つのウォレットが必要です！",
    "es": "¡Debe mantener al menos 1 billetera!",
    "tr": "En az 1 cüzdan tutulmalı!",
    "pl": "Musisz zachować co najmniej 1 portfel!",
    "de": "Mindestens 1 Wallet behalten!"
  },
  "msg.walletDeleted": {
    "en": "Wallet deleted",
    "zh-hans": "钱包已删除",
    "zh-hant": "錢包已刪除",
    "vi": "Đã xóa ví",
    "ru": "Кошелек удален",
    "ko": "지갑이 삭제되었습니다",
    "ja": "ウォレットが削除されました",
    "es": "Billetera eliminada",
    "tr": "Cüzdan silindi",
    "pl": "Portfel usunięty",
    "de": "Wallet gelöscht"
  },
  "msg.billingRefreshed": {
    "en": "🔄 Billing refreshed",
    "zh-hans": "🔄 账单流水已刷新",
    "zh-hant": "🔄 賬單流水已刷新",
    "vi": "🔄 Đã làm mới lịch sử",
    "ru": "🔄 История обновлена",
    "ko": "🔄 청구 내역 새로고침",
    "ja": "🔄 履歴を更新しました",
    "es": "🔄 Historial actualizado",
    "tr": "🔄 İşlem geçmişi yenilendi",
    "pl": "🔄 Odświeżono historię",
    "de": "🔄 Verlauf aktualisiert"
  },
  "msg.fastModeSwitched": {
    "en": "⚡️ Switched to Fast Mode",
    "zh-hans": "⚡️ 已切换为极速模式",
    "zh-hant": "⚡️ 已切換為極速模式",
    "vi": "⚡️ Đã chuyển sang chế độ siêu tốc",
    "ru": "⚡️ Включен турбо режим",
    "ko": "⚡️ 터보 모드로 전환됨",
    "ja": "⚡️ ターボモードに切り替えました",
    "es": "⚡️ Cambiado al Modo Turbo",
    "tr": "⚡️ Turbo Moda geçildi",
    "pl": "⚡️ Przełączono na Tryb Szybki",
    "de": "⚡️ In den Turbo-Modus gewechselt"
  },
  "msg.normalModeSwitched": {
    "en": "🐢 Switched to Normal Mode",
    "zh-hans": "🐢 已切换为普通模式",
    "zh-hant": "🐢 已切換為普通模式",
    "vi": "🐢 Đã chuyển sang chế độ thường",
    "ru": "🐢 Включен обычный режим",
    "ko": "🐢 일반 모드로 전환됨",
    "ja": "🐢 通常モードに切り替えました",
    "es": "🐢 Cambiado al Modo Normal",
    "tr": "🐢 Normal Moda geçildi",
    "pl": "🐢 Przełączono na Tryb Normalny",
    "de": "🐢 In den Normalen Modus gewechselt"
  },
  "msg.enterGasTip": {
    "en": "✏️ Please enter gas tip amount ({symbol}), e.g. 0.002",
    "zh-hans": "✏️ 请输入上链小费数量 ({symbol})，例如 0.002",
    "zh-hant": "✏️ 請輸入上鏈小費數量 ({symbol})，例如 0.002",
    "vi": "✏️ Vui lòng nhập số tiền tip Gas ({symbol}), vd: 0.002",
    "ru": "✏️ Введите чаевые Gas ({symbol}), например 0.002",
    "ko": "✏️ 가스 팁 금액({symbol})을 입력하세요, 예: 0.002",
    "ja": "✏️ ガスチップ額({symbol})を入力してください、例: 0.002",
    "es": "✏️ Ingrese propina de gas ({symbol}), ej. 0.002",
    "tr": "✏️ Lütfen gas bahşişi miktarını ({symbol}) girin, örn. 0.002",
    "pl": "✏️ Wprowadź kwotę napiwku gas ({symbol}), np. 0.002",
    "de": "✏️ Bitte Gas-Tipp-Menge ({symbol}) eingeben, z.B. 0.002"
  },
  "msg.enterPreset": {
    "en": "✏️ Please enter your desired preset value:",
    "zh-hans": "✏️ 请发送您期望设置的快捷交易数值：",
    "zh-hant": "✏️ 請發送您期望設置的快捷交易數值：",
    "vi": "✏️ Vui lòng gửi giá trị cài đặt nhanh:",
    "ru": "✏️ Введите желаемое значение:",
    "ko": "✏️ 원하는 사전 설정 값을 입력하세요:",
    "ja": "✏️ 設定したいプリセット値を入力してください:",
    "es": "✏️ Ingrese el valor deseado:",
    "tr": "✏️ Lütfen istediğiniz ön ayar değerini girin:",
    "pl": "✏️ Wprowadź żądaną wartość szablonu:",
    "de": "✏️ Bitte gewünschten Voreinstellungswert eingeben:"
  },
  "msg.refreshedData": {
    "en": "🔄 Refreshed",
    "zh-hans": "🔄 数据已刷新",
    "zh-hant": "🔄 數據已刷新",
    "vi": "🔄 Đã làm mới",
    "ru": "🔄 Обновлено",
    "ko": "🔄 새로고침 완료",
    "ja": "🔄 更新しました",
    "es": "🔄 Actualizado",
    "tr": "🔄 Yenilendi",
    "pl": "🔄 Odświeżono",
    "de": "🔄 Aktualisiert"
  },
  "msg.noClaimable": {
    "en": "No claimable commission",
    "zh-hans": "暂无可提现佣金",
    "zh-hant": "暫無可提現傭金",
    "vi": "Không có hoa hồng để rút",
    "ru": "Нет доступных комиссий",
    "ko": "출금 가능한 커미션이 없습니다",
    "ja": "出金可能な手数料はありません",
    "es": "No hay comisión para retirar",
    "tr": "Çekilebilir komisyon yok",
    "pl": "Brak prowizji do wypłaty",
    "de": "Keine auszahlbare Provision"
  },
  "msg.claimedSuccess": {
    "en": "✅ Claimed to primary wallet successfully!",
    "zh-hans": "✅ 提现成功，已划转至主钱包！",
    "zh-hant": "✅ 提現成功，已劃轉至主錢包！",
    "vi": "✅ Rút tiền về ví chính thành công!",
    "ru": "✅ Успешно выведено на основной кошелек!",
    "ko": "✅ 기본 지갑으로 출금 성공!",
    "ja": "✅ メインウォレットへの出金成功！",
    "es": "✅ ¡Retiro a la billetera principal exitoso!",
    "tr": "✅ Ana cüzdana başarıyla çekildi!",
    "pl": "✅ Pomyślnie wypłacono do portfela!",
    "de": "✅ Erfolgreich in primäre Wallet ausgezahlt!"
  },
  "msg.limitRefreshed": {
    "en": "🔄 Refreshed limit orders",
    "zh-hans": "🔄 已刷新挂单列表",
    "zh-hant": "🔄 已刷新掛單列表",
    "vi": "🔄 Đã làm mới lệnh giới hạn",
    "ru": "🔄 Лимитные ордера обновлены",
    "ko": "🔄 지정가 주문 새로고침 완료",
    "ja": "🔄 指値注文を更新しました",
    "es": "🔄 Órdenes límite actualizadas",
    "tr": "🔄 Limit emirleri yenilendi",
    "pl": "🔄 Odświeżono zlecenia limit",
    "de": "🔄 Limit-Orders aktualisiert"
  },
  "msg.enterLimitOrder": {
    "en": "✏️ Please enter limit order info: <code>CA Price Amount</code>",
    "zh-hans": "✏️ 请输入添加挂单信息，格式: <code>CA 价格 数量</code>",
    "zh-hant": "✏️ 請輸入添加掛單信息，格式: <code>CA 價格 數量</code>",
    "vi": "✏️ Nhập thông tin lệnh: <code>CA Giá Số_lượng</code>",
    "ru": "✏️ Введите инфо: <code>CA Цена Количество</code>",
    "ko": "✏️ 지정가 주문 정보 입력: <code>CA 가격 수량</code>",
    "ja": "✏️ 指値注文情報を入力: <code>CA 価格 数量</code>",
    "es": "✏️ Ingrese orden límite: <code>CA Precio Monto</code>",
    "tr": "✏️ Limit emri bilgilerini girin: <code>CA Fiyat Miktar</code>",
    "pl": "✏️ Wprowadź dane zlecenia: <code>CA Cena Ilość</code>",
    "de": "✏️ Limit-Order-Info eingeben: <code>CA Preis Menge</code>"
  },
  "msg.autoTradeBeta": {
    "en": "🤖 Auto Trade Bot is under private beta test, coming soon!",
    "zh-hans": "🤖 自动交易 Bot (网格/马丁格尔策略) 正在灰度测试中，敬请期待！",
    "zh-hant": "🤖 自動交易 Bot (網格/馬丁格爾策略) 正在灰度測試中，敬請期待！",
    "vi": "🤖 Bot giao dịch tự động đang trong giai đoạn thử nghiệm kín!",
    "ru": "🤖 Авто-торговый бот находится на закрытом бета-тесте!",
    "ko": "🤖 자동 거래 봇은 비공개 베타 테스트 중입니다!",
    "ja": "🤖 自動取引ボットはプライベートベータテスト中です！",
    "es": "🤖 ¡El bot automático está en prueba beta privada!",
    "tr": "🤖 Otomatik İşlem Botu kapalı beta testinde!",
    "pl": "🤖 Automatyczny bot jest w prywatnych testach beta!",
    "de": "🤖 Auto-Trading-Bot ist im privaten Betatest!"
  },
  "msg.miniFuturesSoon": {
    "en": "🚀 MiniFutures 100x dual-direction leverage is launching soon!",
    "zh-hans": "🚀 迷你合约 100x 极速双向多空合约即将上线！",
    "zh-hant": "🚀 迷你合約 100x 極速雙向多空合約即將上線！",
    "vi": "🚀 MiniFutures đòn bẩy 100x 2 chiều sắp ra mắt!",
    "ru": "🚀 Скоро запуск MiniFutures с плечом 100x!",
    "ko": "🚀 MiniFutures 100배 레버리지가 곧 출시됩니다!",
    "ja": "🚀 MiniFutures 100倍レバレッジがまもなく開始！",
    "es": "🚀 ¡MiniFutures apalancamiento 100x muy pronto!",
    "tr": "🚀 MiniFutures 100x kaldıraç çok yakında!",
    "pl": "🚀 MiniFutures z dźwignią 100x już wkrótce!",
    "de": "🚀 MiniFutures 100x Hebel startet bald!"
  },
  "msg.refreshingLive": {
    "en": "Refreshing live token data...",
    "zh-hans": "正在刷新实时行情...",
    "zh-hant": "正在刷新實時行情...",
    "vi": "Đang làm mới dữ liệu token trực tiếp...",
    "ru": "Обновление данных токена...",
    "ko": "실시간 토큰 데이터 새로고침 중...",
    "ja": "リアルトークンデータを更新中...",
    "es": "Actualizando datos en vivo...",
    "tr": "Canlı token verileri yenileniyor...",
    "pl": "Odświeżanie danych tokena...",
    "de": "Live-Token-Daten werden aktualisiert..."
  },
  "msg.insufficientBalance": {
    "en": "❌ Insufficient balance",
    "zh-hans": "❌ 余额不足",
    "zh-hant": "❌ 餘額不足",
    "vi": "❌ Số dư không đủ",
    "ru": "❌ Недостаточно средств",
    "ko": "❌ 잔액 부족",
    "ja": "❌ 残高不足",
    "es": "❌ Saldo insuficiente",
    "tr": "❌ Yetersiz bakiye",
    "pl": "❌ Niewystarczające saldo",
    "de": "❌ Unzureichendes Guthaben"
  },
  "msg.turboExecuting": {
    "en": "🚀 Turbo engine executing swap...",
    "zh-hans": "🚀 纳秒撮合引擎已接收指令...",
    "zh-hant": "🚀 納秒撮合引擎已接收指令...",
    "vi": "🚀 Động cơ turbo đang thực hiện...",
    "ru": "🚀 Турбо-движок выполняет сделку...",
    "ko": "🚀 터보 엔진 스왑 실행 중...",
    "ja": "🚀 ターボエンジン実行中...",
    "es": "🚀 Motor turbo ejecutando swap...",
    "tr": "🚀 Turbo motor swap gerçekleştiriyor...",
    "pl": "🚀 Silnik turbo wykonuje swap...",
    "de": "🚀 Turbo-Engine führt Swap aus..."
  },
  "msg.sellingExecuting": {
    "en": "⚡ Executing instant on-chain sell...",
    "zh-hans": "⚡ 正在执行链上极速清仓...",
    "zh-hant": "⚡ 正在執行鏈上極速清倉...",
    "vi": "⚡ Đang thực hiện bán trên chuỗi...",
    "ru": "⚡ Выполнение быстрой продажи...",
    "ko": "⚡ 온체인 즉시 매도 실행 중...",
    "ja": "⚡ オンチェーン売却を実行中...",
    "es": "⚡ Ejecutando venta rápida...",
    "tr": "⚡ Anında zincir içi satış yürütülüyor...",
    "pl": "⚡ Wykonywanie natychmiastowej sprzedaży...",
    "de": "⚡ Sofortiger On-Chain-Verkauf..."
  },
  "msg.sellFailedNoToken": {
    "en": "❌ Sell failed: Insufficient token balance in wallet.",
    "zh-hans": "❌ 卖出失败: 钱包中该代币余额不足。",
    "zh-hant": "❌ 賣出失敗: 錢包中該代幣餘額不足。",
    "vi": "❌ Bán thất bại: Số dư token không đủ.",
    "ru": "❌ Ошибка продажи: Недостаточно токенов.",
    "ko": "❌ 매도 실패: 토큰 잔액 부족.",
    "ja": "❌ 売却失敗: トークン残高が不足しています。",
    "es": "❌ Venta fallida: Saldo de token insuficiente.",
    "tr": "❌ Satış başarısız: Yetersiz token bakiyesi.",
    "pl": "❌ Sprzedaż nieudana: Niewystarczające saldo tokena.",
    "de": "❌ Verkauf fehlgeschlagen: Unzureichendes Token-Guthaben."
  },
  "msg.generatingPnl": {
    "en": "📊 Generating PnL chart...",
    "zh-hans": "📊 正在生成专属盈亏海报，请稍候...",
    "zh-hant": "📊 正在生成專屬盈虧海報，請稍候...",
    "vi": "📊 Đang tạo ảnh PnL...",
    "ru": "📊 Генерация PnL графика...",
    "ko": "📊 PnL 차트 생성 중...",
    "ja": "📊 PnLチャートを生成中...",
    "es": "📊 Generando gráfico PnL...",
    "tr": "📊 PnL grafiği oluşturuluyor...",
    "pl": "📊 Generowanie wykresu PnL...",
    "de": "📊 PnL-Chart wird generiert..."
  },
  "msg.cancelled": {
    "en": "❌ Current operation cancelled",
    "zh-hans": "❌ 当前操作已取消",
    "zh-hant": "❌ 當前操作已取消",
    "vi": "❌ Thao tác đã bị hủy",
    "ru": "❌ Операция отменена",
    "ko": "❌ 현재 작업이 취소되었습니다",
    "ja": "❌ 現在の操作はキャンセルされました",
    "es": "❌ Operación cancelada",
    "tr": "❌ Geçerli işlem iptal edildi",
    "pl": "❌ Operacja anulowana",
    "de": "❌ Aktueller Vorgang abgebrochen"
  },
  "msg.invalidNumber": {
    "en": "⚠️ Please enter a valid amount, e.g. 0.1",
    "zh-hans": "⚠️ 请输入有效的数字金额，例如 0.1",
    "zh-hant": "⚠️ 請輸入有效的數字金額，例如 0.1",
    "vi": "⚠️ Vui lòng nhập số hợp lệ, vd: 0.1",
    "ru": "⚠️ Введите корректную сумму, например 0.1",
    "ko": "⚠️ 유효한 금액을 입력하세요, 예: 0.1",
    "ja": "⚠️ 有効な金額を入力してください（例: 0.1）",
    "es": "⚠️ Ingrese un monto válido, ej. 0.1",
    "tr": "⚠️ Geçerli bir miktar girin, örn. 0.1",
    "pl": "⚠️ Wprowadź poprawną kwotę, np. 0.1",
    "de": "⚠️ Gültigen Betrag eingeben, z.B. 0.1"
  },
  "msg.invalidPercent": {
    "en": "⚠️ Please enter percentage 1-100, e.g. 25",
    "zh-hans": "⚠️ 请输入 1 到 100 之间的百分比数字，例如 25",
    "zh-hant": "⚠️ 請輸入 1 到 100 之間的百分比數字，例如 25",
    "vi": "⚠️ Vui lòng nhập % từ 1-100, vd: 25",
    "ru": "⚠️ Введите процент от 1 до 100, например 25",
    "ko": "⚠️ 1에서 100 사이의 백분율을 입력하세요, 예: 25",
    "ja": "⚠️ 1から100のパーセンテージを入力してください、例: 25",
    "es": "⚠️ Ingrese porcentaje 1-100, ej. 25",
    "tr": "⚠️ 1-100 arası yüzde girin, örn. 25",
    "pl": "⚠️ Wprowadź procent 1-100, np. 25",
    "de": "⚠️ Prozent 1-100 eingeben, z.B. 25"
  },
  "msg.transferExpired": {
    "en": "❌ Transfer state expired, please retry",
    "zh-hans": "❌ 转账状态失效，请重新发起",
    "zh-hant": "❌ 轉賬狀態失效，請重新發起",
    "vi": "❌ Trạng thái chuyển đã hết hạn, vui lòng thử lại",
    "ru": "❌ Состояние перевода истекло, повторите",
    "ko": "❌ 전송 상태 만료, 다시 시도하세요",
    "ja": "❌ 送金状態が期限切れです、再試行してください",
    "es": "❌ Estado de transferencia expirado, reintente",
    "tr": "❌ Transfer durumu sona erdi, lütfen tekrar deneyin",
    "pl": "❌ Stan przelewu wygasł, spróbuj ponownie",
    "de": "❌ Überweisungsstatus abgelaufen, bitte neu versuchen"
  },
  "msg.invalidTokenAmount": {
    "en": "⚠️ Please enter a valid token amount",
    "zh-hans": "⚠️ 请输入有效的代币数量",
    "zh-hant": "⚠️ 請輸入有效的代幣數量",
    "vi": "⚠️ Vui lòng nhập số lượng token hợp lệ",
    "ru": "⚠️ Введите корректное количество токенов",
    "ko": "⚠️ 유효한 토큰 수량을 입력하세요",
    "ja": "⚠️ 有効なトークン数量を入力してください",
    "es": "⚠️ Ingrese una cantidad de token válida",
    "tr": "⚠️ Lütfen geçerli bir token miktarı girin",
    "pl": "⚠️ Wprowadź poprawną ilość tokenów",
    "de": "⚠️ Bitte gültige Token-Menge eingeben"
  },
  "msg.invalidFormat": {
    "en": "⚠️ Invalid format.",
    "zh-hans": "⚠️ 格式不正确。",
    "zh-hant": "⚠️ 格式不正確。",
    "vi": "⚠️ Sai định dạng.",
    "ru": "⚠️ Неверный формат.",
    "ko": "⚠️ 잘못된 형식입니다.",
    "ja": "⚠️ 無効なフォーマットです。",
    "es": "⚠️ Formato inválido.",
    "tr": "⚠️ Geçersiz biçim.",
    "pl": "⚠️ Nieprawidłowy format.",
    "de": "⚠️ Ungültiges Format."
  }
};

export class I18nService {
  public static t(key: string, lang: string = 'en', params?: Record<string, string | number>): string {
    const l = this.normalizeLang(lang);
    const transMap = dict[key];
    if (!transMap) return key;
    let res = transMap[l] || transMap['en'] || key;
    if (params) {
      for (const k in params) {
        res = res.replaceAll(`{${k}}`, String(params[k]));
        res = res.replaceAll(`{$${k}}`, String(params[k]));
      }
    }
    return res;
  }

  public static normalizeLang(rawLang?: string): SupportedLang {
    if (!rawLang) return 'en';
    const l = rawLang.toLowerCase();
    if (l === 'zh-hans' || l === 'zh-cn' || l === 'zh') return 'zh-hans';
    if (l === 'zh-hant' || l === 'zh-tw' || l === 'zh-hk') return 'zh-hant';
    if (l === 'ru') return 'ru';
    if (l === 'vi') return 'vi';
    if (l === 'ko') return 'ko';
    if (l === 'ja') return 'ja';
    if (l === 'es') return 'es';
    if (l === 'tr') return 'tr';
    if (l === 'pl') return 'pl';
    if (l === 'de') return 'de';
    return 'en';
  }

  public static getLangInfo(lang: string): LangInfo {
    const norm = this.normalizeLang(lang);
    return ALL_LANGUAGES.find(l => l.code === norm) || ALL_LANGUAGES[0];
  }

  public static getLangLabel(lang: string): string {
    const info = this.getLangInfo(lang);
    return `🌐 ${info.name.replace(/^[^\s]+\s*/, '')}`; // e.g. "🌐 Tiếng Việt", "🌐 简体中文"
  }

  public static btnDockMainMenu(lang: string = 'en'): string {
    return this.t('dock.mainMenu', lang);
  }

  public static btnDockAsset(lang: string = 'en'): string {
    return this.t('dock.asset', lang);
  }

  public static btnDockWallet(lang: string = 'en'): string {
    return this.t('dock.wallet', lang);
  }

  public static getDockPlaceholder(lang: string = 'en'): string {
    return this.t('dock.placeholder', lang);
  }

  public static getCommandDesc(cmdKey: string, lang: string = 'en'): string {
    return this.t(`cmd.${cmdKey}`, lang);
  }

  /**
   * 判断文本是否触发主菜单
   */
  public static isMainMenuTrigger(rawText?: string): boolean {
    if (!rawText) return false;
    const text = rawText.trim();
    if (text === '/start' || text === '/menu') return true;
    if (text.includes('主菜单') || text.includes('主菜單')) return true;

    const titleTrans = dict['dock.mainMenu'];
    if (titleTrans) {
      for (const langCode of Object.keys(titleTrans)) {
        if (text === titleTrans[langCode]) return true;
      }
    }

    if (/^(🚀\s*)?(main\s*menu|menu\s*chính|главное\s*меню|메인\s*메뉴|メインメニュー|menú\s*principal|ana\s*menü|menu\s*główne|hauptmenü)/i.test(text)) {
      return true;
    }
    return false;
  }

  /**
   * 判断文本是否触发资产持仓
   */
  public static isAssetTrigger(rawText?: string): boolean {
    if (!rawText) return false;
    const text = rawText.trim();
    if (text === '/asset' || text === '/assets' || text.includes('资产持仓') || text.includes('資產持倉') || text.includes('查看持仓')) return true;

    const titleTrans = dict['dock.asset'];
    if (titleTrans) {
      for (const langCode of Object.keys(titleTrans)) {
        if (text === titleTrans[langCode]) return true;
      }
    }

    if (/^(📊\s*)?(asset|holdings?|tài\s*sản|активы|보유\s*자산|資産保有|activos|varlıklar|aktywa|bestände)/i.test(text)) {
      return true;
    }
    return false;
  }

  /**
   * 判断文本是否触发钱包设置
   */
  public static isWalletTrigger(rawText?: string): boolean {
    if (!rawText) return false;
    const text = rawText.trim();
    if (text === '/wallet_setting' || text === '/wallets' || text === '/wallet' || text.includes('钱包设置') || text.includes('錢包設置') || text.includes('钱包中心')) return true;

    const titleTrans = dict['dock.wallet'];
    if (titleTrans) {
      for (const langCode of Object.keys(titleTrans)) {
        if (text === titleTrans[langCode]) return true;
      }
    }

    if (/^(💳\s*)?(wallet|billetera|cüzdan|portfel|кошелек|ví\s*tiền|지갑|ウォレット)/i.test(text)) {
      return true;
    }
    return false;
  }

  // --- 1. 主菜单 (Main Menu) 文案 ---
  public static getMainCurrentChain(lang: string, chainName: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return `🌐 当前所在链: ${chainName}`;
      case 'zh-hant': return `🌐 當前所在鏈: ${chainName}`;
      case 'vi': return `🌐 Chuỗi hiện tại: ${chainName}`;
      case 'ru': return `🌐 Текущая сеть: ${chainName}`;
      case 'ko': return `🌐 현재 체인: ${chainName}`;
      case 'ja': return `🌐 現在のチェーン: ${chainName}`;
      case 'es': return `🌐 Cadena actual: ${chainName}`;
      case 'tr': return `🌐 Mevcut Ağ: ${chainName}`;
      case 'pl': return `🌐 Aktualna sieć: ${chainName}`;
      case 'de': return `🌐 Aktuelle Chain: ${chainName}`;
      default: return `🌐 Current Chain: ${chainName}`;
    }
  }

  public static getMainZeroWallets(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return `您当前关联了 0 个钱包(0/10)`;
      case 'zh-hant': return `您當前關聯了 0 個錢包(0/10)`;
      case 'vi': return `Bạn hiện có 0 ví được liên kết (0/10)`;
      case 'ru': return `У вас подключено 0 кошельков (0/10)`;
      case 'ko': return `연결된 지갑이 0개입니다 (0/10)`;
      case 'ja': return `リンクされたウォレットが0個です (0/10)`;
      case 'es': return `Tienes un total de 0 billeteras vinculadas (0/10)`;
      case 'tr': return `Toplam 0 bağlı cüzdanınız var (0/10)`;
      case 'pl': return `Masz łącznie 0 połączonych portfeli (0/10)`;
      case 'de': return `Sie haben insgesamt 0 verknüpfte Wallets (0/10)`;
      default: return `You have a total of 0 linked wallets(0/10)`;
    }
  }

  public static getSecurityReminder(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans':
        return `⚠️ 安全提醒：Telegram 目前在 Bot 顶部展示的广告中已有多人反馈存在诈骗盗取私钥行为（且我们无法屏蔽），为了您的资产安全，请不要点击任何Ad广告!`;
      case 'zh-hant':
        return `⚠️ 安全提醒：Telegram 目前在 Bot 頂部展示的廣告中已有多人反饋存在詐騙盜取私鑰行為（且我們無法屏蔽），為了您的資產安全，請不要點擊任何Ad廣告!`;
      case 'vi':
        return `⚠️ Nhắc nhở an toàn: Nhiều người dùng đã báo cáo hành vi lừa đảo đánh cắp khóa riêng trong các quảng cáo ở đầu Telegram Bot (chúng tôi không thể chặn). Vì an toàn tài sản của bạn, vui lòng không nhấp vào bất kỳ quảng cáo Ad nào!`;
      case 'ru':
        return `⚠️ Напоминание о безопасности: Многие пользователи сообщают о мошенничестве и краже приватных ключей в рекламе вверху Telegram Bot (мы не можем её заблокировать). Ради безопасности ваших средств не нажимайте на рекламу Ad!`;
      case 'ko':
        return `⚠️ 보안 알림: 텔레그램 봇 상단에 표시되는 광고 중 개인키 탈취 등 사기 행위가 다수 보고되었습니다(저희가 차단할 수 없음). 자산 안전을 위해 어떤 Ad 광고도 클릭하지 마세요!`;
      case 'ja':
        return `⚠️ セキュリティ警告：Telegram Bot上部に表示される広告に秘密鍵を盗む詐欺が多数報告されています（当方でブロックできません）。資産の安全のため、いかなるAd広告もクリックしないでください！`;
      case 'es':
        return `⚠️ Recordatorio de seguridad: Varios usuarios han reportado estafas para robar claves privadas en anuncios de Telegram Bot (no podemos bloquearlos). Por la seguridad de sus activos, ¡no haga clic en ningún anuncio Ad!`;
      case 'tr':
        return `⚠️ Güvenlik Uyarısı: Telegram Bot'un üst kısmında gösterilen reklamlarda özel anahtarları çalan dolandırıcılık bildirilmiştir (bunları engelleyemiyoruz). Varlık güvenliğiniz için lütfen hiçbir Ad reklamına tıklamayın!`;
      case 'pl':
        return `⚠️ Ostrzeżenie dotyczące bezpieczeństwa: Wielu użytkowników zgłaszało kradzieże kluczy prywatnych w reklamach na górze Telegram Bot (nie możemy ich zablokować). Dla bezpieczeństwa aktywów nie klikaj w żadne reklamy Ad!`;
      case 'de':
        return `⚠️ Sicherheitswarnung: Mehrere Benutzer haben betrügerische Aktivitäten zum Diebstahl privater Schlüssel in den oben im Telegram Bot angezeigten Anzeigen gemeldet (wir können diese nicht blockieren). Zu Ihrer Sicherheit klicken Sie bitte auf keine Ad-Anzeigen!`;
      default:
        return `⚠️ Security Reminder: Multiple users have reported fraudulent behavior in ads displayed at the top of the Telegram Bot (which we cannot block). For your asset safety, please do not click on any Ad ads!`;
    }
  }

  // --- 2. 主菜单按钮标签 (Main Menu Buttons) ---
  public static btnBuySell(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '💰 买/卖';
      case 'zh-hant': return '💰 買/賣';
      case 'vi': return '💰 Mua/Bán';
      case 'ru': return '💰 Купить/Продать';
      case 'ko': return '💰 매수/매도';
      case 'ja': return '💰 売買';
      case 'es': return '💰 Comprar/Vender';
      case 'tr': return '💰 Al/Sat';
      case 'pl': return '💰 Kup/Sprzedaj';
      case 'de': return '💰 Kaufen/Verkaufen';
      default: return '💰 Buy/Sell';
    }
  }

  public static btnLimitOrder(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '📌 限价单';
      case 'zh-hant': return '📌 限價單';
      case 'vi': return '📌 Lệnh giới hạn';
      case 'ru': return '📌 Лимитный ордер';
      case 'ko': return '📌 지정가 주문';
      case 'ja': return '📌 指値注文';
      case 'es': return '📌 Orden límite';
      case 'tr': return '📌 Limit Emir';
      case 'pl': return '📌 Zlecenie limit';
      case 'de': return '📌 Limit-Order';
      default: return '📌 Limit Order';
    }
  }

  public static btnSniper(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '🔫 狙击';
      case 'zh-hant': return '🔫 狙擊';
      case 'vi': return '🔫 Bắn tỉa';
      case 'ru': return '🔫 Снайпер';
      case 'ko': return '🔫 스나이퍼';
      case 'ja': return '🔫 スナイパー';
      case 'es': return '🔫 Sniper';
      case 'tr': return '🔫 Keskin Nişancı';
      case 'pl': return '🔫 Snajper';
      case 'de': return '🔫 Sniper';
      default: return '🔫 Sniper';
    }
  }

  public static btnCopyTrade(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '⚡️ 跟单';
      case 'zh-hant': return '⚡️ 跟單';
      case 'vi': return '⚡️ Sao chép lệnh';
      case 'ru': return '⚡️ Копитрейдинг';
      case 'ko': return '⚡️ 카피 트레이딩';
      case 'ja': return '⚡️ コピートレード';
      case 'es': return '⚡️ Copy Trade';
      case 'tr': return '⚡️ Kopya İşlem';
      case 'pl': return '⚡️ Kopiuj handel';
      case 'de': return '⚡️ Copy Trading';
      default: return '⚡️ Copy Trade';
    }
  }

  public static btnAsset(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '🏦 资产';
      case 'zh-hant': return '🏦 資產';
      case 'vi': return '🏦 Tài sản';
      case 'ru': return '🏦 Активы';
      case 'ko': return '🏦 자산';
      case 'ja': return '🏦 資産';
      case 'es': return '🏦 Activos';
      case 'tr': return '🏦 Varlıklar';
      case 'pl': return '🏦 Aktywa';
      case 'de': return '🏦 Vermögen';
      default: return '🏦 Asset';
    }
  }

  public static btnWallet(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '💳 钱包';
      case 'zh-hant': return '💳 錢包';
      case 'vi': return '💳 Ví tiền';
      case 'ru': return '💳 Кошелек';
      case 'ko': return '💳 지갑';
      case 'ja': return '💳 ウォレット';
      case 'es': return '💳 Billetera';
      case 'tr': return '💳 Cüzdan';
      case 'pl': return '💳 Portfel';
      case 'de': return '💳 Wallet';
      default: return '💳 Wallet';
    }
  }

  public static btnTradeSetting(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '⚙️ 交易设置';
      case 'zh-hant': return '⚙️ 交易設置';
      case 'vi': return '⚙️ Cài đặt giao dịch';
      case 'ru': return '⚙️ Настройки';
      case 'ko': return '⚙️ 거래 설정';
      case 'ja': return '⚙️ 取引設定';
      case 'es': return '⚙️ Ajustes';
      case 'tr': return '⚙️ İşlem Ayarları';
      case 'pl': return '⚙️ Ustawienia handlu';
      case 'de': return '⚙️ Handelseinstellungen';
      default: return '⚙️ Trade Setting';
    }
  }

  public static btnReferral(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '🎁 邀请奖励';
      case 'zh-hant': return '🎁 邀請獎勵';
      case 'vi': return '🎁 Thưởng giới thiệu';
      case 'ru': return '🎁 Рефералы';
      case 'ko': return '🎁 추천 보상';
      case 'ja': return '🎁 招待報酬';
      case 'es': return '🎁 Referidos';
      case 'tr': return '🎁 Referans Ödülü';
      case 'pl': return '🎁 Polecenia';
      case 'de': return '🎁 Empfehlungsbelohnung';
      default: return '🎁 Referral Reward';
    }
  }

  public static btnSwitchChain(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '🔀 切换链';
      case 'zh-hant': return '🔀 切換鏈';
      case 'vi': return '🔀 Chuyển chuỗi';
      case 'ru': return '🔀 Сменить сеть';
      case 'ko': return '🔀 체인 변경';
      case 'ja': return '🔀 チェーン切替';
      case 'es': return '🔀 Cambiar cadena';
      case 'tr': return '🔀 Ağ Değiştir';
      case 'pl': return '🔀 Zmień sieć';
      case 'de': return '🔀 Chain wechseln';
      default: return '🔀 Switch Chain';
    }
  }

  public static btnFreeSourceCode(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '🎁 免费源码获取';
      case 'zh-hant': return '🎁 免費源碼獲取';
      case 'vi': return '🎁 Nhận mã nguồn miễn phí';
      case 'ru': return '🎁 Бесплатный исходный код';
      case 'ko': return '🎁 무료 소스코드 받기';
      case 'ja': return '🎁 無料ソースコード取得';
      case 'es': return '🎁 Obtener código fuente gratis';
      case 'tr': return '🎁 Ücretsiz Kaynak Kodu Al';
      case 'pl': return '🎁 Pobierz darmowy kod źródłowy';
      case 'de': return '🎁 Kostenlosen Quellcode erhalten';
      default: return '🎁 Get Free Source Code';
    }
  }

  public static btnAutoTradeBot(lang: string): string {
    return this.btnFreeSourceCode(lang);
  }

  public static btnDevTechSupport(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '🛠️ TG机器人开发 / 群发引流 / Web3技术支持';
      case 'zh-hant': return '🛠️ TG機器人開發 / 群發引流 / Web3技術支持';
      case 'vi': return '🛠️ Phát triển TG Bot / Công cụ kéo mem / Web3';
      case 'ru': return '🛠️ Разработка TG-ботов / Маркетинг / Web3';
      case 'ko': return '🛠️ TG 봇 개발 / 마케팅 도구 / Web3 기술지원';
      case 'ja': return '🛠️ TGボット開発 / 集客ツール / Web3開発サポート';
      case 'es': return '🛠️ Desarr. Bots TG / Marketing / Soporte Web3';
      case 'tr': return '🛠️ TG Bot Geliştirme / Pazarlama / Web3 Destek';
      case 'pl': return '🛠️ Boty TG / Narzędzia marketingowe / Web3';
      case 'de': return '🛠️ TG-Bot-Entwicklung / Marketing / Web3-Support';
      default: return '🛠️ TG Bot / Marketing Tools / Web3 Dev Support';
    }
  }

  public static btnMiniFutures(lang: string): string {
    return this.btnDevTechSupport(lang);
  }

  public static btnCreateWallet(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '➕ 创建钱包';
      case 'zh-hant': return '➕ 創建錢包';
      case 'vi': return '➕ Tạo ví mới';
      case 'ru': return '➕ Создать кошелек';
      case 'ko': return '➕ 지갑 생성';
      case 'ja': return '➕ ウォレット作成';
      case 'es': return '➕ Crear billetera';
      case 'tr': return '➕ Cüzdan Oluştur';
      case 'pl': return '➕ Utwórz portfel';
      case 'de': return '➕ Wallet erstellen';
      default: return '➕ Create Wallet';
    }
  }

  public static btnImportWallet(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '⬇️ 导入钱包';
      case 'zh-hant': return '⬇️ 導入錢包';
      case 'vi': return '⬇️ Nhập ví';
      case 'ru': return '⬇️ Импортировать кошелек';
      case 'ko': return '⬇️ 지갑 가져오기';
      case 'ja': return '⬇️ ウォレットインポート';
      case 'es': return '⬇️ Importar billetera';
      case 'tr': return '⬇️ Cüzdan İçe Aktar';
      case 'pl': return '⬇️ Importuj portfel';
      case 'de': return '⬇️ Wallet importieren';
      default: return '⬇️ Import Wallet';
    }
  }

  public static btnClose(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '❌ 关闭';
      case 'zh-hant': return '❌ 關閉';
      case 'vi': return '❌ Đóng';
      case 'ru': return '❌ Закрыть';
      case 'ko': return '❌ 닫기';
      case 'ja': return '❌ 閉じる';
      case 'es': return '❌ Cerrar';
      case 'tr': return '❌ Kapat';
      case 'pl': return '❌ Zamknij';
      case 'de': return '❌ Schließen';
      default: return '❌ Close';
    }
  }

  public static btnBack(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '🔙 返回';
      case 'zh-hant': return '🔙 返回';
      case 'vi': return '🔙 Quay lại';
      case 'ru': return '🔙 Назад';
      case 'ko': return '🔙 뒤로';
      case 'ja': return '🔙 戻る';
      case 'es': return '🔙 Volver';
      case 'tr': return '🔙 Geri';
      case 'pl': return '🔙 Wstecz';
      case 'de': return '🔙 Zurück';
      default: return '🔙 Back';
    }
  }

  public static btnBackToLang(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '🔙 返回修改语言';
      case 'zh-hant': return '🔙 返回修改語言';
      case 'vi': return '🔙 Quay lại đổi ngôn ngữ';
      case 'ru': return '🔙 Сменить язык';
      case 'ko': return '🔙 언어 변경으로 돌아가기';
      case 'ja': return '🔙 言語選択に戻る';
      case 'es': return '🔙 Cambiar idioma';
      case 'tr': return '🔙 Dili Değiştir';
      case 'pl': return '🔙 Zmień język';
      case 'de': return '🔙 Sprache ändern';
      default: return '🔙 Back to Languages';
    }
  }

  public static btnRefresh(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '🔄 刷新';
      case 'zh-hant': return '🔄 刷新';
      case 'vi': return '🔄 Làm mới';
      case 'ru': return '🔄 Обновить';
      case 'ko': return '🔄 새로고침';
      case 'ja': return '🔄 更新';
      case 'es': return '🔄 Actualizar';
      case 'tr': return '🔄 Yenile';
      case 'pl': return '🔄 Odśwież';
      case 'de': return '🔄 Aktualisieren';
      default: return '🔄 Refresh';
    }
  }

  // --- 3. 切链与选链文案 (Chain Selection) ---
  public static getSelectChainPrompt(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '请选择你想要切换到的网络';
      case 'zh-hant': return '請選擇你想切換的網絡';
      case 'vi': return 'Vui lòng chọn mạng bạn muốn chuyển sang';
      case 'ru': return 'Пожалуйста, выберите сеть, на которую хотите переключиться';
      case 'ko': return '전환하려는 네트워크를 선택하세요';
      case 'ja': return '切り替えたいネットワークを選択してください';
      case 'es': return 'Por favor seleccione la red a la que desea cambiar';
      case 'tr': return 'Lütfen geçiş yapmak istediğiniz ağı seçin';
      case 'pl': return 'Wybierz sieć, na którą chcesz się przełączyć';
      case 'de': return 'Bitte wählen Sie das Netzwerk aus, zu dem Sie wechseln möchten';
      default: return 'Please select the chain you want to switch to';
    }
  }

  // --- 4. 语言选择文案 (Language Selection) ---
  public static getSelectLangPrompt(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '请选择你想要切换到的语言';
      case 'zh-hant': return '請選擇你想切換的語言';
      case 'vi': return 'Vui lòng chọn ngôn ngữ bạn muốn chuyển sang';
      case 'ru': return 'Пожалуйста, выберите язык, на который хотите переключиться';
      case 'ko': return '전환하려는 언어를 선택하세요';
      case 'ja': return '切り替えたい言語を選択してください';
      case 'es': return 'Por favor seleccione el idioma al que desea cambiar';
      case 'tr': return 'Lütfen geçiş yapmak istediğiniz dili seçin';
      case 'pl': return 'Wybierz język, na który chcesz się przełączyć';
      case 'de': return 'Bitte wählen Sie die Sprache aus, zu der Sie wechseln möchten';
      default: return 'Please select the language you want to switch to';
    }
  }

  // --- 5. 钱包管理文案与按钮 (Wallet Menu) ---
  public static btnTransferNative(lang: string, symbol: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return `💸 转账 ${symbol}`;
      case 'zh-hant': return `💸 轉賬 ${symbol}`;
      case 'vi': return `💸 Chuyển ${symbol}`;
      case 'ru': return `💸 Перевод ${symbol}`;
      case 'ko': return `💸 ${symbol} 전송`;
      case 'ja': return `💸 ${symbol} 送金`;
      case 'es': return `💸 Transferir ${symbol}`;
      case 'tr': return `💸 ${symbol} Transfer`;
      case 'pl': return `💸 Przelej ${symbol}`;
      case 'de': return `💸 ${symbol} Überweisen`;
      default: return `💸 Transfer ${symbol}`;
    }
  }

  public static btnExportKey(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '🔑 导出私钥';
      case 'zh-hant': return '🔑 導出私鑰';
      case 'vi': return '🔑 Xuất khóa riêng';
      case 'ru': return '🔑 Экспорт ключа';
      case 'ko': return '🔑 개인키 내보내기';
      case 'ja': return '🔑 秘密鍵エクスポート';
      case 'es': return '🔑 Exportar clave';
      case 'tr': return '🔑 Özel Anahtar';
      case 'pl': return '🔑 Eksportuj klucz';
      case 'de': return '🔑 Schlüssel exportieren';
      default: return '🔑 Export Key';
    }
  }

  public static btnDeleteWallet(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '❌ 删除';
      case 'zh-hant': return '❌ 刪除';
      case 'vi': return '❌ Xóa';
      case 'ru': return '❌ Удалить';
      case 'ko': return '❌ 삭제';
      case 'ja': return '❌ 削除';
      case 'es': return '❌ Eliminar';
      case 'tr': return '❌ Sil';
      case 'pl': return '❌ Usuń';
      case 'de': return '❌ Löschen';
      default: return '❌ Delete';
    }
  }

  public static btnBilling(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '📑 账单';
      case 'zh-hant': return '📑 賬單';
      case 'vi': return '📑 Lịch sử giao dịch';
      case 'ru': return '📑 История';
      case 'ko': return '📑 거래 내역';
      case 'ja': return '📑 取引履歴';
      case 'es': return '📑 Historial';
      case 'tr': return '📑 İşlem Geçmişi';
      case 'pl': return '📑 Historia';
      case 'de': return '📑 Transaktionen';
      default: return '📑 Billing';
    }
  }

  // --- 6. 资产中心按钮 (Asset Menu) ---
  public static btnTransferToken(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '💸 转账代币';
      case 'zh-hant': return '💸 轉賬代幣';
      case 'vi': return '💸 Chuyển Token';
      case 'ru': return '💸 Перевод токенов';
      case 'ko': return '💸 토큰 전송';
      case 'ja': return '💸 トークン送金';
      case 'es': return '💸 Transferir Token';
      case 'tr': return '💸 Token Transfer';
      case 'pl': return '💸 Przelej tokeny';
      case 'de': return '💸 Token überweisen';
      default: return '💸 Transfer Token';
    }
  }

  public static btnShowTokens(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '✨ 显示代币';
      case 'zh-hant': return '✨ 顯示代幣';
      case 'vi': return '✨ Hiển thị Token';
      case 'ru': return '✨ Показать токены';
      case 'ko': return '✨ 토큰 표시';
      case 'ja': return '✨ トークン表示';
      case 'es': return '✨ Mostrar Tokens';
      case 'tr': return '✨ Tokenları Göster';
      case 'pl': return '✨ Pokaż tokeny';
      case 'de': return '✨ Tokens anzeigen';
      default: return '✨ Display Tokens';
    }
  }

  public static btnSellPercent(percent: number, lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return `卖出 ${percent}%`;
      case 'zh-hant': return `賣出 ${percent}%`;
      case 'vi': return `Bán ${percent}%`;
      case 'ru': return `Продать ${percent}%`;
      case 'ko': return `${percent}% 매도`;
      case 'ja': return `${percent}% 売却`;
      case 'es': return `Vender ${percent}%`;
      case 'tr': return `%${percent} Sat`;
      case 'pl': return `Sprzedaj ${percent}%`;
      case 'de': return `${percent}% Verkaufen`;
      default: return `Sell ${percent}%`;
    }
  }

  // --- 7. 邀请返佣 (Referral Menu) ---
  public static btnClaimReward(lang: string): string {
    const l = this.normalizeLang(lang);
    switch (l) {
      case 'zh-hans': return '💸 立即提现';
      case 'zh-hant': return '💸 立即提現';
      case 'vi': return '💸 Rút tiền ngay';
      case 'ru': return '💸 Вывести сейчас';
      case 'ko': return '💸 지금 출금';
      case 'ja': return '💸 今すぐ出金';
      case 'es': return '💸 Retirar ahora';
      case 'tr': return '💸 Şimdi Çek';
      case 'pl': return '💸 Wypłać teraz';
      case 'de': return '💸 Jetzt auszahlen';
      default: return '💸 Withdraw Now';
    }
  }

  /**
   * 生成一键分享到私聊/群组的推荐交易文案 (支持全部 11 种语言)
   */
  public static getShareTradeText(lang: string, tokenName: string, symbol: string, chain: string, address: string): string {
    const l = this.normalizeLang(lang);
    const sym = symbol ? ` (${symbol})` : '';
    switch (l) {
      case 'zh-hans':
        return `🔥 发现优质代币推荐！\n代币: ${tokenName}${sym}\n网络: ${chain}\n合约: ${address}\n\n👇 点击下方链接，立即在白猫打狗中交易:`;
      case 'zh-hant':
        return `🔥 發現優質代幣推薦！\n代幣: ${tokenName}${sym}\n網絡: ${chain}\n合約: ${address}\n\n👇 點擊下方鏈接，立即在白貓打狗中交易:`;
      case 'vi':
        return `🔥 Gợi ý token tiềm năng!\nToken: ${tokenName}${sym}\nMạng: ${chain}\nCA: ${address}\n\n👇 Nhấp vào liên kết bên dưới để giao dịch:`;
      case 'ru':
        return `🔥 Рекомендация токена!\nТокен: ${tokenName}${sym}\nСеть: ${chain}\nКонтракт: ${address}\n\n👇 Нажмите ссылку ниже для торговли:`;
      case 'ko':
        return `🔥 추천 토큰!\n토큰: ${tokenName}${sym}\n네트워크: ${chain}\n계약: ${address}\n\n👇 아래 링크를 눌러 거래하세요:`;
      case 'ja':
        return `🔥 おすすめトークン！\nトークン: ${tokenName}${sym}\nネットワーク: ${chain}\nコントラクト: ${address}\n\n👇 以下のリンクをタップして取引:`;
      case 'es':
        return `🔥 ¡Recomendación de token!\nToken: ${tokenName}${sym}\nRed: ${chain}\nContrato: ${address}\n\n👇 Haz clic en el enlace para operar:`;
      case 'tr':
        return `🔥 Sıcak Token Tavsiyesi!\nToken: ${tokenName}${sym}\nAğ: ${chain}\nSözleşme: ${address}\n\n👇 İşlem yapmak için aşağıdaki bağlantıya tıklayın:`;
      case 'pl':
        return `🔥 Rekomendacja tokena!\nToken: ${tokenName}${sym}\nSieć: ${chain}\nKontrakt: ${address}\n\n👇 Kliknij poniższy link, aby handlować:`;
      case 'de':
        return `🔥 Token-Empfehlung!\nToken: ${tokenName}${sym}\nNetzwerk: ${chain}\nContract: ${address}\n\n👇 Klicken Sie auf den folgenden Link, um zu handeln:`;
      default:
        return `🔥 Hot Token Recommendation!\nToken: ${tokenName}${sym}\nNetwork: ${chain}\nCA: ${address}\n\n👇 Click the link below to trade on WhiteCat Bot:`;
    }
  }
}
