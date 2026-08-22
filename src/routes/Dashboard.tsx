import { NAV } from "@/components/layout/nav";
import { AddressChip } from "@/components/shared/AddressChip";
import { Panel } from "@/components/ui/Panel";
import { Stat } from "@/components/ui/Stat";
import {
  AFFECTION_ADDR,
  FAUNG_ADDR,
  FA_ADDR,
  G5_ADDR,
  MATH_ADDR,
  PI_ADDR,
  RNG_ADDR,
} from "@/config/registry";
import { headroom, useSupply } from "@/hooks/useSupply";
import { formatCompact, formatUnits } from "@/lib/format/units";
import { Link } from "@tanstack/react-router";

function Gauge({ pct }: { pct: bigint }) {
  // pct is 0..10000 (basis points). Clamp to 10000.
  const clamped = pct > 10000n ? 10000n : pct;
  const w = Number(clamped) / 100;
  return (
    <div className="h-2 w-full border border-border bg-panel-2">
      <div className="h-full bg-accent" style={{ width: `${w}%` }} />
    </div>
  );
}

/** Format a basis-points bigint (0..10000) as a percentage string with 1 decimal. */
function basisToPct(basis: bigint): string {
  const whole = basis / 100n;
  const tenths = basis % 100n;
  return `${whole}.${tenths / 10n}${tenths % 10n}%`;
}

export function Dashboard() {
  const { data, isLoading, isError } = useSupply();

  const aff = data ? headroom(data.affectionSupply, data.affectionCap) : undefined;
  const math = data ? headroom(data.mathSupply, data.mathCap) : undefined;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <section className="flex flex-col gap-1">
        <h1 className="text-xl text-accent">AFFECTION™ Terminal</h1>
        <p className="text-text-dim">
          A decentralized, client-side portal for the AFFECTION (Ⓐ) token ecosystem on PulseChain.
          No backend. No tracking. Reads straight from the chain.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel
          title="Ⓐ AFFECTION supply"
          actions={<span className="text-text-faint">cap 1.11B</span>}
        >
          {isError ? (
            <p className="text-err text-xs">RPC read failed — see status bar.</p>
          ) : isLoading || !data ? (
            <p className="text-text-faint text-xs">fetching…</p>
          ) : (
            <div className="flex flex-col gap-3">
              <Stat
                label="circulating"
                value={formatCompact(data.affectionSupply, 18)}
                sub={`${formatUnits(data.affectionSupply, 18, 2)} Ⓐ`}
                copyValue={data.affectionSupply.toString()}
              />
              {aff && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-text-dim">
                    <span>{basisToPct(aff.pctFilled)} filled</span>
                    <span>{formatCompact(aff.remaining, 18)} remaining</span>
                  </div>
                  <Gauge pct={aff.pctFilled} />
                </div>
              )}
              <Stat
                label="contract buffer (just-in-time)"
                value={`${formatUnits(data.affectionBuffer, 18, 4)} Ⓐ`}
                tone="dim"
                sub="≈ 0 — buffer is drained in the same tx it's minted"
              />
              <div className="text-xs">
                <AddressChip name="contract" address={AFFECTION_ADDR} />
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="MATH v1.1 supply"
          actions={<span className="text-text-faint">cap 1.11B</span>}
        >
          {isError ? (
            <p className="text-err text-xs">RPC read failed.</p>
          ) : isLoading || !data ? (
            <p className="text-text-faint text-xs">fetching…</p>
          ) : (
            <div className="flex flex-col gap-3">
              <Stat
                label="circulating"
                value={formatCompact(data.mathSupply, 18)}
                sub={`${formatUnits(data.mathSupply, 18, 2)} MATH`}
                copyValue={data.mathSupply.toString()}
              />
              {math && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-text-dim">
                    <span>{basisToPct(math.pctFilled)} filled</span>
                    <span>{formatCompact(math.remaining, 18)} remaining</span>
                  </div>
                  <Gauge pct={math.pctFilled} />
                </div>
              )}
              <p className="text-xs text-text-dim">
                MATH is the math/RNG library AFFECTION depends on — it must be live for AFFECTION to
                mint.
              </p>
              <div className="text-xs">
                <AddressChip name="contract" address={MATH_ADDR} />
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="modules">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {NAV.filter((n) => n.to !== "/").map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="focus-ring flex items-baseline gap-2 border border-border bg-panel-2 px-3 py-2 hover:border-accent-dim"
            >
              <span className="text-accent">▸</span>
              <span className="text-text">{n.label}</span>
              {n.phase && (
                <span className="text-[0.625rem] uppercase text-text-faint">{n.phase}</span>
              )}
              <span className="ml-auto text-xs text-text-faint">{n.desc}</span>
            </Link>
          ))}
        </div>
      </Panel>

      <Panel title="canonical addresses">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <AddressChip name="AFFECTION (Ⓐ)" address={AFFECTION_ADDR} />
          <AddressChip name="libAtropaMath (MATH)" address={MATH_ADDR} />
          <AddressChip name="GIMME FIVE (G5)" address={G5_ADDR} />
          <AddressChip name="pINDEPENDENCE (PI)" address={PI_ADDR} />
          <AddressChip name="RNG" address={RNG_ADDR} />
          <AddressChip name="libConjecture (Fa)" address={FA_ADDR} />
          <AddressChip name="libDynamic (Faung)" address={FAUNG_ADDR} />
        </div>
      </Panel>

      <p className="text-xs text-text-faint">
        Not financial advice. DYOR. Every live value is read from a public PulseChain RPC via a
        fallback transport; re-verify on-chain before acting.
      </p>
    </div>
  );
}
