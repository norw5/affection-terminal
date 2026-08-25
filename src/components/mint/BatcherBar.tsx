// The batcher selector bar — the top of the /mint "mint" tab. Owns which batcher is in use
// (remembered from the per-wallet store, or a manually-entered + on-chain-validated address)
// and lifts it to the parent so the execute panel can drive it. If the user has no batcher,
// it offers a link to /batcher to deploy one. Pure client-side; no auto-signing.
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Panel } from "@/components/ui/Panel";
import { BATCHERS, type BatcherVariant } from "@/config/batcher";
import { useWallet } from "@/hooks/useWallet";
import { validateBatcherAddress } from "@/lib/batcher/validate";
import { scannerUrl, shortenAddress } from "@/lib/format/address";
import { type SavedBatcher, getSavedBatcher, useBatcherStore } from "@/stores/batchers";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Abi, Address } from "viem";
import { getAddress } from "viem";

export type ActiveBatcher = {
  address: Address;
  abi: Abi;
  variant: BatcherVariant;
  from: string;
};

export function BatcherBar({
  onActiveBatcher,
}: {
  onActiveBatcher: (batcher: ActiveBatcher | null) => void;
}) {
  const wallet = useWallet();
  const savedBatchers = useBatcherStore((s) => s.saved);
  const saveBatcher = useBatcherStore((s) => s.save);
  const forgetBatcher = useBatcherStore((s) => s.remove);
  const savedEntry = wallet.address ? getSavedBatcher(savedBatchers, wallet.address) : null;

  const [restored, setRestored] = useState<ActiveBatcher | null>(null);
  const [manual, setManual] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lift the active batcher up whenever it changes.
  useEffect(() => {
    onActiveBatcher(restored);
  }, [restored, onActiveBatcher]);

  // Reset the in-use batcher when the wallet changes (a different wallet's batcher has no
  // allowances/balances for this wallet's mints).
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-runs on wallet change to reset state
  useEffect(() => {
    setRestored(null);
    setManual("");
    setError(null);
  }, [wallet.address]);

  async function useSaved() {
    if (!savedEntry) return;
    // Re-validate on-chain before activating (defense-in-depth against tampered localStorage).
    setChecking(true);
    setError(null);
    try {
      const result = await validateBatcherAddress(savedEntry.address);
      if (!result.ok) {
        setError(`remembered batcher failed on-chain check: ${result.error}`);
        return;
      }
      setRestored({
        address: savedEntry.address,
        abi: BATCHERS[result.variant].abi,
        variant: result.variant,
        from: "remembered batcher (re-verified)",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 140) : "re-validation failed");
    } finally {
      setChecking(false);
    }
  }

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
      if (wallet.address) {
        saveBatcher(wallet.address, {
          address: addr,
          variant: result.variant,
          registeredAt: Date.now(),
        });
      }
      setRestored({
        address: addr,
        abi: BATCHERS[result.variant].abi,
        variant: result.variant,
        from: "entered address",
      });
      setManual("");
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 140) : "validation failed");
    } finally {
      setChecking(false);
    }
  }

  return (
    <Panel title="batcher">
      <div className="flex flex-col gap-2 text-xs">
        {!wallet.isConnected ? (
          <p className="text-text-faint">
            Connect a PulseChain wallet to select a batcher. Route estimates above are read-only.
          </p>
        ) : restored ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text-dim">using batcher:</span>
            <a
              href={scannerUrl(restored.address, "address")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info hover:underline"
            >
              {shortenAddress(restored.address, 10)}
            </a>
            <CopyButton value={restored.address} label="[⎘]" />
            <span className="text-text-faint">
              ({BATCHERS[restored.variant].name} · {restored.from})
            </span>
            <Button variant="ghost" size="sm" onClick={() => setRestored(null)}>
              stop using
            </Button>
            {savedEntry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (wallet.address) forgetBatcher(wallet.address);
                  setRestored(null);
                }}
              >
                forget
              </Button>
            )}
          </div>
        ) : savedEntry ? (
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
            <Button variant="accent" size="sm" disabled={checking} onClick={useSaved}>
              {checking ? "verifying…" : "use it ▸"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (wallet.address) forgetBatcher(wallet.address);
              }}
            >
              forget
            </Button>
          </div>
        ) : (
          <p className="text-text-faint">
            No batcher selected. Deploy your own at{" "}
            <Link to="/batcher" className="text-info hover:underline">
              /batcher
            </Link>{" "}
            (one-tx, immutable, ownerless), or paste an existing batcher address below to mint
            through it.
          </p>
        )}

        {!restored && wallet.isConnected && (
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
              disabled={!manual.trim() || checking || wallet.isWrongChain}
              onClick={validateAndUse}
            >
              {checking ? "checking…" : "validate & use"}
            </Button>
          </div>
        )}
        {!restored && error && <p className="text-err">{error}</p>}
        {!restored && !error && wallet.isConnected && (
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

// Re-export the saved-batcher type for the deploy wizard (it writes entries the bar reads).
export type { SavedBatcher };
