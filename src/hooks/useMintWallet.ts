// Wallet-side reads for Module B Tier 2 (custom mint). Returns the user's stable balance
// and the two allowances the mint plan needs (stable→intermediate multi-mint,
// intermediate→AFFECTION multi-mint), so the UI can show which approvals are already set
// and whether the user can afford the mint. Polled. Only reads when a wallet is connected.
import { erc20Abi } from "@/config/abis/math.abi";
import { INTERMEDIATES, MULTI_AFFECTION_ADDR, STABLES } from "@/config/mint";
import { publicClient } from "@/lib/rpc/client";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";

export type MintWallet = {
  stableBalance: bigint;
  stableAllowance: bigint; // stable → intermediate multi-mint
  intermediateAllowance: bigint; // intermediate → AFFECTION multi-mint
};

export function useMintWallet(
  stable: "pDAI" | "pUSDC",
  intermediate: "G5" | "PI" | "MATH",
  address?: Address,
) {
  const st = STABLES[stable];
  const im = INTERMEDIATES[intermediate];
  return useQuery<MintWallet>({
    queryKey: ["mint-wallet", stable, intermediate, address ?? null],
    enabled: !!address,
    queryFn: async () => {
      if (!address) throw new Error("no wallet");
      const [stableBalance, stableAllowance, intermediateAllowance] = await Promise.all([
        publicClient.readContract({
          address: st.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        }),
        publicClient.readContract({
          address: st.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, im.multiMint],
        }),
        publicClient.readContract({
          address: im.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, MULTI_AFFECTION_ADDR],
        }),
      ]);
      return {
        stableBalance: stableBalance as bigint,
        stableAllowance: stableAllowance as bigint,
        intermediateAllowance: intermediateAllowance as bigint,
      };
    },
    refetchInterval: 12_000,
    staleTime: 8_000,
  });
}
