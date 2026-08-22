import { Panel } from "@/components/ui/Panel";
import { useEcosystemSupply } from "@/hooks/useEcosystemSupply";
import { cn } from "@/lib/cn";
import { formatCompact, formatUnits } from "@/lib/format/units";

function Gauge({ pctFilled, tone = "accent" }: { pctFilled: bigint; tone?: string }) {
  const w = pctFilled > 10000n ? 10000n : pctFilled;
  const pct = Number(w) / 100;
  return (
    <div className="h-2 w-full border border-border bg-panel-2">
      <div
        className={cn("h-full", tone === "accent" ? "bg-accent" : "bg-info")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function SupplyGauges() {
  const { data, isLoading, isError } = useEcosystemSupply();

  if (isError) {
    return (
      <Panel title="ecosystem supply">
        <p className="text-xs text-err">RPC read failed — see status bar.</p>
      </Panel>
    );
  }

  if (isLoading || !data) {
    return (
      <Panel title="ecosystem supply">
        <p className="text-xs text-text-faint">fetching…</p>
      </Panel>
    );
  }

  const capped = data.entries.filter((e) => e.capBase !== null);
  const uncapped = data.entries.filter((e) => e.capBase === null);

  return (
    <Panel
      title="ecosystem supply · all tokens"
      actions={
        <span className="text-text-faint">fetched {data.fetchedAt.toLocaleTimeString()}</span>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-text-faint">
            capped tokens (headroom)
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {capped.map((e) => (
              <div
                key={e.token.address}
                className="flex flex-col gap-1.5 border border-border bg-panel-2 px-3 py-2"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-text">{e.token.display ?? e.token.name}</span>
                  {e.token.symbol && (
                    <span className="text-xs text-text-dim">{e.token.symbol}</span>
                  )}
                </div>
                <div className="text-sm text-text">
                  {formatCompact(e.supply, e.token.decimals)}{" "}
                  <span className="text-text-faint">/ {formatCompact(e.capBase ?? 0n, 18)}</span>
                </div>
                {e.pctFilled !== null && e.remaining !== null && (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs text-text-dim">
                      <span>{formatUnits(e.pctFilled * 100n, 4, 2)}% filled</span>
                      <span>{formatCompact(e.remaining, 18)} remaining</span>
                    </div>
                    <Gauge pctFilled={e.pctFilled} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-text-faint">
            ecosystem tokens (supply)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-text-faint">
                  <th className="border border-border px-2 py-1 text-left">token</th>
                  <th className="border border-border px-2 py-1 text-left">symbol</th>
                  <th className="border border-border px-2 py-1 text-left">supply</th>
                  <th className="border border-border px-2 py-1 text-left">dec</th>
                  <th className="border border-border px-2 py-1 text-left">mint</th>
                </tr>
              </thead>
              <tbody>
                {uncapped.map((e) => (
                  <tr key={e.token.address}>
                    <td className="border border-border px-2 py-1 text-text">
                      {e.token.display ?? e.token.name}
                    </td>
                    <td className="border border-border px-2 py-1 text-text-dim">
                      {e.token.symbol ?? "—"}
                    </td>
                    <td className="border border-border px-2 py-1 text-text">
                      {formatUnits(e.supply, e.token.decimals, 2)}
                    </td>
                    <td className="border border-border px-2 py-1 text-text-dim">
                      {e.token.decimals}
                    </td>
                    <td
                      className={cn(
                        "border border-border px-2 py-1",
                        e.token.stillMintable ? "text-ok" : "text-text-faint",
                      )}
                    >
                      {e.token.stillMintable ? "yes" : "no"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Panel>
  );
}
