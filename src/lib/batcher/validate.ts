// On-chain validation for a candidate batcher address. Both portal batcher variants expose
// the immutable AFFECTION()/PDAI() views; only AtomicArbBatcher exposes ROUTER(). We require
// the contract to exist, its AFFECTION/PDAI immutables to point at the canonical addresses,
// and we detect the variant from ROUTER()'s presence — so /mint can load the right ABI and
// /batcher can refuse non-portal contracts. Pure RPC — no React deps.
import type { BatcherVariant } from "@/config/batcher";
import { AFFECTION_ADDR, PDAI_ADDR } from "@/config/registry";
import { publicClient } from "@/lib/rpc/client";
import type { Address } from "viem";

export const BATCHER_PROBE_ABI = [
  {
    type: "function",
    name: "AFFECTION",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "PDAI",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ROUTER",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;

export type BatchValidation = { ok: true; variant: BatcherVariant } | { ok: false; error: string };

/** Validate a candidate batcher address on-chain: contract exists, its immutables point at
 *  the canonical AFFECTION + pDAI, and detect which variant it is (ROUTER() present). */
export async function validateBatcherAddress(addr: Address): Promise<BatchValidation> {
  const code = await publicClient.getCode({ address: addr });
  if (!code || code === "0x") return { ok: false, error: "no contract deployed at this address" };
  try {
    const [aff, pdai] = await Promise.all([
      publicClient.readContract({
        address: addr,
        abi: BATCHER_PROBE_ABI,
        functionName: "AFFECTION",
      }),
      publicClient.readContract({ address: addr, abi: BATCHER_PROBE_ABI, functionName: "PDAI" }),
    ]);
    if (
      (aff as string).toLowerCase() !== AFFECTION_ADDR.toLowerCase() ||
      (pdai as string).toLowerCase() !== PDAI_ADDR.toLowerCase()
    ) {
      return {
        ok: false,
        error:
          "contract found, but its immutables are not the canonical AFFECTION/pDAI — not one of this portal's batchers",
      };
    }
    try {
      await publicClient.readContract({
        address: addr,
        abi: BATCHER_PROBE_ABI,
        functionName: "ROUTER",
      });
      return { ok: true, variant: "mint-sell" };
    } catch {
      return { ok: true, variant: "mint-only" };
    }
  } catch {
    return {
      ok: false,
      error: "contract found, but it does not expose the batcher views (AFFECTION/PDAI)",
    };
  }
}
