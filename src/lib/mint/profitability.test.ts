import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import {
  type ExitPath,
  type MintRoute,
  type RouteProfit,
  type SwapGraph,
  bestExitPath,
  buildSwapGraph,
  clampLoopsToGranularity,
  computeMaxSafeLoops,
  computeRouteProfitability,
  recommendBest,
} from "./profitability";

const E18 = 10n ** 18n;
const AFF = "0x24F0154C1dCe548AdF15da2098Fdd8B8A3B8151D" as Address; // AFFECTION
const PDAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F" as Address; // pDAI
const PUSDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address; // pUSDC (6 dec)
const WPLS = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27" as Address; // WPLS

function pair(base: Address, quote: Address, baseR: bigint, quoteR: bigint, bd = 18, qd = 18) {
  return {
    baseAddress: base,
    quoteAddress: quote,
    baseReserve: baseR,
    quoteReserve: quoteR,
    baseDecimals: bd,
    quoteDecimals: qd,
  };
}

// Non-null wrappers (biome forbids `!`): assert + return so the test fails loudly if a path
// is unexpectedly absent, while keeping the call sites terse.
function path(
  graph: SwapGraph,
  amountIn: bigint,
  from: Address,
  to: Address,
  maxHops?: number,
): ExitPath {
  const r = bestExitPath(graph, amountIn, from, to, maxHops);
  if (!r) throw new Error("expected an exit path but got null");
  return r;
}
function bestR(profits: RouteProfit[]): RouteProfit {
  const r = recommendBest(profits);
  if (!r) throw new Error("expected a recommendation but got null");
  return r;
}
function exit(r: RouteProfit): ExitPath {
  if (!r.exit) throw new Error("expected an exit path on the result");
  return r.exit;
}

const MATH_PDAI: MintRoute = {
  id: "MATH·pDAI",
  stable: "pDAI",
  intermediate: "MATH",
  buyFunction: "BuyWithMATH",
  perLoop: 3n * E18,
  affectionPerIntermediate: 1,
  stablePerAFFECTION: 1n,
  loopGranularity: 1n,
};

// ─── buildSwapGraph ────────────────────────────────────────────────────────────

describe("buildSwapGraph", () => {
  it("creates two directed edges per pair (both directions)", () => {
    const g = buildSwapGraph([pair(AFF, PDAI, 1000n * E18, 1000n * E18)]);
    expect(g.edges).toHaveLength(2);
    expect(g.edges[0].from).toBe(AFF);
    expect(g.edges[0].to).toBe(PDAI);
    expect(g.edges[1].from).toBe(PDAI);
    expect(g.edges[1].to).toBe(AFF);
    expect(g.adj.get(AFF.toLowerCase())).toHaveLength(1);
    expect(g.adj.get(PDAI.toLowerCase())).toHaveLength(1);
  });

  it("skips pairs with zero reserves", () => {
    const g = buildSwapGraph([pair(AFF, PDAI, 0n, 1000n * E18), pair(AFF, WPLS, 100n, 0n)]);
    expect(g.edges).toHaveLength(0);
  });
});

// ─── bestExitPath ──────────────────────────────────────────────────────────────

describe("bestExitPath", () => {
  it("finds a direct 1-hop path AFFECTION→pDAI", () => {
    const g = buildSwapGraph([pair(AFF, PDAI, 1000n * E18, 1000n * E18)]);
    const p = path(g, E18, AFF, PDAI);
    expect(p.path).toEqual([AFF, PDAI]);
    expect(p.hops).toHaveLength(1);
    // small trade vs 1:1 pool → out ≈ 0.997 (fee only, negligible curve slippage)
    expect(p.amountOut).toBeGreaterThan((E18 * 996n) / 1000n);
    expect(p.amountOut).toBeLessThan((E18 * 997n) / 1000n + 1n);
    // slippage vs the no-fee spot includes the 0.3% swap fee (≥30 bps) + tiny curve depth
    expect(p.slippageBps).toBeGreaterThanOrEqual(30n);
    expect(p.slippageBps).toBeLessThan(50n);
  });

  it("returns null when no path exists", () => {
    const g = buildSwapGraph([pair(AFF, PDAI, 1000n * E18, 1000n * E18)]);
    expect(bestExitPath(g, E18, AFF, WPLS)).toBeNull();
  });

  it("returns null for zero amountIn", () => {
    const g = buildSwapGraph([pair(AFF, PDAI, 1000n * E18, 1000n * E18)]);
    expect(bestExitPath(g, 0n, AFF, PDAI)).toBeNull();
  });

  it("returns null when from === to", () => {
    const g = buildSwapGraph([pair(AFF, PDAI, 1000n * E18, 1000n * E18)]);
    expect(bestExitPath(g, E18, AFF, AFF)).toBeNull();
  });

  it("finds a 2-hop path AFFECTION→WPLS→pDAI when no direct pair exists", () => {
    const g = buildSwapGraph([
      pair(AFF, WPLS, 1000n * E18, 1000n * E18),
      pair(WPLS, PDAI, 1000n * E18, 1000n * E18),
    ]);
    const p = path(g, E18, AFF, PDAI);
    expect(p.path).toEqual([AFF, WPLS, PDAI]);
    expect(p.hops).toHaveLength(2);
    // two fees (0.3% each) + curve slippage on a 0.1%-of-pool trade → out ≈ 0.992
    expect(p.amountOut).toBeGreaterThan((E18 * 991n) / 1000n);
    expect(p.amountOut).toBeLessThan((E18 * 993n) / 1000n + 1n);
  });

  it("picks the higher-output path when multiple exist", () => {
    // direct AFFECTION/pDAI is thin (10 Ⓐ), but AFFECTION/WPLS/pDAI is deep → multi-hop wins
    const g = buildSwapGraph([
      pair(AFF, PDAI, 10n * E18, 10n * E18), // thin direct (~0.906 out for 1 Ⓐ)
      pair(AFF, WPLS, 1_000_000n * E18, 1_000_000n * E18), // deep
      pair(WPLS, PDAI, 1_000_000n * E18, 1_000_000n * E18),
    ]);
    const p = path(g, E18, AFF, PDAI);
    expect(p.path).toEqual([AFF, WPLS, PDAI]);
    // deep multi-hop (~0.994 out) out-sells the thin direct (~0.906 out) for a 1e18 trade
    expect(p.amountOut).toBeGreaterThan((95n * E18) / 100n);
  });

  it("does not revisit nodes (no cycles) — A→B→A→C is rejected", () => {
    const g = buildSwapGraph([
      pair(AFF, WPLS, 1000n * E18, 1000n * E18),
      pair(WPLS, PDAI, 1000n * E18, 1000n * E18),
    ]);
    // with only 2 distinct non-source nodes, max 2-hop path AFF→WPLS→pDAI; no 3-hop cycle.
    const p = path(g, E18, AFF, PDAI, 4);
    expect(p.hops).toHaveLength(2);
  });

  it("respects maxHops", () => {
    const g = buildSwapGraph([
      pair(AFF, WPLS, 1000n * E18, 1000n * E18),
      pair(WPLS, PDAI, 1000n * E18, 1000n * E18),
    ]);
    expect(bestExitPath(g, E18, AFF, PDAI, 1)).toBeNull(); // only 1 hop allowed, no direct
    expect(path(g, E18, AFF, PDAI, 2).hops).toHaveLength(2);
  });

  it("slippage grows with trade size relative to reserves", () => {
    const g = buildSwapGraph([pair(AFF, PDAI, 1000n * E18, 1000n * E18)]);
    const small = path(g, E18, AFF, PDAI);
    const large = path(g, 100n * E18, AFF, PDAI);
    expect(large.slippageBps).toBeGreaterThan(small.slippageBps);
  });
});

// ─── computeMaxSafeLoops ───────────────────────────────────────────────────────

describe("computeMaxSafeLoops", () => {
  const CAP = 1_111_111_111n * E18;
  it("returns floor((cap - supply) / 3e18)", () => {
    const supply = 366_666_666n * E18; // ~current
    // remaining = 744_444_445 Ⓐ; /3 = 248_148_148 loops + 1 Ⓐ remainder
    expect(computeMaxSafeLoops(supply, CAP)).toBe(248_148_148n);
  });

  it("returns 0 when supply is at/over the cap", () => {
    expect(computeMaxSafeLoops(CAP, CAP)).toBe(0n);
    expect(computeMaxSafeLoops(CAP + 1n, CAP)).toBe(0n);
  });
});

// ─── computeRouteProfitability ─────────────────────────────────────────────────

describe("computeRouteProfitability", () => {
  const CAP = 1_111_111_111n * E18;
  const SUPPLY = 366_666_666n * E18;

  it("MATH/pDAI clean route: 1:1 floor, profit = DEX value − cost", () => {
    // Ⓐ trades at 1.5 pDAI on PulseX (50% premium) → minting is profitable
    const g = buildSwapGraph([pair(AFF, PDAI, 1000n * E18, 1500n * E18)]); // 1.5 price
    const r = computeRouteProfitability(MATH_PDAI, 100n, SUPPLY, CAP, g, AFF, PDAI, 18);
    expect(r.effectiveLoops).toBe(100n);
    expect(r.affMinted).toBe(300n * E18); // 100 loops * 3
    expect(r.stableCost).toBe(300n * E18); // 1 pDAI / Ⓐ
    expect(r.maxSafeLoops).toBe(computeMaxSafeLoops(SUPPLY, CAP));
    expect(r.exit).not.toBeNull();
    // profit: 300 Ⓐ sold into a 1.5-priced pool — should be positive
    expect(r.profit).toBeGreaterThan(0n);
    expect(r.profitBps).toBeGreaterThan(0n);
  });

  it("clamps loops to the cap headroom", () => {
    const nearCap = CAP - 10n * 3n * E18; // room for 10 loops only
    const g = buildSwapGraph([pair(AFF, PDAI, 1000n * E18, 1000n * E18)]);
    const r = computeRouteProfitability(MATH_PDAI, 1000n, nearCap, CAP, g, AFF, PDAI, 18);
    expect(r.maxSafeLoops).toBe(10n);
    expect(r.effectiveLoops).toBe(10n); // clamped from 1000
    expect(r.affMinted).toBe(30n * E18);
  });

  it("reports a loss when Ⓐ trades below the 1 pDAI floor", () => {
    // Ⓐ at 0.9 pDAI → minting loses money (cost 1, gets 0.9-ish)
    const g = buildSwapGraph([pair(AFF, PDAI, 1000n * E18, 900n * E18)]);
    const r = computeRouteProfitability(MATH_PDAI, 100n, SUPPLY, CAP, g, AFF, PDAI, 18);
    expect(r.profit).toBeLessThan(0n);
    expect(r.profitBps).toBeLessThan(0n);
  });

  it("handles pUSDC (6 decimals) cost correctly", () => {
    const g = buildSwapGraph([pair(AFF, PUSDC, 1000n * E18, 1500n * 1_000_000n, 18, 6)]);
    const route: MintRoute = { ...MATH_PDAI, id: "MATH·pUSDC", stable: "pUSDC" };
    const r = computeRouteProfitability(route, 100n, SUPPLY, CAP, g, AFF, PUSDC, 6);
    expect(r.stableCost).toBe(300n * 1_000_000n); // 300 pUSDC
    expect(r.profit).toBeGreaterThan(0n); // 1.5 price → profitable
  });

  it("returns no exit (dexValue 0, full loss) when Ⓐ has no PulseX pair to the stable", () => {
    const g = buildSwapGraph([pair(AFF, WPLS, 1000n * E18, 1000n * E18)]); // only WPLS, no pDAI path
    const r = computeRouteProfitability(MATH_PDAI, 100n, SUPPLY, CAP, g, AFF, PDAI, 18);
    expect(r.exit).toBeNull();
    expect(r.dexValue).toBe(0n);
    expect(r.profit).toBe(-r.stableCost); // lost the full cost
    expect(r.profitBps).toBe(-10000n); // −100%
  });

  it("uses a multi-hop exit when no direct Ⓐ/pDAI pair exists", () => {
    // deep reserves so curve slippage is negligible: 1 Ⓐ = 1.5 WPLS, 1 WPLS = 1 pDAI
    const g = buildSwapGraph([
      pair(AFF, WPLS, 1_000_000n * E18, 1_500_000n * E18),
      pair(WPLS, PDAI, 1_000_000n * E18, 1_000_000n * E18),
    ]);
    const r = computeRouteProfitability(MATH_PDAI, 100n, SUPPLY, CAP, g, AFF, PDAI, 18);
    expect(r.exit).not.toBeNull();
    expect(exit(r).path).toEqual([AFF, WPLS, PDAI]);
    // ~447 pDAI out vs 300 pDAI cost, after two 0.3% fees → clearly profitable
    expect(r.profit).toBeGreaterThan(100n * E18);
    expect(r.profitBps).toBeGreaterThan(3300n); // >33% premium captured
  });
});

// ─── recommendBest ─────────────────────────────────────────────────────────────

describe("recommendBest", () => {
  const CAP = 1_111_111_111n * E18;
  const SUPPLY = 366_666_666n * E18;

  it("picks the route with the highest profitBps", () => {
    const gPdai = buildSwapGraph([pair(AFF, PDAI, 1000n * E18, 1500n * E18)]); // 1.5x
    const gUsdc = buildSwapGraph([pair(AFF, PUSDC, 1000n * E18, 1200n * 1_000_000n, 18, 6)]); // 1.2x
    const pdai = computeRouteProfitability(MATH_PDAI, 100n, SUPPLY, CAP, gPdai, AFF, PDAI, 18);
    const usdc: MintRoute = { ...MATH_PDAI, id: "MATH·pUSDC", stable: "pUSDC" };
    const usdcP = computeRouteProfitability(usdc, 100n, SUPPLY, CAP, gUsdc, AFF, PUSDC, 6);
    const best = bestR([pdai, usdcP]);
    expect(best.route.id).toBe("MATH·pDAI"); // 50% > 20%
  });

  it("returns null when no route has an exit path", () => {
    const g = buildSwapGraph([]); // no pairs
    const pdai = computeRouteProfitability(MATH_PDAI, 100n, SUPPLY, CAP, g, AFF, PDAI, 18);
    expect(recommendBest([pdai])).toBeNull();
  });

  it("falls back to the least-bad route when all routes lose", () => {
    const g = buildSwapGraph([pair(AFF, PDAI, 1000n * E18, 900n * E18)]); // 0.9x, loss
    const pdai = computeRouteProfitability(MATH_PDAI, 100n, SUPPLY, CAP, g, AFF, PDAI, 18);
    const best = bestR([pdai]);
    expect(best.route.id).toBe("MATH·pDAI"); // only option, returned even though losing
  });

  it("compares loss across DIFFERENT stables by profitBps, not raw profit bigint", () => {
    // pDAI route loses 77% (dexValue 0.23 of cost) — cost 300e18, profit -231e18 (18-dec)
    // pUSDC route loses 49% (dexValue 0.51 of cost) — cost 300e6, profit -147e6 (6-dec)
    // Raw profit bigints (-231e18 vs -147e6) are not comparable across decimals; profitBps is.
    const gPdai = buildSwapGraph([pair(AFF, PDAI, 1000n * E18, 230n * E18)]); // ~0.23x → −77%
    const gUsdc = buildSwapGraph([pair(AFF, PUSDC, 1000n * E18, 510n * 1_000_000n, 18, 6)]); // ~0.51x → −49%
    const pdai = computeRouteProfitability(MATH_PDAI, 100n, SUPPLY, CAP, gPdai, AFF, PDAI, 18);
    const usdc: MintRoute = { ...MATH_PDAI, id: "MATH·pUSDC", stable: "pUSDC" };
    const usdcP = computeRouteProfitability(usdc, 100n, SUPPLY, CAP, gUsdc, AFF, PUSDC, 6);
    // both lose; the pUSDC route loses less in % terms → it's the "least bad"
    const best = bestR([pdai, usdcP]);
    expect(best.route.id).toBe("MATH·pUSDC");
    expect(pdai.profitBps).toBeLessThan(usdcP.profitBps);
  });
});

// ─── clampLoopsToGranularity ───────────────────────────────────────────────────

describe("clampLoopsToGranularity", () => {
  it("MATH (granularity 1) is a no-op pass-through", () => {
    expect(clampLoopsToGranularity(123n, 1n)).toBe(123n);
    expect(clampLoopsToGranularity(0n, 1n)).toBe(0n);
  });

  it("G5 (granularity 5) floors to a multiple of 5", () => {
    expect(clampLoopsToGranularity(23n, 5n)).toBe(20n);
    expect(clampLoopsToGranularity(5n, 5n)).toBe(5n);
    expect(clampLoopsToGranularity(4n, 5n)).toBe(0n);
  });

  it("PI (granularity 100) floors to a multiple of 100", () => {
    expect(clampLoopsToGranularity(250n, 100n)).toBe(200n);
  });
});
