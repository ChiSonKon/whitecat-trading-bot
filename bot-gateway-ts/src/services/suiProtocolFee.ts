import { Transaction } from '@mysten/sui/transactions';
import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils';
import { splitProtocolFee, RATE_SCALE } from './protocolFee.js';

export function requireSuiFeeRecipient(rate: bigint, recipient: string): string {
  if (rate === 0n) return '';
  if (!isValidSuiAddress(recipient) || BigInt(normalizeSuiAddress(recipient)) === 0n) {
    throw new Error('Configure a valid nonzero PROTOCOL_FEE_RECIPIENT_SUI or set PROTOCOL_FEE_RATE=0');
  }
  return normalizeSuiAddress(recipient);
}

/** Call before aggregator construction, so SDK resolution cannot invalidate command references. */
export function createSuiBuyFeeTransaction(gross: bigint, rate: bigint, recipient: string) {
  const address = requireSuiFeeRecipient(rate, recipient);
  const { fee, net } = splitProtocolFee(gross, rate);
  if (net <= 0n) throw new Error('Swap input must be positive');
  const tx = new Transaction();
  if (fee > 0n) {
    const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(fee)]);
    tx.transferObjects([feeCoin], tx.pure.address(address));
  }
  return { tx, fee, net };
}

/** 7k settles sell commission against actual native output within its Move call. */
export function suiSellCommission(rate: bigint, recipient: string, sender: string) {
  const address = requireSuiFeeRecipient(rate, recipient);
  if (rate * 10000n % RATE_SCALE !== 0n) {
    throw new Error('Sui sell commission requires a whole basis point rate (0.0001 increments)');
  }
  return { partner: address || sender, commissionBps: Number(rate * 10000n / RATE_SCALE) };
}
