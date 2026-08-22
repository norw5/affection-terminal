import { create } from "zustand";

// Deployed-batcher memory (Module C). A batcher's address is derived from the deployer's
// wallet nonce, so "my batcher" is a stable per-wallet fact — this store remembers it so a
// refresh doesn't strand the user on the deploy step when they already have one live.
// Also accepts manually-entered addresses (any batcher the user controls/knows). The user
// can always forget an entry. Pure client-side localStorage — no backend, no telemetry.
//
// NOTE on trust: a remembered address is a convenience, not a guarantee. The wizard
// re-validates any restored/entered address on-chain (eth_getCode + the AFFECTION()
// immutable returning the canonical AFFECTION address) before enabling the mint UI.

import type { Address } from "viem";

export type SavedBatcher = {
  /** The deployed batcher contract address. */
  address: Address;
  /** Which variant was deployed ("mint-only" | "mint-sell") — picks the ABI for the mint UI. */
  variant: "mint-only" | "mint-sell";
  /** ISO timestamp of when it was deployed (or first registered here). */
  registeredAt: number;
  /** Deploy tx hash when known (restores the audit trail across refreshes). */
  deployHash?: `0x${string}`;
};

type BatcherStoreState = {
  /** keyed by wallet address (lowercase) */
  saved: Record<string, SavedBatcher>;
  save: (wallet: Address, entry: SavedBatcher) => void;
  remove: (wallet: Address) => void;
};

const STORAGE_KEY = "aff-terminal-batchers";

function loadInitial(): Record<string, SavedBatcher> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SavedBatcher>;
    const out: Record<string, SavedBatcher> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (
        typeof v?.address === "string" &&
        (v.variant === "mint-only" || v.variant === "mint-sell")
      ) {
        out[k.toLowerCase()] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function persist(saved: Record<string, SavedBatcher>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // storage quota / private mode — non-fatal; the in-memory copy still works.
  }
}

export const useBatcherStore = create<BatcherStoreState>((set) => ({
  saved: loadInitial(),
  save: (wallet, entry) => {
    set((s) => {
      const next = { ...s.saved, [wallet.toLowerCase()]: entry };
      persist(next);
      return { saved: next };
    });
  },
  remove: (wallet) => {
    set((s) => {
      const next = { ...s.saved };
      delete next[wallet.toLowerCase()];
      persist(next);
      return { saved: next };
    });
  },
}));

/** The saved batcher for a wallet (if any). */
export function getSavedBatcher(saved: Record<string, SavedBatcher>, wallet: Address) {
  return saved[wallet.toLowerCase()] ?? null;
}
