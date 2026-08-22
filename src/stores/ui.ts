import { create } from "zustand";

// Minimal UI state store (terminal UI state, not RPC data). Keeps command-palette
// open-state and any future ephemeral UI flags out of React tree noise.
type UiState = {
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
}));
