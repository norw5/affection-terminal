import { describe, expect, it } from "vitest";
import { formatCompact, formatPct, formatUnits, parseToBase, parseWholeInput } from "./units";

const E18 = 10n ** 18n;

describe("formatUnits", () => {
  it("formats zero", () => {
    expect(formatUnits(0n, 18)).toBe("0");
  });

  it("formats a whole-token amount with thousands separators", () => {
    expect(formatUnits(366_689_787n * E18, 18)).toBe("366,689,787");
  });

  it("trims trailing zeros from the fractional part", () => {
    expect(formatUnits(1n * E18 + 50n * 10n ** 16n, 18)).toBe("1.5");
  });

  it("caps fractional digits at maxFrac (truncates, does not round)", () => {
    // 1.1234567 -> 1.1234
    expect(formatUnits(E18 + 123_456_700_000_000_000n, 18, 4)).toBe("1.1234");
  });

  it("handles 6-decimal tokens (pUSDC)", () => {
    expect(formatUnits(5_000_000n, 6)).toBe("5");
  });
});

describe("formatCompact", () => {
  it("renders millions", () => {
    expect(formatCompact(366_689_787n * E18, 18)).toBe("366.69M");
  });

  it("renders billions (cap)", () => {
    expect(formatCompact(1_111_111_111n * E18, 18)).toBe("1.11B");
  });

  it("renders thousands", () => {
    expect(formatCompact(95_927n * E18, 18)).toBe("95.93K");
  });

  it("renders sub-1k without suffix", () => {
    expect(formatCompact(2_846n * E18, 18)).toBe("2.85K");
  });
});

describe("formatPct", () => {
  it("computes fill percentage of the cap", () => {
    const pct = formatPct(366_689_787n, 1_111_111_111n, 2);
    expect(pct).toMatch(/^33\.00%$/);
  });

  it("returns zero with decimals for zero total", () => {
    expect(formatPct(0n, 0n)).toBe("0.00%");
  });

  it("supports 100% exactly", () => {
    expect(formatPct(100n, 100n)).toBe("100.00%");
  });
});

describe("parseToBase", () => {
  it("parses a decimal amount to base units", () => {
    expect(parseToBase("1.5", 18)).toBe(E18 + E18 / 2n);
  });

  it("parses an integer", () => {
    expect(parseToBase("42", 18)).toBe(42n * E18);
  });

  it("parses 6-decimal tokens", () => {
    expect(parseToBase("5", 6)).toBe(5_000_000n);
  });

  it("truncates excess fractional decimals (not round)", () => {
    // 1.2345 with 2 decimals -> 1.23 base units
    expect(parseToBase("1.2345", 2)).toBe(123n);
  });

  it("rejects invalid input", () => {
    expect(() => parseToBase("abc", 18)).toThrow();
    expect(() => parseToBase("", 18)).toThrow();
  });

  it("handles negative amounts", () => {
    expect(parseToBase("-1.5", 18)).toBe(-(E18 + E18 / 2n));
  });
});

describe("parseWholeInput (onChange-safe bigint parsing)", () => {
  it("parses plain integers", () => {
    expect(parseWholeInput("100")).toBe(100n);
    expect(parseWholeInput("0")).toBe(0n);
  });

  it("survives number-input intermediate states without throwing", () => {
    expect(parseWholeInput("")).toBe(0n);
    expect(parseWholeInput("1.")).toBe(1n);
    expect(parseWholeInput("1.5")).toBe(1n);
    expect(parseWholeInput("1e5")).toBe(100000n);
    expect(parseWholeInput("-3")).toBe(-3n);
    expect(parseWholeInput("abc")).toBe(0n);
  });
});
