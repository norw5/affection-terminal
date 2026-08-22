import { describe, expect, it } from "vitest";
import {
  ATOMIC_ARB_BATCHER_ABI,
  ATOMIC_ARB_BATCHER_BYTECODE,
  BATCHERS,
  CONSTRUCTOR_ARG_TYPES,
  UNIFIED_BATCHER_ABI,
  UNIFIED_BATCHER_BYTECODE,
  buildConstructorArgs,
} from "./batcher";
import { AFFECTION_ADDR, G5_ADDR, MATH_ADDR, PDAI_ADDR, PI_ADDR, PUSDC_ADDR } from "./registry";

describe("BATCHERS artifacts", () => {
  it("exposes both variants with non-empty bytecode + abi", () => {
    expect(UNIFIED_BATCHER_BYTECODE.startsWith("0x")).toBe(true);
    expect(ATOMIC_ARB_BATCHER_BYTECODE.startsWith("0x")).toBe(true);
    expect((UNIFIED_BATCHER_BYTECODE.length - 2) / 2).toBeGreaterThan(1000); // ~6.9k
    expect((ATOMIC_ARB_BATCHER_BYTECODE.length - 2) / 2).toBeGreaterThan(
      (UNIFIED_BATCHER_BYTECODE.length - 2) / 2,
    ); // arb extends base
    expect(UNIFIED_BATCHER_ABI.length).toBeGreaterThan(5);
    expect(ATOMIC_ARB_BATCHER_ABI.length).toBeGreaterThan(UNIFIED_BATCHER_ABI.length);
  });

  it("mint-sell variant requires a router; mint-only does not", () => {
    expect(BATCHERS["mint-only"].requiresRouter).toBe(false);
    expect(BATCHERS["mint-sell"].requiresRouter).toBe(true);
    expect(BATCHERS["mint-sell"].constructorParams).toHaveLength(7);
    expect(BATCHERS["mint-only"].constructorParams).toHaveLength(6);
  });

  it("constructor param defaults match the canonical registry addresses", () => {
    const p = BATCHERS["mint-only"].constructorParams;
    expect(p[0].default).toBe(AFFECTION_ADDR);
    expect(p[1].default).toBe(MATH_ADDR);
    expect(p[2].default).toBe(G5_ADDR);
    expect(p[3].default).toBe(PI_ADDR);
    expect(p[4].default).toBe(PDAI_ADDR);
    expect(p[5].default).toBe(PUSDC_ADDR);
  });

  it("abi exposes the public entrypoints (mintFromStable, multiBuyWith, maxSafeLoops, rescue)", () => {
    const names = UNIFIED_BATCHER_ABI.filter((e) => e.type === "function").map((e) =>
      "name" in e ? e.name : "",
    );
    expect(names).toContain("mintFromStable");
    expect(names).toContain("multiBuyWith");
    expect(names).toContain("maxSafeLoops");
    expect(names).toContain("rescue");
    expect(names).toContain("perLoop");
    expect(names).toContain("isChargeAndDrain");
    expect(names).toContain("CAP");
    expect(names).toContain("AFFECTION"); // immutable getter
  });

  it("AtomicArbBatcher adds mintAndSwap + ROUTER over the base", () => {
    const names = ATOMIC_ARB_BATCHER_ABI.filter((e) => e.type === "function").map((e) =>
      "name" in e ? e.name : "",
    );
    expect(names).toContain("mintAndSwap");
    expect(names).toContain("ROUTER");
    // still has the base entrypoints
    expect(names).toContain("mintFromStable");
    expect(names).toContain("maxSafeLoops");
  });
});

describe("CONSTRUCTOR_ARG_TYPES", () => {
  it("mint-only takes 6 addresses; mint-sell takes 7 (adds router)", () => {
    const mo = CONSTRUCTOR_ARG_TYPES.find((t) => t.variant === "mint-only");
    const ms = CONSTRUCTOR_ARG_TYPES.find((t) => t.variant === "mint-sell");
    expect(mo?.types).toEqual(["address", "address", "address", "address", "address", "address"]);
    expect(ms?.types).toHaveLength(7);
    expect(ms?.types.every((t) => t === "address")).toBe(true);
  });
});

describe("buildConstructorArgs", () => {
  it("returns canonical defaults in order when no overrides given", () => {
    const out = buildConstructorArgs("mint-only", {});
    expect(out).toEqual([AFFECTION_ADDR, MATH_ADDR, G5_ADDR, PI_ADDR, PDAI_ADDR, PUSDC_ADDR]);
  });

  it("applies overrides while keeping order + filling defaults for the rest", () => {
    const customAff = "0x0000000000000000000000000000000000000001";
    const out = buildConstructorArgs("mint-only", { aff: customAff });
    expect(out[0]).toBe(customAff);
    expect(out[1]).toBe(MATH_ADDR); // unchanged
    expect(out).toHaveLength(6);
  });

  it("mint-sell includes the router slot at the end", () => {
    const out = buildConstructorArgs("mint-sell", {});
    expect(out).toHaveLength(7);
    expect(out[6]).toBe("0x0000000000000000000000000000000000000000"); // default router (to fill in)
  });
});
