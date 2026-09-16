/** All monetary arithmetic uses integer base units; fractional dust stays with the user. */
export function parseProtocolFeeRate(value: string = '0.006'): bigint {
  if (!/^(?:0|0\.\d{1,18})$/.test(value)) throw new Error('Invalid PROTOCOL_FEE_RATE: expected decimal 0 through 0.020');
  const scaled = BigInt((value.split('.')[1] || '').padEnd(18, '0'));
  if (scaled > 20_000_000_000_000_000n) throw new Error('PROTOCOL_FEE_RATE exceeds 0.020');
  return scaled;
}

export const RATE_SCALE = 1_000_000_000_000_000_000n;

export function splitProtocolFee(amount: bigint, rate: bigint): { fee: bigint; net: bigint } {
  if (amount < 0n || rate < 0n || rate > RATE_SCALE / 50n) throw new Error('Invalid protocol fee operands');
  const fee = amount * rate / RATE_SCALE;
  return { fee, net: amount - fee };
}

/** Accept decimal strings (including exponent notation from existing number callers). */
export function nativeBaseUnits(value: string | number, decimals: number): bigint {
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));
  if (!match || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error('Invalid native amount');
  const exponent = Number(match[3] || 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) throw new Error('Invalid amount exponent');
  const digits = match[1] + (match[2] || '');
  const shift = decimals + exponent - (match[2]?.length || 0);
  if (shift >= 0) return BigInt(digits) * 10n ** BigInt(shift);
  const divisor = 10n ** BigInt(-shift);
  if (BigInt(digits) % divisor !== 0n) throw new Error('Amount has fractional base units');
  return BigInt(digits) / divisor;
}

export function requireBuyBalance(balance: bigint, gross: bigint, gasReserved: bigint): void {
  if (gross <= 0n || gasReserved < 0n || balance < gross + gasReserved) {
    throw new Error('Insufficient native balance for buy amount plus reserved gas');
  }
}
