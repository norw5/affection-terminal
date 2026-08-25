// Pre-simulate a single contract call from the user's address (eth_call probe). Used by the
// /mint execute panel and the /batcher deploy wizard to gate each step's button on a live
// simulation. Passing sims also carry an eth_estimateGas figure so the UI can warn about
// block-sized transactions (large mints can take minutes to confirm during congestion).
import { publicClient } from "@/lib/rpc/client";
import { useQuery } from "@tanstack/react-query";
import type { Abi, Address } from "viem";

const SIM_GAS = 42_000_000n;

export type StepSimulation = { ok: boolean; gasEstimate?: bigint };

export function useSimulateBatcherStep(
  address: Address | undefined,
  contract: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
) {
  return useQuery<StepSimulation>({
    queryKey: [
      "batcher-step-sim",
      address ?? null,
      contract.toLowerCase(),
      functionName,
      args.map((a) => (typeof a === "bigint" ? a.toString() : String(a))).join("|"),
    ],
    enabled: !!address,
    queryFn: async () => {
      if (!address) return { ok: false };
      const request = {
        address: contract,
        abi,
        functionName,
        args: args as never,
        account: address,
      } as const;
      try {
        await publicClient.simulateContract({ ...request, gas: SIM_GAS });
      } catch {
        return { ok: false };
      }
      let gasEstimate: bigint | undefined;
      try {
        gasEstimate = await publicClient.estimateGas(request);
      } catch {
        gasEstimate = undefined;
      }
      return { ok: true, gasEstimate };
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
