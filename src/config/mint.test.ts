import { toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";
import {
  INTERMEDIATES,
  MULTI_AFFECTION_ADDR,
  MULTI_G5_ADDR,
  MULTI_MATH_ADDR,
  MULTI_PI_ADDR,
  type MintStep,
  buildMintPlan,
  buildMintPlanFromIntermediate,
  multiMintAbi,
} from "./mint";
import { PDAI_ADDR } from "./registry";

// The deployed multi-mint selectors, verified on-chain 2026-08 by bytecode dispatch
// extraction (PUSH4 <sel> EQ in eth_getCode) + historical tx replays. See
// affection_docs/04_multi_mint_contracts.md. These tests pin the portal's execution ABI
// to the deployed bytecode — a drift here means every Tier-2 mint step would revert.
const DEPLOYED_SELECTORS: Record<string, `0x${string}`> = {
  multiBuyWithDAI: "0x393a8a07",
  multiBuyWithUSDC: "0xbc9820c1",
  multiBuyWithMATH: "0xa791de3d",
  multiBuyWithG5: "0xf8801ecf",
  multiBuyWithPI: "0x063cbdea",
};

const approveOf = (s: MintStep) => (s.kind === "approve" ? s : null);
const mintOf = (s: MintStep) => (s.kind !== "approve" ? s : null);

function planOrThrow(...args: Parameters<typeof buildMintPlan>): MintStep[] {
  const plan = buildMintPlan(...args);
  if (!plan) throw new Error(`plan unexpectedly null for ${args.join(", ")}`);
  return plan;
}

describe("multiMintAbi matches the deployed bytecode dispatchers", () => {
  for (const entry of multiMintAbi) {
    it(`${entry.name} encodes to the verified selector ${DEPLOYED_SELECTORS[entry.name]}`, () => {
      expect(toFunctionSelector(entry as never)).toBe(DEPLOYED_SELECTORS[entry.name]);
    });
  }

  it("contains no address-dispatching multiBuyWith (not in any deployed contract)", () => {
    const names = multiMintAbi.map((e) => e.name) as string[];
    expect(names).not.toContain("multiBuyWith");
  });
});

describe("buildMintPlan", () => {
  it("MATH·pDAI: 4 steps, per-token fns, arg = whole MATH tokens then loops", () => {
    const [a1, m1, a2, m2] = planOrThrow("MATH", "pDAI", 100n);
    expect(approveOf(a1)?.spender).toBe(MULTI_MATH_ADDR);
    expect(approveOf(a1)?.token).toBe(PDAI_ADDR);
    expect(mintOf(m1)?.calldata.address).toBe(MULTI_MATH_ADDR);
    expect(mintOf(m1)?.calldata.functionName).toBe("multiBuyWithDAI");
    expect(mintOf(m1)?.calldata.args).toEqual([300n]); // 3 MATH per loop × 100 loops
    expect(approveOf(a2)?.spender).toBe(MULTI_AFFECTION_ADDR);
    expect(mintOf(m2)?.calldata.address).toBe(MULTI_AFFECTION_ADDR);
    expect(mintOf(m2)?.calldata.functionName).toBe("multiBuyWithMATH");
    expect(mintOf(m2)?.calldata.args).toEqual([100n]); // loops = Generate() calls → 300 Ⓐ
  });

  it("MATH·pUSDC uses multiBuyWithUSDC", () => {
    const plan = planOrThrow("MATH", "pUSDC", 10n);
    expect(mintOf(plan[1] ?? plan[0])?.calldata.functionName).toBe("multiBuyWithUSDC");
    expect(mintOf(plan[1] ?? plan[0])?.calldata.args).toEqual([30n]);
  });

  it("G5·pDAI: multiBuyWithDAI(0.6×loops) then multiBuyWithG5(loops)", () => {
    const plan = planOrThrow("G5", "pDAI", 100n);
    expect(approveOf(plan[0] as MintStep)?.spender).toBe(MULTI_G5_ADDR);
    expect(mintOf(plan[1] as MintStep)?.calldata.address).toBe(MULTI_G5_ADDR);
    expect(mintOf(plan[1] as MintStep)?.calldata.functionName).toBe("multiBuyWithDAI");
    expect(mintOf(plan[1] as MintStep)?.calldata.args).toEqual([60n]); // 0.6 G5 per loop × 100
    expect(mintOf(plan[3] as MintStep)?.calldata.functionName).toBe("multiBuyWithG5");
    expect(mintOf(plan[3] as MintStep)?.calldata.args).toEqual([100n]);
  });

  it("PI·pDAI: multiBuyWithDAI(loops/100) then multiBuyWithPI(loops)", () => {
    const plan = planOrThrow("PI", "pDAI", 300n);
    expect(approveOf(plan[0] as MintStep)?.spender).toBe(MULTI_PI_ADDR);
    expect(mintOf(plan[1] as MintStep)?.calldata.functionName).toBe("multiBuyWithDAI");
    expect(mintOf(plan[1] as MintStep)?.calldata.args).toEqual([3n]); // 0.01 PI per loop × 300
    expect(mintOf(plan[3] as MintStep)?.calldata.functionName).toBe("multiBuyWithPI");
    expect(mintOf(plan[3] as MintStep)?.calldata.args).toEqual([300n]);
  });

  it("G5/PI via pUSDC is not executable (deployed contracts only accept pDAI)", () => {
    expect(buildMintPlan("G5", "pUSDC", 100n)).toBeNull();
    expect(buildMintPlan("PI", "pUSDC", 300n)).toBeNull();
  });

  it("returns null when loops rounds down to zero intermediate tokens", () => {
    expect(buildMintPlan("PI", "pDAI", 99n)).toBeNull(); // 0.99 PI → 0 whole
    expect(buildMintPlanFromIntermediate("PI", 99n)).toBeNull();
  });

  it("approvals are one-time max approvals to the right spenders", () => {
    const plan = planOrThrow("MATH", "pDAI", 5n);
    const MAX = 2n ** 256n - 1n;
    expect(approveOf(plan[0] as MintStep)?.calldata.args).toEqual([MULTI_MATH_ADDR, MAX]);
    expect(approveOf(plan[2] as MintStep)?.calldata.args).toEqual([MULTI_AFFECTION_ADDR, MAX]);
  });
});

describe("buildMintPlanFromIntermediate", () => {
  it("2 steps: approve intermediate → MultiAffection per-token fn with loops", () => {
    const plan = buildMintPlanFromIntermediate("MATH", 7n);
    expect(plan).toHaveLength(2);
    expect(approveOf((plan ?? [])[0] as MintStep)?.token).toBe(INTERMEDIATES.MATH.address);
    expect(mintOf((plan ?? [])[1] as MintStep)?.calldata.functionName).toBe("multiBuyWithMATH");
    expect(mintOf((plan ?? [])[1] as MintStep)?.calldata.args).toEqual([7n]);
  });
});
