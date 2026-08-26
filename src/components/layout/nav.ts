export type NavItem = {
  to: string;
  label: string;
  desc: string;
  phase?: string;
};

// Module navigation. `phase` marks modules not yet implemented in the scaffold.
export const NAV: NavItem[] = [
  { to: "/", label: "overview", desc: "dashboard" },
  { to: "/knowledge-base", label: "knowledge-base", desc: "docs · abis · addresses · bundle" },
  { to: "/mint", label: "mint", desc: "auto-router · custom · raw" },
  { to: "/batcher", label: "batcher", desc: "deploy your own" },
  { to: "/metrics", label: "metrics", desc: "supply · headroom · route map" },
];
