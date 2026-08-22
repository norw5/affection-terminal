// Module B — Tier 1: Auto-Router. Read-only profitability analysis of every clean mint
// route at a chosen target Ⓐ amount. The input is a single "Ⓐ to mint" number — loops are
// auto-derived (loops = amount / 3, since Generate() mints exactly 3 Ⓐ per call). Each
// route's transaction count is shown (different routes need different tx counts due to
// contract mechanics + per-tx gas limits). Any route can be selected and sent to Tier 2.
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { MINT_ROUTES, STABLES } from "@/config/mint";
import { AFFECTION_ADDR } from "@/config/registry";
import { useMintBalances } from "@/hooks/useMintBalances";
import { useMintData } from "@/hooks/useMintData";
import { useWallet } from "@/hooks/useWallet";
import { formatUnits } from "@/lib/format/units";
import {
  computeMaxSafeLoops,
  computeRouteProfitability,
  recommendBest,
} from "@/lib/mint/profitability";
import { planRoute } from "@/lib/mint/routePlan";
import type { MintPreset } from "@/routes/Mint";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RouteFlow } from "./RouteFlow";

const E18 = 10n ** 18n;

function bpsToPct(bps: bigint): string {
  const neg = bps < 0n;
  const abs = neg ? -bps : bps;
  return `${neg ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

export function AutoRouter({ onMint }: { onMint: (preset: MintPreset) => void }) {
  const { data, isLoading, isError, refetch } = useMintData();
  const wallet = useWallet();
  const balancesQ = useMintBalances(wallet.address);
  const [affAmount, setAffAmount] = useState(300);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const affBase = BigInt(Math.round(affAmount * 1e18));
  const loops = affBase / (3n * E18);
  const actualAff = loops * 3n * E18;

  const profits = useMemo(() => {
    if (!data) return [];
    return MINT_ROUTES.map((route) => {
      const st = STABLES[route.stable];
      return computeRouteProfitability(
        route,
        loops,
        data.affectionSupply,
        data.affectionCap,
        data.graph,
        AFFECTION_ADDR,
        st.address,
        st.decimals,
      );
    });
  }, [data, loops]);

  const best = useMemo(() => recommendBest(profits), [profits]);
  const maxSafe = data ? computeMaxSafeLoops(data.affectionSupply, data.affectionCap) : 0n;
  const overCap = loops > maxSafe;

  const plans = useMemo(
    () =>
      MINT_ROUTES.map((route) =>
        planRoute(route.intermediate as "MATH" | "G5" | "PI", route.stable, actualAff),
      ),
    [actualAff],
  );

  const focused = useMemo(() => {
    if (selectedId) return profits.find((p) => p.route.id === selectedId) ?? best ?? null;
    return best ?? null;
  }, [profits, selectedId, best]);

  const focusedPlan = useMemo(
    () => (focused ? (plans.find((p) => p.routeId === focused.route.id) ?? null) : null),
    [plans, focused],
  );

  if (isLoading || !data) {
    return (
      <Panel title="auto-router">
        <p className="text-xs text-text-faint">reading supply + PulseX reserves…</p>
      </Panel>
    );
  }
  if (isError) {
    return (
      <Panel title="auto-router">
        <p className="text-xs text-err">RPC read failed — retry.</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          retry
        </Button>
      </Panel>
    );
  }

  const bal = balancesQ.data;

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="auto-router — live routes"
        actions={
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1 text-text-faint" htmlFor="aff-amount">
              Ⓐ to mint
              <input
                id="aff-amount"
                type="number"
                min={3}
                step={3}
                value={affAmount}
                onChange={(e) => setAffAmount(Math.max(0, Number(e.target.value || "0")))}
                className="w-28 border border-border bg-panel-2 px-2 py-1 text-text focus-ring"
              />
            </label>
            <span className="text-text-faint">
              = {Number(loops).toLocaleString()} loops · {formatUnits(actualAff, 18, 0)} Ⓐ · cost{" "}
              {formatUnits(actualAff, 18, 0)} pStable
            </span>
          </div>
        }
      >
        {overCap && (
          <p className="mb-2 text-xs text-warn">
            ⚠ size &gt; cap headroom ({maxSafe.toString()} safe loops ={" "}
            {Number(maxSafe * 3n).toLocaleString()} Ⓐ). The engine clamps — near the cap Generate()
            no-ops and BuyWith* would revert.
          </p>
        )}
        {focused ? (
          <RouteFlow profit={focused} />
        ) : (
          <p className="text-xs text-err">
            no DEX exit path found for any route — Ⓐ may have no PulseX liquidity right now.
          </p>
        )}
        {focused && focusedPlan && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="accent"
              size="sm"
              onClick={() =>
                onMint({
                  intermediate: focused.route.intermediate as "G5" | "PI" | "MATH",
                  stable: focused.route.stable,
                  loops,
                })
              }
            >
              mint this route ▸
            </Button>
            <span className="text-xs text-text-faint">
              {focused.route.intermediate} · {focused.route.stable} ·{" "}
              {focused.exit
                ? `${focused.profit >= 0n ? "profitable" : "unprofitable"} (${bpsToPct(focused.profitBps)}%)`
                : "no DEX exit"}{" "}
              · {focusedPlan.totalTxs.toString()} tx + {focusedPlan.approvals.toString()} approvals
            </span>
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-text-faint">
          <span className="text-text-dim">Loops</span> = Generate() calls (each mints exactly 3 Ⓐ).
          Cost = Ⓐ amount (the 1 pStable/Ⓐ floor). Different routes need different tx counts due to
          contract mechanics + per-tx gas limits (measured ~40k gas per Generate(), so ~1000 calls
          max per tx). The PI route has a contract bug (only 1 PI per call = 300 Ⓐ per tx), so it
          needs many txs for larger amounts. Approvals are one-time max per route. Use{" "}
          <Link to="/batcher" className="text-info hover:underline">
            /batcher
          </Link>{" "}
          for a single-tx atomic mint (no multi-tx, no sandwich window).
        </p>
      </Panel>

      {wallet.isConnected && bal && (
        <Panel title="your wallet · mint-relevant balances">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {(
              [
                ["pDAI", bal.pDAI, 18],
                ["pUSDC", bal.pUSDC, 6],
                ["MATH", bal.MATH, 18],
                ["G5", bal.G5, 18],
                ["PI", bal.PI, 18],
                ["Ⓐ", bal.AFFECTION, 18],
              ] as Array<[string, bigint, number]>
            ).map(([sym, v, dec]) => (
              <div key={sym} className="border border-border bg-panel-2 px-2 py-1.5">
                <div className="text-text-faint">{sym}</div>
                <div className="truncate text-text">{formatUnits(v, dec, 2)}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-faint">
            Holding MATH / G5 / PI? Tier 2 can start from the intermediate and skip the pStable leg.
          </p>
        </Panel>
      )}

      <Panel title="profitability table — all clean routes">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-text-faint">
                <th className="border border-border px-2 py-1 text-left">route</th>
                <th className="border border-border px-2 py-1 text-left">Ⓐ minted</th>
                <th className="border border-border px-2 py-1 text-left">cost</th>
                <th className="border border-border px-2 py-1 text-left">profit</th>
                <th className="border border-border px-2 py-1 text-left">%</th>
                <th className="border border-border px-2 py-1 text-left">txs</th>
                <th className="border border-border px-2 py-1 text-left">signs</th>
                <th className="border border-border px-2 py-1 text-left">impact</th>
              </tr>
            </thead>
            <tbody>
              {profits.map((p) => {
                const isBest = best && p.route.id === best.route.id;
                const isFocused = focused && p.route.id === focused.route.id;
                const dec = STABLES[p.route.stable].decimals;
                const sym = p.route.stable;
                const plan = plans.find((pl) => pl.routeId === p.route.id);
                const profitColor =
                  p.profit > 0n ? "var(--c-ok)" : p.exit ? "var(--c-err)" : "var(--c-text-faint)";
                return (
                  <tr
                    key={p.route.id}
                    tabIndex={0}
                    className={`cursor-pointer ${isFocused ? "bg-accent/10" : "hover:bg-panel-2"} focus-ring`}
                    onClick={() => setSelectedId(isFocused ? null : p.route.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(isFocused ? null : p.route.id);
                      }
                    }}
                  >
                    <td className="border border-border px-2 py-1 text-text">
                      {isBest && <span className="text-accent">▸ </span>}
                      {p.route.id}
                      {isFocused && <span className="text-text-faint"> · focus</span>}
                    </td>
                    <td className="border border-border px-2 py-1 text-text-dim">
                      {formatUnits(p.affMinted, 18, 2)}
                    </td>
                    <td className="border border-border px-2 py-1 text-text-dim">
                      {formatUnits(p.stableCost, dec, 2)} {sym}
                    </td>
                    <td className="border border-border px-2 py-1" style={{ color: profitColor }}>
                      {p.exit
                        ? `${p.profit >= 0n ? "+" : ""}${formatUnits(
                            p.profit < 0n ? -p.profit : p.profit,
                            dec,
                            2,
                          )}`
                        : "—"}
                    </td>
                    <td className="border border-border px-2 py-1" style={{ color: profitColor }}>
                      {p.exit ? bpsToPct(p.profitBps) : "—"}
                    </td>
                    <td className="border border-border px-2 py-1 text-text-dim">
                      {plan ? plan.totalTxs.toString() : "—"}
                      {plan?.cappedByGas && <span className="text-warn"> ⚡</span>}
                    </td>
                    <td className="border border-border px-2 py-1 text-text-faint">
                      {plan ? plan.totalSigns.toString() : "—"}
                    </td>
                    <td className="border border-border px-2 py-1 text-text-faint">
                      {p.exit ? bpsToPct(p.exit.slippageBps) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-text-faint">
          Click a row to focus its route flow above. <span className="text-text-dim">txs</span> =
          mint transactions needed (intermediate + AFFECTION), capped at ~1000 Generate() calls per
          tx (measured gas). <span className="text-text-dim">signs</span> = total wallet signatures
          (txs + 2 one-time approvals). ⚡ = gas-capped (needs multiple Generate() batches). Profit
          excludes gas. Loops cap-clamped to {maxSafe.toString()} safe.
        </p>
      </Panel>
    </div>
  );
}
