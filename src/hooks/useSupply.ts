import { affectionAbi } from "@/config/abis/affection.abi";
import { mathAbi } from "@/config/abis/math.abi";
import { AFFECTION_CAP_BASE, MATH_CAP_BASE } from "@/config/constants";
import { AFFECTION_ADDR, MATH_ADDR } from "@/config/registry";
import { publicClient } from "@/lib/rpc/client";
// Live supply + headroom for AFFECTION and MATH (both capped at 1,111,111,111), plus the
// AFFECTION contract's own buffer (balance-of-self, the just-in-time mint buffer). Polled.
import { useQuery } from "@tanstack/react-query";

export type SupplyData = {
  affectionSupply: bigint;
  mathSupply: bigint;
  affectionBuffer: bigint;
  affectionCap: bigint;
  mathCap: bigint;
  affectionDecimals: number;
  mathDecimals: number;
};

export function useSupply() {
  return useQuery<SupplyData>({
    queryKey: ["supply"],
    queryFn: async () => {
      const [affectionSupply, mathSupply, affectionBuffer] = await Promise.all([
        publicClient.readContract({
          address: AFFECTION_ADDR,
          abi: affectionAbi,
          functionName: "totalSupply",
        }),
        publicClient.readContract({
          address: MATH_ADDR,
          abi: mathAbi,
          functionName: "totalSupply",
        }),
        publicClient.readContract({
          address: AFFECTION_ADDR,
          abi: affectionAbi,
          functionName: "balanceOf",
          args: [AFFECTION_ADDR],
        }),
      ]);
      return {
        affectionSupply: affectionSupply as bigint,
        mathSupply: mathSupply as bigint,
        affectionBuffer: affectionBuffer as bigint,
        affectionCap: AFFECTION_CAP_BASE,
        mathCap: MATH_CAP_BASE,
        affectionDecimals: 18,
        mathDecimals: 18,
      };
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

/** Remaining whole AFFECTION that can ever be minted (cap − supply), and safe Generate() loop count. */
export function headroom(supply: bigint, cap: bigint): { remaining: bigint; pctFilled: bigint } {
  const remaining = cap > supply ? cap - supply : 0n;
  const pctFilled = cap === 0n ? 0n : (supply * 10_000n) / cap;
  return { remaining, pctFilled };
}

/** Max safe `loops` for Generate() given current supply (each loop mints 3 AFFECTION). */
export function maxSafeLoops(supply: bigint, cap: bigint): bigint {
  const { remaining } = headroom(supply, cap);
  return remaining / (3n * 10n ** 18n);
}
