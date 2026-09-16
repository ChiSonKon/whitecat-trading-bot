import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function storageKey(): Buffer {
  const value = process.env.USER_STORE_ENCRYPTION_KEY;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error('USER_STORE_ENCRYPTION_KEY must be a securely provisioned 32-byte hex key');
  }
  return Buffer.from(value, 'hex');
}

export function encodeStore(data: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', storageKey(), iv);
  cipher.setAAD(Buffer.from('whitecat-user-store:v1'));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return JSON.stringify({ version: 1, algorithm: 'aes-256-gcm', iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'), ciphertext: ciphertext.toString('hex') });
}

export function decodeStore(raw: string): { data: Record<string, any>; legacy: boolean } {
  storageKey(); // Fail closed even when opening a legacy plaintext file.
  const envelope = JSON.parse(raw);
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error('Invalid user store');
  if (!('version' in envelope)) {
    if (!Object.keys(envelope).every(key => /^\d+$/.test(key))) throw new Error('Invalid legacy user store');
    return { data: envelope, legacy: true };
  }
  if (envelope.version !== 1 || envelope.algorithm !== 'aes-256-gcm' ||
      !/^[a-f0-9]{24}$/.test(envelope.iv) || !/^[a-f0-9]{32}$/.test(envelope.tag) ||
      typeof envelope.ciphertext !== 'string' || !/^(?:[a-f0-9]{2})+$/.test(envelope.ciphertext)) {
    throw new Error('Invalid encrypted user store envelope');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', storageKey(), Buffer.from(envelope.iv, 'hex'));
  decipher.setAAD(Buffer.from('whitecat-user-store:v1'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
  const plain = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'hex')), decipher.final()]);
  return { data: JSON.parse(plain.toString('utf8')), legacy: false };
}

export function writeStoreAtomic(file: string, data: unknown): void {
  const encrypted = encodeStore(data);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    const fd = fs.openSync(temp, 'wx', 0o600);
    try { fs.writeFileSync(fd, encrypted, 'utf8'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
