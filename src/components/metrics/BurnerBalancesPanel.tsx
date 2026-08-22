import { CopyButton } from "@/components/ui/CopyButton";
import { Panel } from "@/components/ui/Panel";
import { useBurnerBalances } from "@/hooks/useBurnerBalances";
import { useSupply } from "@/hooks/useSupply";
import { shortenAddress } from "@/lib/format/address";
import { formatUnits } from "@/lib/format/units";

/** Shows how much Ⓐ each known ecosystem sink contract currently holds, read live
 *  via balanceOf (fast, no log scan). Complements the log-event burn scan. The tracked
 *  set is a lead, not ground truth; the on-chain balance is the verifiable part. */
export function BurnerBalancesPanel() {
  const { data, isLoading, isError } = useBurnerBalances();
  const supply = useSupply();
  const affSupply = supply.data?.affectionSupply;

  return (
    <Panel
      title="Ⓐ held/locked by ecosystem contracts"
      actions={
        data ? (
          <span className="text-text-faint">
            {data.entries.length} contracts · {formatUnits(data.totalHeld, 18, 0)} Ⓐ held
          </span>
        ) : undefined
      }
    >
      {isError ? (
        <p className="text-xs text-err">RPC read failed — see status bar.</p>
      ) : isLoading || !data ? (
        <p className="text-xs text-text-faint">reading balances…</p>
      ) : data.entries.length === 0 ? (
        <p className="text-xs text-text-faint">
          No known burner/locker contract currently holds Ⓐ (or the reads failed).
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-text-faint">
                  <th className="border border-border px-2 py-1 text-left">contract</th>
                  <th className="border border-border px-2 py-1 text-left">address</th>
                  <th className="border border-border px-2 py-1 text-left">Ⓐ held (live)</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.address}>
                    <td className="border border-border px-2 py-1 text-text">
                      {e.name}
                      {e.symbol && <span className="text-text-faint"> ({e.symbol})</span>}
                    </td>
                    <td className="border border-border px-2 py-1 text-info">
                      <span className="flex items-center gap-1">
                        {shortenAddress(e.address, 6)}
                        <CopyButton value={e.address} label="[⎘]" />
                      </span>
                    </td>
                    <td className="border border-border px-2 py-1 text-accent">
                      {formatUnits(e.balance, 18, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-text-faint">
              total held/locked:{" "}
              <span className="text-accent">{formatUnits(data.totalHeld, 18, 2)} Ⓐ</span>
            </span>
            {affSupply != null && affSupply > 0n && (
              <span className="text-text-faint">
                {(Number(data.totalHeld * 10000n) / Number(affSupply) / 100).toFixed(2)}% of supply
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-text-faint">
            Known sink contracts (the market-rate holders of the Dysnomia family — tracked set is a
            lead, not ground truth). The <span className="text-text-dim">held</span> column is a
            live <code>balanceOf</code> read — Ⓐ a contract currently holds may be burned
            (ERC20Burnable) or just locked (soft sink). This is a cheap read (one{" "}
            <code>balanceOf</code> per contract, parallel) — no log scan needed.
          </p>
        </div>
      )}
    </Panel>
  );
}
