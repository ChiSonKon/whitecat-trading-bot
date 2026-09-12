import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP_FILE = path.join(__dirname, '../../data/token_map.json');

export class TokenKeyHelper {
  private static forwardMap = new Map<string, string>(); // lowerTokenAddress -> shortKey
  private static reverseMap = new Map<string, string>(); // shortKey / hash -> canonicalTokenAddress
  private static initialized = false;

  private static init() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const dir = path.dirname(MAP_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(MAP_FILE)) {
        const data = JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'));
        for (const [key, addr] of Object.entries(data)) {
          const canonical = String(addr).trim();
          this.reverseMap.set(key, canonical);
          this.forwardMap.set(canonical.toLowerCase(), key);
          // Also map pure hash if key was tk_hash or vice versa
          if (key.startsWith('tk_')) {
            this.reverseMap.set(key.replace('tk_', ''), canonical);
          } else {
            this.reverseMap.set(`tk_${key}`, canonical);
          }
        }
        console.log(`[TokenKeyHelper] Loaded ${this.reverseMap.size} token mappings from ${MAP_FILE}`);
      }
    } catch (err: any) {
      console.warn('[TokenKeyHelper] Failed to load token_map.json:', err?.message);
    }

    // Pre-seed known tokens to guarantee zero-miss resolution
    this.register('0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL');
    this.register('0x9f854b3ad20f8161ec0886f15f4a1752bf75d22261556f14cc8d3a1c5d50e529::magma::MAGMA');
    this.register('0x2::sui::SUI');
  }

  private static save() {
    try {
      const dir = path.dirname(MAP_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const obj: Record<string, string> = {};
      this.reverseMap.forEach((addr, key) => {
        obj[key] = addr;
      });
      fs.writeFileSync(MAP_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[TokenKeyHelper] Failed to save token_map.json:', err?.message);
    }
  }

  public static register(tokenAddress: string): string {
    this.init();
    const clean = tokenAddress.trim();
    if (!clean) return '';

    const lower = clean.toLowerCase();
    const existing = this.forwardMap.get(lower);
    if (existing) {
      return existing;
    }

    const md5Hash = crypto.createHash('md5').update(lower).digest('hex'); // 32 hex chars (PinkPunk format)
    const shortKey = `tk_${md5Hash.slice(0, 10)}`; // 13 chars

    this.forwardMap.set(lower, shortKey);
    this.reverseMap.set(shortKey, clean);
    this.reverseMap.set(md5Hash, clean);
    this.reverseMap.set(md5Hash.slice(0, 10), clean);

    this.save();
    return shortKey;
  }

  /**
   * 将任意长度代币地址（Move 链如 Sui 的 80+ 字符 Type Tag）
   * 映射为短 Key (严格控制在 16 字节以内)，彻底避免 Telegram 64 字节 callback 溢出。
   */
  public static toKey(tokenAddress: string): string {
    this.init();
    const clean = tokenAddress.trim();
    if (!clean) return '';

    // 如果已经是已注册的短 Key，直接返回
    if (this.reverseMap.has(clean)) {
      return clean.startsWith('tk_') ? clean : `tk_${clean.slice(0, 10)}`;
    }

    // EVM 短地址 (42 字符) 且不包含特殊字符的直接使用短 Key 保持全局统一
    return this.register(clean);
  }

  /**
   * 将 shortKey 反解析回原本完整的代币合约地址 / Type Tag
   */
  public static toAddress(keyOrAddress: string): string {
    this.init();
    if (!keyOrAddress) return '';
    const clean = keyOrAddress.trim();

    if (this.reverseMap.has(clean)) {
      return this.reverseMap.get(clean)!;
    }

    // 如果带有 tk_ 前缀
    if (clean.startsWith('tk_')) {
      const stripped = clean.replace('tk_', '');
      if (this.reverseMap.has(stripped)) {
        return this.reverseMap.get(stripped)!;
      }
    } else {
      const prefixed = `tk_${clean}`;
      if (this.reverseMap.has(prefixed)) {
        return this.reverseMap.get(prefixed)!;
      }
    }

    return clean;
  }
}
