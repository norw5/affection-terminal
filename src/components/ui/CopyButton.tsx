import { cn } from "@/lib/cn";
import { useState } from "react";

/** Copy-to-clipboard button with a transient "[copied]" confirmation. Falls back gracefully. */
export function CopyButton({
  value,
  label = "[copy]",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="copy to clipboard"
      className={cn(
        "focus-ring inline-flex items-center text-text-faint transition-colors hover:text-accent",
        className,
      )}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // clipboard unavailable (secure context required) — no-op
        }
      }}
    >
      {copied ? "[copied]" : label}
    </button>
  );
}
