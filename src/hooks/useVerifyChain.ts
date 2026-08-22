import { erc20Abi } from "@/config/abis/math.abi";
import { publicClient } from "@/lib/rpc/client";
import { type FactDef, type FactResult, VERIFY_FACTS, checkFact } from "@/lib/verify/facts";
// "Verify against chain" — runs the canonical `eth_call`s from affection_docs/sources.md §2
// on demand and returns per-fact results. Re-uses the viem publicClient (no multicall3 dep:
// reads fan out to parallel eth_calls via Promise.all). Each read is independently
// try/caught so a single bad contract/RPC never fails the whole batch.
import { useCallback, useState } from "react";

export type VerifyState = {
  isVerifying: boolean;
  lastRun: Date | null;
  results: Record<string, FactResult>;
};

export type UseVerifyChain = VerifyState & {
  verify: () => Promise<void>;
  reset: () => void;
  facts: FactDef[];
};

const INITIAL: VerifyState = { isVerifying: false, lastRun: null, results: {} };

async function readFact(fact: FactDef): Promise<bigint | null> {
  try {
    const raw = await publicClient.readContract({
      address: fact.address,
      abi: erc20Abi,
      functionName: fact.call,
      args: fact.call === "balanceOf" ? [fact.args ?? fact.address] : undefined,
    });
    if (typeof raw === "bigint") return raw;
    return BigInt(raw as number | string);
  } catch {
    return null;
  }
}

export function useVerifyChain(): UseVerifyChain {
  const [state, setState] = useState<VerifyState>(INITIAL);

  const verify = useCallback(async () => {
    setState((s) => ({ ...s, isVerifying: true }));
    try {
      const entries = await Promise.all(
        VERIFY_FACTS.map(async (f) => [f.id, checkFact(await readFact(f), f)] as const),
      );
      setState({ isVerifying: false, lastRun: new Date(), results: Object.fromEntries(entries) });
    } catch {
      setState((s) => ({ ...s, isVerifying: false }));
    }
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, verify, reset, facts: VERIFY_FACTS };
}
