import { ethers } from 'ethers';
import { splitProtocolFee } from './protocolFee.js';

export const EVM_FEE_TRANSFER_GAS = 21000n;

export function requireEvmFeeRecipient(rate: bigint, recipient: string): string {
  if (rate === 0n) return '';
  const trimmed = recipient?.trim() || '';
  if (!trimmed || !ethers.isAddress(trimmed) || trimmed.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
    throw new Error('Configure a valid nonzero PROTOCOL_FEE_RECIPIENT_EVM or set PROTOCOL_FEE_RATE=0');
  }
  return ethers.getAddress(trimmed);
}

export function createEvmBuyFeePlan(grossWei: bigint, rate: bigint, recipient: string) {
  if (rate === 0n || !recipient?.trim()) {
    if (grossWei <= 0n) throw new Error('Swap input must be positive');
    return { fee: 0n, net: grossWei, recipient: '' };
  }
  const address = requireEvmFeeRecipient(rate, recipient);
  const { fee, net } = splitProtocolFee(grossWei, rate);
  if (net <= 0n) throw new Error('Swap input must be positive');
  return { fee, net, recipient: address };
}

export function createEvmSellFeePlan(grossNativeWei: bigint, rate: bigint, recipient: string) {
  if (rate === 0n || !recipient?.trim()) {
    return { fee: 0n, net: grossNativeWei, recipient: '' };
  }
  const address = requireEvmFeeRecipient(rate, recipient);
  const { fee, net } = splitProtocolFee(grossNativeWei, rate);
  return { fee, net, recipient: address };
}
