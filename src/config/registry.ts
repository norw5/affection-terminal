// Typed, canonical address + rate registry.
//
// SINGLE SOURCE OF TRUTH: this module derives its data directly from the committed
// machine-readable registries in affection_docs/registry/ (addresses.json, minting_rates.json),
// which are themselves sourced from the verified on-chain contracts. The portal reads these
// at build time; bots/agents can read the same JSON. If a value here is wrong, fix the JSON
// in affection_docs/registry/ — not this file.
import type { Address } from "viem";
import addressesData from "../../affection_docs/registry/addresses.json";
import mintingRatesData from "../../affection_docs/registry/minting_rates.json";

export type TokenInfo = {
  name: string;
  symbol?: string;
  display?: string;
  address: Address;
  decimals: number;
  verified: boolean;
  stillMintable?: boolean;
  cap?: string;
  role: string;
  inherits?: string[];
  notes?: string;
  owner?: Address;
};

type RawToken = Omit<TokenInfo, "stillMintable"> & { still_mintable?: boolean };

const rawTokens = addressesData.tokens as unknown as RawToken[];
const tokens: TokenInfo[] = rawTokens.map((t) => ({
  ...t,
  stillMintable: t.still_mintable,
}));

export const TOKENS: TokenInfo[] = tokens;

const byAddr = new Map(tokens.map((t) => [t.address.toLowerCase(), t]));
export const tokenByAddress = (addr: Address): TokenInfo | undefined =>
  byAddr.get(addr.toLowerCase());

const byName = new Map(tokens.map((t) => [t.name, t]));
export const tokenByName = (name: string): TokenInfo | undefined => byName.get(name);

/** Resolve a token that MUST exist in the registry, or throw loudly (build-time-known data). */
function mustToken(name: string): TokenInfo {
  const t = byName.get(name);
  if (!t)
    throw new Error(
      `registry: missing token "${name}" — fix affection_docs/registry/addresses.json`,
    );
  return t;
}

// Canonical shortcuts (the addresses the whole portal keys off of).
export const AFFECTION_ADDR = mustToken("AFFECTION").address;
export const MATH_ADDR = mustToken("libAtropaMath v1.1").address;
export const MATH_V1_0_ADDR = mustToken("libAtropaMath v1.0").address;
export const G5_ADDR = mustToken("GIMME FIVE").address;
export const PI_ADDR = mustToken("pINDEPENDENCE").address;
export const RNG_ADDR = mustToken("Random Number Generator").address;
export const FA_ADDR = mustToken("libConjecture v1.0").address;
export const FAUNG_ADDR = mustToken("libDynamic v1.0").address;
export const PDAI_ADDR = mustToken("pDAI").address;
export const PUSDC_ADDR = mustToken("pUSDC").address;
export const PUSDT_ADDR = mustToken("pUSDT").address;

export type MultiMintContract = { name: string; address: Address };
// Legacy community-deployed batchers — used only by the /mint Tier-2 compatibility mode.
// See the "$comment" in addresses.json: not maintained or endorsed by the portal.
export const MULTI_MINT_CONTRACTS = (
  addressesData.multi_mint_contracts as { contracts: MultiMintContract[] }
).contracts;

// Ecosystem constants block.
export const MOTZKIN_PRIME = BigInt(addressesData.constants.MotzkinPrime);
export const AFFECTION_CAP = BigInt(addressesData.constants.AFFECTION_cap); // whole tokens (1,111,111,111)
export const MATH_CAP = BigInt(addressesData.constants.MATH_cap); // whole tokens

// Minting rates (affection-side BuyWith* routes).
export type BuyRoute = {
  function: string;
  inputSymbol: string;
  inputAddress: Address;
  outputSymbol: string;
  outputAddress: Address;
  divisor?: number;
  multiplier?: number;
  rateInPer1Out: string;
  inverseRateOutPer1In: string;
  effectiveFloorInPDAIPer1AFFECTION: string;
  requiresPriorCharge: boolean;
  chargeFunction: string;
};

export const GENERATE_MINTS_PER_CALL_STR = mintingRatesData.generate_mints_per_call; // "3"

export const BUY_ROUTES = mintingRatesData.buy_routes as unknown as BuyRoute[];

export const AFFECTION_GENERATE_BASE = BigInt(mintingRatesData.generate_mint_units); // 1e18
