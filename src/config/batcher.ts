// Typed config + artifacts for the Module C batchers (P5). Imports the compiled artifacts
// (ABI + bytecode) emitted by `npm run compile-batcher` and exposes the canonical
// constructor defaults + a typed constructor-arg encoder. The deployment wizard reads this.
//
// The batchers are written in contracts/ (UnifiedAffectionBatcher.sol + AtomicArbBatcher.sol)
// and compiled to contracts/artifacts/*.json. Nothing is deployed by default — the wizard lets
// each user deploy their own instance from the frontend (so they control the address).
import type { Abi, Address } from "viem";
import atomicArtifact from "../../contracts/artifacts/AtomicArbBatcher.json";
import unifiedArtifact from "../../contracts/artifacts/UnifiedAffectionBatcher.json";
import { AFFECTION_ADDR, G5_ADDR, MATH_ADDR, PDAI_ADDR, PI_ADDR, PUSDC_ADDR } from "./registry";

export type BatcherVariant = "mint-only" | "mint-sell";

export type BatcherAbi = Abi;

export const UNIFIED_BATCHER_ABI = unifiedArtifact.abi as BatcherAbi;
export const UNIFIED_BATCHER_BYTECODE = unifiedArtifact.bytecode as `0x${string}`;
export const ATOMIC_ARB_BATCHER_ABI = atomicArtifact.abi as BatcherAbi;
export const ATOMIC_ARB_BATCHER_BYTECODE = atomicArtifact.bytecode as `0x${string}`;

export type BatcherArtifact = {
  name: string;
  variant: BatcherVariant;
  abi: BatcherAbi;
  bytecode: `0x${string}`;
  /** Constructor param metadata, in order, for the wizard. */
  constructorParams: Array<{
    name: string;
    label: string;
    default: Address;
    description: string;
  }>;
  requiresRouter: boolean;
};

// Canonical constructor defaults (the verified on-chain addresses; the wizard lets you
// override — e.g. if AFFECTION is ever upgraded, though it is not upgradeable).
const BASE_PARAMS: BatcherArtifact["constructorParams"] = [
  {
    name: "aff",
    label: "AFFECTION",
    default: AFFECTION_ADDR,
    description: "the AFFECTION (Ⓐ) contract",
  },
  {
    name: "math",
    label: "MATH v1.1",
    default: MATH_ADDR,
    description: "libAtropaMath v1.1 (Random + BuyWithDAI/USDC)",
  },
  { name: "g5", label: "G5", default: G5_ADDR, description: "GIMME FIVE (BuyWithDAI direct-mint)" },
  {
    name: "pi",
    label: "PI",
    default: PI_ADDR,
    description: "pINDEPENDENCE (BuyWithDAI direct-mint)",
  },
  {
    name: "pdai",
    label: "pDAI",
    default: PDAI_ADDR,
    description: "PulseChain fork of DAI (18 dec)",
  },
  {
    name: "pusdc",
    label: "pUSDC",
    default: PUSDC_ADDR,
    description: "PulseChain fork of USDC (6 dec; MATH route only)",
  },
];

export const BATCHERS: Record<BatcherVariant, BatcherArtifact> = {
  "mint-only": {
    name: "UnifiedAffectionBatcher",
    variant: "mint-only",
    abi: UNIFIED_BATCHER_ABI,
    bytecode: UNIFIED_BATCHER_BYTECODE,
    constructorParams: BASE_PARAMS,
    requiresRouter: false,
  },
  "mint-sell": {
    name: "AtomicArbBatcher",
    variant: "mint-sell",
    abi: ATOMIC_ARB_BATCHER_ABI,
    bytecode: ATOMIC_ARB_BATCHER_BYTECODE,
    constructorParams: [
      ...BASE_PARAMS,
      {
        name: "router",
        label: "PulseX V2 router",
        // No verified default — the wizard surfaces this for user input/verification.
        default: "0x0000000000000000000000000000000000000000" as Address,
        description:
          "PulseX V2 router (verify on-chain before use; mint+sell adds DEX audit surface)",
      },
    ],
    requiresRouter: true,
  },
};

/** The order + types of constructor args, for encodeDeployContractArgs / the simulate probe. */
export const CONSTRUCTOR_ARG_TYPES: Array<{ variant: BatcherVariant; types: string[] }> = [
  {
    variant: "mint-only",
    types: ["address", "address", "address", "address", "address", "address"],
  },
  {
    variant: "mint-sell",
    types: ["address", "address", "address", "address", "address", "address", "address"],
  },
];

/** Build the constructor args array (in order) from a wizard-state values map. */
export function buildConstructorArgs(
  variant: BatcherVariant,
  values: Record<string, Address>,
): Address[] {
  const spec = BATCHERS[variant];
  return spec.constructorParams.map((p) => values[p.name] ?? p.default);
}
