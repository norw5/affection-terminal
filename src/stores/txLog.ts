import { create } from "zustand";

// Session transaction log — a terminal-flavored "what did I sign?" trail. Every write flow
// (mint, approve, deploy) appends an entry here so the user can audit their own activity
// across the session (fits the explicit-sign trust posture: nothing auto-signs, and the
// signed actions are surfaced for review). Persists to localStorage so a refresh doesn't
// wipe the audit trail; capped to the last N entries so it never grows unbounded.

export type TxStatus = "signing" | "confirming" | "confirmed" | "failed" | "reverted";

export type TxEntry = {
  /** Client-generated id (timestamp + counter) so React keys are stable. */
  id: string;
  /** Where the tx originated — surfaces in the TxPanel header. */
  module: "mint" | "batcher" | "raw";
  /** One-line human label, e.g. "approve pDAI → MultiMath" or "deploy UnifiedAffectionBatcher". */
  label: string;
  /** The tx hash once the wallet returns it (null while signing). */
  hash?: `0x${string}`;
  /** Live status — updated by the useTrackTx hook (wagmi useTransactionConfirmations). */
  status: TxStatus;
  /** Block confirmed in (set on confirmed). */
  blockNumber?: bigint;
  /** Set when status flips to failed/reverted (the short revert reason). */
  error?: string;
  /** ISO timestamp of the signing request (for the audit trail ordering). */
  requestedAt: number;
  /** ISO timestamp of the final state (confirmed/failed/reverted). */
  settledAt?: number;
};

type TxLogState = {
  entries: TxEntry[];
  add: (entry: Omit<TxEntry, "id" | "requestedAt" | "status">) => string;
  setStatus: (id: string, patch: Partial<TxEntry>) => void;
  clear: () => void;
};

const MAX_ENTRIES = 50;
const STORAGE_KEY = "aff-terminal-txlog";

function loadInitial(): TxEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TxEntry[];
    // Re-hydrate bigint blockNumber (JSON has no bigint).
    return parsed.map((e) => ({
      ...e,
      blockNumber: typeof e.blockNumber === "string" ? BigInt(e.blockNumber) : undefined,
      // Any tx still "signing"/"confirming" on reload is stale — mark it as needing attention.
      status: e.status === "signing" || e.status === "confirming" ? "failed" : e.status,
      error:
        e.status === "signing" || e.status === "confirming" ? "stale (session ended)" : e.error,
    }));
  } catch {
    return [];
  }
}

function persist(entries: TxEntry[]) {
  if (typeof localStorage === "undefined") return;
  // Serialize bigint blockNumber → string for JSON.
  const serializable = entries.map((e) => ({
    ...e,
    blockNumber: e.blockNumber?.toString(),
  }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // storage quota / private mode — non-fatal; the in-memory log still works.
  }
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

export const useTxLogStore = create<TxLogState>((set) => ({
  entries: loadInitial(),
  add: (entry) => {
    const id = nextId();
    const full: TxEntry = {
      ...entry,
      id,
      status: "signing",
      requestedAt: Date.now(),
    };
    set((s) => {
      const next = [full, ...s.entries].slice(0, MAX_ENTRIES);
      persist(next);
      return { entries: next };
    });
    return id;
  },
  setStatus: (id, patch) => {
    set((s) => {
      const next = s.entries.map((e) =>
        e.id === id
          ? {
              ...e,
              ...patch,
              // Auto-set settledAt when transitioning to a terminal state.
              settledAt:
                patch.status && ["confirmed", "failed", "reverted"].includes(patch.status)
                  ? (patch.settledAt ?? Date.now())
                  : e.settledAt,
            }
          : e,
      );
      persist(next);
      return { entries: next };
    });
  },
  clear: () => {
    persist([]);
    set({ entries: [] });
  },
}));

// Pure helpers (unit-tested) — kept here so tests don't need zustand.
export function summarizeStatus(entries: TxEntry[]): {
  total: number;
  pending: number;
  confirmed: number;
  failed: number;
} {
  let pending = 0;
  let confirmed = 0;
  let failed = 0;
  for (const e of entries) {
    if (e.status === "signing" || e.status === "confirming") pending++;
    else if (e.status === "confirmed") confirmed++;
    else if (e.status === "failed" || e.status === "reverted") failed++;
  }
  return { total: entries.length, pending, confirmed, failed };
}
