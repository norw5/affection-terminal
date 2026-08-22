import { cn } from "@/lib/cn";

/** AFF_TERMINAL wordmark — text-based, terminal aesthetic. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("select-none font-mono", className)}>
      <span className="text-accent">Ⓐ</span> <span className="text-text">AFF</span>
      <span className="text-text-faint">::</span>
      <span className="text-text">TERMINAL</span>
      <span className="cursor-block ml-1" />
    </span>
  );
}
