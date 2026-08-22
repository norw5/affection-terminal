import { describe, expect, it } from "vitest";
import { effectivePrice, getAmountOut, getAmountsOut, slippageBps, spotPrice } from "./math";

const E18 = 10n ** 18n;

describe("spotPrice", () => {
  it("computes reserveOut / reserveIn scaled to 1e18", () => {
    expect(spotPrice(2n * E18, 4n * E18)).toBe(2n * E18);
  });

  it("returns 0 for zero reserveIn", () => {
    expect(spotPrice(0n, 100n * E18)).toBe(0n);
  });

  it("handles fractional prices (truncates, no rounding)", () => {
    // 1e18 / 3 → 0.333…e18 truncated
    expect(spotPrice(3n * E18, E18)).toBe(E18 / 3n);
  });
});

describe("getAmountOut", () => {
  it("matches the UniswapV2 formula for a small trade (≈ 0.3% fee)", () => {
    // tiny trade relative to a 1:1 pool → out ≈ 0.997 * amountIn (minus negligible slippage)
    const amountIn = E18 / 1000n;
    const out = getAmountOut(amountIn, 1000n * E18, 1000n * E18);
    expect(out).toBeGreaterThan((amountIn * 996n) / 1000n);
    expect(out).toBeLessThan((amountIn * 997n) / 1000n + 1n);
  });

  it("for a trade equal to reserveIn (1:1 pool) halves the output (constant-product)", () => {
    // amountIn = reserveIn = reserveOut → out = 997/1997 * amountIn ≈ 0.4993
    const out = getAmountOut(E18, E18, E18);
    expect(out).toBe((997n * E18) / 1997n);
  });

  it("returns 0 for zero reserves", () => {
    expect(getAmountOut(E18, 0n, E18)).toBe(0n);
    expect(getAmountOut(E18, E18, 0n)).toBe(0n);
  });

  it("larger trade → less out per unit (slippage)", () => {
    const small = getAmountOut(E18, 1000n * E18, 1000n * E18);
    const large = getAmountOut(100n * E18, 1000n * E18, 1000n * E18);
    expect(large / 100n).toBeLessThan(small);
  });
});

describe("getAmountsOut (multi-hop)", () => {
  it("chains two hops and stays below the no-fee theoretical max", () => {
    // A→B→C: reserves [1:2], [2:6]. No-fee max = 1 * (2/1) * (6/2) = 6.
    const out = getAmountsOut(E18, [
      [E18, 2n * E18],
      [2n * E18, 6n * E18],
    ]);
    expect(out).toBeGreaterThan(0n);
    expect(out).toBeLessThan(6n * E18);
    // double fee + slippage → meaningfully below 6
    expect(out).toBeLessThan(5_980_000_000_000_000_000n);
  });

  it("zero reserves → 0", () => {
    expect(getAmountsOut(E18, [[0n, 0n]])).toBe(0n);
  });
});

describe("effectivePrice", () => {
  it("equals spotPrice at amountIn → 0", () => {
    expect(effectivePrice(0n, E18, 2n * E18)).toBe(spotPrice(E18, 2n * E18));
  });

  it("is less than spotPrice for positive amountIn (slippage)", () => {
    const eff = effectivePrice(10n * E18, 1000n * E18, 1000n * E18);
    const spot = spotPrice(1000n * E18, 1000n * E18);
    expect(eff).toBeLessThan(spot);
  });
});

describe("slippageBps", () => {
  it("is 0 at amountIn → 0", () => {
    expect(slippageBps(0n, E18, E18)).toBe(0n);
  });

  it("grows with trade size", () => {
    const small = slippageBps(E18, 100n * E18, 100n * E18);
    const large = slippageBps(50n * E18, 100n * E18, 100n * E18);
    expect(large).toBeGreaterThan(small);
    expect(small).toBeGreaterThan(0n);
  });

  it("is 0 for zero reserves", () => {
    expect(slippageBps(E18, 0n, 0n)).toBe(0n);
  });
});
