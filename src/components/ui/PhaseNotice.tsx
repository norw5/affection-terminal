import { Panel } from "@/components/ui/Panel";
import type { ReactNode } from "react";

/** Standard notice for modules not yet implemented in the scaffold. */
export function PhaseNotice({ phase }: { phase: string; children?: ReactNode }) {
  return (
    <div className="mb-4 border border-border-bright bg-panel-2 px-3 py-2 text-xs text-text-dim">
      <span className="text-accent">[ {phase} ]</span> — scaffolded, implementation pending.{" "}
      <span className="text-text-faint">See docs/ARCHITECTURE.md §7.</span>
    </div>
  );
}

/** A section describing a concept — used for inline education in module pages. */
export function Concept({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel title={title}>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-text-dim">{children}</div>
    </Panel>
  );
}
