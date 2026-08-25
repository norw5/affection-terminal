import { RouteMap } from "@/components/metrics/RouteMap";
import { SupplyGauges } from "@/components/metrics/SupplyGauges";
import { Panel } from "@/components/ui/Panel";
import { Link } from "@tanstack/react-router";

export function Metrics() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <section className="flex flex-col gap-1">
        <h1 className="text-xl text-accent">Metrics &amp; Ecosystem Discovery</h1>
        <p className="text-text-dim">
          Client-side metrics read straight from PulseChain via the fallback RPC pool. No multicall3
          dependency (it's absent on PulseChain — verified). No backend, no telemetry. Re-verify
          everything on-chain before acting.
        </p>
      </section>

      <SupplyGauges />

      <RouteMap />

      <Panel title="how these are computed">
        <div className="flex flex-col gap-2 text-sm leading-relaxed text-text-dim">
          <p>
            <span className="text-text">Supply headroom</span> — <code>totalSupply()</code> vs the
            cap for AFFECTION + MATH (both 1,111,111,111), plus G5/PI/RNG/Fa/Faung supplies. Read
            via parallel <code>eth_call</code>s (no multicall3 — see{" "}
            <code>src/config/chain.ts</code>). Polled every ~20s.
          </p>
          <p>
            <span className="text-text">Live route map</span> — PulseX V2
            <code> factory.getPair(token, quote)</code> for each ecosystem token × WPLS/pDAI/pUSDC
            (plus the WPLS/pDAI, WPLS/pUSDC, pDAI/pUSDC cross-quote pairs — the on-ramp from native
            to the pStables minting needs), then <code>pair.getReserves()</code> for liquidity +
            spot price. The factory (<code>0x1715…a10d</code>) was discovered on-chain by calling{" "}
            <code>factory()</code> on a live pair; 65k+ pairs verified.
          </p>
          <p>
            The auto-router + profitability engine (with slippage + the 0.3% fee) lands in{" "}
            <Link to="/mint" className="text-info hover:underline">
              /mint
            </Link>{" "}
            (Module B, P4).
          </p>
        </div>
      </Panel>
    </div>
  );
}
