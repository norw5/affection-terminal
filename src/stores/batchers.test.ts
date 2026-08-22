// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { getSavedBatcher, useBatcherStore } from "./batchers";

const WALLET = "0x8B090509eAe0fEB4A0B934de1b4345161fA9a62d" as const;
const OTHER = "0x5375fb92c4459973a373f12b0adb4ec7b46cea9d" as const;

function makeEntry(over: Partial<ReturnType<typeof getSavedBatcher> & object> = {}) {
  return {
    address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
    variant: "mint-only" as const,
    registeredAt: 1_000,
    ...over,
  };
}

describe("useBatcherStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useBatcherStore.setState({ saved: {} });
  });

  it("saves and retrieves a batcher per wallet (case-insensitive key)", () => {
    const entry = makeEntry();
    useBatcherStore.getState().save(WALLET, entry);
    const saved = useBatcherStore.getState().saved;
    expect(getSavedBatcher(saved, WALLET)?.address).toBe(entry.address);
    // same wallet, different casing → same entry
    expect(getSavedBatcher(saved, WALLET.toUpperCase() as typeof WALLET)?.address).toBe(
      entry.address,
    );
    // other wallets unaffected
    expect(getSavedBatcher(saved, OTHER)).toBeNull();
  });

  it("persists across store re-hydration (refresh simulation)", () => {
    useBatcherStore.getState().save(WALLET, makeEntry({ variant: "mint-sell" }));
    // simulate a fresh load: loadInitial reads localStorage
    useBatcherStore.setState({ saved: {} });
    const raw = localStorage.getItem("aff-terminal-batchers");
    expect(raw).toBeTruthy();
    const rehydrated = JSON.parse(raw ?? "{}");
    expect(rehydrated[WALLET.toLowerCase()].variant).toBe("mint-sell");
  });

  it("overwrites the previous entry for the same wallet", () => {
    useBatcherStore.getState().save(WALLET, makeEntry());
    useBatcherStore
      .getState()
      .save(
        WALLET,
        makeEntry({ address: "0xabc0000000000000000000000000000000000001" as `0x${string}` }),
      );
    const saved = useBatcherStore.getState().saved;
    expect(Object.keys(saved)).toHaveLength(1);
    expect(getSavedBatcher(saved, WALLET)?.address).toBe(
      "0xabc0000000000000000000000000000000000001",
    );
  });

  it("removes (forgets) a wallet's batcher", () => {
    useBatcherStore.getState().save(WALLET, makeEntry());
    useBatcherStore.getState().remove(WALLET);
    expect(getSavedBatcher(useBatcherStore.getState().saved, WALLET)).toBeNull();
    expect(localStorage.getItem("aff-terminal-batchers")).toBe("{}");
  });

  it("a second wallet's entry survives removing the first", () => {
    useBatcherStore.getState().save(WALLET, makeEntry());
    useBatcherStore.getState().save(OTHER, makeEntry({ registeredAt: 2_000 }));
    useBatcherStore.getState().remove(WALLET);
    const saved = useBatcherStore.getState().saved;
    expect(getSavedBatcher(saved, WALLET)).toBeNull();
    expect(getSavedBatcher(saved, OTHER)?.registeredAt).toBe(2_000);
  });
});
