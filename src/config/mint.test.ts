import { describe, expect, it } from "vitest";
import {
  EXEC_ROUTES,
  GAS_PER_LOOP,
  GAS_PER_LOOP_INTER,
  INTERMEDIATES,
  MINT_ROUTES,
  STABLES,
  maxLoopsPerTx,
} from "./mint";
import { G5_ADDR, MATH_ADDR, PDAI_ADDR, PI_ADDR, PUSDC_ADDR } from "./registry";

// Pins the retained mint config (the portal's own batcher model). The legacy multi-mint
// selectors/addresses/plan builders were removed in P12 — minting now goes through the
// UnifiedAffectionBatcher / AtomicArbBatcher from contracts/, driven by /mint.

describe("MINT_ROUTES", () => {
  it("covers the three clean routes × their accepted stables (4 rows)", () => {
    const ids = MINT_ROUTES.map((r) => r.id).sort();
    expect(ids).toEqual(["G5·pDAI", "MATH·pDAI", "MATH·pUSDC", "PI·pDAI"]);
  });

  it("every route has the verified 1 pStable / 1 Ⓐ floor (stablePerAFFECTION = 1n)", () => {
    for (const r of MINT_ROUTES) {
      expect(r.stablePerAFFECTION).toBe(1n);
    }
  });

  it("perLoop × affectionPerIntermediate = 3 (the Ⓐ minted per Generate loop)", () => {
    const E18 = 10n ** 18n;
    for (const r of MINT_ROUTES) {
      const perLoopWhole = Number(r.perLoop / E18);
      // G5 perLoop is 0.6e18 — handle the fractional case
      const perLoopScaled = Number((r.perLoop * 100n) / E18) / 100;
      expect(perLoopScaled * r.affectionPerIntermediate).toBeCloseTo(3, 2);
      expect(perLoopWhole >= 0).toBe(true);
    }
  });

  it("loop granularity matches the whole-token mint size (MATH=1, G5=5, PI=100)", () => {
    const find = (id: string) => MINT_ROUTES.find((r) => r.id === id);
    expect(find("MATH·pDAI")?.loopGranularity).toBe(1n);
    expect(find("G5·pDAI")?.loopGranularity).toBe(5n);
    expect(find("PI·pDAI")?.loopGranularity).toBe(100n);
  });
});

describe("INTERMEDIATES + STABLES", () => {
  it("intermediates point at the canonical on-chain token addresses", () => {
    expect(INTERMEDIATES.MATH.address).toBe(MATH_ADDR);
    expect(INTERMEDIATES.G5.address).toBe(G5_ADDR);
    expect(INTERMEDIATES.PI.address).toBe(PI_ADDR);
  });

  it("stables point at the canonical pDAI / pUSDC addresses", () => {
    expect(STABLES.pDAI.address).toBe(PDAI_ADDR);
    expect(STABLES.pUSDC.address).toBe(PUSDC_ADDR);
    expect(STABLES.pDAI.decimals).toBe(18);
    expect(STABLES.pUSDC.decimals).toBe(6);
  });

  it("MATH accepts both pDAI + pUSDC; G5 + PI only accept pDAI", () => {
    expect(INTERMEDIATES.MATH.acceptedStables).toEqual(["pDAI", "pUSDC"]);
    expect(INTERMEDIATES.G5.acceptedStables).toEqual(["pDAI"]);
    expect(INTERMEDIATES.PI.acceptedStables).toEqual(["pDAI"]);
  });
});

describe("EXEC_ROUTES", () => {
  it("is the intersection of intermediates × accepted stables", () => {
    const ids = EXEC_ROUTES.map((r) => `${r.intermediate}·${r.stable}`).sort();
    expect(ids).toEqual(["G5·pDAI", "MATH·pDAI", "MATH·pUSDC", "PI·pDAI"]);
  });
});

describe("gas model", () => {
  it("GAS_PER_LOOP matches the measured on-chain per-loop costs", () => {
    expect(GAS_PER_LOOP.MATH).toBe(148_500n);
    expect(GAS_PER_LOOP.G5).toBe(46_400n);
    expect(GAS_PER_LOOP.PI).toBe(40_200n);
  });

  it("GAS_PER_LOOP_INTER is just Generate() ≈ 39.8k (no intermediate-mint leg)", () => {
    expect(GAS_PER_LOOP_INTER).toBe(39_800n);
  });

  it("maxLoopsPerTx = floor(40.5M / gas-per-loop), with ~10% block headroom", () => {
    expect(maxLoopsPerTx("MATH")).toBe(40_500_000n / 148_500n);
    expect(maxLoopsPerTx("G5")).toBe(40_500_000n / 46_400n);
    expect(maxLoopsPerTx("PI")).toBe(40_500_000n / 40_200n);
  });

  it("maxLoopsPerTx in inter mode uses GAS_PER_LOOP_INTER for all routes", () => {
    expect(maxLoopsPerTx("MATH", "inter")).toBe(40_500_000n / GAS_PER_LOOP_INTER);
    expect(maxLoopsPerTx("G5", "inter")).toBe(40_500_000n / GAS_PER_LOOP_INTER);
    expect(maxLoopsPerTx("PI", "inter")).toBe(40_500_000n / GAS_PER_LOOP_INTER);
    // inter mode fits ~3.7x more MATH loops per tx than full mode
    expect(maxLoopsPerTx("MATH", "inter")).toBeGreaterThan(maxLoopsPerTx("MATH", "full") * 3n);
  });

  it("the MATH route caps at ~270 loops/tx in full mode, matching the measured receipt", () => {
    // tx 0xc8fca2a5…21921f: 100-loop MATH mint used 14,751,057 gas ≈ 147.5k/loop
    expect(maxLoopsPerTx("MATH") * GAS_PER_LOOP.MATH).toBeLessThanOrEqual(40_500_000n);
    expect(maxLoopsPerTx("MATH")).toBeGreaterThan(250n);
    expect(maxLoopsPerTx("MATH")).toBeLessThan(300n);
  });
});
