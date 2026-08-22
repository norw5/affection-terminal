import { publicClient } from "@/lib/rpc/client";
import { useQuery } from "@tanstack/react-query";
// Simulate a contract deployment via an `eth_call` with the creation data (no `to`), from
// the user's address — so the wizard can probe for reverts (e.g. a constructor approval
// failing) BEFORE the user signs. Holds the trust posture: every deploy is pre-simulated.
//
// viem's public client does not expose `simulateDeployContract` as a registered action
// here, so we encode the creation data (bytecode + constructor args) and run it through
// `client.call` (an eth_call with no `to` simulates a CREATE). Reverts surface a short
// reason; success → the deploy is likely to land.
import { encodeAbiParameters, parseAbiParameters } from "viem";
import type { Address } from "viem";

export type DeploySim = { ok: boolean; error?: string; creationData: `0x${string}` };

/** Encode creation data = bytecode + ABI-encoded constructor args. */
export function encodeCreationData(
  bytecode: `0x${string}`,
  argTypes: string[],
  args: Address[],
): `0x${string}` {
  const encoded = encodeAbiParameters(parseAbiParameters(argTypes.join(", ")), args);
  return `${bytecode}${encoded.slice(2)}` as `0x${string}`;
}

async function simulateCreation(
  bytecode: `0x${string}`,
  argTypes: string[],
  args: Address[],
  deployer: Address,
): Promise<DeploySim> {
  const creationData = encodeCreationData(bytecode, argTypes, args);
  try {
    // eth_call with no `to` simulates contract creation from `deployer`.
    await publicClient.call({ data: creationData, account: deployer });
    return { ok: true, creationData };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const short = msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
    return { ok: false, error: short, creationData };
  }
}

export function useSimulateDeploy(
  bytecode: `0x${string}` | null,
  argTypes: string[] | null,
  args: Address[] | null,
  deployer?: Address,
) {
  return useQuery<DeploySim>({
    queryKey: [
      "deploy-simulate",
      bytecode ? `${bytecode.slice(0, 18)}…${bytecode.slice(-6)}` : null,
      argTypes ? argTypes.join(",") : null,
      args ? args.map((a) => a.toLowerCase()).join("|") : null,
      deployer ?? null,
    ],
    enabled: !!bytecode && !!argTypes && !!args && args.length > 0 && !!deployer,
    queryFn: async () => {
      if (!bytecode || !argTypes || !args || !deployer)
        return { ok: false, error: "missing params", creationData: "0x" } as DeploySim;
      return simulateCreation(bytecode, argTypes, args, deployer);
    },
    refetchInterval: 20_000,
    staleTime: 15_000,
  });
}
