// The AFFECTION minting graph: pStable → intermediate → AFFECTION. This is the typed model
// the auto-router (Module B Tier 1) and profitability engine will reason over. Data derives
// from affection_docs/registry/minting_rates.json (the authoritative rate table).
import type { Address } from "viem";
import {
  AFFECTION_ADDR,
  BUY_ROUTES,
  G5_ADDR,
  MATH_ADDR,
  PDAI_ADDR,
  PI_ADDR,
  PUSDC_ADDR,
} from "./registry";

export type Stable = "pDAI" | "pUSDC";

export type IntermediateRoute = {
  /** Intermediate token symbol used to redeem AFFECTION. */
  intermediate: "G5" | "PI" | "MATH" | "Fa" | "Faung";
  /** AFFECTION BuyWith* function name. */
  buyFunction: string;
  /** AFFECTION minted per 1 intermediate (e.g. G5 → 5). */
  affectionPerIntermediate: number;
  /** Whole intermediate tokens needed per `Generate()` loop (3 AFFECTION). */
  perLoop: bigint; // in base units
  /** pStable cost per intermediate (for the clean 1:1 floor routes). */
  stableCostPerIntermediate?: { pDAI?: bigint; pUSDC?: bigint };
  /** Whether the intermediate is minted via a charge+drain (MATH) or direct mint (G5/PI). */
  intermediateStrategy: "chargeAndDrain" | "directMint";
  /** Intermediate contract address. */
  intermediateAddress: Address;
};

// perLoop values from registry/minting_rates.json (multi_mint_per_loop.routes), in base units.
const E18 = 10n ** 18n;
export const ROUTES: IntermediateRoute[] = [
  {
    intermediate: "MATH",
    buyFunction: "BuyWithMATH",
    affectionPerIntermediate: 1,
    perLoop: 3n * E18,
    stableCostPerIntermediate: { pDAI: 1n * E18, pUSDC: 1_000_000n },
    intermediateStrategy: "chargeAndDrain",
    intermediateAddress: MATH_ADDR,
  },
  {
    intermediate: "G5",
    buyFunction: "BuyWithG5",
    affectionPerIntermediate: 5,
    perLoop: 6n * 10n ** 17n, // 0.6
    stableCostPerIntermediate: { pDAI: 5n * E18, pUSDC: 5_000_000n },
    intermediateStrategy: "directMint",
    intermediateAddress: G5_ADDR,
  },
  {
    intermediate: "PI",
    buyFunction: "BuyWithPI",
    affectionPerIntermediate: 300,
    perLoop: 1n * 10n ** 16n, // 0.01
    stableCostPerIntermediate: { pDAI: 300n * E18, pUSDC: 300_000_000n },
    intermediateStrategy: "directMint",
    intermediateAddress: PI_ADDR,
  },
];

export const STABLES: Record<Stable, Address> = {
  pDAI: PDAI_ADDR,
  pUSDC: PUSDC_ADDR,
};

export { AFFECTION_ADDR };
export { BUY_ROUTES };
