// Session transaction log panel — a terminal-flavored "what did I sign?" trail. Mounts as a
// collapsible bottom-docked panel (toggled from the header). Surfaces every write the user
// has signed this session: status (signing/confirming/confirmed/reverted), the label, the tx
// hash (scanner link), and the block confirmed in. Fits the explicit-sign trust posture: the
// user can audit their own activity across the session + a refresh.
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { useWallet } from "@/hooks/useWallet";
import { scannerUrl, shortenHash } from "@/lib/format/address";
import { summarizeStatus, useTxLogStore } from "@/stores/txLog";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

const STATUS_COLOR: Record<string, string> = {
  signing: "var(--c-warn)",
  confirming: "var(--c-info)",
  confirmed: "var(--c-ok)",
  failed: "var(--c-err)",
  reverted: "var(--c-err)",
};

const STATUS_LABEL: Record<string, string> = {
  signing: "signing",
  confirming: "confirming",
  confirmed: "confirmed",
  failed: "failed",
  reverted: "reverted",
};

export function TxPanel() {
  const wallet = useWallet();
  const entries = useTxLogStore((s) => s.entries);
  const clear = useTxLogStore((s) => s.clear);
  const [open, setOpen] = useState(false);
  const summary = summarizeStatus(entries);

  if (!wallet.isConnected) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring border border-border-bright bg-panel-2 px-2 py-1.5 text-xs text-text-dim hover:border-accent-dim hover:text-text"
        title="session transaction log"
      >
        txlog
        {summary.pending > 0 ? (
          <span className="ml-1 text-warn">{summary.pending}●</span>
        ) : (
          <span className="ml-1 text-text-faint">{summary.total}</span>
        )}
      </button>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed bottom-8 right-4 z-50 flex max-h-[70vh] w-[min(560px,92vw)] flex-col border border-border-bright bg-panel">
          <div className="flex items-center gap-2 border-b border-border bg-panel-2 px-3 py-1.5">
            <Dialog.Title className="text-xs uppercase tracking-wider text-text-dim">
              session transaction log
            </Dialog.Title>
            <span className="text-[0.625rem] text-text-faint">
              {summary.total} total · {summary.confirmed}✓ · {summary.pending}… · {summary.failed}✗
            </span>
            <span className="ml-auto" />
            {entries.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clear}>
                clear
              </Button>
            )}
            <Dialog.Close className="text-text-faint hover:text-text" aria-label="close">
              ✕
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {entries.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-text-faint">
                no signed transactions this session. every approval, mint, and deploy you sign will
                appear here for your review.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-2 border border-border bg-panel-2 px-2 py-1.5 text-xs"
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0"
                      style={{ background: STATUS_COLOR[e.status] }}
                      aria-hidden
                    />
                    <span className="text-[0.625rem] uppercase text-text-faint">{e.module}</span>
                    <span className="min-w-0 flex-1 truncate text-text">{e.label}</span>
                    <span style={{ color: STATUS_COLOR[e.status] }}>{STATUS_LABEL[e.status]}</span>
                    {e.hash && (
                      <>
                        <a
                          href={scannerUrl(e.hash, "tx")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-info hover:underline"
                          title={e.hash}
                        >
                          {shortenHash(e.hash, 6)}
                        </a>
                        <CopyButton value={e.hash} label="[⎘]" />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="border-t border-border px-3 py-1.5 text-[0.625rem] leading-snug text-text-faint">
            Persists to localStorage (capped at 50 entries). Nothing is sent to any backend. A
            pending tx that outlives the session is marked stale.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
