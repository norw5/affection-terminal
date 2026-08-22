import { AFFECTION_CAP_BASE, MATH_CAP_BASE } from "@/config/constants";
import {
  AFFECTION_ADDR,
  FAUNG_ADDR,
  FA_ADDR,
  G5_ADDR,
  MATH_ADDR,
  PI_ADDR,
  RNG_ADDR,
} from "@/config/registry";
import { formatUnits } from "@/lib/format/units";
// "Verify against chain" — the canonical live reads from affection_docs/sources.md §2,
// modeled as facts. Each fact re-runs a single `eth_call` (totalSupply / decimals /
// balanceOf) and is checked against the immutable on-chain invariants:
//   - exact   : decimals must equal the documented value (immutable → must match)
//   - range   : supply must be ≤ cap (if capped); the as-of-writing snapshot is shown for
//               comparison but NOT used as a pass/fail gate (supplies drift via minting + burns)
//   - small   : the AFFECTION contract's own buffer must be ≈ 0 (just-in-time minting)
//
// The pure `checkFact` is unit-tested in facts.test.ts; the hook wires the RPC reads.
import type { Address } from "viem";

const E18 = 10n ** 18n;

export type FactKind = "exact" | "range" | "small";

export type FactCall = "totalSupply" | "decimals" | "balanceOf";

export type FactDef = {
  id: string;
  label: string;
  symbol: string;
  address: Address;
  call: FactCall;
  args?: Address;
  decimals: number;
  kind: FactKind;
  /** Snapshot as of sources.md writing (display + context only; not a gate). */
  documented?: bigint;
  /** Exact-match value (for `kind: "exact"`). */
  expected?: bigint;
  /** Upper bound for `range` (cap) or threshold for `small`. */
  cap?: bigint;
  note?: string;
};

export type FactResult = {
  ok: boolean;
  detail: string;
  live: bigint | null;
  status: "ok" | "fail" | "error";
};

export const VERIFY_FACTS: FactDef[] = [
  {
    id: "aff-decimals",
    label: "AFFECTION decimals",
    symbol: "Ⓐ",
    address: AFFECTION_ADDR,
    call: "decimals",
    decimals: 0,
    kind: "exact",
    expected: 18n,
    note: "immutable — must match the documented 18",
  },
  {
    id: "aff-supply",
    label: "AFFECTION totalSupply",
    symbol: "Ⓐ",
    address: AFFECTION_ADDR,
    call: "totalSupply",
    decimals: 18,
    kind: "range",
    documented: 366_634_963n * E18,
    cap: AFFECTION_CAP_BASE,
    note: "capped at 1,111,111,111 Ⓐ",
  },
  {
    id: "aff-buffer",
    label: "AFFECTION contract buffer (balanceOf self)",
    symbol: "Ⓐ",
    address: AFFECTION_ADDR,
    call: "balanceOf",
    args: AFFECTION_ADDR,
    decimals: 18,
    kind: "small",
    cap: 100n * E18,
    note: "just-in-time minting — buffer holds only dust (≤ 100 Ⓐ), drained in the same tx it's minted",
  },
  {
    id: "math-decimals",
    label: "MATH v1.1 decimals",
    symbol: "MATH",
    address: MATH_ADDR,
    call: "decimals",
    decimals: 0,
    kind: "exact",
    expected: 18n,
    note: "immutable",
  },
  {
    id: "math-supply",
    label: "MATH v1.1 totalSupply",
    symbol: "MATH",
    address: MATH_ADDR,
    call: "totalSupply",
    decimals: 18,
    kind: "range",
    documented: 340_567_095n * E18,
    cap: MATH_CAP_BASE,
    note: "capped at 1,111,111,111 MATH",
  },
  {
    id: "g5-decimals",
    label: "GIMME FIVE decimals",
    symbol: "G5",
    address: G5_ADDR,
    call: "decimals",
    decimals: 0,
    kind: "exact",
    expected: 18n,
  },
  {
    id: "g5-supply",
    label: "GIMME FIVE totalSupply",
    symbol: "G5",
    address: G5_ADDR,
    call: "totalSupply",
    decimals: 18,
    kind: "range",
    documented: 1_199_887n * E18,
  },
  {
    id: "pi-decimals",
    label: "pINDEPENDENCE decimals",
    symbol: "PI",
    address: PI_ADDR,
    call: "decimals",
    decimals: 0,
    kind: "exact",
    expected: 18n,
  },
  {
    id: "pi-supply",
    label: "pINDEPENDENCE totalSupply",
    symbol: "PI",
    address: PI_ADDR,
    call: "totalSupply",
    decimals: 18,
    kind: "range",
    documented: 95_926n * E18,
  },
  {
    id: "rng-decimals",
    label: "RNG decimals",
    symbol: "RNG",
    address: RNG_ADDR,
    call: "decimals",
    decimals: 0,
    kind: "exact",
    expected: 18n,
  },
  {
    id: "rng-supply",
    label: "RNG totalSupply",
    symbol: "RNG",
    address: RNG_ADDR,
    call: "totalSupply",
    decimals: 18,
    kind: "range",
    documented: 340_587_571n * E18,
  },
  {
    id: "fa-decimals",
    label: "libConjecture (Fa) decimals",
    symbol: "Fa",
    address: FA_ADDR,
    call: "decimals",
    decimals: 0,
    kind: "exact",
    expected: 18n,
  },
  {
    id: "fa-supply",
    label: "libConjecture (Fa) totalSupply",
    symbol: "Fa",
    address: FA_ADDR,
    call: "totalSupply",
    decimals: 18,
    kind: "range",
    documented: 2_846n * E18,
  },
  {
    id: "faung-decimals",
    label: "libDynamic (Faung) decimals",
    symbol: "Faung",
    address: FAUNG_ADDR,
    call: "decimals",
    decimals: 0,
    kind: "exact",
    expected: 18n,
  },
  {
    id: "faung-supply",
    label: "libDynamic (Faung) totalSupply",
    symbol: "Faung",
    address: FAUNG_ADDR,
    call: "totalSupply",
    decimals: 18,
    kind: "range",
    documented: 3n * E18,
  },
];

function fmt(b: bigint, decimals: number, maxFrac = 4): string {
  if (decimals === 0) return b.toString();
  return formatUnits(b, decimals, maxFrac);
}

/** Check a live value against a fact. Pure + unit-tested. `live === null` means the
 *  RPC read failed (→ status "error", never "fail" — the read itself is broken, not the
 *  invariant). */
export function checkFact(live: bigint | null, fact: FactDef): FactResult {
  if (live === null) return { ok: false, detail: "rpc read failed", live: null, status: "error" };
  switch (fact.kind) {
    case "exact": {
      const ok = live === (fact.expected ?? 0n);
      return {
        ok,
        status: ok ? "ok" : "fail",
        detail: ok ? `== ${live}` : `got ${live}, expected ${fact.expected ?? "?"}`,
        live,
      };
    }
    case "range": {
      const cap = fact.cap;
      const ok = cap === undefined ? true : live <= cap;
      const parts = [`live ${fmt(live, fact.decimals, 2)}`];
      if (fact.documented !== undefined)
        parts.push(`doc ${fmt(fact.documented, fact.decimals, 0)}`);
      if (cap !== undefined) parts.push(`cap ${fmt(cap, fact.decimals, 0)}`);
      return {
        ok,
        status: ok ? "ok" : "fail",
        detail: ok
          ? parts.join(" · ")
          : `out of range: ${fmt(live, fact.decimals, 2)} > cap ${fmt(cap ?? 0n, fact.decimals, 0)}`,
        live,
      };
    }
    case "small": {
      const threshold = fact.cap ?? 0n;
      const ok = live < threshold;
      return {
        ok,
        status: ok ? "ok" : "fail",
        detail: ok
          ? `${fmt(live, fact.decimals, 4)} (< ${fmt(threshold, fact.decimals, 4)})`
          : `${fmt(live, fact.decimals, 4)} — expected ≈ 0`,
        live,
      };
    }
  }
}
