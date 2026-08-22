import { AutoRouter } from "@/components/mint/AutoRouter";
import { CustomMint } from "@/components/mint/CustomMint";
import { RawConsole } from "@/components/mint/RawConsole";
import { Concept } from "@/components/ui/PhaseNotice";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useState } from "react";

export type MintPreset = {
  intermediate: "G5" | "PI" | "MATH";
  stable: "pDAI" | "pUSDC";
  loops: bigint;
};

export function Mint() {
  const [tab, setTab] = useState("auto");
  const [preset, setPreset] = useState<MintPreset | null>(null);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <section className="flex flex-col gap-1">
        <h1 className="text-xl text-accent">Minting Terminal</h1>
        <p className="text-text-dim">
          Route pStable → an ecosystem intermediate → Ⓐ AFFECTION, then sell on PulseX. The contract
          rates are fixed; the market floats — the gap is the arbitrage. Every live value is read
          from PulseChain RPCs; nothing is auto-signed.
        </p>
      </section>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="auto">tier 1 · auto-router</TabsTrigger>
          <TabsTrigger value="custom">tier 2 · custom</TabsTrigger>
          <TabsTrigger value="raw">tier 3 · raw console</TabsTrigger>
        </TabsList>
        <TabsContent value="auto">
          <AutoRouter
            onMint={(p) => {
              setPreset(p);
              setTab("custom");
            }}
          />
        </TabsContent>
        <TabsContent value="custom">
          <CustomMint preset={preset} onConsumedPreset={() => setPreset(null)} />
        </TabsContent>
        <TabsContent value="raw">
          <RawConsole />
        </TabsContent>
      </Tabs>

      <Concept title="the three tiers">
        <p>
          AFFECTION cannot be minted directly with a stablecoin — you route through an{" "}
          <em>intermediate</em> ecosystem token (G5 / PI / MATH), then redeem it for Ⓐ via a{" "}
          <code>BuyWith*</code> function. All three clean routes converge on the{" "}
          <strong>1 pStable / 1 Ⓐ floor</strong> (verified on-chain); the only variable is gas and
          which intermediate is cheapest to source.
        </p>
        <ul className="flex flex-col gap-1 pl-1">
          <li>
            <span className="text-text">Tier 1 — Auto-Router:</span> profitability of every clean
            route at a chosen size, with the best route + its exact call sequence. Read-only. Pick
            any route and send it to Tier 2 to mint.
          </li>
          <li>
            <span className="text-text">Tier 2 — Custom:</span> pick route + size, then execute the
            explicit mint steps (approve → multi-mint). Each step is pre-simulated and user-signed.
            You can start from pStable or skip straight to the intermediate if you already hold it.
          </li>
          <li>
            <span className="text-text">Tier 3 — Raw Console:</span> paste any address + ABI,
            encode/decode calldata, simulate (eth_call) or send.
          </li>
        </ul>
      </Concept>
    </div>
  );
}
