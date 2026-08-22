import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { CopyButton } from "./CopyButton";

type Tone = "default" | "dim" | "ok" | "warn" | "err" | "accent" | "info";

const toneClass: Record<Tone, string> = {
  default: "text-text",
  dim: "text-text-dim",
  ok: "text-ok",
  warn: "text-warn",
  err: "text-err",
  accent: "text-accent",
  info: "text-info",
};

export function Stat({
  label,
  value,
  sub,
  tone = "default",
  copyValue,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  copyValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-text-faint">{label}</span>
      <span className={cn("flex items-baseline gap-2 text-lg", toneClass[tone])}>
        {value}
        {copyValue && <CopyButton value={copyValue} className="text-xs" label="[copy]" />}
      </span>
      {sub && <span className="text-xs text-text-dim">{sub}</span>}
    </div>
  );
}
