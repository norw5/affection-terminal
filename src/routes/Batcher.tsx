// Module C — Smart Batcher Deployment Wizard (P5). Lets each user deploy THEIR OWN instance
// of UnifiedAffectionBatcher (mint-only, default) or the opt-in AtomicArbBatcher (mint+sell)
// from the frontend via wagmi's useDeployContract. The user controls the deployed address
// (it's derived from their wallet nonce). Every deploy is pre-simulated (eth_call with the
// creation data). Once deployed, the user mints through it from /mint (which reads the
// per-wallet saved-batcher memory this wizard writes on deploy-confirm).
import { AddressChip } from "@/components/shared/AddressChip";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { CopyButton } from "@/components/ui/CopyButton";
import { Panel } from "@/components/ui/Panel";
import {
  BATCHERS,
  type BatcherVariant,
  CONSTRUCTOR_ARG_TYPES,
  buildConstructorArgs,
} from "@/config/batcher";
import { useSimulateDeploy } from "@/hooks/useSimulateDeploy";
import { useWallet } from "@/hooks/useWallet";
import { scannerUrl, shortenHash } from "@/lib/format/address";
import { type SavedBatcher, useBatcherStore } from "@/stores/batchers";
import { useTxLogStore } from "@/stores/txLog";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { useDeployContract, useWaitForTransactionReceipt } from "wagmi";

import atomicSrc from "../../contracts/AtomicArbBatcher.sol?raw";
// The committed Solidity sources, imported raw so the wizard can show the annotated source
// the user is about to deploy (audit surface = transparency).
import unifiedSrc from "../../contracts/UnifiedAffectionBatcher.sol?raw";

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
  // Per-field address validation for clear inline error display (F-4 audit fix).
  const invalidParams = useMemo(() => {
    const invalid: Record<string, boolean> = {};
    for (const p of spec.constructorParams) {
      const v = params[p.name] ?? p.default;
      invalid[p.name] = !isAddress(v);
    }
    return invalid;
  }, [params, spec.constructorParams]);
  const hasInvalidParams = Object.values(invalidParams).some(Boolean);
  const simQ = useSimulateDeploy(spec.bytecode, argTypes, args, wallet.address);
  const addTx = useTxLogStore((s) => s.add);
  const setTxStatus = useTxLogStore((s) => s.setStatus);

  // Deploy state.
  const { deployContractAsync, isPending: deployPending } = useDeployContract();
  const [deployHash, setDeployHash] = useState<`0x${string}` | null>(null);
  const [deployedAddr, setDeployedAddr] = useState<Address | null>(null);
  const receiptQ = useWaitForTransactionReceipt({ hash: deployHash ?? undefined });

  // Persisted batcher memory: remembers the wallet's deployed batcher so a refresh doesn't
  // strand the user. /mint reads this same store to offer "use my batcher" automatically.
  const saveBatcher = useBatcherStore((s) => s.save);

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
          Deploy <em>your own</em> full-route atomic batcher from the frontend. Your{" "}
          <code>UnifiedAffectionBatcher</code> does the full route (pStable → intermediate → Ⓐ) in
          one tx, is cap-aware, immutable, and ownerless — no admin keys, no tax, no upgrade path.
          You control the deployed address (it’s derived from your wallet nonce). Once deployed,
          mint through it at{" "}
          <Link to="/mint" className="text-info hover:underline">
            /mint
          </Link>
          .
        </p>
      </section>

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
                {!invalidParams[p.name] && params[p.name] !== p.default && (
                  <span className="text-ok">✓</span>
                )}
              </span>
              <input
                value={params[p.name] ?? p.default}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, [p.name]: e.target.value as Address }))
                }
                className={`border bg-panel-2 px-2 py-1 font-mono text-text focus-ring ${invalidParams[p.name] ? "border-err" : "border-border"}`}
              />
              {invalidParams[p.name] ? (
                <span className="text-xs text-err">not a valid address</span>
              ) : (
                <span className="text-xs text-text-faint">{p.description}</span>
              )}
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
                  hasInvalidParams ||
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
              <div className="flex flex-col gap-2 border border-accent-dim bg-accent/5 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-accent">
                  your batcher is live
                </span>
                <AddressChip name="deployed contract" address={deployedAddr} />
                <Link to="/mint" className="text-xs text-info hover:underline">
                  go to /mint to mint through it ▸
                </Link>
              </div>
            )}
            <p className="text-xs leading-snug text-text-faint">
              The deploy is pre-simulated with an <code>eth_call</code> using the creation data
              (bytecode + constructor args) from your address. The deployed address is derived from
              your wallet nonce — <strong>you control it</strong>. Nothing is auto-signed; the
              deploy is an explicit wallet confirmation. Your deployed batcher is remembered for the
              /mint terminal on this wallet.
            </p>
          </div>
        )}
      </Panel>

      <Panel title={`source — ${spec.name}.sol (annotated, what you're deploying)`}>
        <CodeBlock lang="solidity" code={src} label={`${spec.name}.sol`} />
        <p className="text-xs leading-snug text-text-faint">
          Self-contained Solidity (inline minimal interfaces, no external imports — trivial to
          re-compile and verify). Bytecode: {(spec.bytecode.length - 2) / 2} bytes, ABI:{" "}
          {spec.abi.length} entries. Re-compile locally with <code>npm run compile-batcher</code>.
        </p>
      </Panel>
    </div>
  );
}

// Re-export the saved-batcher type so /mint can import it from the store directly.
export type { SavedBatcher };
