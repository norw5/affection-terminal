import { pulsechain } from "@/config/chain";
import { RPC_URLS } from "@/config/rpc";
// Periodic RPC health probe. This is *separate* from the viem fallback transport (which
// handles failover transparently); it exists only to power the bottom status bar with live
// per-RPC latency + block-height so the user can see network health at a glance.
//
// Backoff: an RPC that fails repeatedly is skipped for a growing window (2m → 4m → 8m…)
// so we don't keep hammering an endpoint that is returning 403/rate-limiting/errors. A
// successful probe resets the failure counter. This keeps the status bar accurate without
// being a bad citizen on the public RPCs.
import { http, createPublicClient } from "viem";

export type RpcHealth = {
  url: string;
  online: boolean;
  latencyMs: number | null;
  blockNumber: bigint | null;
};

const probeClients = RPC_URLS.map((url) => ({
  url,
  client: createPublicClient({ chain: pulsechain, transport: http(url, { timeout: 15_000 }) }),
  failures: 0,
  nextProbeAt: 0,
}));

function backoffMs(failures: number): number {
  // 2m, 4m, 8m, 16m, capped at 32m
  return Math.min(2 ** failures, 32) * 60_000;
}

async function probeOne({
  url,
  client,
}: {
  url: string;
  client: ReturnType<typeof createPublicClient>;
}): Promise<RpcHealth> {
  const start = performance.now();
  try {
    const blockNumber = await client.getBlockNumber();
    const latencyMs = Math.round(performance.now() - start);
    return { url, online: true, latencyMs, blockNumber };
  } catch {
    return { url, online: false, latencyMs: null, blockNumber: null };
  }
}

/** Probe all configured RPCs in parallel, skipping any that are in a backoff window. */
export async function probeAllRpc(): Promise<RpcHealth[]> {
  const now = Date.now();
  const due = probeClients.map((p) => {
    if (p.failures > 0 && now < p.nextProbeAt) {
      // Skipped (in backoff) — report as offline without hitting the endpoint.
      return Promise.resolve<RpcHealth>({
        url: p.url,
        online: false,
        latencyMs: null,
        blockNumber: null,
      });
    }
    return probeOne(p).then((h) => {
      if (h.online) {
        p.failures = 0;
        p.nextProbeAt = 0;
      } else {
        p.failures += 1;
        p.nextProbeAt = now + backoffMs(p.failures);
      }
      return h;
    });
  });
  return Promise.all(due);
}

/** Pick the best (lowest-latency online) RPC for status-bar display. */
export function bestRpc(health: RpcHealth[]): RpcHealth | null {
  const online = health.filter((h) => h.online);
  if (online.length === 0) return null;
  return online.reduce((best, h) =>
    (h.latencyMs ?? Number.POSITIVE_INFINITY) < (best.latencyMs ?? Number.POSITIVE_INFINITY)
      ? h
      : best,
  );
}
