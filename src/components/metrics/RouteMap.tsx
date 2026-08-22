import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Panel } from "@/components/ui/Panel";
import { PULSEX_V2_FACTORY } from "@/config/pulsex";
import { usePulseXPairs } from "@/hooks/usePulseX";
import { shortenAddress } from "@/lib/format/address";
import { formatUnits } from "@/lib/format/units";
import { spotPrice } from "@/lib/pulsex/math";

function LiquidityGraph({
  pairs,
}: {
  pairs: {
    baseSymbol: string;
    quoteSymbol: string;
    baseReserve: bigint;
    quoteReserve: bigint;
    quoteDecimals: number;
    baseDecimals: number;
  }[];
}) {
  if (pairs.length === 0) {
    return <p className="text-xs text-text-faint">no pairs with liquidity discovered.</p>;
  }

  const maxLiquidity = pairs.reduce((max, p) => {
    const val = p.quoteReserve > p.baseReserve ? p.quoteReserve : p.baseReserve;
    return val > max ? val : max;
  }, 0n);

  return (
    <svg
      viewBox="0 0 600 400"
      className="w-full border border-border bg-panel-2"
      role="img"
      aria-label="PulseX liquidity graph"
    >
      <text x="12" y="20" className="fill-text-faint text-[10px]">
        pair liquidity (relative)
      </text>
      {pairs.map((p, i) => {
        const y = 40 + i * 28;
        const barWidth = Number((p.quoteReserve * 400n) / (maxLiquidity > 0n ? maxLiquidity : 1n));
        const price = spotPrice(p.baseReserve, p.quoteReserve);
        return (
          <g key={`${p.baseSymbol}-${p.quoteSymbol}-${i}`}>
            <text x="12" y={y + 10} className="fill-text text-[11px]">
              {p.baseSymbol}/{p.quoteSymbol}
            </text>
            <rect
              x="120"
              y={y}
              width={Math.max(barWidth, 2)}
              height="18"
              className="fill-accent opacity-70"
            />
            <text x="530" y={y + 10} className="fill-text-dim text-[9px]">
              {formatUnits(price, 18, 6)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function RouteMap() {
  const { data, isLoading, isError, refetch } = usePulseXPairs();

  if (isLoading) {
    return (
      <Panel title="PulseX route map · V1 + V2">
        <p className="text-xs text-text-faint">discovering pairs…</p>
      </Panel>
    );
  }

  if (isError || !data) {
    return (
      <Panel title="PulseX route map · V1 + V2">
        <p className="text-xs text-err">Failed to load pairs — RPC error.</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          retry
        </Button>
      </Panel>
    );
  }

  const sortedPairs = [...data.pairs].sort((a, b) =>
    b.quoteReserve > a.quoteReserve ? 1 : b.quoteReserve < a.quoteReserve ? -1 : 0,
  );
  const v1Count = data.pairs.filter((p) => p.factoryVersion === "V1").length;
  const v2Count = data.pairs.filter((p) => p.factoryVersion === "V2").length;

  return (
    <Panel
      title="PulseX route map · V1 + V2"
      actions={
        <span className="flex items-center gap-1 text-text-faint">
          V2 {shortenAddress(PULSEX_V2_FACTORY, 6)} · {v2Count} pairs · V1 {v1Count} pairs
          {data.totalPairs !== null && ` · ${Number(data.totalPairs).toLocaleString()} V2 total`}
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        {data.failedReads > 0 && (
          <p className="text-xs text-warn">
            ⚠ {data.failedReads} pair read{data.failedReads === 1 ? "" : "s"} failed — the map may
            be missing live pairs (RPC degradation, not absent liquidity). Check the RPC status bar;
            it re-discovers automatically.
          </p>
        )}
        <LiquidityGraph
          pairs={sortedPairs.map((p) => ({
            baseSymbol: p.baseSymbol,
            quoteSymbol: p.quoteSymbol,
            baseReserve: p.baseReserve,
            quoteReserve: p.quoteReserve,
            quoteDecimals: p.quoteDecimals,
            baseDecimals: p.baseDecimals,
          }))}
        />

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-text-faint">
                <th className="border border-border px-2 py-1 text-left">pair</th>
                <th className="border border-border px-2 py-1 text-left">ven</th>
                <th className="border border-border px-2 py-1 text-left">base reserve</th>
                <th className="border border-border px-2 py-1 text-left">quote reserve</th>
                <th className="border border-border px-2 py-1 text-left">price (quote/base)</th>
                <th className="border border-border px-2 py-1 text-left">pair address</th>
              </tr>
            </thead>
            <tbody>
              {sortedPairs.map((p) => (
                <tr key={`${p.pair}-${p.baseSymbol}-${p.quoteSymbol}-${p.factoryVersion}`}>
                  <td className="border border-border px-2 py-1 text-text">{p.label}</td>
                  <td className="border border-border px-2 py-1 text-text-faint">
                    {p.factoryVersion}
                  </td>
                  <td className="border border-border px-2 py-1 text-text-dim">
                    {formatUnits(p.baseReserve, p.baseDecimals, 2)} {p.baseSymbol}
                  </td>
                  <td className="border border-border px-2 py-1 text-text-dim">
                    {formatUnits(p.quoteReserve, p.quoteDecimals, 2)} {p.quoteSymbol}
                  </td>
                  <td className="border border-border px-2 py-1 text-info">
                    {formatUnits(spotPrice(p.baseReserve, p.quoteReserve), 18, 8)}
                  </td>
                  <td className="border border-border px-2 py-1 text-text-faint">
                    <span className="flex items-center gap-1">
                      {shortenAddress(p.pair, 8)}
                      <CopyButton value={p.pair} label="[⎘]" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs leading-snug text-text-faint">
          Discovered via <code>factory.getPair(token, quote)</code> for each ecosystem token ×
          WPLS/pDAI/pUSDC on BOTH PulseX V2 and V1, then <code>pair.getReserves()</code>. Price =
          spot (<code>reserveOut / reserveIn</code>); the 0.3% swap fee + slippage are not included
          (the auto-router in <code>/mint</code> computes effective prices across both venues).
          Pairs with zero reserves are filtered out. No multicall3 dependency — reads fan out to
          parallel <code>eth_call</code>s.
        </p>
      </div>
    </Panel>
  );
}
