// Module C — Smart Batcher & Deployment Wizard (P5). Lets each user deploy THEIR OWN
// instance of UnifiedAffectionBatcher (mint-only, default) or the opt-in AtomicArbBatcher
// (mint+sell) from the frontend via wagmi's useDeployContract. The user controls the
// deployed address (it's derived from their wallet nonce). Every deploy is pre-simulated
// (eth_call with the creation data). After deploy, "mint via my batcher" offers the
// 2-step atomic route (approve pStable → batcher.mintFromStable) — a strict upgrade over
// the legacy 4-step in /mint.
import { AddressChip } from "@/components/shared/AddressChip";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { CopyButton } from "@/components/ui/CopyButton";
import { Panel } from "@/components/ui/Panel";
import { erc20Abi } from "@/config/abis/math.abi";
import {
  BATCHERS,
  type BatcherVariant,
  CONSTRUCTOR_ARG_TYPES,
  buildConstructorArgs,
} from "@/config/batcher";
import {
  BLOCK_GAS_LIMIT_APPROX,
  GAS_PER_LOOP,
  INTERMEDIATES,
  STABLES,
  maxLoopsPerTx,
} from "@/config/mint";
import { AFFECTION_ADDR, PDAI_ADDR } from "@/config/registry";
import { formatGas, formatGwei, useNetworkContext } from "@/hooks/useNetworkContext";
import { useSimulateDeploy } from "@/hooks/useSimulateDeploy";
import { useWallet } from "@/hooks/useWallet";
import { scannerUrl, shortenAddress, shortenHash } from "@/lib/format/address";
import { formatUnits, parseWholeInput } from "@/lib/format/units";
import { publicClient } from "@/lib/rpc/client";
import { type SavedBatcher, getSavedBatcher, useBatcherStore } from "@/stores/batchers";
import { useTxLogStore } from "@/stores/txLog";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { Abi, Address } from "viem";
import { getAddress } from "viem";
import { useDeployContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import atomicSrc from "../../contracts/AtomicArbBatcher.sol?raw";
// The committed Solidity sources, imported raw so the wizard can show the annotated source
// the user is about to deploy (audit surface = transparency).
import unifiedSrc from "../../contracts/UnifiedAffectionBatcher.sol?raw";

const ROUTES: Array<{ intermediate: "G5" | "PI" | "MATH"; stable: "pDAI" | "pUSDC" }> = [
  { intermediate: "MATH", stable: "pDAI" },
  { intermediate: "MATH", stable: "pUSDC" },
  { intermediate: "G5", stable: "pDAI" },
  { intermediate: "PI", stable: "pDAI" },
];

const MAX_ALLOWANCE = 2n ** 256n - 1n;
const SIM_GAS = 42_000_000n;
const GAS_CEILING_DISPLAY = 40_500_000n;

// Probe ABI for validating a user-entered batcher address: both variants expose the
// immutable AFFECTION()/PDAI() views; only AtomicArbBatcher exposes ROUTER().
const BATCHER_PROBE_ABI = [
  {
    type: "function",
    name: "AFFECTION",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "PDAI",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ROUTER",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;

/** Validate a candidate batcher address on-chain: contract exists, its immutables point at
 *  the canonical AFFECTION + pDAI, and detect which variant it is (ROUTER() present). */
async function validateBatcherAddress(
  addr: Address,
): Promise<{ ok: true; variant: BatcherVariant } | { ok: false; error: string }> {
  const code = await publicClient.getCode({ address: addr });
  if (!code || code === "0x") return { ok: false, error: "no contract deployed at this address" };
  try {
    const [aff, pdai] = await Promise.all([
      publicClient.readContract({
        address: addr,
        abi: BATCHER_PROBE_ABI,
        functionName: "AFFECTION",
      }),
      publicClient.readContract({ address: addr, abi: BATCHER_PROBE_ABI, functionName: "PDAI" }),
    ]);
    if (
      (aff as string).toLowerCase() !== AFFECTION_ADDR.toLowerCase() ||
      (pdai as string).toLowerCase() !== PDAI_ADDR.toLowerCase()
    ) {
      return {
        ok: false,
        error:
          "contract found, but its immutables are not the canonical AFFECTION/pDAI — not one of this portal's batchers",
      };
    }
    try {
      await publicClient.readContract({
        address: addr,
        abi: BATCHER_PROBE_ABI,
        functionName: "ROUTER",
      });
      return { ok: true, variant: "mint-sell" };
    } catch {
      return { ok: true, variant: "mint-only" };
    }
  } catch {
    return {
      ok: false,
      error: "contract found, but it does not expose the batcher views (AFFECTION/PDAI)",
    };
  }
}

export function Batcher() {
  const wallet = useWallet();
  const [variant, setVariant] = useState<BatcherVariant>("mint-only");
  const spec = BATCHERS[variant];
  const src = variant === "mint-only" ? unifiedSrc : atomicSrc;

  // Constructor params (defaulted to canonical; the wizard lets you override).
  const [params, setParams] = useState<Record<string, Address>>(() => {
    const init: Record<string, Address> = {};
    for (const v of Object.values(BATCHERS)) {
      for (const p of v.constructorParams) init[p.name] = p.default;
    }
    return init;
  });

  const argTypes = CONSTRUCTOR_ARG_TYPES.find((t) => t.variant === variant)?.types ?? [];
  const args = useMemo(() => buildConstructorArgs(variant, params), [variant, params]);
  const simQ = useSimulateDeploy(spec.bytecode, argTypes, args, wallet.address);
  const addTx = useTxLogStore((s) => s.add);
  const setTxStatus = useTxLogStore((s) => s.setStatus);

  // Deploy state.
  const { deployContractAsync, isPending: deployPending } = useDeployContract();
  const [deployHash, setDeployHash] = useState<`0x${string}` | null>(null);
  const [deployedAddr, setDeployedAddr] = useState<Address | null>(null);
  const receiptQ = useWaitForTransactionReceipt({ hash: deployHash ?? undefined });

  // Persisted batcher memory: remembers the wallet's deployed (or registered) batcher so a
  // refresh doesn't strand the user on the deploy step. `restored` is the in-use entry set
  // via "use my batcher" (saved entry) or a validated manual address.
  const savedBatchers = useBatcherStore((s) => s.saved);
  const saveBatcher = useBatcherStore((s) => s.save);
  const forgetBatcher = useBatcherStore((s) => s.remove);
  const savedEntry = wallet.address ? getSavedBatcher(savedBatchers, wallet.address) : null;
  const [restored, setRestored] = useState<{ address: Address; abi: Abi; from: string } | null>(
    null,
  );

  // On receipt, surface the deployed address from the contractCreated log + remember it.
  useEffect(() => {
    if (receiptQ.data?.contractAddress) {
      const addr = receiptQ.data.contractAddress as Address;
      setDeployedAddr(addr);
      if (wallet.address) {
        saveBatcher(wallet.address, {
          address: addr,
          variant,
          registeredAt: Date.now(),
          deployHash: receiptQ.data.transactionHash,
        });
      }
    }
  }, [
    receiptQ.data?.contractAddress,
    receiptQ.data?.transactionHash,
    wallet.address,
    variant,
    saveBatcher,
  ]);

  // Auto-offer (but don't auto-enable) the remembered batcher when one exists and nothing
  // is in use yet — the user explicitly clicks "use".
  const activeBatcher =
    restored ??
    (deployedAddr
      ? {
          address: deployedAddr,
          abi: spec.abi,
          from: "this session's deploy",
        }
      : null);

  async function useSavedBatcher() {
    if (!savedEntry) return;
    const abi = BATCHERS[savedEntry.variant].abi;
    setRestored({ address: savedEntry.address, abi, from: "remembered batcher" });
  }

  // Reset the in-use restored batcher when the wallet changes (a different wallet's
  // batcher has no allowances/balances for this wallet's mints).
  useEffect(() => {
    setRestored(null);
  }, [wallet.address]);

  // Reset deployed address when the params/variant change (a new deploy = a new address).
  // `argsKey` is a stable summary of the deploy inputs; referencing it here satisfies the
  // exhaustive-deps rule (the reset is its only purpose).
  const argsKey = `${variant}:${args.map((a) => a.toLowerCase()).join("|")}`;
  useEffect(() => {
    if (!argsKey) return;
    setDeployedAddr(null);
    setDeployHash(null);
  }, [argsKey]);

  async function deploy() {
    if (!wallet.address) return;
    setDeployedAddr(null);
    setDeployHash(null);
    const txId = addTx({ module: "batcher", label: `deploy ${spec.name}` });
    try {
      const hash = await deployContractAsync({
        abi: spec.abi,
        bytecode: spec.bytecode,
        args,
      });
      setDeployHash(hash);
      setTxStatus(txId, { hash, status: "confirming" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxStatus(txId, { status: "failed", error: msg.slice(0, 120) });
    }
  }

  const routerEmpty =
    variant === "mint-sell" && params.router === "0x0000000000000000000000000000000000000000";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <section className="flex flex-col gap-1">
        <h1 className="text-xl text-accent">Smart Batcher &amp; Deployment Wizard</h1>
        <p className="text-text-dim">
          Deploy <em>your own</em> full-route atomic batcher from the frontend. Older community
          multi-mints are fragmented per target (one mints the intermediate, another mints Ⓐ) — two
          txs with a sandwich window, plus an admin surface on the deployed contracts. Your own{" "}
          <code>UnifiedAffectionBatcher</code> does the full route in one tx, is cap-aware,
          immutable, and ownerless. You control the deployed address.
        </p>
      </section>

      <UseExistingBatcher
        wallet={wallet}
        savedEntry={savedEntry}
        activeBatcher={activeBatcher}
        onUse={useSavedBatcher}
        onStopUsing={() => setRestored(null)}
        onForget={() => {
          if (wallet.address) forgetBatcher(wallet.address);
          setRestored(null);
        }}
        onValidated={(address, detected) => {
          if (wallet.address) {
            saveBatcher(wallet.address, {
              address,
              variant: detected,
              registeredAt: Date.now(),
            });
          }
          setRestored({
            address,
            abi: BATCHERS[detected].abi,
            from: "entered address",
          });
        }}
      />

      <Panel title="1 · choose a variant">
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2 border border-border bg-panel-2 px-3 py-2 text-xs">
            <input
              type="radio"
              name="variant"
              checked={variant === "mint-only"}
              onChange={() => setVariant("mint-only")}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-text">
                UnifiedAffectionBatcher <span className="text-accent">(recommended)</span>
              </span>
              <span className="text-text-dim">
                Mint-only. Full route pStable → intermediate → Ⓐ in one tx. No DEX interaction =
                small audit surface.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 border border-border bg-panel-2 px-3 py-2 text-xs">
            <input
              type="radio"
              name="variant"
              checked={variant === "mint-sell"}
              onChange={() => setVariant("mint-sell")}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-text">AtomicArbBatcher (opt-in)</span>
              <span className="text-warn">
                ⚠ Adds a PulseX V2 swap leg so mint + sell happen in one tx (defeats sell-side
                sniping). The sell leg adds DEX-interaction audit surface. Only use this if you
                understand the router interaction.
              </span>
            </span>
          </label>
        </div>
      </Panel>

      <Panel title="2 · constructor params (default = canonical)">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {spec.constructorParams.map((p) => (
            <label key={p.name} className="flex flex-col gap-1 text-xs text-text-faint">
              <span className="flex items-center gap-1">
                {p.label} <span className="text-text-faint">({p.name})</span>
              </span>
              <input
                value={params[p.name] ?? p.default}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, [p.name]: e.target.value as Address }))
                }
                className="border border-border bg-panel-2 px-2 py-1 font-mono text-text focus-ring"
              />
              <span className="text-xs text-text-faint">{p.description}</span>
            </label>
          ))}
        </div>
        {routerEmpty && (
          <p className="mt-2 text-xs text-err">
            PulseX V2 router address required for the mint+sell variant. Verify it on-chain before
            deploying — the router is outside the AFFECTION/MATH contract set.
          </p>
        )}
        <p className="mt-2 text-xs leading-snug text-text-faint">
          The constructor sets the immutable addresses and does the one-time max-approvals (pStables
          → {"{MATH,G5,PI}"}; intermediates → AFFECTION). No owner, no upgrade, no pause — once
          deployed it's immutable forever.
        </p>
      </Panel>

      <Panel title="3 · simulate then deploy">
        {!wallet.isConnected ? (
          <p className="text-xs text-text-dim">Connect a PulseChain wallet to deploy.</p>
        ) : wallet.isWrongChain ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-warn">Wrong chain — switch to PulseChain (id 369).</p>
            <Button variant="accent" size="sm" onClick={() => wallet.switchChain()}>
              switch chain
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button
                variant="accent"
                size="sm"
                disabled={
                  !simQ.data?.ok ||
                  routerEmpty ||
                  deployPending ||
                  (!!deployHash && !receiptQ.isSuccess)
                }
                onClick={deploy}
              >
                {deployPending
                  ? "signing…"
                  : !!deployHash && !receiptQ.isSuccess
                    ? "confirming…"
                    : "deploy my batcher"}
              </Button>
              <span className="text-text-faint">
                sim:{" "}
                {simQ.isLoading
                  ? "probing…"
                  : simQ.data?.ok
                    ? "✓ creation eth_call did not revert"
                    : `✗ ${simQ.data?.error ?? "failed"}`}
              </span>
            </div>
            {deployHash && (
              <p className="text-xs text-text-dim">
                tx{" "}
                <a
                  href={scannerUrl(deployHash, "tx")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info hover:underline"
                >
                  {shortenHash(deployHash, 10)}
                </a>{" "}
                <CopyButton value={deployHash} label="[⎘]" />
                {receiptQ.isLoading
                  ? "confirming…"
                  : receiptQ.isSuccess
                    ? "confirmed ✓"
                    : "pending"}
              </p>
            )}
            {deployedAddr && (
              <div className="flex flex-col gap-1 border border-accent-dim bg-accent/5 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-accent">
                  your batcher is live
                </span>
                <AddressChip name="deployed contract" address={deployedAddr} />
              </div>
            )}
            <p className="text-xs leading-snug text-text-faint">
              The deploy is pre-simulated with an <code>eth_call</code> using the creation data
              (bytecode + constructor args) from your address. The deployed address is derived from
              your wallet nonce — <strong>you control it</strong>. Nothing is auto-signed; the
              deploy is an explicit wallet confirmation.
            </p>
          </div>
        )}
      </Panel>

      {activeBatcher && wallet.isConnected && (
        <MintViaBatcher deployedAddr={activeBatcher.address} abi={activeBatcher.abi} />
      )}

      <Panel title={`source — ${spec.name}.sol (annotated, what you're deploying)`}>
        <CodeBlock lang="solidity" code={src} label={`${spec.name}.sol`} />
        <p className="text-xs leading-snug text-text-faint">
          Self-contained Solidity (inline minimal interfaces, no external imports — trivial to
          re-compile and verify). Bytecode: {(spec.bytecode.length - 2) / 2} bytes, ABI:{" "}
          {spec.abi.length} entries. Re-compile locally with <code>npm run compile-batcher</code>.
        </p>
      </Panel>

      <Panel title="older community batchers (non-endorsed)">
        <p className="mb-2 text-xs text-text-dim">
          Community-deployed multi-mint batchers predate this portal. They are not maintained or
          vouched for here — analysis of their deployed bytecode shows an admin surface (owner,
          settable tax, withdrawal functions) — and their deployed ABI differs from the source
          copies that circulated. They remain drivable from the /mint Tier-2 compatibility mode,
          with live tax read + per-step pre-simulation.
        </p>
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex gap-2">
            <span className="text-text-dim">vs legacy</span>
            <a
              href={scannerUrl("0x81fcd03D2100A0fE9767C0CfC68050bdc6a2969d", "address")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info hover:underline"
            >
              MultiAffection
            </a>
            <span className="text-text-faint">
              — 2 txs (pStable→MATH, then MATH→Ⓐ) with a sandwich window, admin surface.
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-text-dim">your batcher</span>
            <span className="text-ok">
              — 1 tx, full route atomic, cap-aware, ownerless, no tax.
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs leading-snug text-text-faint">
          The recommended path is deploying your own batcher above. The design + economics are
          documented in{" "}
          <Link
            to="/kb/$doc"
            params={{ doc: "04_multi_mint_contracts" }}
            className="text-info hover:underline"
          >
            batch minting
          </Link>
          .
        </p>
      </Panel>
    </div>
  );
}

// ─── Use an existing batcher (saved or manually entered) ───────────────────────

/** Panel 0: skip the deploy entirely if you already have a batcher. Remembers deploys per
 *  wallet (localStorage), re-validates any address on-chain before enabling the mint UI,
 *  and accepts a manually-entered address. */
function UseExistingBatcher({
  wallet,
  savedEntry,
  activeBatcher,
  onUse,
  onStopUsing,
  onForget,
  onValidated,
}: {
  wallet: ReturnType<typeof useWallet>;
  savedEntry: SavedBatcher | null;
  activeBatcher: { address: Address; abi: Abi; from: string } | null;
  onUse: () => void;
  onStopUsing: () => void;
  onForget: () => void;
  onValidated: (address: Address, variant: BatcherVariant) => void;
}) {
  const [manual, setManual] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function validateAndUse() {
    setError(null);
    let addr: Address;
    try {
      addr = getAddress(manual.trim());
    } catch {
      setError("not a valid address");
      return;
    }
    setChecking(true);
    try {
      const result = await validateBatcherAddress(addr);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onValidated(addr, result.variant);
      setManual("");
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 140) : "validation failed");
    } finally {
      setChecking(false);
    }
  }

  return (
    <Panel title="0 · already have a batcher? (skip the deploy)">
      <div className="flex flex-col gap-2 text-xs">
        {activeBatcher ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text-dim">in use:</span>
            <a
              href={scannerUrl(activeBatcher.address, "address")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info hover:underline"
            >
              {shortenAddress(activeBatcher.address, 10)}
            </a>
            <CopyButton value={activeBatcher.address} label="[⎘]" />
            <span className="text-text-faint">({activeBatcher.from})</span>
            <Button variant="ghost" size="sm" onClick={onStopUsing}>
              stop using
            </Button>
            {savedEntry && (
              <Button variant="ghost" size="sm" onClick={onForget}>
                forget
              </Button>
            )}
          </div>
        ) : savedEntry && wallet.isConnected ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text-dim">your remembered batcher:</span>
            <a
              href={scannerUrl(savedEntry.address, "address")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info hover:underline"
            >
              {shortenAddress(savedEntry.address, 10)}
            </a>
            <CopyButton value={savedEntry.address} label="[⎘]" />
            <span className="text-text-faint">
              ({BATCHERS[savedEntry.variant].name} · registered{" "}
              {new Date(savedEntry.registeredAt).toLocaleDateString()})
            </span>
            <Button variant="accent" size="sm" onClick={onUse}>
              use it ▸
            </Button>
            <Button variant="ghost" size="sm" onClick={onForget}>
              forget
            </Button>
          </div>
        ) : (
          <p className="text-text-faint">
            {wallet.isConnected
              ? "Deploy below, or paste an existing batcher address to mint through it."
              : "Connect a wallet to see your remembered batcher, deploy one, or register an existing address."}
          </p>
        )}

        {!activeBatcher && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={manual}
              onChange={(e) => {
                setManual(e.target.value);
                setError(null);
              }}
              placeholder="0x… your batcher contract address"
              className="min-w-64 flex-1 border border-border bg-panel-2 px-2 py-1 font-mono text-text focus-ring"
            />
            <Button
              variant="accent"
              size="sm"
              disabled={!manual.trim() || checking || !wallet.isConnected || wallet.isWrongChain}
              onClick={validateAndUse}
            >
              {checking ? "checking…" : "validate & use"}
            </Button>
          </div>
        )}
        {!activeBatcher && error && <p className="text-err">{error}</p>}
        {!activeBatcher && !error && (
          <p className="text-text-faint">
            The address is checked on-chain (contract exists + its immutables point at the canonical
            AFFECTION/pDAI) before the mint UI unlocks. Approvals already granted to that batcher
            are picked up automatically — no re-approval needed.
          </p>
        )}
      </div>
    </Panel>
  );
}

// ─── Mint via the user's batcher (deployed here, remembered, or registered) ────
// A 2-step atomic route (approve pStable → batcher.mintFromStable) — a strict upgrade over
// the legacy 4-step in /mint. Each step pre-simulated; nothing auto-signs.

function MintViaBatcher({ deployedAddr, abi }: { deployedAddr: Address; abi: Abi }) {
  const wallet = useWallet();
  const netQ = useNetworkContext();
  const [routeIdx, setRouteIdx] = useState(0);
  const chosen = ROUTES[routeIdx];
  const im = INTERMEDIATES[chosen.intermediate];
  const st = STABLES[chosen.stable];
  const [loops, setLoops] = useState(100n);
  const [done, setDone] = useState<Set<number>>(new Set());

  const stableCost = loops * 3n * 10n ** BigInt(st.decimals);
  const loopsGasCeiling = maxLoopsPerTx(chosen.intermediate);
  const estGas = loops * GAS_PER_LOOP[chosen.intermediate]; // measured per-loop model
  const estPctOfBlock = Math.round(
    (Number(estGas) * 100) / Number(netQ.data?.blockGasLimit ?? BLOCK_GAS_LIMIT_APPROX),
  );

  // Live allowance read: if this wallet already approved this stable to this batcher (e.g.
  // before a refresh, or when re-registering an existing batcher), the approve step is
  // already done on-chain — no redundant approval tx is requested.
  const allowQ = useQuery<bigint>({
    queryKey: [
      "batcher-allowance",
      wallet.address ?? null,
      st.address.toLowerCase(),
      deployedAddr.toLowerCase(),
    ],
    enabled: !!wallet.address,
    queryFn: async () => {
      if (!wallet.address) return 0n;
      return (await publicClient.readContract({
        address: st.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [wallet.address, deployedAddr],
      })) as bigint;
    },
    refetchInterval: 12_000,
    staleTime: 8_000,
  });
  const approveDone =
    done.has(0) || (allowQ.data != null && allowQ.data >= stableCost && stableCost > 0n);

  // Pre-simulate both steps (eth_call from the user's address).
  const approveSim = useSimulateBatcherStep(wallet.address, st.address, erc20Abi, "approve", [
    deployedAddr,
    MAX_ALLOWANCE,
  ]);
  const mintSim = useSimulateBatcherStep(wallet.address, deployedAddr, abi, "mintFromStable", [
    st.address,
    im.address,
    loops,
    0n,
  ]);

  // Execution.
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const addTx = useTxLogStore((s) => s.add);
  const setTxStatus = useTxLogStore((s) => s.setStatus);
  const [execHash, setExecHash] = useState<`0x${string}` | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const receiptQ = useWaitForTransactionReceipt({ hash: execHash ?? undefined });
  // Transient success marker for the (repeatable) mint step — unlike the one-time approve,
  // a completed mint must not latch the button to "done"; the user may mint again. Cleared
  // when the inputs change or a new mint starts.
  const [lastMintHash, setLastMintHash] = useState<`0x${string}` | null>(null);

  useEffect(() => {
    if (receiptQ.isSuccess && activeStep !== null && execHash) {
      if (receiptQ.data?.status === "success") {
        if (activeStep === 1) {
          setLastMintHash(execHash);
        } else {
          setDone((prev) => new Set(prev).add(activeStep));
        }
      }
      setActiveStep(null);
      setExecHash(null);
      // re-simulate the next step (its dependency just landed)
      approveSim.refetch();
      mintSim.refetch();
      allowQ.refetch();
    }
  }, [receiptQ.isSuccess, receiptQ.data, activeStep, execHash, approveSim, mintSim, allowQ]);

  async function exec(step: number, kind: "approve" | "mint") {
    if (!wallet.address) return;
    if (kind === "mint") setLastMintHash(null);
    setActiveStep(step);
    setExecHash(null);
    const label =
      kind === "approve"
        ? `approve ${st.symbol} → my batcher`
        : `mintFromStable(${st.symbol}, ${im.symbol}, ${loops})`;
    const txId = addTx({ module: "batcher", label });
    try {
      const hash =
        kind === "approve"
          ? await writeContractAsync({
              address: st.address,
              abi: erc20Abi,
              functionName: "approve",
              args: [deployedAddr, MAX_ALLOWANCE],
            })
          : await writeContractAsync({
              address: deployedAddr,
              abi,
              functionName: "mintFromStable",
              args: [st.address, im.address, loops, 0n],
            });
      setExecHash(hash);
      setTxStatus(txId, { hash, status: "confirming" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxStatus(txId, { status: "failed", error: msg.slice(0, 120) });
      setActiveStep(null);
      setExecHash(null);
    }
  }

  const confirming = activeStep !== null && !!execHash && !receiptQ.isSuccess;
  const signing = activeStep !== null && writePending && !execHash;

  return (
    <Panel
      title="4 · mint via your batcher (2-step atomic)"
      actions={
        <span className="flex items-center gap-1 text-text-faint">
          {shortenAddress(deployedAddr, 8)}
          <CopyButton value={deployedAddr} label="[⎘]" />
        </span>
      }
    >
      <div className="flex flex-col gap-3 text-xs">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-text-faint">
            route
            <select
              value={routeIdx}
              onChange={(e) => {
                setRouteIdx(Number(e.target.value));
                setDone(new Set());
                setLastMintHash(null);
              }}
              className="border border-border bg-panel-2 px-2 py-1 text-text focus-ring"
            >
              {ROUTES.map((r, i) => (
                <option key={`${r.intermediate}-${r.stable}`} value={i}>
                  {r.intermediate} · {r.stable}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-text-faint">
            loops (Generate calls)
            <input
              type="number"
              min={1}
              value={Number(loops)}
              onChange={(e) => {
                setLoops(parseWholeInput(e.target.value));
                setDone(new Set());
                setLastMintHash(null);
              }}
              className="w-28 border border-border bg-panel-2 px-2 py-1 text-text focus-ring"
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-text-faint">→ mints</span>
            <span className="text-text">{formatUnits(loops * 3n * 10n ** 18n, 18, 2)} Ⓐ</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-text-faint">→ cost</span>
            <span className="text-text">
              {formatUnits(stableCost, st.decimals, 2)} {st.symbol}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <StepRow
            n={1}
            label={`approve ${st.symbol} → your batcher`}
            sub={
              approveDone
                ? "approved ✓ (on-chain allowance)"
                : approveSim.isLoading
                  ? "simulating…"
                  : approveSim.data?.ok
                    ? "sim ✓ — executable now"
                    : "sim ✗ — blocked"
            }
            done={approveDone}
            busy={signing && activeStep === 0}
            confirming={confirming && activeStep === 0}
            disabled={approveDone || signing || confirming}
            ctaLabel="approve"
            onClick={() => exec(0, "approve")}
          />
          <StepRow
            n={2}
            label={`${im.symbol} route · mintFromStable(${st.symbol}, ${im.symbol}, ${loops})`}
            sub={
              mintSim.isLoading
                ? "simulating…"
                : mintSim.data?.ok
                  ? `sim ✓ · ~${mintSim.data.gasEstimate ? formatGas(mintSim.data.gasEstimate) : formatGas(estGas)} gas (${estPctOfBlock}% of a block) — executable now`
                  : "sim ✗ — blocked (approve first)"
            }
            success={
              lastMintHash != null
                ? `minted ✓ (${shortenHash(lastMintHash, 8)} — mint again below)`
                : null
            }
            busy={signing && activeStep === 1}
            confirming={confirming && activeStep === 1}
            disabled={
              !approveDone || !mintSim.data?.ok || signing || confirming || loops > loopsGasCeiling
            }
            ctaLabel="mint Ⓐ"
            onClick={() => exec(1, "mint")}
          />
        </div>
        {netQ.data && (
          <p className="text-xs text-text-faint">
            network · base fee {formatGwei(netQ.data.baseFeePerGas)} gwei · latest block{" "}
            {(netQ.data.fullness * 100).toFixed(0)}% full
            {netQ.data.blockTimeSeconds != null &&
              ` · ~${netQ.data.blockTimeSeconds.toFixed(0)}s blocks`}
          </p>
        )}
        {estPctOfBlock >= 25 && (
          <p className="text-xs text-warn">
            ⚠ gas-heavy transaction (~{formatGas(estGas)} ≈ {estPctOfBlock}% of a block). It only
            fits in blocks with enough spare capacity — during network congestion it can sit pending
            for several minutes even at a reasonable gas price. A wallet "speed up" re-submits the
            same nonce and still needs block space — if your wallet lets you customize fees, raising
            the <em>priority fee</em> is the effective lever (PulseChain validators keep 100% of it
            + 75% of the base fee; only 25% is burned). Otherwise: wait it out, or split the mint
            into smaller loops.
          </p>
        )}
        {loops > loopsGasCeiling && (
          <p className="text-xs text-err">
            ⚠ {loops.toString()} loops × ~{formatGas(GAS_PER_LOOP[chosen.intermediate])} gas ≈{" "}
            {formatGas(estGas)} — beyond the ~{formatGas(GAS_CEILING_DISPLAY)} block gas limit (~
            {loopsGasCeiling.toString()} loops max on the {im.symbol} route). This transaction would
            run out of gas; reduce the loops.
          </p>
        )}
        <p className="text-xs leading-snug text-text-faint">
          One approval (max, one-time per stable) + one mint tx. The full route — pStable →
          intermediate → Generate×N → BuyWith* → Ⓐ to you — runs atomically inside your batcher, so
          there's no sandwich window. Compare to the legacy 4-step in{" "}
          <Link to="/mint" className="text-info hover:underline">
            /mint
          </Link>
          .
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
  /** one-time steps (approve) latch to a disabled "done" button */
  done?: boolean;
  /** repeatable steps (mint) show a transient success marker instead — the button stays live */
  success?: string | null;
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
        <span className="text-xs text-text-faint">
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

// Pre-simulate a single contract call from the user's address (eth_call probe).
// Passing sims also carry an eth_estimateGas figure so the UI can warn about
// block-sized transactions (large mints can take minutes to confirm during congestion).
function useSimulateBatcherStep(
  address: Address | undefined,
  contract: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
) {
  return useQuery<{ ok: boolean; gasEstimate?: bigint }>({
    queryKey: [
      "batcher-mint-sim",
      address ?? null,
      contract.toLowerCase(),
      functionName,
      args.map((a) => (typeof a === "bigint" ? a.toString() : String(a))).join("|"),
    ],
    enabled: !!address,
    queryFn: async () => {
      if (!address) return { ok: false };
      const request = {
        address: contract,
        abi,
        functionName,
        args: args as never,
        account: address,
      } as const;
      try {
        await publicClient.simulateContract({ ...request, gas: SIM_GAS });
      } catch {
        return { ok: false };
      }
      let gasEstimate: bigint | undefined;
      try {
        gasEstimate = await publicClient.estimateGas(request);
      } catch {
        gasEstimate = undefined;
      }
      return { ok: true, gasEstimate };
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
