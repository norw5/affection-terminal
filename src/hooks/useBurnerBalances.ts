// Reads how much Ⓐ each known burner/locker contract currently holds (balanceOf the
// AFFECTION contract on each burner's address). This is the verifiable "held/locked" amount
// — fast (parallel balanceOf reads, no log scan) — and complements the log-event burn scan
// (which only catches transfers to 0x0 / 0xdEaD / 0x369). A contract holding Ⓐ may burn it or
// just lock it; the live balance is "held", not necessarily "permanently burned".
import { erc20Abi } from "@/config/abis/math.abi";
import { BURNERS } from "@/config/burners";
import { AFFECTION_ADDR } from "@/config/registry";
import { publicClient } from "@/lib/rpc/client";
import { useQuery } from "@tanstack/react-query";

export type BurnerBalance = {
  address: string;
  name: string;
  symbol?: string;
  balance: bigint;
};

export type BurnerBalancesData = {
  entries: BurnerBalance[];
  totalHeld: bigint;
};

export function useBurnerBalances() {
  return useQuery<BurnerBalancesData>({
    queryKey: ["burner-balances"],
    queryFn: async () => {
      const balances = await Promise.all(
        BURNERS.map(async (b) => {
          try {
            const v = await publicClient.readContract({
              address: AFFECTION_ADDR,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [b.address],
            });
            return {
              address: b.address,
              name: b.name,
              symbol: b.symbol,
              balance: v as bigint,
            };
          } catch {
            return {
              address: b.address,
              name: b.name,
              symbol: b.symbol,
              balance: 0n,
            };
          }
        }),
      );
      const withBalance = balances
        .filter((e) => e.balance > 0n)
        .sort((a, b) => (b.balance > a.balance ? 1 : -1));
      const totalHeld = withBalance.reduce((sum, e) => sum + e.balance, 0n);
      return { entries: withBalance, totalHeld };
    },
    refetchInterval: 60_000,
    staleTime: 50_000,
  });
}
