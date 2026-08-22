// Reads the user's balances of all mint-relevant tokens (pDAI, pUSDC, G5, PI, MATH, Ⓐ) so the
// mint terminal can show what the wallet holds and whether the user can start from an
// intermediate they already own. Fans out to parallel eth_calls — no multicall3 dependency.
// Only reads when a wallet is connected. Polled.
import { erc20Abi } from "@/config/abis/math.abi";
import {
  AFFECTION_ADDR,
  G5_ADDR,
  MATH_ADDR,
  PDAI_ADDR,
  PI_ADDR,
  PUSDC_ADDR,
} from "@/config/registry";
import { publicClient } from "@/lib/rpc/client";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";

export type MintBalances = {
  pDAI: bigint;
  pUSDC: bigint;
  G5: bigint;
  PI: bigint;
  MATH: bigint;
  AFFECTION: bigint;
};

const READS: Array<[keyof MintBalances, Address, number]> = [
  ["pDAI", PDAI_ADDR, 18],
  ["pUSDC", PUSDC_ADDR, 6],
  ["G5", G5_ADDR, 18],
  ["PI", PI_ADDR, 18],
  ["MATH", MATH_ADDR, 18],
  ["AFFECTION", AFFECTION_ADDR, 18],
];

export function useMintBalances(address?: Address) {
  return useQuery<MintBalances>({
    queryKey: ["mint-balances", address ?? null],
    enabled: !!address,
    queryFn: async () => {
      if (!address) throw new Error("no wallet");
      const results = await Promise.all(
        READS.map(([, token]) =>
          publicClient.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          }),
        ),
      );
      const out = {} as MintBalances;
      READS.forEach(([key], i) => {
        out[key] = results[i] as bigint;
      });
      return out;
    },
    refetchInterval: 12_000,
    staleTime: 8_000,
  });
}
