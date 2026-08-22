// PulseX V2 pair discovery + the typed pair model. The RPC reads are in usePulseX;
// this module holds the pair-set definition and the pure pair-address→model builder.

import type { QUOTE_TOKENS } from "@/config/pulsex";
import type { TokenInfo } from "@/config/registry";
import type { Address } from "viem";

export type PairReserveData = {
  pair: Address;
  token0: Address;
  token1: Address;
  reserve0: bigint;
  reserve1: bigint;
};

export type EcosystemPair = {
  /** Display label, e.g. "AFFECTION/WPLS" */
  label: string;
  /** The ecosystem token (one side of the pair) */
  baseSymbol: string;
  baseAddress: Address;
  baseDecimals: number;
  /** The quote token (the other side) */
  quoteSymbol: string;
  quoteAddress: Address;
  quoteDecimals: number;
  pair: Address;
  token0: Address;
  token1: Address;
  reserve0: bigint;
  reserve1: bigint;
  /** The ecosystem token's reserve (base), in base units */
  baseReserve: bigint;
  /** The quote token's reserve, in base units */
  quoteReserve: bigint;
  /** Which PulseX factory this pair was discovered on */
  factoryVersion: "V1" | "V2";
  factoryAddress: Address;
};

/**
 * Build the set of pair queries to discover: for each ecosystem token × each quote token,
 * attempt `factory.getPair()`. The result is filtered to pairs that exist (nonzero address)
 * and have nonzero reserves.
 */
export function buildPairQueries(
  ecosystemTokens: TokenInfo[],
  quotes: typeof QUOTE_TOKENS,
): Array<{ base: TokenInfo; quote: (typeof quotes)[number] }> {
  const queries: Array<{ base: TokenInfo; quote: (typeof quotes)[number] }> = [];
  for (const base of ecosystemTokens) {
    // Skip pStables and non-ecosystem tokens (only minting-ecosystem tokens get routes).
    if (base.name.startsWith("p") && base.decimals !== 18) continue;
    if (!base.stillMintable && !base.verified) continue;
    for (const quote of quotes) {
      if (base.address.toLowerCase() === quote.address.toLowerCase()) continue;
      queries.push({ base, quote });
    }
  }
  return queries;
}

/**
 * Build an EcosystemPair from raw reserve data + the base/quote metadata. Resolves which
 * reserve belongs to which token (token0 vs token1 ordering is arbitrary in UniswapV2).
 */
export function buildEcosystemPair(
  base: { symbol?: string; display?: string; name: string; address: Address; decimals: number },
  quote: { symbol: string; address: Address; decimals: number },
  raw: PairReserveData,
  factoryVersion: "V1" | "V2",
  factoryAddress: Address,
): EcosystemPair | null {
  const { pair, token0, token1, reserve0, reserve1 } = raw;
  if (reserve0 === 0n && reserve1 === 0n) return null;
  const isBaseToken0 = token0.toLowerCase() === base.address.toLowerCase();
  if (!isBaseToken0 && token1.toLowerCase() !== base.address.toLowerCase()) return null;
  const baseReserve = isBaseToken0 ? reserve0 : reserve1;
  const quoteReserve = isBaseToken0 ? reserve1 : reserve0;
  if (baseReserve === 0n || quoteReserve === 0n) return null;
  const baseSymbol = base.display ?? base.symbol ?? base.name;
  return {
    label: `${baseSymbol}/${quote.symbol}`,
    baseSymbol,
    baseAddress: base.address,
    baseDecimals: base.decimals,
    quoteSymbol: quote.symbol,
    quoteAddress: quote.address,
    quoteDecimals: quote.decimals,
    pair,
    token0,
    token1,
    reserve0,
    reserve1,
    baseReserve,
    quoteReserve,
    factoryVersion,
    factoryAddress,
  };
}
