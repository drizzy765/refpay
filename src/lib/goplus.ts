// GoPlus address security. STUB: implement addressSecurity.
//
// Endpoint: GET https://api.gopluslabs.io/api/v1/address_security/{address}?chain_id=8453
// No key required for basic use (rate limited). Verified live 2026-10-16, response:
//   { code: 1, message: "ok", result: { cybercrime: "0", money_laundering: "0", phishing_activities: "0",
//     stealing_attack: "0", sanctioned: "0", blacklist_doubt: "0", honeypot_related_address: "0",
//     fake_kyc: "0", mixer: "0", financial_crime: "0", darkweb_transactions: "0", blackmail_activities: "0",
//     malicious_mining_activities: "0", fake_token: "0", fake_standard_interface: "0", gas_abuse: "0",
//     reinit: "0", number_of_malicious_contracts_created: "0", contract_address: "1"|"0", data_source: "" } }
import { BASE_CHAIN_ID, HOSTS } from "../config.js";
import { fetchJson } from "./http.js";

/** Any of these = "1" -> BLOCK. */
export const GOPLUS_BLOCK_FLAGS = [
  "cybercrime", "money_laundering", "phishing_activities", "stealing_attack", "sanctioned",
  "blackmail_activities", "honeypot_related_address", "financial_crime", "darkweb_transactions",
] as const;
/** Any of these = "1" (or malicious contracts > 0) -> +40 HIGH-ish. */
export const GOPLUS_SUSPICIOUS_FLAGS = [
  "blacklist_doubt", "fake_kyc", "mixer", "malicious_mining_activities", "fake_token",
  "fake_standard_interface", "gas_abuse", "reinit",
] as const;

export interface GoPlusResult {
  blockFlags: string[];
  suspiciousFlags: string[];
  isContract: boolean;
}

/**
 * TODO(agent): implement.
 * fetchJson(`https://${HOSTS.goplus}/api/v1/address_security/${address}?chain_id=${BASE_CHAIN_ID}`)
 * - require code === 1, else throw
 * - collect flags whose value === "1"; treat number_of_malicious_contracts_created > 0 as suspicious
 * - isContract = result.contract_address === "1"
 */
export async function addressSecurity(address: string): Promise<GoPlusResult> {
  void address; void BASE_CHAIN_ID; void HOSTS; void fetchJson;
  throw new Error("TODO: addressSecurity not implemented");
}
