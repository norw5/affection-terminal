import type { MintRoute } from "@/lib/mint/profitability";
// Mint configuration for Module B. Two layers:
//
//  1. MINT_ROUTES — the clean arbitrage routes fed to the profitability engine
//     (src/lib/mint/profitability.ts). Each is (intermediate × stable) with the verified
//     1-pStable-per-1-Ⓐ floor. Used by the /mint route selector (read-only profitability).
//
//  2. INTERMEDIATES + STABLES — the on-chain token specs the execution layer needs. Minting
//     execution happens through the portal's own batcher contracts (UnifiedAffectionBatcher /
//     AtomicArbBatcher in contracts/), driven from /mint via batcher.mintFromStable() or
//     batcher.multiBuyWith(). The batcher does the full route (pStable → intermediate → Ⓐ)
//     atomically in one transaction — no legacy community contracts are involved.
//
// ⚠ The official AFFECTION contract's BuyWithMATH/G5/PI(amount) only DRAINS Ⓐ from the
// contract's own balance — it does NOT call Generate(). Generate() (3 Ⓐ/call) must be looped
// first to "charge" that balance. The official MATH/G5/PI contracts likewise mint 1 token
// per BuyWithDAI/USDC call. Looping those one-at-a-time from a wallet is impractical, which
// is exactly what the portal's batcher contracts batch into a single atomic tx.
import type { Address } from "viem";
import { erc20Abi } from "./abis/math.abi";
import { G5_ADDR, MATH_ADDR, PDAI_ADDR, PI_ADDR, PUSDC_ADDR } from "./registry";

const E18 = 10n ** 18n;

// ─── Measured gas model (on-chain receipts, 2026-08) ─────────────────────────────────
// Random() ≈ 36.2k, Generate() ≈ 39.8k, G5 mint ≈ 11.5k marginal. Per Generate() loop:
//   MATH route (full): 3×Random + 1×Generate ≈ 148.5k/loop (verified: mintFromStable(pUSDC,MATH,100)
//   used 14,751,057 gas = 147.5k/loop — tx 0xc8fca2a5…21921f).
//   G5 route (full): 0.6×G5mint + Generate ≈ 46.4k/loop.  PI route (full): ≈ 40.2k/loop.
//   ALL routes (inter / multiBuyWith): just Generate() ≈ 39.8k/loop (no intermediate-mint leg).
// Block gas limit ≈ 45M (44,956,056 at measurement). CEILING keeps ~10% headroom.
export const GAS_PER_LOOP: Record<"G5" | "PI" | "MATH", bigint> = {
  MATH: 148_500n,
  G5: 46_400n,
  PI: 40_200n,
};
/** Gas per loop in "from intermediate" mode (skip pStable → intermediate leg). */
export const GAS_PER_LOOP_INTER: bigint = 39_800n;
export const BLOCK_GAS_LIMIT_APPROX = 45_000_000n;
export const GAS_CEILING_PER_TX = 40_500_000n;

/** Max Generate() loops for a route + mode before the atomic mint nears the block gas limit. */
export function maxLoopsPerTx(
  intermediate: "G5" | "PI" | "MATH",
  mode: "full" | "inter" = "full",
): bigint {
  const gasPerLoop = mode === "inter" ? GAS_PER_LOOP_INTER : GAS_PER_LOOP[intermediate];
  return GAS_CEILING_PER_TX / gasPerLoop;
}

// ─── 1. profitability routes ──────────────────────────────────────────────────

// The clean routes (1 pStable / 1 Ⓐ floor). Fa/Faung are omitted from the auto-router
// because their floor floats with the Fa/Faung mint cost — they're covered in the KB.
const baseRoutes: Array<
  Pick<
    MintRoute,
    "intermediate" | "buyFunction" | "perLoop" | "affectionPerIntermediate" | "loopGranularity"
  > & {
    stable: MintRoute["stable"];
  }
> = [
  {
    stable: "pDAI",
    intermediate: "MATH",
    buyFunction: "BuyWithMATH",
    perLoop: 3n * E18,
    affectionPerIntermediate: 1,
    loopGranularity: 1n,
  },
  {
    stable: "pUSDC",
    intermediate: "MATH",
    buyFunction: "BuyWithMATH",
    perLoop: 3n * E18,
    affectionPerIntermediate: 1,
    loopGranularity: 1n,
  },
  {
    stable: "pDAI",
    intermediate: "G5",
    buyFunction: "BuyWithG5",
    perLoop: 6n * 10n ** 17n,
    affectionPerIntermediate: 5,
    loopGranularity: 5n,
  },
  {
    stable: "pDAI",
    intermediate: "PI",
    buyFunction: "BuyWithPI",
    perLoop: 1n * 10n ** 16n,
    affectionPerIntermediate: 300,
    loopGranularity: 100n,
  },
];

export const MINT_ROUTES: MintRoute[] = baseRoutes.map((r) => ({
  id: `${r.intermediate}·${r.stable}`,
  stable: r.stable,
  intermediate: r.intermediate,
  buyFunction: r.buyFunction,
  perLoop: r.perLoop,
  affectionPerIntermediate: r.affectionPerIntermediate,
  stablePerAFFECTION: 1n, // the verified hard floor for all clean routes
  loopGranularity: r.loopGranularity,
}));

// ─── 2. token specs for the execution layer ───────────────────────────────────

export type StableSpec = {
  symbol: "pDAI" | "pUSDC";
  address: Address;
  decimals: number;
};

export const STABLES: Record<"pDAI" | "pUSDC", StableSpec> = {
  pDAI: { symbol: "pDAI", address: PDAI_ADDR, decimals: 18 },
  pUSDC: { symbol: "pUSDC", address: PUSDC_ADDR, decimals: 6 },
};

export type IntermediateSpec = {
  symbol: "G5" | "PI" | "MATH";
  address: Address;
  decimals: number;
  /** base units of intermediate needed per Generate() loop (3 Ⓐ) */
  perLoop: bigint;
  /** whole-token granularity the route needs (1=MATH, 5=G5, 100=PI) */
  loopGranularity: bigint;
  /** which pStables the official contract's BuyWith* accepts (MATH: pDAI+pUSDC; G5/PI: pDAI) */
  acceptedStables: Array<"pDAI" | "pUSDC">;
};

export const INTERMEDIATES: Record<"G5" | "PI" | "MATH", IntermediateSpec> = {
  MATH: {
    symbol: "MATH",
    address: MATH_ADDR,
    decimals: 18,
    perLoop: 3n * E18,
    loopGranularity: 1n,
    acceptedStables: ["pDAI", "pUSDC"],
  },
  G5: {
    symbol: "G5",
    address: G5_ADDR,
    decimals: 18,
    perLoop: 6n * 10n ** 17n,
    loopGranularity: 5n,
    acceptedStables: ["pDAI"],
  },
  PI: {
    symbol: "PI",
    address: PI_ADDR,
    decimals: 18,
    perLoop: 1n * 10n ** 16n,
    loopGranularity: 100n,
    acceptedStables: ["pDAI"],
  },
};

/** The executable routes — intersection of intermediates × their accepted stables. */
export const EXEC_ROUTES: Array<{ intermediate: "G5" | "PI" | "MATH"; stable: "pDAI" | "pUSDC" }> =
  (Object.keys(INTERMEDIATES) as Array<"G5" | "PI" | "MATH">).flatMap((im) =>
    INTERMEDIATES[im].acceptedStables.map((stable) => ({ intermediate: im, stable })),
  );

// Re-export the ERC-20 ABI for the mint module's read needs (balance/allowance).
export { erc20Abi };
