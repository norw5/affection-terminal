// PulseX (UniswapV2 forks) configuration for PulseChain.
//
// VERIFIED ON-CHAIN / via the PulseChain explorer (not assumed):
//   - Factory V2: 0x1715a3e4a142d8b698131108995174f37aeba10d
//     · eth_getCode → 28,270 chars (deployed). allPairsLength() → 65,181 pairs.
//     · Discovered by calling factory() on a live AFFECTION/WPLS pair.
//   - Factory V1: 0x29eA7545DEf87022BAdc76323F373EA1e707C523
//     · Verified on the PulseChain explorer (api.scan.pulsechain.com/address/0x29eA…)
//       as "PulseXFactory" — the V1 factory (same UniswapV2 selectors: getPair/getReserves/
//       token0/token1/allPairsLength). Confirmed across the PulseChain forum + docs.
//   - WPLS (Wrapped Pulse, the native-wrapper / canonical quote token):
//     0xA1077a294dDE1B09bB078844df40758a5D0f9a27 (verified on the Blockscout scanner).
//
// UniswapV2 selectors (verified via viem toFunctionSelector):
//   factory()=0xc45a0155 · getPair(a,b)=0xe6a43905 · getReserves()=0x0902f1ac
//   token0()=0x0dfe1681 · token1()=0xd21220a7 · allPairsLength()=0x574f2ba3
//   WETH()=0xad5c4648 · getAmountsOut(amountIn,path)=0xd06ca61f
import type { Address } from "viem";
import { PDAI_ADDR, PUSDC_ADDR } from "./registry";

export const PULSEX_V2_FACTORY: Address = "0x1715a3e4a142d8b698131108995174f37aeba10d";
export const PULSEX_V1_FACTORY: Address = "0x29eA7545DEf87022BAdc76323F373EA1e707C523";
export const WPLS_ADDR: Address = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27";

/** The factories we discover pairs on (V2 first as the more liquid venue on PulseChain). */
export const PULSEX_FACTORIES: Array<{ version: "V2" | "V1"; address: Address }> = [
  { version: "V2", address: PULSEX_V2_FACTORY },
  { version: "V1", address: PULSEX_V1_FACTORY },
];

// Quote tokens for pair discovery (ordered by liquidity preference — WPLS first as the
// native wrapped token is the most liquid quote on PulseChain, then pDAI, then pUSDC).
export const QUOTE_TOKENS: Array<{ symbol: string; address: Address; decimals: number }> = [
  { symbol: "WPLS", address: WPLS_ADDR, decimals: 18 },
  { symbol: "pDAI", address: PDAI_ADDR, decimals: 18 },
  { symbol: "pUSDC", address: PUSDC_ADDR, decimals: 6 },
];

// Minimal UniswapV2Factory ABI (only the read functions we use).
export const pulsexFactoryAbi = [
  {
    type: "function",
    name: "getPair",
    inputs: [
      { type: "address", name: "tokenA" },
      { type: "address", name: "tokenB" },
    ],
    outputs: [{ type: "address", name: "pair" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allPairsLength",
    inputs: [],
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
  },
] as const;

// Minimal UniswapV2Pair ABI (only the read functions we use).
export const pulsexPairAbi = [
  {
    type: "function",
    name: "getReserves",
    inputs: [],
    outputs: [
      { type: "uint112", name: "_reserve0" },
      { type: "uint112", name: "_reserve1" },
      { type: "uint32", name: "_blockTimestampLast" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "token0",
    inputs: [],
    outputs: [{ type: "address", name: "" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "token1",
    inputs: [],
    outputs: [{ type: "address", name: "" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "factory",
    inputs: [],
    outputs: [{ type: "address", name: "" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
  },
] as const;

// Transfer event ABI (for burns scanning — Transfer(…, 0x0) + Transfer(…, 0xdEaD)).
export const transferEventAbi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
] as const;
