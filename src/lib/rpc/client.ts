import { pulsechain } from "@/config/chain";
import { RPC_URLS } from "@/config/rpc";
// The app's public client: a single viem client over the PulseChain RPCs with automatic
// failover + latency ranking. Reads go through this; writes go through wagmi (which uses the
// same transport via the wagmi config in src/main.tsx). No multicall3 dependency (see chain.ts).
import { http, createPublicClient, fallback } from "viem";

export const publicClient = createPublicClient({
  chain: pulsechain,
  transport: fallback(
    RPC_URLS.map((url) => http(url, { timeout: 20_000, batch: { wait: 80 } })),
    { rank: true, retryCount: 3, retryDelay: 500 },
  ),
});
