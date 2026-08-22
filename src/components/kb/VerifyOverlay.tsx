import { Button } from "@/components/ui/Button";
import { useVerifyChain } from "@/hooks/useVerifyChain";
import { cn } from "@/lib/cn";

function StatusBadge({ status }: { status: "ok" | "fail" | "error" | "idle" }) {
  const map = {
    idle: { cls: "border-border-bright text-text-faint", glyph: "○" },
    ok: { cls: "border-ok/40 text-ok", glyph: "✓" },
    fail: { cls: "border-err/40 text-err", glyph: "✗" },
    error: { cls: "border-warn/40 text-warn", glyph: "!" },
  } as const;
  const m = map[status];
  return (
    <span
      className={cn("inline-flex w-5 items-center justify-center border", m.cls)}
      title={status}
    >
      {m.glyph}
    </span>
  );
}

/** The per-fact "verify against chain" overlay (Module A). Re-runs the canonical
 *  `eth_call`s from affection_docs/sources.md §2 against the live publicClient and shows
 *  ✓/✗/! per fact. ✓ = immutable invariant holds (decimals match; supply ≤ cap; buffer ≈0);
 *  ✗ = invariant violated; ! = the read itself failed (RPC/contract, not the invariant). */
export function VerifyOverlay() {
  const { facts, results, isVerifying, lastRun, verify, reset } = useVerifyChain();

  const ok = Object.values(results).filter((r) => r.status === "ok").length;
  const fail = Object.values(results).filter((r) => r.status === "fail").length;
  const err = Object.values(results).filter((r) => r.status === "error").length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="accent" size="sm" disabled={isVerifying} onClick={verify}>
          {isVerifying ? "verifying…" : "verify against chain"}
        </Button>
        {lastRun && (
          <span className="text-xs text-text-faint">
            last run {lastRun.toLocaleTimeString()} · <span className="text-ok">{ok} ok</span>
            {fail > 0 && <span className="text-err"> · {fail} fail</span>}
            {err > 0 && <span className="text-warn"> · {err} error</span>}
          </span>
        )}
        {lastRun && !isVerifying && (
          <Button variant="ghost" size="sm" onClick={reset}>
            clear
          </Button>
        )}
      </div>

      <p className="text-xs leading-snug text-text-faint">
        Re-runs the canonical <code>eth_call</code>s from <code>sources.md §2</code> via the
        fallback RPC pool. ✓ = immutable invariant holds (decimals match, supply ≤ cap, buffer ≈0);
        ✗ = invariant violated; ! = the read itself failed (RPC, not the invariant). Supply values
        drift via minting + burns — the snapshot column is for comparison, not a gate.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-text-faint">
              <th className="border border-border px-2 py-1 text-left">fact</th>
              <th className="border border-border px-2 py-1 text-left">live · doc · cap</th>
              <th className="border border-border px-2 py-1 text-left">note</th>
              <th className="border border-border px-2 py-1 text-left">st</th>
            </tr>
          </thead>
          <tbody>
            {facts.map((f) => {
              const r = results[f.id];
              const status = r?.status ?? "idle";
              return (
                <tr key={f.id}>
                  <td className="border border-border px-2 py-1">
                    <div className="text-text">{f.label}</div>
                    <div className="text-[0.625rem] text-text-faint">{f.symbol}</div>
                  </td>
                  <td className="border border-border px-2 py-1 text-text-dim">
                    {r ? r.detail : <span className="text-text-faint">—</span>}
                  </td>
                  <td className="border border-border px-2 py-1 text-xs text-text-faint">
                    {f.note ?? ""}
                  </td>
                  <td className="border border-border px-2 py-1 text-center">
                    <StatusBadge status={status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
