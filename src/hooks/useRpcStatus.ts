import { PULSECHAIN_CHAIN_ID } from "@/config/constants";
import { type RpcHealth, bestRpc, probeAllRpc } from "@/lib/rpc/health";
// RPC network status for the bottom status bar. Probes all configured RPCs in parallel and
// picks the best (lowest-latency online) as the "primary". Polled every 30s; failing RPCs are
// skipped on a growing backoff (see lib/rpc/health.ts) so we don't keep hitting a 403'ing
// endpoint.
import { useQuery } from "@tanstack/react-query";

export type RpcStatus = {
  perRpc: RpcHealth[];
  primary: RpcHealth | null;
  chainId: number;
};

export function useRpcStatus() {
  return useQuery<RpcStatus>({
    queryKey: ["rpc-status"],
    queryFn: async () => {
      const perRpc = await probeAllRpc();
      return { perRpc, primary: bestRpc(perRpc), chainId: PULSECHAIN_CHAIN_ID };
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}
