// Alchemy Base mainnet JSON-RPC. STUB: implement the two functions below.
//
// Endpoint: POST https://base-mainnet.g.alchemy.com/v2      (NO key in the URL)
// Auth:     header `Authorization: Bearer <ALCHEMY_API_KEY>` -> brokered SECRET for host
//           base-mainnet.g.alchemy.com. Alchemy documents header auth at
//           https://www.alchemy.com/docs/how-to-use-api-keys-in-http-headers
// Method:   alchemy_getAssetTransfers  (Base supports categories "external" and "erc20")
import * as z from "zod/v4";
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

const rpcResponse = z.object({
  result: z.unknown().optional(),
  error: z.object({ code: z.number().optional(), message: z.string().optional() }).optional(),
});

/** One JSON-RPC call to Alchemy. Errors surface as thrown Error (callers degrade gracefully). */
async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const json = rpcResponse.parse(
    await fetchJson(ALCHEMY_URL, {
      method: "POST",
      body: { jsonrpc: "2.0", id: 1, method, params },
      headers: devAuthHeader(),
    }),
  );
  if (json.error) throw new Error(`Alchemy ${method}: ${json.error.message ?? json.error.code ?? "RPC error"}`);
  return json.result;
}

const transferItem = z.object({
  from: z.string(),
  to: z.string().nullable(),
  value: z.union([z.number(), z.string()]).nullable(),
  asset: z.string().nullable(),
  hash: z.string(),
  blockNum: z.string(),
  rawContract: z.object({ address: z.string().nullable() }).optional(),
  metadata: z.object({ blockTimestamp: z.string().nullable() }).optional(),
});

const assetTransfersResult = z.object({ transfers: z.array(transferItem) });

export async function getTransfers(opts: {
  fromAddress?: string;
  toAddress?: string;
  usdcOnly: boolean;
}): Promise<Transfer[]> {
  const params: Record<string, unknown> = {
    fromBlock: "0x0",
    toBlock: "latest",
    category: ["erc20"],
    withMetadata: true,
    excludeZeroValue: false, // zero-value transfers ARE the poisoning signal
    maxCount: `0x${settings().historyCount.toString(16)}`,
    order: "desc",
  };
  if (opts.fromAddress) params.fromAddress = opts.fromAddress;
  if (opts.toAddress) params.toAddress = opts.toAddress;
  if (opts.usdcOnly) params.contractAddresses = [USDC_BASE];

  const result = await rpc("alchemy_getAssetTransfers", [params]);
  const parsed = assetTransfersResult.parse(result);
  return parsed.transfers.map((t) => ({
    from: t.from.toLowerCase(),
    to: t.to ? t.to.toLowerCase() : null,
    value: typeof t.value === "number" ? t.value : t.value === null ? null : Number(t.value),
    token: t.rawContract?.address ? t.rawContract.address.toLowerCase() : null,
    asset: t.asset,
    hash: t.hash,
    blockNum: parseInt(t.blockNum, 16),
    timestamp: t.metadata?.blockTimestamp ?? null,
  }));
}

const txObject = z.object({ input: z.string() }).nullable();

export async function getTxInput(hash: string): Promise<string | null> {
  const result = await rpc("eth_getTransactionByHash", [hash]);
  const parsed = txObject.parse(result);
  return parsed?.input ?? null;
}

export function devAuthHeader(): Record<string, string> {
  const k = process.env.REFPAY_DEV_ALCHEMY_KEY;
  return k ? { Authorization: `Bearer ${k}` } : {};
}
