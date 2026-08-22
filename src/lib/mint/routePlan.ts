// Pure helpers for calculating the transaction count + loop packing for each mint route.
// Verified against the DEPLOYED multi-mint contracts (bytecode dispatch + historical tx
// replays — the recovered sources/multi-*.sol describe an older, undeployed ABI):
//
// Mechanics:
//   - Generate() mints exactly 3 Ⓐ per call (conjecture.sol: _mintToCap × 3)
//   - MultiAffection.multiBuyWithMATH/G5/PI(loops):
//       • loops = number of Generate() calls → mints loops * 3 Ⓐ
//       • takes loops * perLoop[intermediate] intermediate tokens from caller
//       • perLoop: MATH=3e18 (3 per loop), G5=6e17 (0.6 per loop), PI=1e16 (0.01 per loop)
//   - MultiMath.multiBuyWithDAI/USDC(N): N = MATH tokens to mint (1 Random() call each)
//       • costs N pStable, produces N MATH
//   - MultiG5.multiBuyWithDAI(N): N = G5 tokens to mint (loops the G5 mint N times)
//       • costs N * 5 pDAI, produces N G5
//   - MultiPI.multiBuyWithDAI(N): N = PI tokens to mint
//       • costs N * 300 pDAI, produces N PI (only small N observed on-chain — simulate first)
//   - All deployed multi-mints carry an owner-settable tax (0 live; taxMax 15) + admin
//     withdrawal functions — the live tax is surfaced in the mint terminal.
//
// Gas limits: each Generate() call uses bigModExp several times (~expensive). The practical
// per-tx ceiling is ~2000 Generate() calls. MultiG5's BuyWithDAI loop is cheaper per call.
//
// For a target of `affToMint` Ⓐ:
//   - generateLoops = affToMint / 3 (must be integer)
//   - intermediate tokens needed = generateLoops * perLoop[intermediate] / 1e18
//   - intermediate mint calls = ceil(intermediateTokens / maxIntermediatePerTx)
//   - affection mint calls = ceil(generateLoops / maxGeneratePerTx)
//   - total txs = intermediateMintCalls + affectionMintCalls
//   - total approvals = 2 (one-time, per route)

const E18 = 10n ** 18n;

export type RouteId = "MATH·pDAI" | "MATH·pUSDC" | "G5·pDAI" | "PI·pDAI";

export type RoutePlan = {
  routeId: RouteId;
  intermediate: "MATH" | "G5" | "PI";
  stable: "pDAI" | "pUSDC";
  affToMint: bigint;
  generateLoops: bigint;
  intermediateTokensNeeded: bigint;
  intermediateMintCalls: bigint;
  affectionMintCalls: bigint;
  totalTxs: bigint;
  approvals: bigint;
  totalSigns: bigint;
  perTxBreakdown: Array<{ label: string; loops: bigint }>;
  cappedByGas: boolean;
  piBugWarning: boolean;
};

// Per-tx ceilings from MEASURED on-chain gas (receipts, 2026-08): Random() ≈ 36.2k,
// Generate() ≈ 39.8k, G5 mint ≈ 11.5k marginal. With a ~45M block gas limit and ~10%
// headroom (~40.5M usable): MultiAffection Generate leg ≤ ~1000 loops; MultiMath Random
// leg ≤ ~1100 MATH; MultiG5 mint leg is far cheaper (not binding).
const MAX_GENERATE_PER_TX = 1000n;
const MAX_MATH_PER_TX = 1100n;
const MAX_G5_PER_TX = 2000n;

const PER_LOOP: Record<"MATH" | "G5" | "PI", bigint> = {
  MATH: 3n * E18,
  G5: 6n * 10n ** 17n,
  PI: 1n * 10n ** 16n,
};

function ceilDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n;
  return (a + b - 1n) / b;
}

/** Compute the execution plan for a route given the target Ⓐ amount (in base units, 18 dec). */
export function planRoute(
  intermediate: "MATH" | "G5" | "PI",
  stable: "pDAI" | "pUSDC",
  affToMint: bigint,
): RoutePlan {
  const routeId = `${intermediate}·${stable}` as RouteId;
  const generateLoops = affToMint / (3n * E18);
  const perLoop = PER_LOOP[intermediate];
  const intermediateTokensNeeded = (perLoop * generateLoops) / E18;

  let intermediateMintCalls: bigint;
  let piBugWarning = false;

  if (intermediate === "PI") {
    // MultiPI bug: only 1 PI per call. Need ceil(PI tokens) calls.
    intermediateMintCalls = intermediateTokensNeeded > 0n ? intermediateTokensNeeded : 1n;
    if (intermediateTokensNeeded > 1n) piBugWarning = true;
  } else if (intermediate === "MATH") {
    intermediateMintCalls = ceilDiv(intermediateTokensNeeded, MAX_MATH_PER_TX);
  } else {
    // G5: MultiG5 loops BuyWithDAI() N times — gas per call is cheaper than Generate()
    intermediateMintCalls = ceilDiv(intermediateTokensNeeded, MAX_G5_PER_TX);
  }

  const affectionMintCalls = ceilDiv(generateLoops, MAX_GENERATE_PER_TX);
  const totalTxs = intermediateMintCalls + affectionMintCalls;
  const approvals = 2n;
  const totalSigns = totalTxs + approvals;
  const cappedByGas = generateLoops > MAX_GENERATE_PER_TX;

  const perTxBreakdown: Array<{ label: string; loops: bigint }> = [];
  if (intermediate === "PI") {
    for (let i = 0n; i < intermediateMintCalls; i++) {
      perTxBreakdown.push({ label: `MultiPI call ${i + 1n}/${intermediateMintCalls}`, loops: 1n });
    }
  } else {
    const imSymbol = intermediate === "MATH" ? "MultiMath" : "MultiG5";
    const maxPerTx = intermediate === "MATH" ? MAX_MATH_PER_TX : MAX_G5_PER_TX;
    for (let i = 0n; i < intermediateMintCalls; i++) {
      const remaining = intermediateTokensNeeded - i * maxPerTx;
      const batch = remaining > maxPerTx ? maxPerTx : remaining;
      perTxBreakdown.push({
        label: `${imSymbol} call ${i + 1n}/${intermediateMintCalls}`,
        loops: batch,
      });
    }
  }
  for (let i = 0n; i < affectionMintCalls; i++) {
    const remaining = generateLoops - i * MAX_GENERATE_PER_TX;
    const batch = remaining > MAX_GENERATE_PER_TX ? MAX_GENERATE_PER_TX : remaining;
    perTxBreakdown.push({
      label: `MultiAffection call ${i + 1n}/${affectionMintCalls}`,
      loops: batch,
    });
  }

  return {
    routeId,
    intermediate,
    stable,
    affToMint: generateLoops * 3n * E18,
    generateLoops,
    intermediateTokensNeeded,
    intermediateMintCalls,
    affectionMintCalls,
    totalTxs,
    approvals,
    totalSigns,
    perTxBreakdown,
    cappedByGas,
    piBugWarning,
  };
}

/** The minimum Ⓐ amount a route can mint in one batch (its granularity). */
export function routeGranularity(intermediate: "MATH" | "G5" | "PI"): bigint {
  // MATH: 3 Ⓐ (1 loop), G5: 15 Ⓐ (5 loops, 1 G5), PI: 300 Ⓐ (100 loops, 1 PI)
  if (intermediate === "MATH") return 3n * E18;
  if (intermediate === "G5") return 15n * E18;
  return 300n * E18;
}
