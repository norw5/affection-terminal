import { PULSECHAIN_BLOCK_EXPLORER } from "@/config/constants";
import { getAddress } from "viem";
import type { Address } from "viem";

/** EIP-55 checksum an address. */
export function checksum(address: string): Address {
  return getAddress(address);
}

/** Shorten an address: 0x24F0…151D. `size` is the number of hex chars per side (excluding 0x).
 *  Validates via getAddress — only for 20-byte addresses. */
export function shortenAddress(address: string, size = 4): string {
  const a = getAddress(address);
  return `${a.slice(0, size + 2)}\u2026${a.slice(-size)}`;
}

/** Shorten any hex string (tx hash, block hash, etc.) without address validation.
 *  Tx hashes are 32 bytes (64 hex chars) — getAddress would reject them. */
export function shortenHash(hash: string, size = 6): string {
  return `${hash.slice(0, size + 2)}\u2026${hash.slice(-size)}`;
}

/** Build a Blockscout URL for an address/tx. Uses the IPFS gateway base
 *  (ipfs.scan.pulsechain.com) which 302-redirects to the canonical IPFS-hosted explorer,
 *  preserving the path-based route. */
export function scannerUrl(hash: string, kind: "address" | "tx" = "address"): string {
  return `${PULSECHAIN_BLOCK_EXPLORER}/${kind}/${hash}`;
}
