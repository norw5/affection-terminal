// Live network context for the mint surfaces: current base fee, block fullness, block gas
// limit, and the measured average block time. This exists because large mint transactions
// are a significant fraction of a whole block (a 100-loop MATH-route mint ≈ 33% of a block)
// and during congestion they can take several minutes to confirm even at adequate gas
// prices — the portal surfaces the context so users set wallet gas accordingly and know
// what to expect. Block time is MEASURED (PulseChain is ~10s/block as of 2026-08, not the
// 2s often assumed). Read-only; two getBlock calls per refresh.
import { publicClient } from "@/lib/rpc/client";
import { useQuery } from "@tanstack/react-query";

export type NetworkContext = {
  blockNumber: bigint;
  blockGasLimit: bigint;
  blockGasUsed: bigint;
  /** 0..1 — how full the latest block is */
  fullness: number;
  baseFeePerGas: bigint | null;
  /** measured average seconds between the last few blocks */
  blockTimeSeconds: number | null;
};

async function fetchNetworkContext(): Promise<NetworkContext> {
  const head = await publicClient.getBlockNumber();
  const [latest, prev] = await Promise.all([
    publicClient.getBlock({ blockNumber: head }),
    publicClient.getBlock({ blockNumber: head > 3n ? head - 3n : 0n }),
  ]);
  const dt = Number(latest.timestamp) - Number(prev.timestamp);
  const span = Number(head - (head > 3n ? head - 3n : 0n));
  return {
    blockNumber: head,
    blockGasLimit: latest.gasLimit,
    blockGasUsed: latest.gasUsed,
    fullness: Number(latest.gasUsed) / Number(latest.gasLimit),
    baseFeePerGas: latest.baseFeePerGas ?? null,
    blockTimeSeconds: dt > 0 && span > 0 ? dt / span : null,
  };
}

/** Gwei-formatted base fee with 3 decimals (bigint wei → string). */
export function formatGwei(wei: bigint | null | undefined): string {
  if (wei == null) return "?";
  const gwei = Number(wei) / 1e9;
  return gwei >= 1000 ? `${Math.round(gwei).toLocaleString()}` : gwei.toFixed(1);
}

/** "14.8M" style gas formatting. */
export function formatGas(gas: bigint): string {
  const n = Number(gas);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toString();
}

export function useNetworkContext() {
  return useQuery<NetworkContext>({
    queryKey: ["network-context"],
    queryFn: fetchNetworkContext,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}
