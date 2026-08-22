// Per-step eth_call simulation for Module B Tier 2. Simulates each MintStep from the
// user's address against the CURRENT on-chain state (parallel) so the UI can show which
// steps are executable right now and which are blocked (insufficient allowance/balance).
//
// Because approvals persist on-chain, after the user confirms step 1 its allowance is set
// and step 2's simulation flips to ✓ — this naturally guides the user through the sequence.
// Reverting simulations return the decoded revert reason (e.g. "ERC20InsufficientAllowance").
// Passing steps also carry an eth_estimateGas figure so the UI can warn about block-sized
// transactions (large mints can take minutes to confirm during congestion).
//
// Heavier than a read: the multi-mint steps do the full work (Generate() × loops, bigModExp
// each). We pass a fixed high gas to skip gas-estimation and just probe for revert.
import { erc20Abi } from "@/config/abis/math.abi";
import type { MintStep } from "@/config/mint";
import { publicClient } from "@/lib/rpc/client";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";

export type StepSim = { ok: boolean; error?: string; gasEstimate?: bigint };

const SIM_GAS = 42_000_000n;

async function simulateStep(step: MintStep, address: Address): Promise<StepSim> {
  try {
    if (step.kind === "approve") {
      await publicClient.simulateContract({
        address: step.calldata.address,
        abi: erc20Abi,
        functionName: "approve",
        args: step.calldata.args,
        account: address,
        gas: SIM_GAS,
      });
      return { ok: true };
    }
    const request = {
      address: step.calldata.address,
      abi: step.calldata.abi,
      functionName: step.calldata.functionName,
      args: step.calldata.args,
      account: address,
    } as const;
    await publicClient.simulateContract({ ...request, gas: SIM_GAS });
    // Sim passed — also fetch the real gas estimate (eth_estimateGas) so the UI can show
    // how big the tx is relative to a block. Best-effort: some RPCs cap estimateGas.
    let gasEstimate: bigint | undefined;
    try {
      gasEstimate = await publicClient.estimateGas(request);
    } catch {
      gasEstimate = undefined;
    }
    return { ok: true, gasEstimate };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // viem nests the revert reason; surface a short tail.
    const short = msg.length > 240 ? `${msg.slice(0, 240)}…` : msg;
    return { ok: false, error: short };
  }
}

export function useSimulateMint(plan: MintStep[] | null, address?: Address) {
  return useQuery<StepSim[]>({
    queryKey: ["mint-simulate", plan?.map((s) => s.label).join("|") ?? "none", address ?? null],
    enabled: !!address && !!plan && plan.length > 0,
    queryFn: async () => {
      if (!address || !plan) return [];
      return Promise.all(plan.map((step) => simulateStep(step, address)));
    },
    refetchInterval: 8_000,
    staleTime: 5_000,
  });
}
