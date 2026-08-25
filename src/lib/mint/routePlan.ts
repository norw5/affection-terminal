// Pure helpers for calculating the transaction count + loop packing for each mint route,
// framed around the portal's OWN batcher contracts (UnifiedAffectionBatcher /
// AtomicArbBatcher). The batcher does the full route — pStable → intermediate → Generate×N →
// BuyWith* → Ⓐ to caller — in ONE atomic transaction. The recovered community multi-mint
// contracts are no longer involved (see the P12 entry in AGENTS.md).
//
// Mechanics (verified on-chain + against affection_docs/sources/affection.sol):
//   - Generate() mints exactly 3 Ⓐ per call (conjecture.sol: _mintToCap × 3)
//   - batcher.mintFromStable(stable, intermediate, loops, minOut):
//       • pulls loops * 3 pStable (18-dec) or 3 * 1e6 pUSDC-equivalent from the caller
//       • mints the intermediate (Random/BuyWithDAI/USDC looped internally)
//       • loops Generate() inside the batcher → mints loops * 3 Ⓐ
//       • sends the ␀ straight back to the caller
//   - batcher.multiBuyWith(intermediate, loops): same Generate loop + BuyWith*, but the
//     caller supplies the intermediate (skips the pStable leg).
//
// Gas limits: each Generate() call uses bigModExp several times (~expensive). The practical
// per-tx ceiling is the block gas limit (~45M) minus ~10% headroom. Measured per-loop:
//   MATH route ≈ 148.5k (3× Random + Generate), G5 ≈ 46.4k, PI ≈ 40.2k.
// A mint larger than maxLoopsPerTx() must split across multiple mintFromStable calls.
//
// For a target of `affToMint` Ⓐ:
//   - generateLoops = affToMint / 3 (must be integer)
//   - mintTxs = ceil(generateLoops / maxLoopsPerTx(intermediate))   (1 if it fits)
//   - approvals = 1 (one-time, per stable or intermediate — re-used across mintTxs)
//   - totalSigns = mintTxs + approvals

const E18 = 10n ** 18n;

export type RouteId = "MATH·pDAI" | "MATH·pUSDC" | "G5·pDAI" | "PI·pDAI";

export type RoutePlan = {
  routeId: RouteId;
  intermediate: "MATH" | "G5" | "PI";
  stable: "pDAI" | "pUSDC";
  affToMint: bigint;
  generateLoops: bigint;
  /** atomic mint transactions needed (1 if it fits in one tx, N if gas-capped) */
  totalTxs: bigint;
  /** one-time approval transactions (1 per mint session — re-used across mintTxs) */
  approvals: bigint;
  totalSigns: bigint;
  perTxBreakdown: Array<{ label: string; loops: bigint }>;
  /** true when generateLoops exceeds the per-tx gas ceiling (needs multiple batches) */
  cappedByGas: boolean;
  /** gas per loop used for the plan (mode-dependent: full vs inter) */
  gasPerLoop: bigint;
};

import { GAS_CEILING_PER_TX, GAS_PER_LOOP, GAS_PER_LOOP_INTER, maxLoopsPerTx } from "@/config/mint";

function ceilDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n;
  return (a + b - 1n) / b;
}

/** Compute the execution plan for a route given the target Ⓐ amount (in base units, 18 dec).
 *  `mode` = "full" (pStable → intermediate → Ⓐ via mintFromStable) or "inter" (intermediate →
 *  Ⓐ via multiBuyWith — skips the pStable leg, ~39.8k gas/loop for all routes). */
export function planRoute(
  intermediate: "MATH" | "G5" | "PI",
  stable: "pDAI" | "pUSDC",
  affToMint: bigint,
  mode: "full" | "inter" = "full",
): RoutePlan {
  const routeId = `${intermediate}·${stable}` as RouteId;
  const generateLoops = affToMint / (3n * E18);
  const maxPerTx = maxLoopsPerTx(intermediate, mode);
  const totalTxs = ceilDiv(generateLoops, maxPerTx);
  const approvals = 1n;
  const totalSigns = totalTxs + approvals;
  const cappedByGas = generateLoops > maxPerTx;

  const entryFn = mode === "inter" ? "multiBuyWith" : "mintFromStable";
  const gasPerLoop = mode === "inter" ? GAS_PER_LOOP_INTER : GAS_PER_LOOP[intermediate];
  const perTxBreakdown: Array<{ label: string; loops: bigint }> = [];
  for (let i = 0n; i < totalTxs; i++) {
    const remaining = generateLoops - i * maxPerTx;
    const batch = remaining > maxPerTx ? maxPerTx : remaining;
    perTxBreakdown.push({
      label: `${entryFn} call ${i + 1n}/${totalTxs}`,
      loops: batch,
    });
  }

  return {
    routeId,
    intermediate,
    stable,
    affToMint: generateLoops * 3n * E18,
    generateLoops,
    totalTxs,
    approvals,
    totalSigns,
    perTxBreakdown,
    cappedByGas,
    gasPerLoop,
  };
}

/** The minimum Ⓐ amount a route can mint in one batch (its granularity). */
export function routeGranularity(intermediate: "MATH" | "G5" | "PI"): bigint {
  // MATH: 3 Ⓐ (1 loop), G5: 15 Ⓐ (5 loops, 1 G5), PI: 300 Ⓐ (100 loops, 1 PI)
  if (intermediate === "MATH") return 3n * E18;
  if (intermediate === "G5") return 15n * E18;
  return 300n * E18;
}

// Re-export the gas model so callers can resolve the per-route ceiling in one place.
export { GAS_PER_LOOP, GAS_PER_LOOP_INTER, GAS_CEILING_PER_TX };
