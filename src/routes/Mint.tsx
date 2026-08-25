import { AutoRouter, type ExecMode, type MintSelection } from "@/components/mint/AutoRouter";
import { type ActiveBatcher, BatcherBar } from "@/components/mint/BatcherBar";
import { MintExecute } from "@/components/mint/MintExecute";
import { RawConsole } from "@/components/mint/RawConsole";
import { Panel } from "@/components/ui/Panel";
import { Concept } from "@/components/ui/PhaseNotice";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { INTERMEDIATES } from "@/config/mint";
import { formatUnits } from "@/lib/format/units";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";

type InputMode = "aff" | "spend";

const DEFAULT_SELECTION: MintSelection = {
  intermediate: "MATH",
  stable: "pDAI",
  loops: 100n,
};

export function Mint() {
  const [tab, setTab] = useState("mint");
  const [selection, setSelection] = useState<MintSelection>(DEFAULT_SELECTION);
  const [activeBatcher, setActiveBatcher] = useState<ActiveBatcher | null>(null);

  // The "mint amount" panel state — owns the input + mode, derives loops.
  const [inputMode, setInputMode] = useState<InputMode>("aff");
  const [inputAmount, setInputAmount] = useState(300);
  const [execMode, setExecMode] = useState<ExecMode>("full");

  // Derive loops from the input mode + amount.
  // aff mode:        loops = affAmount / 3  (Generate() mints 3 Ⓐ per call)
  // spend mode:      loops = spendAmount / 3  (full: pStable 1:1 with Ⓐ → 3 pStable per loop)
  //                  inter: depends on the selected route's intermediate perLoop — but the
  //                  spend input is only shown in full mode, so the 1:1 floor always holds.
  const loops = BigInt(Math.max(0, Math.round(inputAmount))) / 3n;

  const handleSelect = useCallback((s: MintSelection) => setSelection(s), []);
  const handleBatcher = useCallback((b: ActiveBatcher | null) => setActiveBatcher(b), []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <section className="flex flex-col gap-1">
        <h1 className="text-xl text-accent">Minting Terminal</h1>
        <p className="text-text-dim">
          Route pStable → an ecosystem intermediate → Ⓐ AFFECTION, then sell on PulseX. The contract
          rates are fixed; the market floats — the gap is the arbitrage. Minting happens through{" "}
          <em>your own</em> atomic batcher contract (deploy one at{" "}
          <Link to="/batcher" className="text-info hover:underline">
            /batcher
          </Link>
          ). Every live value is read from PulseChain RPCs; nothing is auto-signed.
        </p>
      </section>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mint">mint</TabsTrigger>
          <TabsTrigger value="raw">raw console</TabsTrigger>
        </TabsList>
        <TabsContent value="mint">
          <div className="flex flex-col gap-4">
            <BatcherBar onActiveBatcher={handleBatcher} />

            <MintAmountPanel
              inputMode={inputMode}
              setInputMode={setInputMode}
              inputAmount={inputAmount}
              setInputAmount={setInputAmount}
              execMode={execMode}
              setExecMode={setExecMode}
              loops={loops}
              selection={selection}
            />

            <AutoRouter loops={loops} execMode={execMode} onSelect={handleSelect} />

            {activeBatcher ? (
              <MintExecute batcher={activeBatcher} selection={selection} execMode={execMode} />
            ) : (
              <div className="border border-border bg-panel-2 px-3 py-4 text-xs text-text-dim">
                Select or deploy a batcher above to unlock mint execution. Route estimates are
                read-only until then.
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="raw">
          <RawConsole />
        </TabsContent>
      </Tabs>

      <Concept title="how minting works here">
        <p>
          AFFECTION cannot be minted directly with a stablecoin — you route through an{" "}
          <em>intermediate</em> ecosystem token (G5 / PI / MATH), then redeem it for Ⓐ via a{" "}
          <code>BuyWith*</code> function. All three clean routes converge on the{" "}
          <strong>1 pStable / 1 Ⓐ floor</strong> (verified on-chain); the only variable is gas and
          which intermediate is cheapest to source.
        </p>
        <ul className="flex flex-col gap-1 pl-1">
          <li>
            <span className="text-text">Spend mode:</span> “full route” spends pStable (pDAI/pUSDC)
            and mints the intermediate inside the batcher. “from intermediate” spends MATH/G5/PI you
            already hold — cheaper gas per loop (~40k vs ~148k on MATH), but you must hold the
            intermediate.
          </li>
          <li>
            <span className="text-text">Mint amount:</span> enter the Ⓐ to mint (in full mode you
            can also toggle to pStable to spend — 1:1 at the floor). Loops are auto-derived (1 loop
            = 3 Ⓐ). In “from intermediate” mode, the intermediate needed is shown for the selected
            route.
          </li>
          <li>
            <span className="text-text">Route + size:</span> profitability of every clean route at
            your size, with the best route auto-selected. Click any row to select it. Routes greyed
            out when the amount is below their minimum (G5 = 15 Ⓐ, PI = 300 Ⓐ).
          </li>
          <li>
            <span className="text-text">Execute:</span> the selected route runs through your own
            batcher in one atomic transaction — <code>mintFromStable</code> (full) or{" "}
            <code>multiBuyWith</code> (from intermediate). Each step is pre-simulated and
            user-signed; approvals are one-time max per token.
          </li>
        </ul>
      </Concept>
    </div>
  );
}

// ─── Mint amount panel ─────────────────────────────────────────────────────
//
// The spend mode (full / inter) is the top-level tab. The amount input below adapts:
//  - full mode:  "Ⓐ to mint" ↔ "pStable to spend" toggle (1:1 at the floor, so trivial)
//  - inter mode: only "Ⓐ to mint" (you're spending the intermediate, not pStable — the
//                intermediate needed varies per route and is shown for the selected route)

function MintAmountPanel({
  inputMode,
  setInputMode,
  inputAmount,
  setInputAmount,
  execMode,
  setExecMode,
  loops,
  selection,
}: {
  inputMode: InputMode;
  setInputMode: (m: InputMode) => void;
  inputAmount: number;
  setInputAmount: (n: number) => void;
  execMode: ExecMode;
  setExecMode: (m: ExecMode) => void;
  loops: bigint;
  selection: MintSelection;
}) {
  // In inter mode, force inputMode to "aff" (no pStable to spend).
  const effectiveInputMode = execMode === "inter" ? "aff" : inputMode;
  const label = effectiveInputMode === "aff" ? "Ⓐ to mint" : "pStable to spend";

  // Derived display info.
  const affMinted = loops * 3n;
  let derived: string;
  if (execMode === "full") {
    derived =
      effectiveInputMode === "aff"
        ? `${formatLoops(loops)} loops · cost ${Number(affMinted).toLocaleString()} pStable`
        : `${formatLoops(loops)} loops · mints ${Number(affMinted).toLocaleString()} Ⓐ`;
  } else {
    // inter mode — show the intermediate needed for the selected route
    const im = INTERMEDIATES[selection.intermediate];
    const intermediateNeeded = im.perLoop * loops;
    derived = `${formatLoops(loops)} loops · needs ${formatUnits(intermediateNeeded, 18, 4)} ${im.symbol}`;
  }

  return (
    <Panel title="mint amount">
      <div className="flex flex-col gap-3">
        {/* spend mode — top-level tab switch */}
        <div className="flex border border-border bg-panel-2">
          <button
            type="button"
            className={`focus-ring flex-1 px-3 py-2 text-xs ${execMode === "full" ? "bg-accent/15 text-accent" : "text-text-dim"}`}
            onClick={() => setExecMode("full")}
          >
            full route (from pStable)
          </button>
          <button
            type="button"
            className={`focus-ring flex-1 px-3 py-2 text-xs ${execMode === "inter" ? "bg-accent/15 text-accent" : "text-text-dim"}`}
            onClick={() => setExecMode("inter")}
          >
            from intermediate (skip pStable)
          </button>
        </div>
        <p className="-mt-1 text-xs text-text-faint">
          {execMode === "full"
            ? "Spends pStable (pDAI/pUSDC) → batcher mints the intermediate → mints Ⓐ. ~148k gas/loop on MATH."
            : "Spends MATH/G5/PI you already hold → batcher mints Ⓐ. ~40k gas/loop (no intermediate-mint leg). The intermediate needed is shown below for the selected route."}
        </p>

        {/* amount input + input-mode toggle (toggle only in full mode) */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="mint-amount" className="text-xs text-text-faint">
              {label}
            </label>
            <input
              id="mint-amount"
              type="number"
              min={0}
              step={effectiveInputMode === "aff" ? 3 : 1}
              value={inputAmount}
              onChange={(e) => setInputAmount(Math.max(0, Number(e.target.value || "0")))}
              className="w-48 border border-border bg-panel-2 px-3 py-2 text-lg text-text focus-ring"
            />
          </div>
          {execMode === "full" && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-text-faint">input as</span>
              <div className="flex border border-border bg-panel-2">
                <button
                  type="button"
                  className={`focus-ring px-3 py-2 text-xs ${effectiveInputMode === "aff" ? "bg-accent/15 text-accent" : "text-text-dim"}`}
                  onClick={() => {
                    setInputMode("aff");
                    setInputAmount(Math.max(3, Math.round(inputAmount / 3) * 3));
                  }}
                >
                  Ⓐ to mint
                </button>
                <button
                  type="button"
                  className={`focus-ring px-3 py-2 text-xs ${effectiveInputMode === "spend" ? "bg-accent/15 text-accent" : "text-text-dim"}`}
                  onClick={() => setInputMode("spend")}
                >
                  pStable to spend
                </button>
              </div>
            </div>
          )}
          <span className="text-xs text-text-faint pb-2">{derived}</span>
        </div>
      </div>
    </Panel>
  );
}

function formatLoops(loops: bigint): string {
  return Number(loops).toLocaleString();
}
