// Invoice reference <-> calldata. IMPLEMENTED.
//
// Primary strategy: standard ERC-20 transfer(payee, amount) calldata with a RefPay
// suffix appended. Solidity's ABI decoder ignores trailing calldata for static
// arguments, so USDC executes a normal transfer while the reference stays
// permanently visible in the transaction input on Basescan ("View Input As UTF-8").
//
// Suffix layout (after the 68-byte transfer call):
//   4 bytes  magic "RFP1"  (0x52465031)
//   1 byte   reference length N (1..48)
//   N bytes  reference, ASCII
//
// RISK (unverified): PayBox's validator/simulator may reject non-ABI trailing bytes.
// Test this FIRST in the portal (EXECUTION_PLAN.md step 2). Fallbacks: ARCHITECTURE.md §7.
import { encodeFunctionData, erc20Abi } from "viem";

export const MEMO_MAGIC = "52465031"; // "RFP1"
const TRANSFER_SELECTOR = "a9059cbb";
const TRANSFER_CALL_HEX_LEN = 2 + 8 + 64 + 64; // "0x" + selector + 2 words

export function encodeReferenceSuffix(reference: string): string {
  if (!/^[\x21-\x7e]{1,48}$/.test(reference)) throw new Error("Reference must be 1-48 printable ASCII chars");
  const bytes = Buffer.from(reference, "ascii");
  return MEMO_MAGIC + bytes.length.toString(16).padStart(2, "0") + bytes.toString("hex");
}

/** ERC-20 transfer calldata with the RefPay reference appended. */
export function encodeTransferWithReference(payee: `0x${string}`, atomicAmount: bigint, reference: string): `0x${string}` {
  const base = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [payee, atomicAmount] });
  return `${base}${encodeReferenceSuffix(reference)}` as `0x${string}`;
}

/** Plain ERC-20 transfer calldata (fallback C: reference only in the tool result). */
export function encodeTransfer(payee: `0x${string}`, atomicAmount: bigint): `0x${string}` {
  return encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [payee, atomicAmount] });
}

/** Extract a RefPay reference from transaction input, or null. Used by verify_invoice_paid. */
export function decodeReferenceFromInput(input: string): string | null {
  const hex = input.toLowerCase();
  if (!hex.startsWith(`0x${TRANSFER_SELECTOR}`) || hex.length < TRANSFER_CALL_HEX_LEN + 10) return null;
  const tail = hex.slice(TRANSFER_CALL_HEX_LEN);
  if (!tail.startsWith(MEMO_MAGIC)) return null;
  const len = parseInt(tail.slice(8, 10), 16);
  const body = tail.slice(10, 10 + len * 2);
  if (!len || body.length !== len * 2) return null;
  return Buffer.from(body, "hex").toString("ascii");
}
