import { PublicKey as SolPublicKey } from '@solana/web3.js';
import { splitProtocolFee } from './protocolFee.js';

export const SOLANA_FEE_TRANSFER_LAMPORTS = 5000n;

export function requireSolanaFeeRecipient(rate: bigint, recipient: string): string {
  if (rate === 0n) return '';
  const trimmed = recipient?.trim() || '';
  if (!trimmed) {
    throw new Error('Configure a valid nonzero PROTOCOL_FEE_RECIPIENT_SOLANA or set PROTOCOL_FEE_RATE=0');
  }
  try {
    const pubkey = new SolPublicKey(trimmed);
    if (pubkey.equals(SolPublicKey.default)) {
      throw new Error('Zero/default address is not allowed');
    }
    return pubkey.toBase58();
  } catch (err: any) {
    throw new Error('Configure a valid nonzero PROTOCOL_FEE_RECIPIENT_SOLANA or set PROTOCOL_FEE_RATE=0');
  }
}

export function createSolanaBuyFeePlan(grossLamports: bigint, rate: bigint, recipient: string) {
  if (rate === 0n || !recipient?.trim()) {
    if (grossLamports <= 0n) throw new Error('Swap input must be positive');
    return { fee: 0n, net: grossLamports, recipient: '' };
  }
  const address = requireSolanaFeeRecipient(rate, recipient);
  const { fee, net } = splitProtocolFee(grossLamports, rate);
  if (net <= 0n) throw new Error('Swap input must be positive');
  return { fee, net, recipient: address };
}

export function createSolanaSellFeePlan(grossLamports: bigint, rate: bigint, recipient: string) {
  if (rate === 0n || !recipient?.trim()) {
    return { fee: 0n, net: grossLamports, recipient: '' };
  }
  const address = requireSolanaFeeRecipient(rate, recipient);
  const { fee, net } = splitProtocolFee(grossLamports, rate);
  return { fee, net, recipient: address };
}
