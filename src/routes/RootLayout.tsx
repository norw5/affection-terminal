import { CommandPalette } from "@/components/layout/CommandPalette";
import { Header } from "@/components/layout/Header";
import { RpcStatusBar } from "@/components/layout/RpcStatusBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { useTrackPendingTxs } from "@/hooks/useTrackTx";
import { Outlet } from "@tanstack/react-router";
import { Suspense, useEffect } from "react";

/** A minimal terminal-flavored loading state for the lazy route chunks. */
function RouteFallback() {
  return (
    <div className="flex items-center gap-2 p-4 text-xs text-text-faint">
      <span className="cursor-block" aria-hidden />
      <span>loading module…</span>
    </div>
  );
}

/** App chrome: header (logo + wallet + ⌘K), left module nav, content, bottom status bar. */
export function RootLayout() {
  // Track every pending tx in the session log (re-attaches on remount/refresh).
  useTrackPendingTxs();
  // Clear the pre-hydration boot splash once React mounts.
  useEffect(() => {
    document.getElementById("boot")?.remove();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:border focus:border-accent focus:bg-panel focus:px-3 focus:py-1 focus:text-xs focus:text-accent"
      >
        skip to content
      </a>
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main id="main" className="min-w-0 flex-1 overflow-y-auto p-4" tabIndex={-1}>
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <RpcStatusBar />
      <CommandPalette />
    </div>
  );
}
