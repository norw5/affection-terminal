import { cn } from "@/lib/cn";
import { Link, useRouterState } from "@tanstack/react-router";
import { NAV } from "./nav";

/** Left module nav — a file-tree style index. */
export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-panel">
      <div className="px-3 py-2 text-xs uppercase tracking-wider text-text-faint">modules</div>
      <ul className="flex-1 overflow-y-auto px-1.5">
        {NAV.map((item) => {
          const active = pathname === item.to;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring group flex items-baseline gap-1 px-2 py-1 text-sm transition-colors",
                  active ? "text-accent" : "text-text-dim hover:text-text",
                )}
              >
                <span className="text-text-faint group-hover:text-accent">
                  {active ? "▸" : "·"}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.phase && (
                  <span className="text-[0.625rem] uppercase text-text-faint">{item.phase}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="ascii-divider border-t border-border px-3 py-2 text-[0.625rem] leading-tight">
        {"┄".repeat(28)}
        <div className="mt-1 text-text-faint">PulseChain · chainId 369</div>
      </div>
    </nav>
  );
}
