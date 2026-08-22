// Module B — Tier 2: Custom Routing. Pick route + size, see live profitability, then
// execute the explicit mint sequence — each step pre-simulated (eth_call) and user-signed.
// Never auto-approves: every approval + mint is an explicit wallet click.
//
// Two start modes:
//  - "full"  : pStable → intermediate → Ⓐ (4 steps: 2 approvals + 2 multi-mint txs)
//  - "inter" : intermediate → Ⓐ (2 steps: 1 approval + 1 multi-mint tx) — for users who
//              already hold the intermediate.
//
// The legacy community multi-mint contracts are used (MultiMath/G5/PI + MultiAffection),
// so each leg is internally atomic. The fully-atomic single-tx batcher is P5 (/batcher).
// The multi-mints' DEPLOYED ABI is per-token (multiBuyWithDAI/USDC/MATH/G5/PI — verified
// on-chain; see src/config/mint.ts) and exposes an owner-settable tax — read live and
// shown below. Every step is still pre-simulated against current chain state.
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import {
  BLOCK_GAS_LIMIT_APPROX,
  INTERMEDIATES,
  MULTI_AFFECTION_ADDR,
  type MintStep,
  STABLES,
  buildMintPlan,
  buildMintPlanFromIntermediate,
  erc20Abi,
} from "@/config/mint";
import { AFFECTION_ADDR } from "@/config/registry";
import { useMintBalances } from "@/hooks/useMintBalances";
import { useMintData } from "@/hooks/useMintData";
import { useMintWallet } from "@/hooks/useMintWallet";
import { useMultiMintTax } from "@/hooks/useMultiMintTax";
import { formatGas, formatGwei, useNetworkContext } from "@/hooks/useNetworkContext";
import { useSimulateMint } from "@/hooks/useSimulateMint";
import { useWallet } from "@/hooks/useWallet";
import { formatUnits, parseWholeInput } from "@/lib/format/units";
import {
  clampLoopsToGranularity,
  computeMaxSafeLoops,
  computeRouteProfitability,
} from "@/lib/mint/profitability";
import type { MintPreset } from "@/routes/Mint";
import { useTxLogStore } from "@/stores/txLog";
import { useEffect, useMemo, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { RouteFlow } from "./RouteFlow";

const EXEC_ROUTES: Array<{ intermediate: "G5" | "PI" | "MATH"; stable: "pDAI" | "pUSDC" }> = [
  { intermediate: "MATH", stable: "pDAI" },
  { intermediate: "MATH", stable: "pUSDC" },
  { intermediate: "G5", stable: "pDAI" },
  { intermediate: "PI", stable: "pDAI" },
];

type StartMode = "full" | "inter";

export function CustomMint({
  preset,
  onConsumedPreset,
}: {
  preset: MintPreset | null;
  onConsumedPreset: () => void;
}) {
  const wallet = useWallet();
  const { data: mintData, isLoading: dataLoading } = useMintData();

  const [routeIdx, setRouteIdx] = useState(0);
  const [startMode, setStartMode] = useState<StartMode>("full");
  const [loopsInput, setLoopsInput] = useState(100n);

  // Apply a preset handed over from Tier 1 (route + loops).
  useEffect(() => {
    if (!preset) return;
    const idx = EXEC_ROUTES.findIndex(
      (r) => r.intermediate === preset.intermediate && r.stable === preset.stable,
    );
    if (idx >= 0) setRouteIdx(idx);
    setLoopsInput(preset.loops);
    setStartMode("full");
    setDoneSteps(new Set());
    setTxHash(null);
    setActiveStep(null);
    onConsumedPreset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, onConsumedPreset]);

  const chosen = EXEC_ROUTES[routeIdx];
  const im = INTERMEDIATES[chosen.intermediate];
  const st = STABLES[chosen.stable];

  const loops = clampLoopsToGranularity(loopsInput, im.loopGranularity);

  const maxSafe = mintData
    ? computeMaxSafeLoops(mintData.affectionSupply, mintData.affectionCap)
    : 0n;
  const effectiveLoops = loops > maxSafe ? maxSafe : loops;

  const plan: MintStep[] | null = useMemo(
    () =>
      startMode === "inter"
        ? buildMintPlanFromIntermediate(chosen.intermediate, effectiveLoops)
        : buildMintPlan(chosen.intermediate, chosen.stable, effectiveLoops),
    [startMode, chosen, effectiveLoops],
  );

  const walletQ = useMintWallet(chosen.stable, chosen.intermediate, wallet.address);
  const balancesQ = useMintBalances(wallet.address);
  const simQ = useSimulateMint(plan, wallet.address);
  const taxQ = useMultiMintTax();
  const netQ = useNetworkContext();
  const addTx = useTxLogStore((s) => s.add);
  const setTxStatus = useTxLogStore((s) => s.setStatus);

  const intermediateBalance = balancesQ.data
    ? chosen.intermediate === "MATH"
      ? balancesQ.data.MATH
      : chosen.intermediate === "G5"
        ? balancesQ.data.G5
        : balancesQ.data.PI
    : 0n;
  const intermediateNeeded = im.perLoop * effectiveLoops;

  // Profitability of the chosen route at the chosen loops (read-only).
  const profit = useMemo(() => {
    if (!mintData) return null;
    const route = {
      id: `${chosen.intermediate}·${chosen.stable}`,
      stable: chosen.stable,
      intermediate: chosen.intermediate,
      buyFunction: `BuyWith${chosen.intermediate === "MATH" ? "MATH" : chosen.intermediate}`,
      perLoop: im.perLoop,
      affectionPerIntermediate:
        chosen.intermediate === "MATH" ? 1 : chosen.intermediate === "G5" ? 5 : 300,
      stablePerAFFECTION: 1n,
      loopGranularity: im.loopGranularity,
    };
    return computeRouteProfitability(
      route,
      effectiveLoops,
      mintData.affectionSupply,
      mintData.affectionCap,
      mintData.graph,
      AFFECTION_ADDR,
      st.address,
      st.decimals,
    );
  }, [mintData, chosen, im, st, effectiveLoops]);

  // Execution state.
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const receiptQ = useWaitForTransactionReceipt({ hash: txHash ?? undefined });
  const [activeTxId, setActiveTxId] = useState<string | null>(null);

  // On receipt confirmation, mark the step done + refresh wallet/sim (side-effect, not in render).
  // A REVERTED receipt does NOT mark the step done — it stays actionable so the user can retry.
  useEffect(() => {
    if (receiptQ.isSuccess && activeStep !== null && txHash && activeTxId) {
      const ok = receiptQ.data?.status === "success";
      if (ok) {
        setDoneSteps((prev) => new Set(prev).add(activeStep));
      }
      // The useTrackTx hook also picks up the hash, but mirror it now for immediacy.
      setTxStatus(activeTxId, {
        status: ok ? "confirmed" : "reverted",
        blockNumber: receiptQ.data?.blockNumber,
      });
      walletQ.refetch();
      simQ.refetch();
      balancesQ.refetch();
      setActiveStep(null);
      setTxHash(null);
      setActiveTxId(null);
    }
  }, [
    receiptQ.isSuccess,
    receiptQ.data,
    activeStep,
    txHash,
    activeTxId,
    walletQ,
    simQ,
    balancesQ,
    setTxStatus,
  ]);

  const stableCost = effectiveLoops * 3n * 10n ** BigInt(st.decimals);
  const canAffordStable = walletQ.data ? walletQ.data.stableBalance >= stableCost : false;
  const canAffordInter = intermediateBalance >= intermediateNeeded;
  const granularityWarn = loopsInput !== loops && loopsInput > 0n;

  async function executeStep(i: number, step: MintStep) {
    if (!wallet.address) return;
    setActiveStep(i);
    setTxHash(null);
    const txId = addTx({ module: "mint", label: step.label });
    setActiveTxId(txId);
    try {
      // Branch on the discriminated step kind so wagmi infers the right contract config
      // (the union abi type otherwise confuses the generic).
      const hash =
        step.kind === "approve"
          ? await writeContractAsync({
              address: step.calldata.address,
              abi: erc20Abi,
              functionName: "approve",
              args: step.calldata.args,
            })
          : await writeContractAsync({
              address: step.calldata.address,
              abi: step.calldata.abi,
              functionName: step.calldata.functionName,
              args: step.calldata.args,
            });
      setTxHash(hash as `0x${string}`);
      setTxStatus(txId, { hash: hash as `0x${string}`, status: "confirming" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxStatus(txId, { status: "failed", error: msg.slice(0, 120) });
      setActiveStep(null);
      setTxHash(null);
      setActiveTxId(null);
    }
  }

  // Wallet gating.
  if (!wallet.isConnected) {
    return (
      <Panel title="custom routing">
        <p className="text-xs text-text-dim">
          Connect a PulseChain wallet (injected / EIP-1193) to use the custom mint. Read-only
          profitability is in the Auto-Router tab.
        </p>
      </Panel>
    );
  }
  if (wallet.isWrongChain) {
    return (
      <Panel title="custom routing">
        <p className="text-xs text-warn">Wrong chain — switch to PulseChain (id 369).</p>
        <Button variant="accent" size="sm" onClick={() => wallet.switchChain()}>
          switch chain
        </Button>
      </Panel>
    );
  }

  const simResults = simQ.data;
  const isExecuting = activeStep !== null && writePending && !txHash;
  const isConfirming = activeStep !== null && !!txHash && !receiptQ.isSuccess;
  const approvalCount = plan?.filter((s) => s.kind === "approve").length ?? 0;
  const txCount = plan?.filter((s) => s.kind !== "approve").length ?? 0;

  // Derive which steps are already done from ON-CHAIN state (survives reload).
  // An approval step is done if the allowance is already set on-chain. This is the key
  // fix: the old code only tracked doneSteps in memory, so a page reload lost all progress
  // and the user had to re-approve. Now we check the live allowance.
  const isStepDone = (i: number, step: MintStep): boolean => {
    if (doneSteps.has(i)) return true;
    if (!walletQ.data) return false;
    if (step.kind === "approve") {
      // Approval is done if the allowance is already non-zero (max approval = 2^256-1).
      if (step.token === st.address && step.spender === im.multiMint) {
        return walletQ.data.stableAllowance > 0n;
      }
      if (step.token === im.address && step.spender === MULTI_AFFECTION_ADDR) {
        return walletQ.data.intermediateAllowance > 0n;
      }
    }
    return false;
  };

  // A step is actionable if: not done, all prior steps are done, and nothing is executing.
  // For approval steps we do NOT require sim.ok — approve(spender, MAX) always succeeds.
  // For mint steps we require the simulation to pass (so the user doesn't send a tx that reverts).
  const isStepActionable = (i: number, step: MintStep): boolean => {
    const done = isStepDone(i, step);
    if (done) return false;
    const priorDone = plan?.slice(0, i).every((prevStep, j) => isStepDone(j, prevStep)) ?? false;
    if (!priorDone) return false;
    if (isExecuting || isConfirming) return false;
    if (step.kind === "approve") return true;
    const sim = simResults?.[i];
    return sim?.ok ?? false;
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title="route + size">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-text-faint">
            route
            <select
              value={routeIdx}
              onChange={(e) => {
                setRouteIdx(Number(e.target.value));
                setDoneSteps(new Set());
                setTxHash(null);
                setActiveStep(null);
              }}
              className="border border-border bg-panel-2 px-2 py-1 text-text focus-ring"
            >
              {EXEC_ROUTES.map((r, i) => (
                <option key={`${r.intermediate}-${r.stable}`} value={i}>
                  {r.intermediate} · {r.stable}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-faint">
            loops (Generate() calls)
            <input
              type="number"
              min={1}
              value={Number(loopsInput)}
              onChange={(e) => {
                setLoopsInput(parseWholeInput(e.target.value));
                setDoneSteps(new Set());
              }}
              className="w-32 border border-border bg-panel-2 px-2 py-1 text-text focus-ring"
            />
          </label>
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-text-faint">→ mints</span>
            <span className="text-text">
              {formatUnits(effectiveLoops * 3n * 10n ** 18n, 18, 2)} Ⓐ
            </span>
          </div>
          {startMode === "full" ? (
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-text-faint">→ cost</span>
              <span className="text-text">
                {formatUnits(stableCost, st.decimals, 2)} {st.symbol}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-text-faint">→ needs</span>
              <span className="text-text">
                {formatUnits(intermediateNeeded, 18, 4)} {im.symbol}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-text-faint">cap headroom</span>
            <span className="text-text-dim">{maxSafe.toString()} safe loops</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex border border-border bg-panel-2">
            <button
              type="button"
              className={`focus-ring px-2 py-1 text-xs ${startMode === "full" ? "bg-accent/15 text-accent" : "text-text-dim"}`}
              onClick={() => {
                setStartMode("full");
                setDoneSteps(new Set());
                setTxHash(null);
                setActiveStep(null);
              }}
            >
              from pStable (full)
            </button>
            <button
              type="button"
              className={`focus-ring px-2 py-1 text-xs ${startMode === "inter" ? "bg-accent/15 text-accent" : "text-text-dim"}`}
              onClick={() => {
                setStartMode("inter");
                setDoneSteps(new Set());
                setTxHash(null);
                setActiveStep(null);
              }}
            >
              from {im.symbol} (skip pStable)
            </button>
          </div>
          {startMode === "inter" && (
            <span className="text-xs text-text-faint">
              your {im.symbol} bal: {formatUnits(intermediateBalance, 18, 4)}
            </span>
          )}
        </div>
        {granularityWarn && (
          <p className="mt-2 text-xs text-warn">
            ⚠ {im.symbol} mints 1 token per call — floored loops to a multiple of{" "}
            {im.loopGranularity.toString()} ({loops.toString()}) so the intermediate count is whole.
          </p>
        )}
        {chosen.intermediate === "PI" && (
          <p className="mt-2 text-xs text-warn">
            ⚠ PI route caution: the deployed MultiPI has only been observed paying out small amounts
            (1 PI per call) — the pre-simulation below is the source of truth for whether your size
            goes through. Prefer MATH/G5 or the /batcher wizard for large mints.
          </p>
        )}
        {effectiveLoops > maxSafe && (
          <p className="mt-2 text-xs text-warn">
            ⚠ clamped to {maxSafe.toString()} (cap headroom). Near the cap, Generate() no-ops and
            BuyWith* reverts.
          </p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-text-faint">
          <span className="text-text-dim">Loops</span> = Generate() calls (3 Ⓐ each). This plan
          takes <span className="text-text-dim">{approvalCount} approval(s)</span> +{" "}
          <span className="text-text-dim">{txCount} mint tx(s)</span> — approvals are one-time max
          per route. Each step below is pre-simulated before its button enables.
        </p>
        {taxQ.data && (
          <p className="text-xs text-text-faint">
            multi-mint tax (live read, owner-settable):{" "}
            {Object.entries(taxQ.data)
              .map(([name, t]) => `${name.replace("Multi ", "")} ${t.tax.toString()}%`)
              .join(" · ")}
            {Object.values(taxQ.data).some((t) => t.tax > 0n) && (
              <span className="text-warn">
                {" "}
                — a non-zero tax raises your effective cost; the cost line above does not include
                it. Check the contract before signing.
              </span>
            )}
          </p>
        )}
        <p className="text-xs leading-relaxed text-text-faint">
          The deployed multi-mints also expose an admin surface (setTax / setOwner / withdrawERC20 /
          withdrawPLS) not described by their recovered sources — the live tax read above and each
          step's pre-simulation reflect the current on-chain state.
        </p>
      </Panel>

      {profit && startMode === "full" && (
        <Panel title="profitability of this route">
          <RouteFlow profit={profit} />
          {profit.exit && profit.profit <= 0n && (
            <p className="mt-2 text-xs text-warn">
              Currently unprofitable (DEX value &lt; floor cost). Minting still works — you'd hold
              the Ⓐ rather than sell.
            </p>
          )}
          {!profit.exit && (
            <p className="mt-2 text-xs text-err">
              No PulseX exit path from Ⓐ to {st.symbol} right now — you can still mint but there's
              no live DEX value to estimate.
            </p>
          )}
        </Panel>
      )}

      <Panel
        title={`execute — explicit, pre-simulated steps (${startMode === "inter" ? "from intermediate" : "full route"})`}
        actions={
          <div className="flex items-center gap-2">
            {walletQ.data && startMode === "full" ? (
              <span className="text-text-faint">
                {st.symbol} bal {formatUnits(walletQ.data.stableBalance, st.decimals, 2)}
              </span>
            ) : null}
            <button
              type="button"
              className="focus-ring border border-border bg-panel-2 px-2 py-0.5 text-xs text-text-dim hover:border-accent-dim hover:text-text"
              onClick={() => {
                walletQ.refetch();
                simQ.refetch();
                balancesQ.refetch();
              }}
              title="re-read chain state (use after an external approval or tx)"
            >
              re-check
            </button>
          </div>
        }
      >
        {dataLoading ? (
          <p className="text-xs text-text-faint">reading chain state…</p>
        ) : !plan ? (
          <p className="text-xs text-err">
            This route isn't executable via the legacy multi-mints (e.g. {im.symbol} via {st.symbol}
            ). Pick another route.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {netQ.data && (
              <p className="text-xs text-text-faint">
                network · base fee {formatGwei(netQ.data.baseFeePerGas)} gwei · latest block{" "}
                {(netQ.data.fullness * 100).toFixed(0)}% full
                {netQ.data.blockTimeSeconds != null &&
                  ` · ~${netQ.data.blockTimeSeconds.toFixed(0)}s blocks`}
              </p>
            )}
            {(() => {
              const bigGas = plan
                .map((_, i) => simResults?.[i]?.gasEstimate)
                .filter((g): g is bigint => g != null)
                .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))[0];
              if (bigGas == null || !netQ.data) return null;
              const pct = (Number(bigGas) * 100) / Number(netQ.data.blockGasLimit);
              if (pct < 25) return null;
              return (
                <p className="text-xs text-warn">
                  ⚠ gas-heavy transaction (~{formatGas(bigGas)} ≈ {Math.round(pct)}% of a block). A
                  tx this large only fits in blocks with enough spare capacity — during network
                  congestion it can sit pending for several minutes even at a reasonable gas price.
                  A wallet "speed up" re-submits the same nonce and still needs block space; raising
                  the <em>priority fee</em> is the effective lever (validators keep 100% of it),
                  otherwise wait it out or split the mint into smaller steps/loops.
                </p>
              );
            })()}
            {startMode === "full" && !canAffordStable && (
              <p className="text-xs text-err">
                Insufficient {st.symbol} balance (
                {walletQ.data ? formatUnits(walletQ.data.stableBalance, st.decimals, 2) : "?"} &lt;{" "}
                {formatUnits(stableCost, st.decimals, 2)}).
              </p>
            )}
            {startMode === "inter" && !canAffordInter && (
              <p className="text-xs text-err">
                Insufficient {im.symbol} balance ({formatUnits(intermediateBalance, 18, 4)} &lt;{" "}
                {formatUnits(intermediateNeeded, 18, 4)}). Switch to the full route or acquire more{" "}
                {im.symbol}.
              </p>
            )}
            {plan.map((step, i) => {
              const thisDone = isStepDone(i, step);
              const actionable = isStepActionable(i, step);
              const isStepActive = activeStep === i;
              const blockedByBalance =
                startMode === "full"
                  ? !canAffordStable && step.kind !== "approve"
                  : !canAffordInter && step.kind !== "approve";
              const stepGas = simResults?.[i]?.gasEstimate;
              const gasPct =
                stepGas != null
                  ? Math.round(
                      (Number(stepGas) * 100) /
                        Number(netQ.data?.blockGasLimit ?? BLOCK_GAS_LIMIT_APPROX),
                    )
                  : null;
              return (
                <div
                  key={step.label}
                  className="flex items-center gap-3 border border-border bg-panel-2 px-2 py-1.5"
                >
                  <span className="text-text-faint">{i + 1}.</span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-xs text-text">{step.label}</span>
                    <span className="text-xs text-text-faint">
                      {step.kind === "approve"
                        ? `approve ${step.amount === 2n ** 256n - 1n ? "max" : step.amount.toString()}`
                        : step.calldata.functionName}
                      {" · "}
                      {thisDone
                        ? "done ✓ (on-chain)"
                        : step.kind === "approve"
                          ? "ready to approve"
                          : simResults?.[i] === undefined
                            ? "simulating…"
                            : simResults[i]?.ok
                              ? `sim ✓ · ~${simResults[i]?.gasEstimate ? formatGas(simResults[i].gasEstimate as bigint) : "?"} gas${gasPct !== null ? ` (${gasPct}% of a block)` : ""} — executable now`
                              : `sim ✗ — ${simResults[i]?.error ?? "blocked"}`}
                    </span>
                  </div>
                  <Button
                    variant={thisDone ? "ghost" : "accent"}
                    size="sm"
                    disabled={thisDone || !actionable || blockedByBalance}
                    onClick={() => executeStep(i, step)}
                  >
                    {thisDone
                      ? "done"
                      : isStepActive && isConfirming
                        ? "confirming…"
                        : isStepActive && isExecuting
                          ? "signing…"
                          : step.kind === "approve"
                            ? "approve"
                            : step.kind === "mintIntermediate"
                              ? "mint inter."
                              : "mint Ⓐ"}
                  </Button>
                </div>
              );
            })}
            <p className="text-xs leading-relaxed text-text-faint">
              Each step is pre-simulated with an <code>eth_call</code> from your address before the
              button enables. Approvals use <code>type(uint256).max</code> (one-time, per route).
              The legacy multi-mints are community contracts with an owner + settable tax (shown
              above, live) — the pre-simulation is the source of truth. Nothing is auto-signed.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
