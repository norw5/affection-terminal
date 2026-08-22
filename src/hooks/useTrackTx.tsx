// Watch every pending tx in the session log and mirror its on-chain status into the store.
// Uses the viem publicClient to poll `getTransactionReceipt` for each pending hash — this
// returns the full receipt (status + blockNumber), so we can distinguish confirmed vs
// reverted. A refresh, wallet disconnect, or route change doesn't lose the audit trail: the
// store persists to localStorage, and this hook re-attaches to any pending entry on remount.
//
// Mount once at the app root (RootLayout) so the whole session is watched regardless of route.
import { useTxLogStore } from "@/stores/txLog";
import { useEffect } from "react";

const POLL_MS = 8_000;
const MAX_RETRIES = 60; // ~8 minutes of polling before we mark a pending tx as stale.

export function useTrackPendingTxs() {
  const pendingKey = useTxLogStore((s) =>
    s.entries
      .filter((e) => (e.status === "signing" || e.status === "confirming") && e.hash)
      .map((p) => `${p.id}:${p.hash}`)
      .join("|"),
  );
  const setStatus = useTxLogStore((s) => s.setStatus);

  useEffect(() => {
    if (!pendingKey) return;
    let cancelled = false;
    let pollCount = 0;

    const poll = async () => {
      if (cancelled) return;
      pollCount += 1;
      // Re-read the current pending set from the store (avoids capturing a stale array).
      const pending = useTxLogStore
        .getState()
        .entries.filter((e) => (e.status === "signing" || e.status === "confirming") && e.hash);
      if (pending.length === 0) return;
      const { publicClient } = await import("@/lib/rpc/client");
      for (const e of pending) {
        if (!e.hash) continue;
        try {
          const rc = await publicClient.getTransactionReceipt({ hash: e.hash });
          if (rc.status === "success") {
            setStatus(e.id, { status: "confirmed", blockNumber: rc.blockNumber });
          } else {
            setStatus(e.id, { status: "reverted", error: "reverted on-chain" });
          }
        } catch {
          setStatus(e.id, { status: "confirming" });
        }
      }
      if (pollCount >= MAX_RETRIES) {
        for (const e of pending) {
          setStatus(e.id, { status: "failed", error: "stale (no receipt after ~8min)" });
        }
      }
    };

    const iv = window.setInterval(poll, POLL_MS);
    poll();
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [pendingKey, setStatus]);
}
