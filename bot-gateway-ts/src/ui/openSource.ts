export const GITHUB_URL = 'https://github.com/ChiSonKon/whitecat-trading-bot';
const copy: Record<string, [string, string]> = {
  'zh-hans': ['⭐ GitHub 开源项目', '白猫 Trading Bot 已全面开源，欢迎前往 GitHub 为我们点亮 Star 🌟 并参与生态建设！'],
  'zh-hant': ['⭐ GitHub 開源專案', '白貓 Trading Bot 已全面開源，歡迎前往 GitHub 點亮 Star 🌟 並參與生態建設！'],
  en: ['⭐ GitHub source code', 'WhiteCat Trading Bot is open source. Star us on GitHub 🌟 and contribute!'],
  ru: ['⭐ Исходный код GitHub', 'WhiteCat Trading Bot — проект с открытым кодом. Поставьте звезду на GitHub 🌟 и участвуйте!'],
  vi: ['⭐ Mã nguồn GitHub', 'WhiteCat Trading Bot đã mở mã nguồn. Hãy tặng sao trên GitHub 🌟 và đóng góp!'],
  ko: ['⭐ GitHub 오픈 소스', 'WhiteCat Trading Bot은 오픈 소스입니다. GitHub에서 Star 🌟를 누르고 참여하세요!'],
  ja: ['⭐ GitHub ソースコード', 'WhiteCat Trading Botはオープンソースです。GitHubでStar 🌟を付けて開発に参加しましょう！'],
  es: ['⭐ Código en GitHub', 'WhiteCat Trading Bot es de código abierto. ¡Danos una estrella en GitHub 🌟 y participa!'],
  tr: ['⭐ GitHub kaynak kodu', 'WhiteCat Trading Bot açık kaynaklıdır. GitHub’da yıldız verin 🌟 ve katkıda bulunun!'],
  pl: ['⭐ Kod źródłowy GitHub', 'WhiteCat Trading Bot ma otwarty kod. Daj nam gwiazdkę na GitHub 🌟 i dołącz!'],
  de: ['⭐ GitHub-Quellcode', 'WhiteCat Trading Bot ist Open Source. Gib uns einen Stern auf GitHub 🌟 und mach mit!'],
};
export const githubLabel = (lang: string): string => (copy[lang] || copy.en)[0];
export const githubDescription = (lang: string): string => (copy[lang] || copy.en)[1];
