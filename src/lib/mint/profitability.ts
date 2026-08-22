// Pure mint-arbitrage profitability engine + PulseX swap pathfinder (Module B Tier 1).
//
// No React/viem-RPC deps — fully unit-tested. The live reserves are fed in by the hooks
// (useMintReadiness); this module only does the math. It reuses the constant-product math
// from src/lib/pullex/math.ts (getAmountOut) so the auto-router and the route map share
// identical pricing.
//
// Economics (verified against affection_docs/registry/minting_rates.json + sources):
//   - Generate() mints exactly 3 Ⓐ per call → `loops` calls mint `3·loops` Ⓐ.
//   - The three "clean" routes (G5 / PI / MATH via pDAI or pUSDC) all cost exactly
//     1 pStable per 1 Ⓐ — the hard floor for freshly-minted Ⓐ.
//   - Profit = (DEX value of minted Ⓐ in the spent stable) − (pStable cost).
//   - Cap-aware: loops are clamped to floor((cap − totalSupply) / 3) so the engine never
//     assumes a Generate() that would no-op near the 1,111,111,111 cap.
//
// The DEX exit pathfinder finds the best 1–3 hop simple path from Ⓐ to the spent stable
// across the live PulseX V2 pairs (Ⓐ/WPLS, Ⓐ/pDAI, Ⓐ/pUSDC, WPLS/pDAI, …). It is a
// brute-force DFS over a tiny graph (≤6 edges) — trivial client-side.

import { getAmountOut } from "@/lib/pulsex/math";
import type { Address } from "viem";

/** A directed swap edge in the PulseX graph (built from both sides of each pair). */
export type SwapEdge = {
  from: Address;
  to: Address;
  /** reserve of `from` in base units (what you pay with) */
  reserveIn: bigint;
  /** reserve of `to` in base units (what you receive) */
  reserveOut: bigint;
  fromDecimals: number;
  toDecimals: number;
};

export type SwapGraph = {
  edges: SwapEdge[];
  /** adjacency: lowercase from-address → edges leaving it */
  adj: Map<string, SwapEdge[]>;
};

export type ExitPath = {
  /** token path, e.g. [AFFECTION, WPLS, pDAI] */
  path: Address[];
  hops: SwapEdge[];
  /** output amount in the target stable's base units */
  amountOut: bigint;
  /** spot (zero-size) output in the target stable's base units */
  spotOut: bigint;
  /** slippage vs spot, in basis points (0..10000) */
  slippageBps: bigint;
};

/** A mint route definition (one row of the profitability table). */
export type MintRoute = {
  /** human id, e.g. "MATH·pDAI" */
  id: string;
  stable: "pDAI" | "pUSDC";
  intermediate: "G5" | "PI" | "MATH" | "Fa" | "Faung";
  /** AFFECTION BuyWith* function (e.g. BuyWithMATH) */
  buyFunction: string;
  /** base units of intermediate needed per Generate() loop (3 Ⓐ) */
  perLoop: bigint;
  /** Ⓐ minted per 1 intermediate (e.g. G5→5, PI→300, MATH→1) */
  affectionPerIntermediate: number;
  /** whole pStable per 1 whole Ⓐ for the clean routes; null when the floor floats */
  stablePerAFFECTION: bigint | null;
  /** whole-token granularity the route needs (1 = MATH, 5 = G5, 100 = PI). */
  loopGranularity: bigint;
};

export type RouteProfit = {
  route: MintRoute;
  /** loops actually used (clamped to the cap headroom) */
  effectiveLoops: bigint;
  /** Ⓐ minted, in base units (18 dec) */
  affMinted: bigint;
  /** pStable spent, in the spent stable's base units */
  stableCost: bigint;
  /** DEX value of the minted Ⓐ in the spent stable, base units (0 if no exit path) */
  dexValue: bigint;
  /** dexValue − stableCost (negative = unprofitable) */
  profit: bigint;
  /** profit * 10000 / stableCost (basis points; can be negative) */
  profitBps: bigint;
  /** best DEX exit path, or null if Ⓐ has no route to this stable on PulseX */
  exit: ExitPath | null;
  /** max safe loops given the current supply (cap-aware clamp) */
  maxSafeLoops: bigint;
};

// ─── swap graph ─────────────────────────────────────────────────────────────────

/**
 * Build a directed swap graph from a set of UniswapV2 pairs. Each pair contributes two
 * edges (A→B and B→A). Reserves are in base units (already resolved to the correct token
 * by the caller). Pairs with zero reserves are skipped.
 */
export function buildSwapGraph(
  pairs: Array<{
    baseAddress: Address;
    quoteAddress: Address;
    baseReserve: bigint;
    quoteReserve: bigint;
    baseDecimals: number;
    quoteDecimals: number;
  }>,
): SwapGraph {
  const edges: SwapEdge[] = [];
  for (const p of pairs) {
    if (p.baseReserve <= 0n || p.quoteReserve <= 0n) continue;
    edges.push({
      from: p.baseAddress,
      to: p.quoteAddress,
      reserveIn: p.baseReserve,
      reserveOut: p.quoteReserve,
      fromDecimals: p.baseDecimals,
      toDecimals: p.quoteDecimals,
    });
    edges.push({
      from: p.quoteAddress,
      to: p.baseAddress,
      reserveIn: p.quoteReserve,
      reserveOut: p.baseReserve,
      fromDecimals: p.quoteDecimals,
      toDecimals: p.baseDecimals,
    });
  }
  const adj = new Map<string, SwapEdge[]>();
  for (const e of edges) {
    const k = e.from.toLowerCase();
    const arr = adj.get(k);
    if (arr) arr.push(e);
    else adj.set(k, [e]);
  }
  return { edges, adj };
}

/** Spot (zero-size) output along a hop list, computed with 1e18 scaled math to limit
 *  truncation. Equals amountIn · Π(reserveOut_i / reserveIn_i). */
function pathSpotOutput(amountIn: bigint, hops: SwapEdge[]): bigint {
  if (hops.length === 0) return amountIn;
  let scaled = amountIn * 10n ** 18n;
  for (const h of hops) {
    if (h.reserveIn === 0n) return 0n;
    scaled = (scaled * h.reserveOut) / h.reserveIn;
  }
  return scaled / 10n ** 18n;
}

/** Actual output along a hop list (chains getAmountOut, which applies the 0.3% fee each hop). */
function pathActualOutput(amountIn: bigint, hops: SwapEdge[]): bigint {
  let amount = amountIn;
  for (const h of hops) {
    amount = getAmountOut(amount, h.reserveIn, h.reserveOut);
  }
  return amount;
}

/**
 * Find the best 1–`maxHops` hop simple path (no repeated nodes) from `from` to `to`.
 * Brute-force DFS over the tiny graph. Returns the path with the maximum `amountOut`, or
 * null if no path exists. Slippage is computed vs the path's own spot output so it captures
 * cumulative curve depth across multi-hop routes.
 */
export function bestExitPath(
  graph: SwapGraph,
  amountIn: bigint,
  from: Address,
  to: Address,
  maxHops = 3,
): ExitPath | null {
  if (amountIn <= 0n) return null;
  const target = to.toLowerCase();
  const start = from.toLowerCase();
  if (start === target) return null;

  let best: ExitPath | null = null;

  const dfs = (current: string, hops: SwapEdge[], visited: Set<string>) => {
    if (hops.length >= maxHops) return;
    const out = graph.adj.get(current);
    if (!out) return;
    for (const edge of out) {
      const next = edge.to.toLowerCase();
      if (visited.has(next)) continue;
      if (next === target) {
        const finalHops = [...hops, edge];
        const amountOut = pathActualOutput(amountIn, finalHops);
        const spotOut = pathSpotOutput(amountIn, finalHops);
        const slippageBps = spotOut > amountOut ? ((spotOut - amountOut) * 10000n) / spotOut : 0n;
        const candidate: ExitPath = {
          path: [from, ...finalHops.map((h) => h.to)],
          hops: finalHops,
          amountOut,
          spotOut,
          slippageBps,
        };
        if (!best || candidate.amountOut > best.amountOut) best = candidate;
        continue;
      }
      visited.add(next);
      dfs(next, [...hops, edge], visited);
      visited.delete(next);
    }
  };

  dfs(start, [], new Set([start]));
  return best;
}

// ─── profitability ──────────────────────────────────────────────────────────────

/** Max safe Generate() loops given the current supply (cap-aware clamp). Each loop mints 3 Ⓐ. */
export function computeMaxSafeLoops(supply: bigint, cap: bigint): bigint {
  const remaining = cap > supply ? cap - supply : 0n;
  return remaining / (3n * 10n ** 18n);
}

/**
 * Compute the full profitability of one route at `loops`. Pure — takes the supply, cap,
 * swap graph, AFFECTION address, and the spent stable's address+decimals. Clamps loops to
 * the cap headroom. The DEX exit sells the minted Ⓐ for the spent stable.
 */
export function computeRouteProfitability(
  route: MintRoute,
  loops: bigint,
  supply: bigint,
  cap: bigint,
  graph: SwapGraph,
  affectionAddress: Address,
  stableAddress: Address,
  stableDecimals: number,
): RouteProfit {
  const maxSafeLoops = computeMaxSafeLoops(supply, cap);
  const effectiveLoops = loops > maxSafeLoops ? maxSafeLoops : loops;
  const affMinted = effectiveLoops * 3n * 10n ** 18n;

  let stableCost = 0n;
  if (route.stablePerAFFECTION !== null) {
    const affWhole = effectiveLoops * 3n; // whole Ⓐ
    const stableWhole = affWhole * route.stablePerAFFECTION; // whole pStable
    stableCost = stableWhole * 10n ** BigInt(stableDecimals);
  }

  const exit = bestExitPath(graph, affMinted, affectionAddress, stableAddress, 3);
  const dexValue = exit ? exit.amountOut : 0n;
  const profit = dexValue - stableCost;

  return {
    route,
    effectiveLoops,
    affMinted,
    stableCost,
    dexValue,
    profit,
    profitBps: stableCost > 0n ? (profit * 10000n) / stableCost : 0n,
    exit,
    maxSafeLoops,
  };
}

/** Recommend the best route from a computed set. Ranks by `profitBps` (a unitless
 *  percentage, so routes across different stables — pDAI 18-dec vs pUSDC 6-dec — compare
 *  fairly; raw profit bigints would not). Ties → lower id. Returns null if no route has a
 *  DEX exit. A losing route (negative profitBps) can still be "best" when all routes lose. */
export function recommendBest(profits: RouteProfit[]): RouteProfit | null {
  const withExit = profits.filter((p) => p.exit !== null);
  if (withExit.length === 0) return null;
  return withExit.reduce((best, p) =>
    p.profitBps > best.profitBps || (p.profitBps === best.profitBps && p.route.id < best.route.id)
      ? p
      : best,
  );
}

/** Round loops up to the route's whole-token granularity (G5/PI mint 1 token/call). */
export function clampLoopsToGranularity(loops: bigint, granularity: bigint): bigint {
  if (granularity <= 1n) return loops > 0n ? loops : 0n;
  return (loops / granularity) * granularity;
}
