import type { MintRoute } from "@/lib/mint/profitability";
// Mint execution model for Module B (P4). Two layers:
//
//  1. MINT_ROUTES — the clean arbitrage routes fed to the profitability engine
//     (src/lib/mint/profitability.ts). Each is (intermediate × stable) with the verified
//     1-pStable-per-1-Ⓐ floor. Used by the Tier-1 auto-router (read-only).
//
//  2. EXECUTION_ROUTES — the on-chain execution plan for each route that the legacy
//     community multi-mint contracts can actually drive. The plan is a 4-step explicit
//     sequence (never auto-signed — every step is pre-simulated and user-confirmed):
//        approve stable → MultiMath/G5/PI.multiBuyWith<Stable>(N) →
//        approve intermediate → MultiAffection.multiBuyWith<Intermediate>(loops)
//     This is the legacy 2-tx route (each leg internally atomic; non-atomic across legs).
//     The fully-atomic single-tx batcher is P5 (/batcher).
//
// ⚠ DEPLOYED ABI (verified on-chain 2026-08 by bytecode dispatch analysis + replaying
// historical successful txs):
//   - The recovered sources/multi-*.sol describe `multiBuyWith(address,uint256)` — that
//     selector (0xcc93bb90) is NOT in any deployed contract's dispatcher. The deployed
//     contracts expose per-token functions instead:
//       Multi MATH 1.1: multiBuyWithDAI(uint256) / multiBuyWithUSDC(uint256)
//       Multi G5:      multiBuyWithDAI(uint256)
//       Multi PI:      multiBuyWithDAI(uint256)
//       Multi AFFECTION: multiBuyWithMATH/G5/PI(uint256)
//   - Arg semantics (verified from tx logs): the intermediate multi-mints take N = whole
//     intermediate tokens to mint (N pStable → N MATH; 5N pDAI → N G5; 300N pDAI → N PI).
//     MultiAffection takes loops = Generate() calls (3N Ⓐ out, perLoop×N intermediate in).
//   - All five also expose an admin surface the recovered sources do NOT describe:
//     tax()/taxMax()/setTax(uint256)/setOwner(address)/withdrawPLS()/withdrawERC20(address).
//     tax() is 0 live on all five (taxMax = 15), but the owner can raise it — the UI reads
//     it live and the per-step pre-simulation always reflects the current on-chain state.
import type { Address } from "viem";
import { erc20Abi } from "./abis/math.abi";
import {
  G5_ADDR,
  MATH_ADDR,
  MULTI_MINT_CONTRACTS,
  PDAI_ADDR,
  PI_ADDR,
  PUSDC_ADDR,
} from "./registry";

const E18 = 10n ** 18n;

// ─── Measured gas model (on-chain receipts, 2026-08) ─────────────────────────────────
// Random() ≈ 36.2k, Generate() ≈ 39.8k, G5 mint ≈ 11.5k marginal. Per Generate() loop:
//   MATH route: 3×Random + 1×Generate ≈ 148.5k/loop (verified: mintFromStable(pUSDC,MATH,100)
//   used 14,751,057 gas = 147.5k/loop — tx 0xc8fca2a5…21921f).
//   G5 route: 0.6×G5mint + Generate ≈ 46.4k/loop.  PI route: ≈ 40.2k/loop.
// Block gas limit ≈ 45M (44,956,056 at measurement). CEILING keeps ~10% headroom.
export const GAS_PER_LOOP: Record<"G5" | "PI" | "MATH", bigint> = {
  MATH: 148_500n,
  G5: 46_400n,
  PI: 40_200n,
};
export const BLOCK_GAS_LIMIT_APPROX = 45_000_000n;
export const GAS_CEILING_PER_TX = 40_500_000n;

/** Max Generate() loops for a route before the atomic mint nears the block gas limit. */
export function maxLoopsPerTx(intermediate: "G5" | "PI" | "MATH"): bigint {
  return GAS_CEILING_PER_TX / GAS_PER_LOOP[intermediate];
}

/** Resolve a multi-mint contract address by its registry name (throws if missing). */
function multiMintAddr(name: string): Address {
  const found = MULTI_MINT_CONTRACTS.find((m) => m.name === name);
  if (!found) throw new Error(`multi-mint contract "${name}" not in registry addresses.json`);
  return found.address;
}

export const MULTI_MATH_ADDR = multiMintAddr("Multi MATH 1.1");
export const MULTI_G5_ADDR = multiMintAddr("Multi G5");
export const MULTI_PI_ADDR = multiMintAddr("Multi PI");
export const MULTI_AFFECTION_ADDR = multiMintAddr("Multi AFFECTION");

/**
 * Shared ABI for the DEPLOYED community multi-mint contracts (verified on-chain — see the
 * header comment). Every mint entry point takes a single uint256: the intermediate
 * multi-mints take N = whole intermediate tokens to mint; MultiAffection takes loops =
 * Generate() calls. tx() calls a per-token function — there is no address-dispatching
 * `multiBuyWith(address,uint256)` in the deployed bytecode.
 */
export const multiMintAbi = [
  {
    type: "function",
    name: "multiBuyWithDAI",
    inputs: [{ type: "uint256", name: "_amount" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "multiBuyWithUSDC",
    inputs: [{ type: "uint256", name: "_amount" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "multiBuyWithMATH",
    inputs: [{ type: "uint256", name: "_loops" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "multiBuyWithG5",
    inputs: [{ type: "uint256", name: "_loops" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "multiBuyWithPI",
    inputs: [{ type: "uint256", name: "_loops" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/** The per-token mint entry point each intermediate multi-mint accepts (deployed ABI). */
export type MultiMintFn = (typeof multiMintAbi)[number]["name"];

// ─── 1. profitability routes ──────────────────────────────────────────────────

// The clean routes (1 pStable / 1 Ⓐ floor). Fa/Faung are omitted from the auto-router
// because their floor floats with the Fa/Faung mint cost — they're covered in the KB.
const baseRoutes: Array<
  Pick<
    MintRoute,
    "intermediate" | "buyFunction" | "perLoop" | "affectionPerIntermediate" | "loopGranularity"
  > & {
    stable: MintRoute["stable"];
  }
> = [
  {
    stable: "pDAI",
    intermediate: "MATH",
    buyFunction: "BuyWithMATH",
    perLoop: 3n * E18,
    affectionPerIntermediate: 1,
    loopGranularity: 1n,
  },
  {
    stable: "pUSDC",
    intermediate: "MATH",
    buyFunction: "BuyWithMATH",
    perLoop: 3n * E18,
    affectionPerIntermediate: 1,
    loopGranularity: 1n,
  },
  {
    stable: "pDAI",
    intermediate: "G5",
    buyFunction: "BuyWithG5",
    perLoop: 6n * 10n ** 17n,
    affectionPerIntermediate: 5,
    loopGranularity: 5n,
  },
  {
    stable: "pDAI",
    intermediate: "PI",
    buyFunction: "BuyWithPI",
    perLoop: 1n * 10n ** 16n,
    affectionPerIntermediate: 300,
    loopGranularity: 100n,
  },
];

export const MINT_ROUTES: MintRoute[] = baseRoutes.map((r) => ({
  id: `${r.intermediate}·${r.stable}`,
  stable: r.stable,
  intermediate: r.intermediate,
  buyFunction: r.buyFunction,
  perLoop: r.perLoop,
  affectionPerIntermediate: r.affectionPerIntermediate,
  stablePerAFFECTION: 1n, // the verified hard floor for all clean routes
  loopGranularity: r.loopGranularity,
}));

// ─── 2. execution routes ──────────────────────────────────────────────────────

export type StableSpec = {
  symbol: "pDAI" | "pUSDC";
  address: Address;
  decimals: number;
};

export const STABLES: Record<"pDAI" | "pUSDC", StableSpec> = {
  pDAI: { symbol: "pDAI", address: PDAI_ADDR, decimals: 18 },
  pUSDC: { symbol: "pUSDC", address: PUSDC_ADDR, decimals: 6 },
};

export type IntermediateSpec = {
  symbol: "G5" | "PI" | "MATH";
  address: Address;
  decimals: number;
  /** base units of intermediate needed per Generate() loop (3 Ⓐ) */
  perLoop: bigint;
  /** whole-token granularity the route needs (1=MATH, 5=G5, 100=PI) */
  loopGranularity: bigint;
  /** the multi-mint contract that mints this intermediate, + which stables it accepts */
  multiMint: Address;
  acceptedStables: Array<"pDAI" | "pUSDC">;
  /** the deployed multi-mint's entry point per accepted stable (arg = whole tokens) */
  mintFn: Record<"pDAI" | "pUSDC", MultiMintFn>;
};

export const INTERMEDIATES: Record<"G5" | "PI" | "MATH", IntermediateSpec> = {
  MATH: {
    symbol: "MATH",
    address: MATH_ADDR,
    decimals: 18,
    perLoop: 3n * E18,
    loopGranularity: 1n,
    multiMint: MULTI_MATH_ADDR,
    acceptedStables: ["pDAI", "pUSDC"],
    mintFn: { pDAI: "multiBuyWithDAI", pUSDC: "multiBuyWithUSDC" },
  },
  G5: {
    symbol: "G5",
    address: G5_ADDR,
    decimals: 18,
    perLoop: 6n * 10n ** 17n,
    loopGranularity: 5n,
    multiMint: MULTI_G5_ADDR,
    acceptedStables: ["pDAI"], // deployed MultiG5 only exposes multiBuyWithDAI
    mintFn: { pDAI: "multiBuyWithDAI", pUSDC: "multiBuyWithDAI" },
  },
  PI: {
    symbol: "PI",
    address: PI_ADDR,
    decimals: 18,
    perLoop: 1n * 10n ** 16n,
    loopGranularity: 100n,
    multiMint: MULTI_PI_ADDR,
    acceptedStables: ["pDAI"], // deployed MultiPI only exposes multiBuyWithDAI
    mintFn: { pDAI: "multiBuyWithDAI", pUSDC: "multiBuyWithDAI" },
  },
};

/**
 * The 4-step execution plan for a (intermediate, stable, loops) mint. Returns the exact
 * transactions the user signs, in order, each pre-simulated by the hook before signing.
 * `intermediateMintAmount` is how many whole intermediate tokens the multi-mint mints
 * (MATH/G5/PI all mint 1 token per internal loop). For MATH that's `3*loops` (1 MATH = 1 Ⓐ);
 * for G5 `(3*loops)/5`; for PI `loops/100`.
 */
export type MintStep =
  | {
      kind: "approve";
      label: string;
      token: Address;
      spender: Address;
      amount: bigint; // type(uint256).max for max-approve
      calldata: {
        address: Address;
        abi: typeof erc20Abi;
        functionName: "approve";
        args: [Address, bigint];
      };
    }
  | {
      kind: "mintIntermediate" | "mintAffection";
      label: string;
      target: Address;
      calldata: {
        address: Address;
        abi: typeof multiMintAbi;
        functionName: MultiMintFn;
        args: [bigint];
      };
    };

export function buildMintPlan(
  intermediate: "G5" | "PI" | "MATH",
  stable: "pDAI" | "pUSDC",
  loops: bigint,
): MintStep[] | null {
  const im = INTERMEDIATES[intermediate];
  const st = STABLES[stable];
  if (!im.acceptedStables.includes(stable)) return null;

  // whole intermediate tokens needed = perLoop * loops, in whole units
  const intermediateWholeNeeded = (im.perLoop * loops) / E18;
  if (intermediateWholeNeeded <= 0n) return null;

  const MAX = 2n ** 256n - 1n;
  const intermediateFn = im.mintFn[stable];
  const affectionFn: MultiMintFn =
    intermediate === "MATH"
      ? "multiBuyWithMATH"
      : intermediate === "G5"
        ? "multiBuyWithG5"
        : "multiBuyWithPI";
  const steps: MintStep[] = [
    {
      kind: "approve",
      label: `approve ${st.symbol} → ${im.symbol} multi-mint`,
      token: st.address,
      spender: im.multiMint,
      amount: MAX,
      calldata: {
        address: st.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [im.multiMint, MAX],
      },
    },
    {
      kind: "mintIntermediate",
      label: `${im.symbol} multi-mint · ${intermediateFn}(${intermediateWholeNeeded})`,
      target: im.multiMint,
      calldata: {
        address: im.multiMint,
        abi: multiMintAbi,
        functionName: intermediateFn,
        args: [intermediateWholeNeeded],
      },
    },
    {
      kind: "approve",
      label: `approve ${im.symbol} → AFFECTION multi-mint`,
      token: im.address,
      spender: MULTI_AFFECTION_ADDR,
      amount: MAX,
      calldata: {
        address: im.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [MULTI_AFFECTION_ADDR, MAX],
      },
    },
    {
      kind: "mintAffection",
      label: `MultiAffection · ${affectionFn}(${loops})`,
      target: MULTI_AFFECTION_ADDR,
      calldata: {
        address: MULTI_AFFECTION_ADDR,
        abi: multiMintAbi,
        functionName: affectionFn,
        args: [loops],
      },
    },
  ];
  return steps;
}

// Re-export the ERC-20 ABI for the mint module's read needs (balance/allowance).
export { erc20Abi };

/**
 * A 2-step plan for a user who already holds the intermediate token and wants to skip the
 * pStable leg: just approve the intermediate → AFFECTION multi-mint, then MultiAffection.
 * `loops` is the number of Generate() calls (= Ⓐ wanted / 3). The caller must hold
 * `perLoop * loops` base units of the intermediate.
 */
export function buildMintPlanFromIntermediate(
  intermediate: "G5" | "PI" | "MATH",
  loops: bigint,
): MintStep[] | null {
  const im = INTERMEDIATES[intermediate];
  const intermediateWholeNeeded = (im.perLoop * loops) / E18;
  if (intermediateWholeNeeded <= 0n) return null;
  const MAX = 2n ** 256n - 1n;
  const affectionFn: MultiMintFn =
    intermediate === "MATH"
      ? "multiBuyWithMATH"
      : intermediate === "G5"
        ? "multiBuyWithG5"
        : "multiBuyWithPI";
  return [
    {
      kind: "approve",
      label: `approve ${im.symbol} → AFFECTION multi-mint`,
      token: im.address,
      spender: MULTI_AFFECTION_ADDR,
      amount: MAX,
      calldata: {
        address: im.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [MULTI_AFFECTION_ADDR, MAX],
      },
    },
    {
      kind: "mintAffection",
      label: `MultiAffection · ${affectionFn}(${loops})`,
      target: MULTI_AFFECTION_ADDR,
      calldata: {
        address: MULTI_AFFECTION_ADDR,
        abi: multiMintAbi,
        functionName: affectionFn,
        args: [loops],
      },
    },
  ];
}
