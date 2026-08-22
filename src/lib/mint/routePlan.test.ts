import { describe, expect, it } from "vitest";
import { planRoute, routeGranularity } from "./routePlan";

const E18 = 10n ** 18n;

describe("planRoute", () => {
  it("MATH route: 300 Ⓐ = 100 loops, needs 300 MATH, 1 batch each = 2 txs", () => {
    const p = planRoute("MATH", "pDAI", 300n * E18);
    expect(p.generateLoops).toBe(100n);
    expect(p.intermediateTokensNeeded).toBe(300n);
    expect(p.intermediateMintCalls).toBe(1n);
    expect(p.affectionMintCalls).toBe(1n);
    expect(p.totalTxs).toBe(2n);
    expect(p.approvals).toBe(2n);
    expect(p.totalSigns).toBe(4n);
    expect(p.piBugWarning).toBe(false);
    expect(p.cappedByGas).toBe(false);
  });

  it("MATH route: 6000 Ⓐ = 2000 loops, needs 6000 MATH = 6 batches + 2 AFFECTION = 8 txs (gas-capped)", () => {
    const p = planRoute("MATH", "pDAI", 6000n * E18);
    expect(p.generateLoops).toBe(2000n);
    expect(p.intermediateTokensNeeded).toBe(6000n);
    expect(p.intermediateMintCalls).toBe(6n);
    expect(p.affectionMintCalls).toBe(2n);
    expect(p.totalTxs).toBe(8n);
    expect(p.cappedByGas).toBe(true);
  });

  it("MATH route: 6003 Ⓐ = 2001 loops, needs 6003 MATH = 6 batches + 3 AFFECTION = 9 txs", () => {
    const p = planRoute("MATH", "pDAI", 6003n * E18);
    expect(p.generateLoops).toBe(2001n);
    expect(p.intermediateMintCalls).toBe(6n);
    expect(p.affectionMintCalls).toBe(3n);
    expect(p.totalTxs).toBe(9n);
    expect(p.cappedByGas).toBe(true);
  });

  it("G5 route: 300 Ⓐ = 100 loops, needs 60 G5 = 1 batch + 1 AFFECTION = 2 txs", () => {
    const p = planRoute("G5", "pDAI", 300n * E18);
    expect(p.generateLoops).toBe(100n);
    expect(p.intermediateTokensNeeded).toBe(60n);
    expect(p.intermediateMintCalls).toBe(1n);
    expect(p.totalTxs).toBe(2n);
  });

  it("G5 route: 6000 Ⓐ = 2000 loops, needs 1200 G5 = 1 batch + 2 AFFECTION = 3 txs", () => {
    const p = planRoute("G5", "pDAI", 6000n * E18);
    expect(p.intermediateTokensNeeded).toBe(1200n);
    expect(p.intermediateMintCalls).toBe(1n);
    expect(p.affectionMintCalls).toBe(2n);
    expect(p.totalTxs).toBe(3n);
  });

  it("PI route: 300 Ⓐ = 100 loops, needs 1 PI = 1 MultiPI + 1 MultiAffection = 2 txs (ok)", () => {
    const p = planRoute("PI", "pDAI", 300n * E18);
    expect(p.generateLoops).toBe(100n);
    expect(p.intermediateTokensNeeded).toBe(1n);
    expect(p.intermediateMintCalls).toBe(1n);
    expect(p.totalTxs).toBe(2n);
    expect(p.piBugWarning).toBe(false);
  });

  it("PI route: 600 Ⓐ = 200 loops, needs 2 PI = 2 MultiPI + 1 MultiAffection = 3 txs (bug!)", () => {
    const p = planRoute("PI", "pDAI", 600n * E18);
    expect(p.generateLoops).toBe(200n);
    expect(p.intermediateTokensNeeded).toBe(2n);
    expect(p.intermediateMintCalls).toBe(2n);
    expect(p.affectionMintCalls).toBe(1n);
    expect(p.totalTxs).toBe(3n);
    expect(p.piBugWarning).toBe(true);
  });

  it("PI route: 3000 Ⓐ = 1000 loops, needs 10 PI = 10 MultiPI + 1 MultiAffection = 11 txs", () => {
    const p = planRoute("PI", "pDAI", 3000n * E18);
    expect(p.intermediateMintCalls).toBe(10n);
    expect(p.totalTxs).toBe(11n);
    expect(p.piBugWarning).toBe(true);
  });

  it("MATH vs PI for 3000 Ⓐ: MATH needs 5 txs, PI needs 11 txs", () => {
    const math = planRoute("MATH", "pDAI", 3000n * E18);
    const pi = planRoute("PI", "pDAI", 3000n * E18);
    expect(math.totalTxs).toBeLessThan(pi.totalTxs);
  });

  it("G5 is best for 6000 Ⓐ: 3 txs vs MATH 8 txs vs PI 22 txs", () => {
    const g5 = planRoute("G5", "pDAI", 6000n * E18);
    const math = planRoute("MATH", "pDAI", 6000n * E18);
    const pi = planRoute("PI", "pDAI", 6000n * E18);
    expect(g5.totalTxs).toBe(3n);
    expect(math.totalTxs).toBe(8n);
    expect(pi.totalTxs).toBe(22n);
    expect(g5.totalTxs).toBeLessThan(math.totalTxs);
    expect(math.totalTxs).toBeLessThan(pi.totalTxs);
  });

  it("floors non-multiple-of-3 amounts to whole loops", () => {
    const p = planRoute("MATH", "pDAI", 299n * E18);
    expect(p.generateLoops).toBe(99n);
    expect(p.affToMint).toBe(297n * E18);
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
