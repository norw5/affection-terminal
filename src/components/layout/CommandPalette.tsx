import { cn } from "@/lib/cn";
import { DOCS } from "@/lib/docs/loader";
import { useUiStore } from "@/stores/ui";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { NAV } from "./nav";

type Item = { to: string; label: string; kind: string; desc: string };

export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const togglePalette = useUiStore((s) => s.togglePalette);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<Item[]>(
    () => [
      ...NAV.map((n) => ({ to: n.to, label: n.label, kind: "module", desc: n.desc })),
      ...DOCS.map((d) => ({ to: `/kb/${d.slug}`, label: d.title, kind: "doc", desc: d.filename })),
    ],
    [],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => `${i.label} ${i.desc}`.toLowerCase().includes(needle));
  }, [items, q]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    // Focus the input once the dialog opens (replaces autoFocus for a11y).
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePalette]);

  const go = (to: string) => {
    navigate({ to });
    setOpen(false);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && filtered[active]) go(filtered[active].to);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-[14vh] z-50 w-[min(640px,92vw)] -translate-x-1/2 border border-border-bright bg-panel">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder="jump to module or doc…  (⌘K / Ctrl+K)"
            className="w-full border-b border-border bg-transparent px-3 py-2 text-sm text-text outline-none placeholder:text-text-faint"
          />
          <div className="max-h-[52vh] overflow-y-auto p-1">
            {filtered.map((it, i) => (
              <button
                key={it.to + it.kind}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(it.to)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                  i === active ? "bg-panel-2 text-accent" : "text-text-dim",
                )}
              >
                <span className="text-text-faint">{it.kind === "module" ? "▸" : "≡"}</span>
                <span className="flex-1 truncate">{it.label}</span>
                <span className="text-[0.625rem] text-text-faint">{it.desc}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-2 text-text-faint">no matches</div>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
