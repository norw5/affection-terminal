// Canonical RPC endpoints for PulseChain. These are public endpoints; the app uses a
// viem `fallback` transport over all of them for automatic failover, plus a periodic
// health probe (lib/rpc/health.ts) for the status bar.
//
// NOTE: `pulsechain-rpc.publicnode.com` was removed because it started returning 403
// (rate-limit/access restriction) frequently, causing every read to waste a round-trip
// before falling back. If it stabilises it can be re-added. Verified live 2026-08.
export const RPC_URLS = [
  "https://rpc.pulsechain.com",
  "https://rpc-pulsechain.g4mm4.io",
  "https://rpc.pulsechainstats.com",
] as const;

// WebSocket endpoints for log subscriptions (Module D burns / new-block subscriptions).
export const WSS_URLS = ["wss://rpc.pulsechain.com"] as const;

export type RpcUrl = (typeof RPC_URLS)[number];
