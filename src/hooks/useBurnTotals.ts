// Instant burn totals: reads `balanceOf(burnAddr)` on the AFFECTION contract for each
// known burn address (0x0, 0xdEaD, 0x369). This is 3 parallel eth_calls — instant, no log
// scan needed. The totals reflect all Ⓐ *sent* to those addresses via `transfer()`.
//
// Caveat: if Ⓐ was burned via ERC20Burnable.burn() (which calls _burn → reduces
// totalSupply + burner's balance, emits Transfer(from, 0x0, amount), but does NOT increase
// balanceOf(0x0)), that amount is NOT captured by balanceOf(0x0). In practice most
// ecosystem burns use transfer(0xdEaD/0x0, ...) rather than burn(), so this captures the
// vast majority. The log-event scan (useBurns) catches _burn events too — use both.
import { erc20Abi } from "@/config/abis/math.abi";
import { AFFECTION_ADDR } from "@/config/registry";
import { publicClient } from "@/lib/rpc/client";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";

export type BurnTotal = {
  address: string;
  label: string;
  balance: bigint;
};

export type BurnTotalsData = {
  entries: BurnTotal[];
  total: bigint;
  /** true when any read failed — the zeros are RPC errors, not real balances */
  degraded: boolean;
};

const BURN_QUERY: Array<[string, string]> = [
  ["0x0000000000000000000000000000000000000000", "0x0 (zero)"],
  ["0x000000000000000000000000000000000000dEaD", "0xdEaD"],
  ["0x0000000000000000000000000000000000000369", "0x369 (PulseChain)"],
];

export function useBurnTotals() {
  return useQuery<BurnTotalsData>({
    queryKey: ["burn-totals"],
    queryFn: async () => {
      let degraded = false;
      const balances = await Promise.all(
        BURN_QUERY.map(async ([addr, label]) => {
          try {
            const v = await publicClient.readContract({
              address: AFFECTION_ADDR,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [addr as Address],
            });
            return { address: addr, label, balance: v as bigint };
          } catch {
            degraded = true;
            return { address: addr, label, balance: 0n };
          }
        }),
      );
      const total = balances.reduce((sum, e) => sum + e.balance, 0n);
      return { entries: balances, total, degraded };
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}
