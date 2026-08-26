import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";
import { lazy } from "react";
import { RootLayout } from "./RootLayout";

// Code-based route tree (no file-based codegen). Deterministic, fully typed.
//
// Routes are code-split via React.lazy so the initial dashboard shell is light: only the
// Dashboard + RootLayout ship in the main chunk; /mint, /batcher, /metrics, /knowledge-base/* load on
// navigation (and preloads on hover via defaultPreload="intent"). The lazy() chunks are
// separate Vite output files (see dist/assets/).

const Dashboard = lazy(() => import("./Dashboard").then((m) => ({ default: m.Dashboard })));
const KBIndex = lazy(() => import("./KBIndex").then((m) => ({ default: m.KBIndex })));
const KBDoc = lazy(() => import("./KBDoc").then((m) => ({ default: m.KBDoc })));
const Mint = lazy(() => import("./Mint").then((m) => ({ default: m.Mint })));
const Batcher = lazy(() => import("./Batcher").then((m) => ({ default: m.Batcher })));
const Metrics = lazy(() => import("./Metrics").then((m) => ({ default: m.Metrics })));

function RootError({ error }: { error: Error }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl text-err">render error</h1>
      <p className="max-w-md text-sm text-text-dim">
        A component threw an error. This is likely a bug in the portal, not a chain issue. Try
        refreshing the page — if it persists, clear the session tx log (localStorage key{" "}
        <code className="text-info">aff-tx-log</code>) which can hold stale data.
      </p>
      <pre className="max-w-md overflow-x-auto border border-border bg-panel-2 px-3 py-2 text-left text-xs text-err">
        {error.message.slice(0, 300)}
      </pre>
      <button
        type="button"
        className="border border-border bg-panel-2 px-3 py-1 text-xs text-text hover:border-accent-dim"
        onClick={() => window.location.assign("/")}
      >
        ▸ reload
      </button>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard,
});

// /knowledge-base is a layout route: its Outlet renders either the index (KBIndex at exactly
// /knowledge-base) or the document route (KBDoc at /knowledge-base/$doc). Without the Outlet,
// the child route matches but never mounts — the doc page silently shows the index instead.
function KbLayout() {
  return <Outlet />;
}

const kbRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/knowledge-base",
  component: KbLayout,
});

const kbIndexRoute = createRoute({
  getParentRoute: () => kbRoute,
  path: "/",
  component: KBIndex,
});

const kbDocRoute = createRoute({
  getParentRoute: () => kbRoute,
  path: "$doc",
  component: KBDoc,
});

const mintRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mint",
  component: Mint,
});

const batcherRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/batcher",
  component: Batcher,
});

const metricsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/metrics",
  component: Metrics,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  kbRoute.addChildren([kbIndexRoute, kbDocRoute]),
  mintRoute,
  batcherRoute,
  metricsRoute,
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    ...(history ? { history } : {}),
  });
}

export const router = createAppRouter();

// Register the router for typed Link/useParams/useNavigate.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
