import { useRpcStatus } from "@/hooks/useRpcStatus";
import { headroom, useSupply } from "@/hooks/useSupply";
import { useWallet } from "@/hooks/useWallet";
import { shortenAddress } from "@/lib/format/address";
import { formatCompact, formatPct } from "@/lib/format/units";

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Bottom status bar (tmux-style). Shows network/RPC/block/latency + supply + wallet. */
export function RpcStatusBar() {
  const rpc = useRpcStatus();
  const supply = useSupply();
  const wallet = useWallet();

  const primary = rpc.data?.primary;
  const block = primary?.blockNumber;
  const latency = primary?.latencyMs;
  const aff = supply.data;
  const fill = aff ? headroom(aff.affectionSupply, aff.affectionCap).pctFilled : undefined;

  return (
    <footer className="flex items-center gap-4 overflow-x-auto border-t border-border bg-panel px-3 py-1 text-xs text-text-dim whitespace-nowrap">
      <span>
        [net: <span className="text-text">PLS 369</span>]
      </span>
      <span>
        [rpc:{" "}
        <span className={primary ? "text-ok" : "text-err"}>
          {primary ? hostOf(primary.url) : "offline"}
        </span>
        {primary ? " ●" : " ○"}]
      </span>
      {block != null && (
        <span>
          [block: <span className="text-text">{Number(block).toLocaleString()}</span>]
        </span>
      )}
      {latency != null && <span>[{latency}ms]</span>}
      <span className="ml-auto" />
      {aff && (
        <span>
          [Ⓐ <span className="text-text">{formatCompact(aff.affectionSupply, 18)}</span> / 1.11B
          {fill !== undefined && (
            <span className="text-text-faint"> {formatPct(fill, 100n, 1)}</span>
          )}
          ]
        </span>
      )}
      <span>
        [wallet:{" "}
        <span className={wallet.isConnected ? "text-text" : "text-text-faint"}>
          {wallet.address ? shortenAddress(wallet.address) : "disconnected"}
        </span>
        {wallet.isWrongChain && <span className="text-err"> (wrong chain)</span>}]
      </span>
    </footer>
  );
}
