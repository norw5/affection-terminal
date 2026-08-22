// PulseX pair discovery (V1 + V2) + reserves for the ecosystem tokens. For each ecosystem
// token x each quote token (WPLS, pDAI, pUSDC), calls `factory.getPair()` then
// `pair.getReserves()` + `token0()`/`token1()` on BOTH the V1 and V2 factories. Fans out to
// parallel eth_calls (no multicall3). Polled. Pairs are tagged with their factory version.
import {
  PULSEX_V1_FACTORY,
  PULSEX_V2_FACTORY,
  QUOTE_TOKENS,
  pulsexFactoryAbi,
  pulsexPairAbi,
} from "@/config/pulsex";
import { TOKENS } from "@/config/registry";
import { type EcosystemPair, type PairReserveData, buildEcosystemPair } from "@/lib/pulsex/pairs";
import { publicClient } from "@/lib/rpc/client";
import { useQuery } from "@tanstack/react-query";

export type PulseXPairsData = {
  pairs: EcosystemPair[];
  factoryAddress: string;
  totalPairs: bigint | null;
  /** how many pair reads failed (RPC outage) — a low pair count may be degraded, not empty */
  failedReads: number;
};

// Base tokens for pair discovery: every verified, still-mintable ecosystem token EXCEPT
// the stablecoin quotes (excluded by address — a name-prefix filter would wrongly drop
// pINDEPENDENCE (PI), whose registry name starts with "p" but is an ecosystem token).
const QUOTE_ADDRESSES = new Set(QUOTE_TOKENS.map((q) => q.address.toLowerCase()));
const ECOSYSTEM_TOKENS = TOKENS.filter(
  (t) => t.stillMintable !== false && t.verified && !QUOTE_ADDRESSES.has(t.address.toLowerCase()),
);

const FACTORIES: Array<{ version: "V1" | "V2"; address: `0x${string}` }> = [
  { version: "V2", address: PULSEX_V2_FACTORY },
  { version: "V1", address: PULSEX_V1_FACTORY },
];

async function fetchPair(
  factory: { version: "V1" | "V2"; address: `0x${string}` },
  base: {
    symbol?: string;
    display?: string;
    name: string;
    address: `0x${string}`;
    decimals: number;
  },
  quote: { symbol: string; address: `0x${string}`; decimals: number },
): Promise<{ pair: EcosystemPair | null; failed: boolean }> {
  try {
    const pairAddr = (await publicClient.readContract({
      address: factory.address,
      abi: pulsexFactoryAbi,
      functionName: "getPair",
      args: [base.address, quote.address],
    })) as string;
    if (!pairAddr || pairAddr === "0x0000000000000000000000000000000000000000")
      return { pair: null, failed: false };
    const [token0, token1, reserves] = await Promise.all([
      publicClient.readContract({
        address: pairAddr as `0x${string}`,
        abi: pulsexPairAbi,
        functionName: "token0",
      }),
      publicClient.readContract({
        address: pairAddr as `0x${string}`,
        abi: pulsexPairAbi,
        functionName: "token1",
      }),
      publicClient.readContract({
        address: pairAddr as `0x${string}`,
        abi: pulsexPairAbi,
        functionName: "getReserves",
      }),
    ]);
    const [reserve0, reserve1] = reserves as [bigint, bigint, number];
    const raw: PairReserveData = {
      pair: pairAddr as `0x${string}`,
      token0: token0 as `0x${string}`,
      token1: token1 as `0x${string}`,
      reserve0,
      reserve1,
    };
    return {
      pair: buildEcosystemPair(base, quote, raw, factory.version, factory.address),
      failed: false,
    };
  } catch {
    // RPC read failed — distinct from "no pair exists", surfaced via `failedReads`.
    return { pair: null, failed: true };
  }
}

export function usePulseXPairs() {
  return useQuery<PulseXPairsData>({
    queryKey: ["pulsex-pairs"],
    queryFn: async () => {
      const totalPairs = (async () => {
        try {
          const raw = await publicClient.readContract({
            address: PULSEX_V2_FACTORY,
            abi: pulsexFactoryAbi,
            functionName: "allPairsLength",
          });
          return typeof raw === "bigint" ? raw : BigInt(raw as number | string);
        } catch {
          return null;
        }
      })();

      const pairResults = await Promise.all(
        ECOSYSTEM_TOKENS.flatMap((base) =>
          FACTORIES.flatMap((factory) =>
            QUOTE_TOKENS.map(async (quote) => {
              if (base.address.toLowerCase() === quote.address.toLowerCase())
                return { pair: null, failed: false };
              return fetchPair(factory, base, quote);
            }),
          ),
        ),
      );

      const pairs = pairResults.map((r) => r.pair).filter((p): p is EcosystemPair => p !== null);
      const failedReads = pairResults.filter((r) => r.failed).length;
      return {
        pairs,
        factoryAddress: PULSEX_V2_FACTORY,
        totalPairs: await totalPairs,
        failedReads,
      };
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}
