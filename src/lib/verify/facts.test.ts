import { describe, expect, it } from "vitest";
import { type FactDef, VERIFY_FACTS, checkFact } from "./facts";

const E18 = 10n ** 18n;

function fact(id: string): FactDef {
  const f = VERIFY_FACTS.find((x) => x.id === id);
  if (!f) throw new Error(`no fact ${id}`);
  return f;
}

describe("VERIFY_FACTS", () => {
  it("covers the canonical sources.md §2 reads (7 tokens × 2 + buffer)", () => {
    const ids = VERIFY_FACTS.map((f) => f.id);
    expect(ids).toContain("aff-supply");
    expect(ids).toContain("aff-buffer");
    expect(ids).toContain("math-supply");
    expect(ids).toContain("g5-supply");
    expect(ids).toContain("pi-supply");
    expect(ids).toContain("rng-supply");
    expect(ids).toContain("fa-supply");
    expect(ids).toContain("faung-supply");
    for (const t of ["aff", "math", "g5", "pi", "rng", "fa", "faung"]) {
      expect(ids).toContain(`${t}-decimals`);
    }
    expect(VERIFY_FACTS.length).toBe(15);
  });

  it("every decimals fact is exact with expected 18n", () => {
    for (const f of VERIFY_FACTS.filter((x) => x.kind === "exact")) {
      expect(f.expected).toBe(18n);
      expect(f.decimals).toBe(0);
    }
  });

  it("every supply fact is range with a documented snapshot", () => {
    for (const f of VERIFY_FACTS.filter((x) => x.kind === "range")) {
      expect(f.documented).not.toBe(undefined);
      expect(f.decimals).toBe(18);
    }
  });

  it("AFFECTION + MATH supplies are capped; intermediates are not", () => {
    expect(fact("aff-supply").cap).not.toBe(undefined);
    expect(fact("math-supply").cap).not.toBe(undefined);
    expect(fact("g5-supply").cap).toBe(undefined);
    expect(fact("faung-supply").cap).toBe(undefined);
  });

  it("the buffer fact is small with a dust tolerance (≤ 100 Ⓐ)", () => {
    const f = fact("aff-buffer");
    expect(f.kind).toBe("small");
    expect(f.cap).toBe(100n * E18);
    expect(f.call).toBe("balanceOf");
    expect(f.args).toBe(f.address);
  });

  it("fact ids are unique", () => {
    const ids = VERIFY_FACTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("checkFact", () => {
  it("null live → error status", () => {
    const r = checkFact(null, fact("aff-supply"));
    expect(r.status).toBe("error");
    expect(r.ok).toBe(false);
    expect(r.live).toBe(null);
  });

  it("exact match → ok", () => {
    const r = checkFact(18n, fact("aff-decimals"));
    expect(r.status).toBe("ok");
    expect(r.ok).toBe(true);
    expect(r.detail).toBe("== 18");
  });

  it("exact mismatch → fail", () => {
    const r = checkFact(6n, fact("aff-decimals"));
    expect(r.status).toBe("fail");
    expect(r.ok).toBe(false);
  });

  it("range within cap → ok", () => {
    const r = checkFact(400_000_000n * E18, fact("aff-supply"));
    expect(r.status).toBe("ok");
    expect(r.detail).toContain("cap 1,111,111,111");
  });

  it("range above cap → fail", () => {
    const r = checkFact(2_000_000_000n * E18, fact("aff-supply"));
    expect(r.status).toBe("fail");
    expect(r.ok).toBe(false);
  });

  it("range without cap (intermediate) → ok whenever the read succeeds", () => {
    const r = checkFact(1_999_887n * E18, fact("g5-supply"));
    expect(r.status).toBe("ok");
    expect(r.ok).toBe(true);
  });

  it("small below threshold → ok (dust tolerated)", () => {
    const r = checkFact(8_749_400_000_000_000_000n, fact("aff-buffer"));
    expect(r.status).toBe("ok");
    expect(r.ok).toBe(true);
  });

  it("small at/above threshold → fail", () => {
    const r = checkFact(200n * E18, fact("aff-buffer"));
    expect(r.status).toBe("fail");
    expect(r.ok).toBe(false);
  });

  it("detail includes the documented snapshot for range facts", () => {
    const r = checkFact(366_634_963n * E18, fact("aff-supply"));
    expect(r.detail).toContain("doc 366,634,963");
  });
});
