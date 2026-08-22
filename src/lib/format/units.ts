// Bigint → human formatting helpers. Pure functions, fully unit-tested.

const WHOLE_FMT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const COMPACT_FMT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Format a base-units bigint as a human string with `decimals`, up to `maxFrac` digits, trimming trailing zeros. */
export function formatUnits(value: bigint, decimals: number, maxFrac = 4): string {
  if (value === 0n) return "0";
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const wholeStr = WHOLE_FMT.format(whole);
  if (frac === 0n) {
    return `${negative ? "-" : ""}${wholeStr}`;
  }
  let fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  if (fracStr.length > maxFrac) fracStr = fracStr.slice(0, maxFrac).replace(/0+$/, "");
  return `${negative ? "-" : ""}${wholeStr}.${fracStr}`;
}

/** Compact representation for large supplies: 366.7M, 1.11B, 95.9K. Whole-token granularity. */
export function formatCompact(value: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = Number(value % base) / Number(base);
  const n = Number(whole) + frac;
  if (n >= 1e9) return `${COMPACT_FMT.format(n / 1e9)}B`;
  if (n >= 1e6) return `${COMPACT_FMT.format(n / 1e6)}M`;
  if (n >= 1e3) return `${COMPACT_FMT.format(n / 1e3)}K`;
  if (n >= 1) return COMPACT_FMT.format(n);
  return formatUnits(value, decimals, 4);
}

/** Percentage with `digits` precision (always showing `digits` decimals), given two base-unit bigints. */
export function formatPct(part: bigint, total: bigint, digits = 2): string {
  if (total === 0n) return `${(0).toFixed(digits)}%`;
  const f = 10n ** BigInt(digits);
  const pctScaled = (part * f * 100n) / total; // percentage * 10^digits (e.g. 3300 for 33.00)
  const whole = pctScaled / f;
  const frac = pctScaled % f;
  const fracStr = frac.toString().padStart(Number(digits), "0");
  return `${whole}.${fracStr}%`;
}

/** Parse a human amount string ("12.34") into base-units bigint at `decimals`. Throws on invalid input. */
export function parseToBase(input: string, decimals: number): bigint {
  const s = input.trim();
  if (!s) throw new Error("empty amount");
  const neg = s.startsWith("-");
  const sign = neg ? -1n : 1n;
  const body = neg ? s.slice(1) : s;
  if (!/^\d*(\.\d*)?$/.test(body)) throw new Error(`invalid amount: ${input}`);
  const [wholeStr, fracStr = ""] = body.split(".");
  const whole = wholeStr ? BigInt(wholeStr) : 0n;
  const fracPadded = (fracStr + "0".repeat(decimals)).slice(0, decimals);
  const frac = fracPadded ? BigInt(fracPadded) : 0n;
  return sign * (whole * 10n ** BigInt(decimals) + frac);
}

/** Parse a whole-number text input (e.g. a loops/amount <input type="number">) into a
 *  bigint without throwing: accepts "1.", "1.5" (floors), "1e5", negative values and
 *  garbage (→ 0n). `<input type="number">` legitimately produces intermediate states
 *  like "1." while typing, and BigInt("1.") throws — never let that hit an onChange. */
export function parseWholeInput(raw: string): bigint {
  const s = raw.trim();
  if (/^-?\d+$/.test(s)) return BigInt(s);
  const n = Number(s);
  if (Number.isFinite(n)) return BigInt(Math.floor(Math.abs(n))) * (n < 0 ? -1n : 1n);
  return 0n;
}
