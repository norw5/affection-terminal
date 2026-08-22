// Mint-side live data for Module B Tier 1 (auto-router). Composes the existing supply +
// PulseX pair reads and adds the three cross-quote pairs (WPLS/pDAI, WPLS/pUSDC, pDAI/pUSDC)
// so the profitability pathfinder can resolve 2-hop DEX exits (Ⓐ → WPLS → pStable).
//
// `usePulseXPairs` already fetches the Ⓐ/WPLS, Ⓐ/pDAI, Ⓐ/pUSDC pairs (among others), so we
// reuse it and only fetch the cross-quote pairs ourselves (3 extra getPair + getReserves).
// All reads fan out to parallel eth_calls — no multicall3 dependency (absent on PulseChain).
import { PULSEX_V2_FACTORY, pulsexFactoryAbi, pulsexPairAbi } from "@/config/pulsex";
import { WPLS_ADDR } from "@/config/pulsex";
import { AFFECTION_ADDR, PDAI_ADDR, PUSDC_ADDR } from "@/config/registry";
import { type SwapGraph, buildSwapGraph } from "@/lib/mint/profitability";
import { publicClient } from "@/lib/rpc/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePulseXPairs } from "./usePulseX";
import { useSupply } from "./useSupply";

const CROSS_QUOTE_PAIRS: Array<
  [label: string, a: `0x${string}`, b: `0x${string}`, adec: number, bdec: number]
> = [
  ["WPLS/pDAI", WPLS_ADDR, PDAI_ADDR, 18, 18],
  ["WPLS/pUSDC", WPLS_ADDR, PUSDC_ADDR, 18, 6],
  ["pDAI/pUSDC", PDAI_ADDR, PUSDC_ADDR, 18, 6],
];

type CrossPair = {
  baseAddress: `0x${string}`;
  quoteAddress: `0x${string}`;
  baseReserve: bigint;
  quoteReserve: bigint;
  baseDecimals: number;
  quoteDecimals: number;
};

async function fetchCrossQuotePairs(): Promise<CrossPair[]> {
  const results = await Promise.all(
    CROSS_QUOTE_PAIRS.map(async ([, a, b, adec, bdec]) => {
      try {
        const pairAddr = (await publicClient.readContract({
          address: PULSEX_V2_FACTORY,
          abi: pulsexFactoryAbi,
          functionName: "getPair",
          args: [a, b],
        })) as string;
        if (!pairAddr || pairAddr === "0x0000000000000000000000000000000000000000") return null;
        const [token0, reserves] = await Promise.all([
          publicClient.readContract({
            address: pairAddr as `0x${string}`,
            abi: pulsexPairAbi,
            functionName: "token0",
          }),
          publicClient.readContract({
            address: pairAddr as `0x${string}`,
            abi: pulsexPairAbi,
            functionName: "getReserves",
          }),
        ]);
        const [reserve0, reserve1] = reserves as [bigint, bigint, number];
        const isAFirst = (token0 as string).toLowerCase() === a.toLowerCase();
        return {
          baseAddress: a,
          quoteAddress: b,
          baseReserve: isAFirst ? reserve0 : reserve1,
          quoteReserve: isAFirst ? reserve1 : reserve0,
          baseDecimals: adec,
          quoteDecimals: bdec,
        } as CrossPair;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is CrossPair => r !== null);
}

export type MintData = {
  graph: SwapGraph;
  affectionSupply: bigint;
  affectionCap: bigint;
  /** timestamp of the freshest underlying read */
  fetchedAt: Date;
};

export function useMintData() {
  const supplyQ = useSupply();
  const pairsQ = usePulseXPairs();
  const crossQ = useQuery<CrossPair[]>({
    queryKey: ["mint-cross-quote-pairs"],
    queryFn: fetchCrossQuotePairs,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const isLoading = supplyQ.isLoading || pairsQ.isLoading || crossQ.isLoading;
  const isError = supplyQ.isError || pairsQ.isError || crossQ.isError;

  // Build the swap graph only from the pairs the pathfinder cares about: Ⓐ↔quote pairs
  // (from usePulseXPairs) + the cross-quote pairs (WPLS/pDAI, WPLS/pUSDC, pDAI/pUSDC).
  // Memoized on the underlying query-data identities so consumers (e.g. the AutoRouter's
  // per-route profitability useMemo) don't recompute on every render/poll tick.
  const pairsData = pairsQ.data;
  const crossData = crossQ.data;
  const graph: SwapGraph | null = useMemo(() => {
    if (!pairsData || !crossData) return null;
    const affPairs = pairsData.pairs
      .filter((p) => p.baseAddress.toLowerCase() === AFFECTION_ADDR.toLowerCase())
      .map((p) => ({
        baseAddress: p.baseAddress,
        quoteAddress: p.quoteAddress,
        baseReserve: p.baseReserve,
        quoteReserve: p.quoteReserve,
        baseDecimals: p.baseDecimals,
        quoteDecimals: p.quoteDecimals,
      }));
    return buildSwapGraph([...affPairs, ...crossData]);
  }, [pairsData, crossData]);

  const supplyData = supplyQ.data;
  const data: MintData | undefined = useMemo(
    () =>
      supplyData && graph
        ? {
            graph,
            affectionSupply: supplyData.affectionSupply,
            affectionCap: supplyData.affectionCap,
            fetchedAt: new Date(),
          }
        : undefined,
    [supplyData, graph],
  );

  return {
    data,
    isLoading,
    isError,
    refetch: () => {
      supplyQ.refetch();
      pairsQ.refetch();
      crossQ.refetch();
    },
  };
}
