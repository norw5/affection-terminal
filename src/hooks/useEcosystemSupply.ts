// Live supply for ALL ecosystem tokens (not just AFFECTION + MATH). Fans out parallel
// `totalSupply()` eth_calls via the viem publicClient (no multicall3 dependency — see
// chain.ts). For capped tokens (AFFECTION, MATH) it also computes headroom; for the
// rest it reports supply + the stillMintable/verified status from the registry. Polled.
import { erc20Abi } from "@/config/abis/math.abi";
import { AFFECTION_CAP_BASE, MATH_CAP_BASE } from "@/config/constants";
import { TOKENS, type TokenInfo } from "@/config/registry";
import { headroom } from "@/hooks/useSupply";
import { publicClient } from "@/lib/rpc/client";
import { useQuery } from "@tanstack/react-query";

export type EcosystemSupplyEntry = {
  token: TokenInfo;
  supply: bigint;
  capBase: bigint | null;
  remaining: bigint | null;
  pctFilled: bigint | null;
};

export type EcosystemSupplyData = {
  entries: EcosystemSupplyEntry[];
  fetchedAt: Date;
};

function capBaseFor(token: TokenInfo): bigint | null {
  if (token.name === "AFFECTION") return AFFECTION_CAP_BASE;
  if (token.name === "libAtropaMath v1.1") return MATH_CAP_BASE;
  if (token.cap && token.cap !== "0") return BigInt(token.cap) * 10n ** 18n;
  return null;
}

export function useEcosystemSupply() {
  return useQuery<EcosystemSupplyData>({
    queryKey: ["ecosystem-supply"],
    queryFn: async () => {
      const supplies = await Promise.all(
        TOKENS.filter((t) => t.stillMintable !== false || t.verified).map(async (t) => {
          let supply = 0n;
          try {
            const raw = await publicClient.readContract({
              address: t.address,
              abi: erc20Abi,
              functionName: "totalSupply",
            });
            supply = typeof raw === "bigint" ? raw : BigInt(raw as number | string);
          } catch {
            supply = 0n;
          }
          return { token: t, supply };
        }),
      );
      const entries: EcosystemSupplyEntry[] = supplies.map(({ token, supply }) => {
        const capBase = capBaseFor(token);
        if (capBase !== null) {
          const { remaining, pctFilled } = headroom(supply, capBase);
          return { token, supply, capBase, remaining, pctFilled };
        }
        return { token, supply, capBase: null, remaining: null, pctFilled: null };
      });
      return { entries, fetchedAt: new Date() };
    },
    refetchInterval: 20_000,
    staleTime: 15_000,
  });
}
