import { maxLoopsPerTx } from "@/config/mint";
import { describe, expect, it } from "vitest";
import { planRoute, routeGranularity } from "./routePlan";

const E18 = 10n ** 18n;

describe("planRoute (batcher model — 1 atomic tx per batch)", () => {
  it("MATH route: 300 Ⓐ = 100 loops, fits in 1 tx → 1 mint tx + 1 approval = 2 signs", () => {
    const p = planRoute("MATH", "pDAI", 300n * E18);
    expect(p.generateLoops).toBe(100n);
    expect(p.totalTxs).toBe(1n);
    expect(p.approvals).toBe(1n);
    expect(p.totalSigns).toBe(2n);
    expect(p.cappedByGas).toBe(false);
    expect(p.perTxBreakdown).toHaveLength(1);
    expect(p.perTxBreakdown[0]?.loops).toBe(100n);
  });

  it("MATH route: 6000 Ⓐ = 2000 loops, gas-capped → ceil(2000 / maxLoops) batches", () => {
    const p = planRoute("MATH", "pDAI", 6000n * E18);
    expect(p.generateLoops).toBe(2000n);
    const expected = 2000n / maxLoopsPerTx("MATH") + 1n; // ceil
    expect(p.totalTxs).toBe(expected);
    expect(p.cappedByGas).toBe(true);
    // approval is one-time, not per-tx
    expect(p.approvals).toBe(1n);
    expect(p.totalSigns).toBe(p.totalTxs + p.approvals);
  });

  it("G5 route: 6000 Ⓐ = 2000 loops, gas-capped → fewer batches than MATH (cheaper per loop)", () => {
    const g5 = planRoute("G5", "pDAI", 6000n * E18);
    const math = planRoute("MATH", "pDAI", 6000n * E18);
    expect(g5.totalTxs).toBeLessThan(math.totalTxs);
    expect(g5.cappedByGas).toBe(true);
  });

  it("PI route: 3000 Ⓐ = 1000 loops fits in 1 tx (maxLoopsPerTx(PI) ≈ 1007)", () => {
    const p = planRoute("PI", "pDAI", 3000n * E18);
    expect(p.generateLoops).toBe(1000n);
    expect(p.totalTxs).toBe(1n);
    expect(p.cappedByGas).toBe(false);
  });

  it("PI route: 6000 Ⓐ = 2000 loops is gas-capped (2000 > maxLoopsPerTx(PI) ≈ 1007)", () => {
    const p = planRoute("PI", "pDAI", 6000n * E18);
    expect(p.generateLoops).toBe(2000n);
    expect(p.totalTxs).toBe(2000n / maxLoopsPerTx("PI") + 1n);
    expect(p.cappedByGas).toBe(true);
  });

  it("PI is the most gas-efficient route for 3000 Ⓐ (cheapest per loop in the batcher model)", () => {
    const math = planRoute("MATH", "pDAI", 3000n * E18);
    const pi = planRoute("PI", "pDAI", 3000n * E18);
    // PI per-loop gas (40.2k) < MATH per-loop gas (148.5k) → PI fits more loops per tx
    expect(pi.totalTxs).toBeLessThanOrEqual(math.totalTxs);
  });

  it("PI is the most gas-efficient route for 6000 Ⓐ, then G5, then MATH", () => {
    const g5 = planRoute("G5", "pDAI", 6000n * E18);
    const math = planRoute("MATH", "pDAI", 6000n * E18);
    const pi = planRoute("PI", "pDAI", 6000n * E18);
    // per-loop gas: PI (40.2k) < G5 (46.4k) < MATH (148.5k) → fewest txs to most txs
    expect(pi.totalTxs).toBeLessThanOrEqual(g5.totalTxs);
    expect(g5.totalTxs).toBeLessThanOrEqual(math.totalTxs);
  });

  it("perTxBreakdown sums back to generateLoops", () => {
    const p = planRoute("MATH", "pDAI", 6000n * E18);
    const sum = p.perTxBreakdown.reduce((acc, b) => acc + b.loops, 0n);
    expect(sum).toBe(p.generateLoops);
  });

  it("floors non-multiple-of-3 amounts to whole loops", () => {
    const p = planRoute("MATH", "pDAI", 299n * E18);
    expect(p.generateLoops).toBe(99n);
    expect(p.affToMint).toBe(297n * E18);
  });

  it("a small mint that fits in one tx is not gas-capped", () => {
    const p = planRoute("G5", "pDAI", 300n * E18);
    expect(p.totalTxs).toBe(1n);
    expect(p.cappedByGas).toBe(false);
  });
});

describe("planRoute (inter mode — skip pStable, just Generate() per loop)", () => {
  it("all routes use GAS_PER_LOOP_INTER in inter mode (39.8k/loop)", () => {
    const math = planRoute("MATH", "pDAI", 6000n * E18, "inter");
    const g5 = planRoute("G5", "pDAI", 6000n * E18, "inter");
    const pi = planRoute("PI", "pDAI", 6000n * E18, "inter");
    // All three routes have the same per-loop gas in inter mode → same tx count
    expect(math.totalTxs).toBe(g5.totalTxs);
    expect(g5.totalTxs).toBe(pi.totalTxs);
  });

  it("inter mode fits ~3.7x more MATH loops per tx than full mode", () => {
    const fullMath = planRoute("MATH", "pDAI", 6000n * E18, "full");
    const interMath = planRoute("MATH", "pDAI", 6000n * E18, "inter");
    expect(interMath.totalTxs).toBeLessThan(fullMath.totalTxs);
  });

  it("inter mode breakdown labels use multiBuyWith, not mintFromStable", () => {
    const p = planRoute("MATH", "pDAI", 300n * E18, "inter");
    expect(p.perTxBreakdown[0]?.label).toContain("multiBuyWith");
  });

  it("full mode breakdown labels use mintFromStable", () => {
    const p = planRoute("MATH", "pDAI", 300n * E18, "full");
    expect(p.perTxBreakdown[0]?.label).toContain("mintFromStable");
  });
});

describe("routeGranularity", () => {
  it("MATH = 3 Ⓐ (1 loop)", () => {
    expect(routeGranularity("MATH")).toBe(3n * E18);
  });
  it("G5 = 15 Ⓐ (5 loops, 1 G5)", () => {
    expect(routeGranularity("G5")).toBe(15n * E18);
  });
  it("PI = 300 Ⓐ (100 loops, 1 PI)", () => {
    expect(routeGranularity("PI")).toBe(300n * E18);
  });
});
