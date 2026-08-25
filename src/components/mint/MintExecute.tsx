// The execute panel — the lower half of the /mint "mint" tab. Drives the user's OWN batcher
// (UnifiedAffectionBatcher / AtomicArbBatcher) for the selected route + size. Two modes
// (controlled by the parent, from the "mint amount" panel):
//   - "full"          : pStable → intermediate → Ⓐ via batcher.mintFromStable() — one atomic tx
//   - "inter"         : intermediate → Ⓐ via batcher.multiBuyWith() — for users who already
//                       hold MATH/G5/PI (one atomic tx, no pStable leg, ~39.8k gas/loop)
// When the batcher is an AtomicArbBatcher (mint-sell variant) AND a DEX exit path is available
// from the profitability engine, a "sell after mint" checkbox switches the call to
// `mintAndSwap` — mint + sell in one atomic tx (defeats sell-side sniping).
// The approve step is driven by the LIVE on-chain allowance (a restored batcher with an
// existing max-approval skips straight to the mint). Every step is pre-simulated; nothing
// auto-signs. "mint again" stays live on the same tab for consecutive mints.
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Panel } from "@/components/ui/Panel";
import {
  BLOCK_GAS_LIMIT_APPROX,
  GAS_CEILING_PER_TX,
  GAS_PER_LOOP,
  GAS_PER_LOOP_INTER,
  INTERMEDIATES,
  STABLES,
  erc20Abi,
  maxLoopsPerTx,
} from "@/config/mint";
import { AFFECTION_ADDR } from "@/config/registry";
import { useMintBalances } from "@/hooks/useMintBalances";
import { formatGas, formatGwei, useNetworkContext } from "@/hooks/useNetworkContext";
import { useSimulateBatcherStep } from "@/hooks/useSimulateBatcherStep";
import { useWallet } from "@/hooks/useWallet";
import { scannerUrl, shortenHash } from "@/lib/format/address";
import { formatUnits } from "@/lib/format/units";
import { publicClient } from "@/lib/rpc/client";
import { useTxLogStore } from "@/stores/txLog";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { Abi, Address } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { ExecMode, MintSelection } from "./AutoRouter";
import type { ActiveBatcher } from "./BatcherBar";

const MAX_ALLOWANCE = 2n ** 256n - 1n;

export function MintExecute({
  batcher,
  selection,
  execMode,
}: {
  batcher: ActiveBatcher;
  selection: MintSelection;
  execMode: ExecMode;
}) {
  const wallet = useWallet();
  const netQ = useNetworkContext();
  const balancesQ = useMintBalances(wallet.address);
  const addTx = useTxLogStore((s) => s.add);
  const setTxStatus = useTxLogStore((s) => s.setStatus);

  const im = INTERMEDIATES[selection.intermediate];
  const st = STABLES[selection.stable];
  const loops = selection.loops;

  // "sell after mint" — only available on the AtomicArbBatcher (mint-sell variant) when we
  // have a DEX exit path from the profitability engine and we're in full mode (mintAndSwap
  // mints from stable, so it needs the pStable leg).
  const isArbBatcher = batcher.variant === "mint-sell";
  const canSell =
    isArbBatcher && execMode === "full" && !!selection.exitPath && selection.exitPath.length >= 2;
  const [sellAfterMint, setSellAfterMint] = useState(false);
  const [slippagePct, setSlippagePct] = useState(2);

  // Reset sell-after-mint when the selection changes and the new route has no exit path.
  useEffect(() => {
    if (!canSell) setSellAfterMint(false);
  }, [canSell]);

  const gasPerLoop =
    execMode === "inter" ? GAS_PER_LOOP_INTER : GAS_PER_LOOP[selection.intermediate];
  const loopsGasCeiling = maxLoopsPerTx(selection.intermediate, execMode);
  const estGas = loops * gasPerLoop;
  const estPctOfBlock = Math.round(
    (Number(estGas) * 100) / Number(netQ.data?.blockGasLimit ?? BLOCK_GAS_LIMIT_APPROX),
  );

  const stableCost = loops * 3n * 10n ** BigInt(st.decimals);
  const intermediateNeeded = im.perLoop * loops;

  const balances = balancesQ.data;
  const intermediateBalance = balances
    ? selection.intermediate === "MATH"
      ? balances.MATH
      : selection.intermediate === "G5"
        ? balances.G5
        : balances.PI
    : 0n;
  const canAffordStable = balances ? balances[selection.stable] >= stableCost : false;
  const canAffordInter = intermediateBalance >= intermediateNeeded;

  // The token that needs approving in the current mode + the live allowance read.
  const approveToken = execMode === "full" ? st.address : im.address;
  const allowQ = useQuery<bigint>({
    queryKey: [
      "mint-execute-allowance",
      wallet.address ?? null,
      approveToken.toLowerCase(),
      batcher.address.toLowerCase(),
    ],
    enabled: !!wallet.address,
    queryFn: async () => {
      if (!wallet.address) return 0n;
      return (await publicClient.readContract({
        address: approveToken,
        abi: erc20Abi,
        functionName: "allowance",
        args: [wallet.address, batcher.address],
      })) as bigint;
    },
    refetchInterval: 12_000,
    staleTime: 8_000,
  });
  const approveDone = allowQ.data != null && allowQ.data > 0n;

  // Pre-simulate both steps.
  const approveSim = useSimulateBatcherStep(wallet.address, approveToken, erc20Abi, "approve", [
    batcher.address,
    MAX_ALLOWANCE,
  ]);
  const expectedAff = loops * 3n * 10n ** 18n;
  // When sell-after-mint is enabled on an AtomicArbBatcher, use mintAndSwap (mint + DEX swap
  // in one atomic tx). Otherwise use mintFromStable (full) or multiBuyWith (inter).
  const useMintAndSwap = sellAfterMint && canSell;
  const mintFunctionName = useMintAndSwap
    ? "mintAndSwap"
    : execMode === "full"
      ? "mintFromStable"
      : "multiBuyWith";

  // Memoize the swap deadline + path + slippage guard so the sim query key is stable across
  // re-renders. Without this, Date.now() changes every second → new query key → fresh sim →
  // button flashes between enabled/disabled. The deadline only needs to be recomputed when the
  // route/size/sell-mode changes (the user will re-simulate then anyway).
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-computes on route/size/sell-mode/slippage change so the deadline is fresh for a new mint
  const swapDeadline = useMemo(
    () => BigInt(Math.floor(Date.now() / 1000) + 1200), // 20 min from now
    [selection.intermediate, selection.stable, loops, sellAfterMint, slippagePct],
  );
  const swapPath = useMemo(
    () => (selection.exitPath ?? [AFFECTION_ADDR, st.address]) as Address[],
    [selection.exitPath, st.address],
  );
  // Slippage guard: amountOutMin = (100 - slippagePct)% of the expected swap output from the
  // profitability engine. This protects against sandwich attacks — with amountOutMin = 0, a MEV
  // bot could front-run the swap and the user would get very little pDAI. With the guard, the tx
  // reverts if the swap would return less than the tolerated minimum, and the user only loses gas.
  const slippageBps = BigInt(Math.max(0, Math.min(100, slippagePct)) * 100);
  const amountOutMin = useMemo(() => {
    if (!selection.exitAmountOut || selection.exitAmountOut <= 0n) return 0n;
    return (selection.exitAmountOut * (10_000n - slippageBps)) / 10_000n;
  }, [selection.exitAmountOut, slippageBps]);

  const mintArgs = useMintAndSwap
    ? [st.address, im.address, loops, expectedAff, swapPath, amountOutMin, swapDeadline]
    : execMode === "full"
      ? [st.address, im.address, loops, expectedAff]
      : [im.address, loops];
  const mintSim = useSimulateBatcherStep(
    wallet.address,
    batcher.address,
    batcher.abi,
    mintFunctionName,
    mintArgs,
  );

  // Execution state.
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [execHash, setExecHash] = useState<`0x${string}` | null>(null);
  const [approveLatched, setApproveLatched] = useState(false);
  const [lastMintHash, setLastMintHash] = useState<`0x${string}` | null>(null);
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const receiptQ = useWaitForTransactionReceipt({ hash: execHash ?? undefined });

  useEffect(() => {
    if (receiptQ.isSuccess && activeStep !== null && execHash && activeTxId) {
      const ok = receiptQ.data?.status === "success";
      if (ok) {
        if (activeStep === 1) {
          setLastMintHash(execHash);
        } else {
          setApproveLatched(true);
        }
      }
      setTxStatus(activeTxId, {
        status: ok ? "confirmed" : "reverted",
        blockNumber: receiptQ.data?.blockNumber,
      });
      setActiveStep(null);
      setExecHash(null);
      setActiveTxId(null);
      approveSim.refetch();
      mintSim.refetch();
      allowQ.refetch();
      balancesQ.refetch();
    }
  }, [
    receiptQ.isSuccess,
    receiptQ.data,
    activeStep,
    execHash,
    activeTxId,
    approveSim,
    mintSim,
    allowQ,
    balancesQ,
    setTxStatus,
  ]);

  // Reset transient state when the route/size/batcher/mode changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-runs on route/size/batcher/mode change to reset transient state
  useEffect(() => {
    setApproveLatched(false);
    setLastMintHash(null);
    setActiveStep(null);
    setExecHash(null);
  }, [batcher.address, selection.intermediate, selection.stable, execMode, loops]);

  async function exec(step: 0 | 1) {
    if (!wallet.address) return;
    if (step === 1) setLastMintHash(null);
    setActiveStep(step);
    setExecHash(null);
    const isApprove = step === 0;
    const label = isApprove
      ? `approve ${execMode === "full" ? st.symbol : im.symbol} → my batcher`
      : useMintAndSwap
        ? `mintAndSwap(${st.symbol}, ${im.symbol}, ${loops}, path=${swapPath.map((a) => a.slice(0, 6)).join("→")})`
        : execMode === "full"
          ? `mintFromStable(${st.symbol}, ${im.symbol}, ${loops})`
          : `multiBuyWith(${im.symbol}, ${loops})`;
    const txId = addTx({ module: "mint", label });
    setActiveTxId(txId);
    try {
      const hash: `0x${string}` = isApprove
        ? ((await writeContractAsync({
            address: approveToken,
            abi: erc20Abi,
            functionName: "approve",
            args: [batcher.address, MAX_ALLOWANCE],
          })) as `0x${string}`)
        : ((await writeContractAsync(
            useMintAndSwap
              ? {
                  address: batcher.address,
                  abi: batcher.abi as Abi,
                  functionName: "mintAndSwap",
                  args: [
                    st.address,
                    im.address,
                    loops,
                    expectedAff,
                    swapPath,
                    amountOutMin,
                    swapDeadline,
                  ],
                }
              : execMode === "full"
                ? {
                    address: batcher.address,
                    abi: batcher.abi as Abi,
                    functionName: "mintFromStable",
                    args: [st.address, im.address, loops, expectedAff],
                  }
                : {
                    address: batcher.address,
                    abi: batcher.abi as Abi,
                    functionName: "multiBuyWith",
                    args: [im.address, loops],
                  },
          )) as `0x${string}`);
      setExecHash(hash);
      setTxStatus(txId, { hash, status: "confirming" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxStatus(txId, { status: "failed", error: msg.slice(0, 120) });
      setActiveStep(null);
      setExecHash(null);
      setActiveTxId(null);
    }
  }

  const stepDone = approveLatched || approveDone;
  const confirming = activeStep !== null && !!execHash && !receiptQ.isSuccess;
  const signing = activeStep !== null && writePending && !execHash;
  const overGasCeiling = loops > loopsGasCeiling;
  const blockedByBalance = execMode === "full" ? !canAffordStable : !canAffordInter;
  const zeroLoops = loops <= 0n;

  const mintGas = mintSim.data?.gasEstimate ?? estGas;
  const mintGasPct = Math.round(
    (Number(mintGas) * 100) / Number(netQ.data?.blockGasLimit ?? BLOCK_GAS_LIMIT_APPROX),
  );

  // Build a human-readable sim status for the mint step.
  const mintSimStatus = zeroLoops
    ? "amount below route minimum"
    : overGasCeiling
      ? `beyond gas ceiling (${loopsGasCeiling.toString()} loops max on ${im.symbol})`
      : !stepDone
        ? "approve first"
        : mintSim.isLoading
          ? "simulating…"
          : mintSim.data?.ok
            ? `sim ✓ · ~${formatGas(mintGas)} gas (${mintGasPct}% of a block) — executable now`
            : "sim ✗ — on-chain revert (check balance + cap)";

  return (
    <Panel
      title="execute — via your batcher (atomic)"
      actions={
        <div className="flex items-center gap-1 text-text-faint">
          <a
            href={scannerUrl(batcher.address, "address")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-info hover:underline"
          >
            {shortenHash(batcher.address, 8)}
          </a>
          <CopyButton value={batcher.address} label="[⎘]" />
        </div>
      }
    >
      <div className="flex flex-col gap-3 text-xs">
        {/* selection summary */}
        <div className="flex flex-wrap items-end gap-3 border-b border-border pb-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-text-faint">route</span>
            <span className="text-text">
              {im.symbol} · {st.symbol}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-text-faint">loops</span>
            <span className="text-text">{loops.toString()}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-text-faint">mints</span>
            <span className="text-text">{formatUnits(loops * 3n * 10n ** 18n, 18, 2)} Ⓐ</span>
          </div>
          {execMode === "full" ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-text-faint">cost</span>
              <span className="text-text">
                {formatUnits(stableCost, st.decimals, 2)} {st.symbol}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <span className="text-text-faint">needs</span>
              <span className="text-text">
                {formatUnits(intermediateNeeded, 18, 4)} {im.symbol}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="text-text-faint">mode</span>
            <span className="text-text-dim">
              {execMode === "full" ? "full route" : "from intermediate"}
            </span>
          </div>
        </div>

        {zeroLoops && (
          <p className="text-warn">
            ⚠ {im.symbol} route needs a minimum of{" "}
            {Number(im.loopGranularity * 3n).toLocaleString()} Ⓐ ({im.loopGranularity.toString()}{" "}
            loops). Increase the amount above.
          </p>
        )}
        {execMode === "full" && !canAffordStable && balances && !zeroLoops && (
          <p className="text-err">
            Insufficient {st.symbol} ({formatUnits(balances[selection.stable], st.decimals, 2)} &lt;{" "}
            {formatUnits(stableCost, st.decimals, 2)}). Switch to “from {im.symbol}” mode or acquire
            more {st.symbol}.
          </p>
        )}
        {execMode === "inter" && !canAffordInter && balances && !zeroLoops && (
          <p className="text-err">
            Insufficient {im.symbol} ({formatUnits(intermediateBalance, 18, 4)} &lt;{" "}
            {formatUnits(intermediateNeeded, 18, 4)}). Switch to “full route” mode or acquire more{" "}
            {im.symbol}.
          </p>
        )}

        {/* sell-after-mint toggle — only for AtomicArbBatcher with an exit path */}
        {canSell && (
          <div className="flex flex-wrap items-center gap-3 border border-border bg-panel-2 px-3 py-2 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sellAfterMint}
                onChange={(e) => setSellAfterMint(e.target.checked)}
                className="accent-[var(--c-accent)]"
              />
              <span className="text-text">
                sell after mint{" "}
                <span className="text-text-faint">
                  (mint + swap Ⓐ→{st.symbol} via PulseX in one tx — defeats sell-side sniping)
                </span>
              </span>
            </label>
            {sellAfterMint && (
              <label className="flex items-center gap-1 text-text-faint">
                slippage
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={slippagePct}
                  onChange={(e) =>
                    setSlippagePct(Math.max(0, Math.min(100, Number(e.target.value || "0"))))
                  }
                  className="w-16 border border-border bg-panel px-2 py-0.5 text-text focus-ring"
                />
                %
              </label>
            )}
          </div>
        )}
        {isArbBatcher && !canSell && execMode === "full" && (
          <p className="text-text-faint">
            AtomicArbBatcher detected, but no DEX exit path available for this route — minting will
            send Ⓐ to your wallet (no swap). Select a route with a DEX exit to enable mint+sell.
          </p>
        )}

        {/* step 1: approve */}
        <StepRow
          n={1}
          label={`approve ${execMode === "full" ? st.symbol : im.symbol} → your batcher`}
          sub={
            stepDone
              ? "approved ✓ (on-chain allowance)"
              : approveSim.isLoading
                ? "simulating…"
                : approveSim.data?.ok
                  ? "sim ✓ — executable now"
                  : "sim ✗ — blocked"
          }
          done={stepDone}
          success={null}
          busy={signing && activeStep === 0}
          confirming={confirming && activeStep === 0}
          disabled={stepDone || signing || confirming}
          ctaLabel="approve"
          onClick={() => exec(0)}
        />

        {/* step 2: mint (or mint + swap) */}
        <StepRow
          n={2}
          label={
            useMintAndSwap
              ? `mintAndSwap(${st.symbol}, ${im.symbol}, ${loops}, ${swapPath.map((a) => a.slice(0, 6)).join("→")})`
              : execMode === "full"
                ? `mintFromStable(${st.symbol}, ${im.symbol}, ${loops})`
                : `multiBuyWith(${im.symbol}, ${loops})`
          }
          sub={mintSimStatus}
          done={false}
          success={
            lastMintHash != null ? (
              <span>
                {useMintAndSwap ? "minted + swapped ✓ " : "minted ✓ "}
                <a
                  href={scannerUrl(lastMintHash, "tx")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info hover:underline"
                >
                  {shortenHash(lastMintHash, 8)}
                </a>{" "}
                <CopyButton value={lastMintHash} label="[⎘]" />
              </span>
            ) : null
          }
          busy={signing && activeStep === 1}
          confirming={confirming && activeStep === 1}
          disabled={
            zeroLoops ||
            !stepDone ||
            !mintSim.data?.ok ||
            signing ||
            confirming ||
            overGasCeiling ||
            blockedByBalance
          }
          ctaLabel={useMintAndSwap ? "mint + sell Ⓐ" : "mint Ⓐ"}
          onClick={() => exec(1)}
        />

        {/* network context + warnings */}
        {netQ.data && (
          <p className="text-text-faint">
            network · base fee {formatGwei(netQ.data.baseFeePerGas)} gwei · latest block{" "}
            {(netQ.data.fullness * 100).toFixed(0)}% full
            {netQ.data.blockTimeSeconds != null &&
              ` · ~${netQ.data.blockTimeSeconds.toFixed(0)}s blocks`}
          </p>
        )}
        {(mintGasPct >= 25 || estPctOfBlock >= 25) && !overGasCeiling && !zeroLoops && (
          <p className="text-warn">
            ⚠ gas-heavy transaction (~{formatGas(mintGas)} ≈ {Math.max(mintGasPct, estPctOfBlock)}%
            of a block). It only fits in blocks with enough spare capacity — during network
            congestion it can sit pending for several minutes even at a reasonable gas price. A
            wallet “speed up” re-submits the same nonce and still needs block space — if your wallet
            lets you customize fees, raising the <em>priority fee</em> is the effective lever
            (PulseChain validators keep 100% of it + 75% of the base fee; only 25% is burned).
            Otherwise: wait it out, or split the mint into smaller loops.
          </p>
        )}
        {overGasCeiling && !zeroLoops && (
          <p className="text-err">
            ⚠ {loops.toString()} loops × ~{formatGas(gasPerLoop)} gas ≈ {formatGas(estGas)} — beyond
            the ~{formatGas(GAS_CEILING_PER_TX)} block gas limit (~{loopsGasCeiling.toString()}{" "}
            loops max on the {im.symbol} route in {execMode === "inter" ? "intermediate" : "full"}{" "}
            mode). This transaction would run out of gas; reduce the Ⓐ amount (or split into
            multiple {execMode === "inter" ? "multiBuyWith" : "mintFromStable"} calls).
          </p>
        )}

        <p className="text-text-faint">
          {useMintAndSwap ? (
            <>
              One approval (max, one-time per {st.symbol}) + one atomic tx. The full route —{" "}
              {st.symbol} → {im.symbol} → Generate×N → BuyWith* → Ⓐ → PulseX swap → {st.symbol} to
              you — runs inside your AtomicArbBatcher, so there’s no sandwich window on either the
              mint or the sell. The swap uses the best DEX exit path selected above, with a{" "}
              <strong>{slippagePct}% slippage guard</strong> (reverts if the swap returns less than{" "}
              {100 - slippagePct}% of the expected {st.symbol} amount — protects against sandwich
              attacks; you'd only lose gas on a revert).
            </>
          ) : execMode === "full" ? (
            <>
              One approval (max, one-time per {st.symbol}) + one mint tx. The full route —{" "}
              {st.symbol} → {im.symbol} → Generate×N → BuyWith* → Ⓐ to you — runs atomically inside
              your batcher, so there’s no sandwich window.
            </>
          ) : (
            <>
              One approval (max, one-time per {im.symbol}) + one mint tx. Your batcher pulls the{" "}
              {im.symbol} you hold, runs Generate×N + BuyWith*, and sends{" "}
              {formatUnits(loops * 3n * 10n ** 18n, 18, 0)} Ⓐ to you — atomically. No pStable leg =
              lower gas per loop (~{formatGas(GAS_PER_LOOP_INTER)} vs{" "}
              {formatGas(GAS_PER_LOOP[selection.intermediate])} in full mode).
            </>
          )}
        </p>
      </div>
    </Panel>
  );
}

function StepRow({
  n,
  label,
  sub,
  done,
  success,
  busy,
  confirming,
  disabled,
  ctaLabel,
  onClick,
}: {
  n: number;
  label: string;
  sub: string;
  done: boolean;
  success: React.ReactNode;
  busy: boolean;
  confirming: boolean;
  disabled: boolean;
  ctaLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border border-border bg-panel-2 px-2 py-1.5">
      <span className="text-text-faint">{n}.</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-text">{label}</span>
        <span className="text-text-faint">
          {sub}
          {success != null && <span className="text-ok"> · {success}</span>}
        </span>
      </div>
      <Button variant={done ? "ghost" : "accent"} size="sm" disabled={disabled} onClick={onClick}>
        {done ? "done" : confirming ? "confirming…" : busy ? "signing…" : ctaLabel}
      </Button>
    </div>
  );
}
