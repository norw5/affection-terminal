// Live tax reads for the deployed community multi-mint contracts. The deployed bytecode
// (unlike the recovered sources) exposes an admin surface: tax()/taxMax()/setTax(uint256)/
// setOwner/withdrawPLS/withdrawERC20. tax() is 0 on all five as of 2026-08, but the owner
// can raise it up to taxMax — this hook surfaces the live value so the mint terminal can
// show the real cost basis and warn when it moves. Read-only; parallel eth_calls.
import { MULTI_AFFECTION_ADDR, MULTI_G5_ADDR, MULTI_MATH_ADDR, MULTI_PI_ADDR } from "@/config/mint";
import { publicClient } from "@/lib/rpc/client";
import { useQuery } from "@tanstack/react-query";

const taxAbi = [
  {
    type: "function",
    name: "tax",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "taxMax",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export type MultiMintTax = {
  tax: bigint;
  taxMax: bigint;
};

const CONTRACTS = [
  ["Multi MATH 1.1", MULTI_MATH_ADDR],
  ["Multi AFFECTION", MULTI_AFFECTION_ADDR],
  ["Multi G5", MULTI_G5_ADDR],
  ["Multi PI", MULTI_PI_ADDR],
] as const;

async function fetchTaxes(): Promise<Record<string, MultiMintTax>> {
  const entries = await Promise.all(
    CONTRACTS.map(async ([name, address]) => {
      const [tax, taxMax] = await Promise.all([
        publicClient.readContract({ address, abi: taxAbi, functionName: "tax" }),
        publicClient.readContract({ address, abi: taxAbi, functionName: "taxMax" }),
      ]);
      return [name, { tax: tax as bigint, taxMax: taxMax as bigint }] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export function useMultiMintTax() {
  return useQuery<Record<string, MultiMintTax>>({
    queryKey: ["multi-mint-tax"],
    queryFn: fetchTaxes,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}
