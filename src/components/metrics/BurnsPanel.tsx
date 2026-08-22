import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Panel } from "@/components/ui/Panel";
import { useBurnTotals } from "@/hooks/useBurnTotals";
import { type BurnScanMode, useBurns } from "@/hooks/useBurns";
import { useSupply } from "@/hooks/useSupply";
import { shortenAddress } from "@/lib/format/address";
import { formatUnits } from "@/lib/format/units";
import { burnPctOfSupply } from "@/lib/metrics/burns";

const MODES: Array<{ id: Exclude<BurnScanMode, "idle">; label: string }> = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "max", label: "2M blocks (~231d)" },
];

export function BurnsPanel() {
  const totals = useBurnTotals();
  const { state, scan, cancel, reset } = useBurns();
  const supply = useSupply();
  const affSupply = supply.data?.affectionSupply;

  return (
    <Panel title="burns · Ⓐ sent to burn addresses">
      <div className="flex flex-col gap-4">
        {/* Instant totals via balanceOf — no log scan needed */}
        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-text-faint">
            current totals (instant · balanceOf)
          </div>
          {totals.isLoading ? (
            <p className="text-xs text-text-faint">reading burn-address balances…</p>
          ) : totals.isError ? (
            <p className="text-xs text-err">RPC read failed — see status bar.</p>
          ) : totals.data ? (
            <div className="flex flex-col gap-2">
              {totals.data.degraded && (
                <p className="text-xs text-warn">
                  ⚠ some burn-address reads failed — the zeros above are RPC errors, not real
                  balances. Check the RPC status bar; totals refresh automatically.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="border border-border bg-panel-2 px-3 py-2">
                  <div className="text-xs uppercase tracking-wider text-text-faint">
                    total burned
                  </div>
                  <div className="text-lg text-err">{formatUnits(totals.data.total, 18, 2)} Ⓐ</div>
                </div>
                {totals.data.entries.map((e) => (
                  <div key={e.address} className="border border-border bg-panel-2 px-3 py-2">
                    <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-text-faint">
                      {e.label}
                      <CopyButton value={e.address} label="[⎘]" />
                    </div>
                    <div className="text-sm text-text-dim">{formatUnits(e.balance, 18, 2)} Ⓐ</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                {affSupply != null && affSupply > 0n && (
                  <span className="text-text-faint">
                    {burnPctOfSupply(totals.data.total, affSupply)} of supply
                  </span>
                )}
                <span className="text-text-faint">
                  Polled every 30s · 3 parallel <code>balanceOf</code> reads
                </span>
              </div>
              <p className="text-xs leading-relaxed text-text-faint">
                These totals reflect all Ⓐ sent to burn addresses via <code>transfer()</code> — the
                vast majority of ecosystem burns. If Ⓐ was burned via{" "}
                <code>ERC20Burnable.burn()</code> (which reduces <code>totalSupply</code> without
                crediting <code>balanceOf(0x0)</code>), that is NOT captured here. Use the log-event
                scan below for a complete historic breakdown.
              </p>
            </div>
          ) : null}
        </div>

        {/* Optional log-event scan for historic breakdown */}
        <div className="border-t border-border pt-3">
          <div className="mb-2 text-xs uppercase tracking-wider text-text-faint">
            historic breakdown (log scan · optional)
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {MODES.map((m) => (
              <Button
                key={m.id}
                variant={m.id === "max" ? "accent" : "default"}
                size="sm"
                disabled={state.isScanning}
                onClick={() => scan(m.id)}
              >
                {state.isScanning && state.mode === m.id ? "scanning…" : m.label}
              </Button>
            ))}
            {state.isScanning && (
              <Button variant="ghost" size="sm" onClick={cancel}>
                cancel
              </Button>
            )}
            {state.result && !state.isScanning && (
              <Button variant="ghost" size="sm" onClick={reset}>
                clear
              </Button>
            )}
          </div>

          {state.isScanning && (
            <div className="mt-2 flex flex-col gap-1">
              <div
                className="h-1.5 w-full border border-border bg-panel-2"
                role="progressbar"
                aria-valuenow={Math.round(state.progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`burn scan progress: ${Math.round(state.progress)}% (${state.chunksDone}/${state.chunksTotal} chunks)`}
                tabIndex={-1}
              >
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <span className="text-xs text-text-faint">
                {state.progress.toFixed(0)}% · chunk {state.chunksDone}/{state.chunksTotal} · 4
                parallel getLogs
              </span>
            </div>
          )}

          {state.error && <p className="mt-2 text-xs text-err">{state.error}</p>}

          {state.result && (
            <div className="mt-3 flex flex-col gap-2">
              {state.cancelled && (
                <p className="text-xs text-warn">
                  ⚠ cancelled mid-scan — the numbers below are partial.
                </p>
              )}
              {state.chunksFailed > 0 && (
                <p className="text-xs text-warn">
                  ⚠ {state.chunksFailed}/{state.chunksTotal} chunks failed (RPC limits) — the
                  numbers below may undercount. Try a shorter window or re-run the scan.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="border border-border bg-panel-2 px-3 py-2">
                  <div className="text-xs uppercase tracking-wider text-text-faint">
                    burned (in range)
                  </div>
                  <div className="text-lg text-err">
                    {formatUnits(state.result.totalBurned, 18, 4)} Ⓐ
                  </div>
                </div>
                <div className="border border-border bg-panel-2 px-3 py-2">
                  <div className="text-xs uppercase tracking-wider text-text-faint">events</div>
                  <div className="text-lg text-text">{state.result.count}</div>
                </div>
                <div className="border border-border bg-panel-2 px-3 py-2">
                  <div className="text-xs uppercase tracking-wider text-text-faint">
                    % of supply
                  </div>
                  <div className="text-lg text-text-dim">
                    {affSupply ? burnPctOfSupply(state.result.totalBurned, affSupply) : "—"}
                  </div>
                </div>
              </div>

              {Object.keys(state.result.byAddress).length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="text-text-faint">
                        <th className="border border-border px-2 py-1 text-left">burn target</th>
                        <th className="border border-border px-2 py-1 text-left">amount</th>
                        <th className="border border-border px-2 py-1 text-left">count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(state.result.byAddress).map(([addr, { total, count }]) => (
                        <tr key={addr}>
                          <td className="border border-border px-2 py-1 text-info">
                            <span className="flex items-center gap-1">
                              {shortenAddress(addr, 8)}
                              <CopyButton value={addr} label="[⎘]" />
                            </span>
                          </td>
                          <td className="border border-border px-2 py-1 text-err">
                            {formatUnits(total, 18, 4)} Ⓐ
                          </td>
                          <td className="border border-border px-2 py-1 text-text-dim">{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {state.result.fromBlock !== null && state.result.toBlock !== null && (
                <p className="text-xs text-text-faint">
                  blocks {state.result.fromBlock.toString()}–{state.result.toBlock.toString()} (
                  {Number(state.result.toBlock - state.result.fromBlock).toLocaleString()} blocks
                  scanned{state.chunksTotal ? `, ${state.chunksTotal} chunks` : ""})
                </p>
              )}
            </div>
          )}

          <p className="mt-2 text-xs leading-relaxed text-text-faint">
            Scans <code>Transfer</code> events on the AFFECTION contract where the recipient is{" "}
            <code>0x0</code>, <code>0xdEaD</code>, or <code>0x369</code>. Time windows estimate
            block counts from the live block time. Chunks run 4-at-a-time (parallel) — you can
            cancel mid-scan. This catches both <code>transfer()</code> and <code>burn()</code>{" "}
            events (the instant totals above only catch transfers).
          </p>
        </div>
      </div>
    </Panel>
  );
}
