// Module B — route+size selector (the upper half of the /mint "mint" tab). Read-only
// profitability analysis of every clean mint route. Receives the loop count from the parent
// (derived from the user's ␀ / pStable input + the mode toggle). The best route is
// auto-selected; clicking a row's radio button selects it. The selection is reported live via
// `onSelect` so the execute panel below can drive the user's own batcher for the same route +
// size — no tab switching.
//
// Per-route granularity: each route's loops are clamped to the route's whole-token
// granularity (MATH=1, G5=5, PI=100) before profitability is computed. Routes whose clamped
// loops would be 0 (amount below the route's minimum) are shown as "min not met" and are not
// selectable. This prevents the subtle bug where the table showed profitability at an
// unclamped loop count that execution would later floor to 0.
import { Panel } from "@/components/ui/Panel";
import { MINT_ROUTES, STABLES } from "@/config/mint";
import { AFFECTION_ADDR } from "@/config/registry";
import { useMintBalances } from "@/hooks/useMintBalances";
import { useMintData } from "@/hooks/useMintData";
import { useWallet } from "@/hooks/useWallet";
import { formatUnits } from "@/lib/format/units";
import {
  type MintRoute,
  computeMaxSafeLoops,
  computeRouteProfitability,
  recommendBest,
} from "@/lib/mint/profitability";
import { clampLoopsToGranularity } from "@/lib/mint/profitability";
import { planRoute } from "@/lib/mint/routePlan";
import { useEffect, useMemo, useState } from "react";
import { RouteFlow } from "./RouteFlow";

const E18 = 10n ** 18n;

export type ExecMode = "full" | "inter";

export type MintSelection = {
  intermediate: "G5" | "PI" | "MATH";
  stable: "pDAI" | "pUSDC";
  loops: bigint;
};

function bpsToPct(bps: bigint): string {
  const neg = bps < 0n;
  const abs = neg ? -bps : bps;
  return `${neg ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

/** Per-route profitability, with loops clamped to the route's granularity. */
type RouteResult = {
  route: MintRoute;
  profit: ReturnType<typeof computeRouteProfitability>;
  plan: ReturnType<typeof planRoute>;
  /** true when the clamped loops = 0 (amount below the route's minimum) */
  belowMinimum: boolean;
  /** the loops actually used (after granularity clamping) */
  effectiveLoops: bigint;
};

export function AutoRouter({
  loops,
  execMode,
  onSelect,
}: {
  loops: bigint;
  execMode: ExecMode;
  onSelect: (selection: MintSelection) => void;
}) {
  const { data, isLoading, isError, refetch } = useMintData();
  const wallet = useWallet();
  const balancesQ = useMintBalances(wallet.address);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const maxSafe = data ? computeMaxSafeLoops(data.affectionSupply, data.affectionCap) : 0n;
  const overCap = loops > maxSafe;
  const effectiveCapLoops = loops > maxSafe ? maxSafe : loops;

  // Compute per-route profitability with granularity clamping.
  const results: RouteResult[] = useMemo(() => {
    if (!data) return [];
    return MINT_ROUTES.map((route) => {
      const clampedLoops = clampLoopsToGranularity(effectiveCapLoops, route.loopGranularity);
      const belowMinimum = clampedLoops <= 0n;
      const profit = computeRouteProfitability(
        route,
        clampedLoops,
        data.affectionSupply,
        data.affectionCap,
        data.graph,
        AFFECTION_ADDR,
        STABLES[route.stable].address,
        STABLES[route.stable].decimals,
      );
      const plan = planRoute(
        route.intermediate as "MATH" | "G5" | "PI",
        route.stable,
        clampedLoops * 3n * E18,
        execMode,
      );
      return {
        route,
        profit,
        plan,
        belowMinimum,
        effectiveLoops: clampedLoops,
      };
    });
  }, [data, effectiveCapLoops, execMode]);

  // Auto-select the best route; allow manual override via radio.
  const best = useMemo(() => {
    const profitable = results.filter((r) => !r.belowMinimum && r.profit.exit !== null);
    if (profitable.length === 0) return null;
    return recommendBest(profitable.map((r) => r.profit)) ?? null;
  }, [results]);

  const focused = useMemo(() => {
    if (selectedId) return results.find((r) => r.route.id === selectedId) ?? null;
    if (best) return results.find((r) => r.route.id === best.route.id) ?? null;
    return null;
  }, [results, selectedId, best]);

  // Lift the current selection to the parent so the execute panel stays in sync.
  useEffect(() => {
    if (!focused || focused.belowMinimum) return;
    onSelect({
      intermediate: focused.route.intermediate as "G5" | "PI" | "MATH",
      stable: focused.route.stable,
      loops: focused.effectiveLoops,
    });
  }, [focused, onSelect]);

  if (isLoading || !data) {
    return (
      <Panel title="route + size">
        <p className="text-xs text-text-faint">reading supply + PulseX reserves…</p>
      </Panel>
    );
  }
  if (isError) {
    return (
      <Panel title="route + size">
        <p className="text-xs text-err">RPC read failed — retry.</p>
        <button
          type="button"
          className="text-xs text-info hover:underline"
          onClick={() => refetch()}
        >
          retry
        </button>
      </Panel>
    );
  }

  const bal = balancesQ.data;

  return (
    <div className="flex flex-col gap-4">
      {overCap && (
        <Panel title="route + size">
          <p className="text-xs text-warn">
            ⚠ size &gt; cap headroom ({maxSafe.toString()} safe loops ={" "}
            {Number(maxSafe * 3n).toLocaleString()} Ⓐ). The engine clamps — near the cap Generate()
            no-ops and BuyWith* would revert.
          </p>
        </Panel>
      )}

      {focused && !focused.belowMinimum ? (
        <Panel title="selected route — flow & profitability">
          <RouteFlow profit={focused.profit} />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-text-faint">
              {focused.route.intermediate} · {focused.route.stable} ·{" "}
              {focused.profit.exit
                ? `${focused.profit.profit >= 0n ? "profitable" : "unprofitable"} (${bpsToPct(focused.profit.profitBps)}%)`
                : "no DEX exit"}{" "}
              · {focused.plan.totalTxs.toString()} mint tx + {focused.plan.approvals.toString()}{" "}
              approval{focused.plan.approvals === 1n ? "" : "s"}
              {focused.plan.cappedByGas && " · ⚡ gas-capped (split loops)"}
            </span>
          </div>
        </Panel>
      ) : (
        <Panel title="selected route">
          {!focused || focused.belowMinimum ? (
            <p className="text-xs text-err">
              {results.every((r) => r.belowMinimum)
                ? "amount too small — the minimum mint is 3 Ⓐ (1 MATH loop). Larger routes need more: G5 = 15 Ⓐ, PI = 300 Ⓐ."
                : "no DEX exit path found for any route — Ⓐ may have no PulseX liquidity right now."}
            </p>
          ) : null}
        </Panel>
      )}

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
          {execMode === "inter" && (
            <p className="mt-2 text-xs text-text-faint">
              In “from intermediate” mode you spend MATH / G5 / PI you already hold. Check your
              balance above — the execute panel will pull the intermediate from your wallet.
            </p>
          )}
        </Panel>
      )}

      <Panel title="profitability table — all clean routes">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-text-faint">
                <th className="w-8 border border-border px-1 py-1" />
                <th className="border border-border px-2 py-1 text-left">route</th>
                <th className="border border-border px-2 py-1 text-left">Ⓐ minted</th>
                <th className="border border-border px-2 py-1 text-left">cost</th>
                <th className="border border-border px-2 py-1 text-left">profit</th>
                <th className="border border-border px-2 py-1 text-left">%</th>
                <th className="border border-border px-2 py-1 text-left">txs</th>
                <th className="border border-border px-2 py-1 text-left">gas</th>
                <th className="border border-border px-2 py-1 text-left">impact</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const isBest = best && r.route.id === best.route.id;
                const isFocused = focused && r.route.id === focused.route.id;
                const dec = STABLES[r.route.stable].decimals;
                const sym = r.route.stable;
                const profitColor =
                  r.profit.profit > 0n
                    ? "var(--c-ok)"
                    : r.profit.exit
                      ? "var(--c-err)"
                      : "var(--c-text-faint)";
                const estGas = r.effectiveLoops * r.plan.gasPerLoop;
                return (
                  <tr
                    key={r.route.id}
                    onClick={() => {
                      if (!r.belowMinimum) setSelectedId(r.route.id);
                    }}
                    onKeyDown={
                      r.belowMinimum
                        ? undefined
                        : (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedId(r.route.id);
                            }
                          }
                    }
                    tabIndex={r.belowMinimum ? -1 : 0}
                    className={`border border-border ${
                      r.belowMinimum
                        ? "opacity-40"
                        : `cursor-pointer ${isFocused ? "bg-accent/10" : "hover:bg-panel-2"}`
                    }`}
                  >
                    <td className="border border-border px-1 py-1 text-center">
                      <input
                        type="radio"
                        name="route"
                        checked={isFocused ?? false}
                        disabled={r.belowMinimum}
                        onChange={() => setSelectedId(r.route.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer accent-[var(--c-accent)]"
                        aria-label={`select ${r.route.id} route`}
                      />
                    </td>
                    <td className="border border-border px-2 py-1 text-text">
                      <span className="flex items-center gap-1.5">
                        {r.route.id}
                        {isBest && (
                          <span className="border border-accent-dim bg-accent/10 px-1 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider text-accent">
                            best
                          </span>
                        )}
                        {r.belowMinimum && (
                          <span className="text-text-faint">
                            (min {Number(r.route.loopGranularity * 3n).toLocaleString()} Ⓐ)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="border border-border px-2 py-1 text-text-dim">
                      {r.belowMinimum ? "—" : formatUnits(r.profit.affMinted, 18, 2)}
                    </td>
                    <td className="border border-border px-2 py-1 text-text-dim">
                      {r.belowMinimum ? "—" : `${formatUnits(r.profit.stableCost, dec, 2)} ${sym}`}
                    </td>
                    <td className="border border-border px-2 py-1" style={{ color: profitColor }}>
                      {r.belowMinimum || !r.profit.exit
                        ? "—"
                        : `${r.profit.profit >= 0n ? "+" : ""}${formatUnits(
                            r.profit.profit < 0n ? -r.profit.profit : r.profit.profit,
                            dec,
                            2,
                          )}`}
                    </td>
                    <td className="border border-border px-2 py-1" style={{ color: profitColor }}>
                      {r.belowMinimum || !r.profit.exit ? "—" : bpsToPct(r.profit.profitBps)}
                    </td>
                    <td className="border border-border px-2 py-1 text-text-dim">
                      {r.belowMinimum ? "—" : r.plan.totalTxs.toString()}
                      {r.plan.cappedByGas && <span className="text-warn"> ⚡</span>}
                    </td>
                    <td className="border border-border px-2 py-1 text-text-faint">
                      {r.belowMinimum ? "—" : formatGasShort(estGas)}
                    </td>
                    <td className="border border-border px-2 py-1 text-text-faint">
                      {r.belowMinimum || !r.profit.exit ? "—" : bpsToPct(r.profit.exit.slippageBps)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-text-faint">
          Select a route with the radio button (the best route is auto-selected).{" "}
          <span className="text-text-dim">txs</span> = atomic mint transactions via your batcher in{" "}
          {execMode === "inter" ? "intermediate" : "full"} mode (1 tx per batch, gas-capped routes
          split). <span className="text-text-dim">gas</span> = estimated total gas for the mint. ⚡
          = gas-capped. Routes greyed out when the amount is below their minimum. Profit excludes
          gas. Loops cap-clamped to {maxSafe.toString()} safe.
        </p>
      </Panel>
    </div>
  );
}

function formatGasShort(gas: bigint): string {
  const n = Number(gas);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toString();
}
