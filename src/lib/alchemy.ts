// Alchemy Base mainnet JSON-RPC. STUB: implement the two functions below.
//
// Endpoint: POST https://base-mainnet.g.alchemy.com/v2      (NO key in the URL)
// Auth:     header `Authorization: Bearer <ALCHEMY_API_KEY>` -> brokered SECRET for host
//           base-mainnet.g.alchemy.com. Alchemy documents header auth at
//           https://www.alchemy.com/docs/how-to-use-api-keys-in-http-headers
// Method:   alchemy_getAssetTransfers  (Base supports categories "external" and "erc20")
import { HOSTS, USDC_BASE, settings } from "../config.js";
import { fetchJson } from "./http.js";

export const ALCHEMY_URL = `https://${HOSTS.alchemyBase}/v2`;

export interface Transfer {
  from: string; // lowercase 0x address
  to: string | null;
  /** Decimal token amount as Alchemy reports it (may be null for odd tokens). */
  value: number | null;
  /** Token contract (lowercase) or null for native ETH. */
  token: string | null;
  asset: string | null;
  hash: string;
  blockNum: number;
  timestamp: string | null;
}

/**
 * TODO(agent): implement with ONE JSON-RPC call:
 *   { jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers", params: [{
 *       fromBlock: "0x0", toBlock: "latest",
 *       fromAddress?: addr, toAddress?: addr,
 *       contractAddresses?: [USDC_BASE],         // omit for incoming-dust scan (fake tokens matter)
 *       category: ["erc20"],                     // add "external" if you also want ETH dust
 *       withMetadata: true, excludeZeroValue: false,  // zero-value transfers ARE the poisoning signal
 *       maxCount: "0x" + settings().historyCount.toString(16), order: "desc" }] }
 * Map result.transfers[] -> Transfer (lowercase addresses, parseInt(blockNum, 16),
 * rawContract.address as token, metadata.blockTimestamp as timestamp).
 * Headers: devAuthHeader() pattern like groq.ts (REFPAY_DEV_ALCHEMY_KEY) for local runs only.
 */
export async function getTransfers(opts: {
  fromAddress?: string;
  toAddress?: string;
  usdcOnly: boolean;
}): Promise<Transfer[]> {
  void opts; void USDC_BASE; void settings; void fetchJson; void ALCHEMY_URL;
  throw new Error("TODO: getTransfers not implemented");
}

/**
 * TODO(agent): eth_getTransactionByHash -> return `input` hex (for decodeReferenceFromInput).
 * Only needed by verify_invoice_paid. Cap at 5 lookups per call to respect the 10 s budget,
 * or batch them in one JSON-RPC array request.
 */
export async function getTxInput(hash: string): Promise<string | null> {
  void hash;
  throw new Error("TODO: getTxInput not implemented");
}

export function devAuthHeader(): Record<string, string> {
  const k = process.env.REFPAY_DEV_ALCHEMY_KEY;
  return k ? { Authorization: `Bearer ${k}` } : {};
}
