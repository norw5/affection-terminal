import { formatUnits } from "@/lib/format/units";
// The 4-stage mint route flow (pStable → intermediate → AFFECTION → PulseX) rendered as
// an SVG so the best route's live amounts read at a glance. Responsive (scales to width).
import type { RouteProfit } from "@/lib/mint/profitability";

/** Format a basis-points bigint (can be negative) as a percentage string with 2 decimals. */
function bpsToPct(bps: bigint): string {
  const neg = bps < 0n;
  const abs = neg ? -bps : bps;
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${neg ? "-" : ""}${whole}.${frac.toString().padStart(2, "0")}`;
}

function compact(base: bigint, decimals: number): string {
  return formatUnits(base, decimals, 2);
}

/** Short label for a hop address in the DEX exit path. */
function hopLabel(addr: string): string {
  const known: Record<string, string> = {
    "0xa1077a294dde1b09bb078844df40758a5d0f9a27": "WPLS",
    "0x6b175474e89094c44da98b954eedeac495271d0f": "pDAI",
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "pUSDC",
  };
  return known[addr.toLowerCase()] ?? `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function RouteFlow({ profit }: { profit: RouteProfit }) {
  const { route, affMinted, stableCost, dexValue, exit } = profit;
  const stableSym = route.stable;
  const imSym = route.intermediate;
  const exitPath = exit?.path ?? [];
  // last node = the stable we end in; middle nodes = DEX hops
  const hopLabels = exitPath
    .slice(1, -1) // e.g. ["WPLS"] for AFF→WPLS→pDAI
    .map((a) => hopLabel(a));

  const profitable = profit.profit > 0n && exit !== null;
  const profitColor = profitable ? "var(--c-ok)" : "var(--c-err)";

  // 4 stage cards: pStable(cost) → intermediate → AFFECTION(minted) → DEX(value)
  const stages = [
    {
      title: "spend",
      big: `${compact(stableCost, route.stable === "pDAI" ? 18 : 6)}`,
      sub: `${stableSym}`,
      tone: "var(--c-text-dim)",
    },
    {
      title: "via",
      big: `${imSym}`,
      sub: route.buyFunction,
      tone: "var(--c-info)",
    },
    {
      title: "mint",
      big: `${formatUnits(affMinted, 18, 2)}`,
      sub: "Ⓐ AFFECTION",
      tone: "var(--c-accent)",
    },
    {
      title: exit ? "sell on PulseX" : "no DEX exit",
      big: exit ? `${compact(dexValue, route.stable === "pDAI" ? 18 : 6)}` : "—",
      sub: exit
        ? `${stableSym}${hopLabels.length ? ` via ${hopLabels.join(" → ")}` : ""}`
        : "no Ⓐ/stable pair",
      tone: exit ? profitColor : "var(--c-err)",
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-stretch gap-2">
        {stages.map((s, i) => (
          <div key={s.title} className="flex items-center gap-2">
            <div className="flex w-32 flex-col gap-0.5 border border-border bg-panel-2 px-2 py-1.5">
              <span className="text-[0.625rem] uppercase tracking-wider text-text-faint">
                {s.title}
              </span>
              <span className="truncate text-sm" style={{ color: s.tone }}>
                {s.big}
              </span>
              <span className="truncate text-xs text-text-dim">{s.sub}</span>
            </div>
            {i < stages.length - 1 && (
              <span className="text-text-faint" aria-hidden>
                →
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-text-faint">net</span>
        <span style={{ color: profitColor }}>
          {profit.profit >= 0n ? "+" : "-"}
          {compact(
            profit.profit < 0n ? -profit.profit : profit.profit,
            route.stable === "pDAI" ? 18 : 6,
          )}{" "}
          {stableSym}
        </span>
        <span className="text-text-faint">
          ({bpsToPct(profit.profitBps)}%{exit ? ` · ${bpsToPct(exit.slippageBps)}% impact` : ""})
        </span>
      </div>
    </div>
  );
}
