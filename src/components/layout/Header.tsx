import { TxPanel } from "@/components/layout/TxPanel";
import { useUiStore } from "@/stores/ui";
import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { WalletButton } from "./WalletButton";

export function Header() {
  const togglePalette = useUiStore((s) => s.togglePalette);
  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-panel px-3">
      <Link to="/" className="focus-ring" aria-label="AFFECTION Terminal — overview">
        <Logo className="text-sm" />
      </Link>
      <div className="ascii-divider hidden text-text-faint sm:block">{"┄".repeat(6)}</div>
      <span className="hidden text-xs text-text-faint sm:block">decentralized state machine</span>
      <span className="ml-auto" />
      <button
        type="button"
        onClick={togglePalette}
        className="focus-ring hidden items-center gap-2 border border-border bg-panel-2 px-2 py-1 text-xs text-text-dim hover:border-accent-dim hover:text-text sm:flex"
      >
        <span>jump</span>
        <kbd className="rounded-none border border-border-bright px-1 text-[0.625rem]">⌘K</kbd>
      </button>
      <TxPanel />
      <WalletButton />
    </header>
  );
}
