// Ecosystem-wide immutable constants. Sourced from the verified contract sources in
// affection_docs/sources/ and the machine-readable registries. Re-verify via
// affection_docs/sources.md if these ever change (they are immutable on-chain, so they won't
// unless AFFECTION is upgraded — it is not upgradeable).

import { AFFECTION_CAP, MATH_CAP, MOTZKIN_PRIME } from "./registry";

export { AFFECTION_CAP, MATH_CAP, MOTZKIN_PRIME };

/** Generate() mints exactly 3 AFFECTION per call (2× Conjecture.React + 1× _mintToCap). */
export const GENERATE_MINTS_PER_CALL = 3n;

/** Caps in base units (1e18). */
export const AFFECTION_CAP_BASE = BigInt(AFFECTION_CAP) * 10n ** 18n;
export const MATH_CAP_BASE = BigInt(MATH_CAP) * 10n ** 18n;

export const PULSECHAIN_CHAIN_ID = 369;
// The canonical Blockscout explorer for PulseChain. The classic scan.pulsechain.com is
// IPFS-hosted and served via a redirect gateway at ipfs.scan.pulsechain.com (302 → the
// pinned IPFS bundle), which auto-resolves to the latest published version. Path-based
// links (/address/0x… , /tx/0x…) are preserved across the redirect — verified.
export const PULSECHAIN_BLOCK_EXPLORER = "https://ipfs.scan.pulsechain.com";
export const PULSECHAIN_BLOCK_EXPLORER_API = "https://api.scan.pulsechain.com";
