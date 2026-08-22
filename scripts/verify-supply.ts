// Standalone re-verification of the canonical live reads from affection_docs/sources.md.
// Run with: npm run verify-supply
//
// This is the "verify the docs" escape hatch: it hits a PulseChain RPC directly and prints
// the live supply / decimals / contract buffer so you can diff against the documented values.
// It also sanity-checks that the portal's config layer reads the right selectors.
import { createPublicClient, http, formatUnits } from "viem";
import { pulsechain } from "../src/config/chain";
import { RPC_URLS } from "../src/config/rpc";
import { AFFECTION_ADDR, MATH_ADDR, AFFECTION_CAP } from "../src/config/registry";
import { affectionAbi } from "../src/config/abis/affection.abi";
import { mathAbi } from "../src/config/abis/math.abi";

const client = createPublicClient({
  chain: pulsechain,
  transport: http(RPC_URLS[0]!, { timeout: 30_000 }),
});

async function main() {
  const [affSupply, affDecimals, mathSupply, mathDecimals, affBuffer] = await Promise.all([
    client.readContract({ address: AFFECTION_ADDR, abi: affectionAbi, functionName: "totalSupply" }),
    client.readContract({ address: AFFECTION_ADDR, abi: affectionAbi, functionName: "decimals" }),
    client.readContract({ address: MATH_ADDR, abi: mathAbi, functionName: "totalSupply" }),
    client.readContract({ address: MATH_ADDR, abi: mathAbi, functionName: "decimals" }),
    client.readContract({
      address: AFFECTION_ADDR,
      abi: affectionAbi,
      functionName: "balanceOf",
      args: [AFFECTION_ADDR],
    }),
  ]);

  const affSupplyB = affSupply as bigint;
  const affDec = affDecimals as number;
  const mathSupplyB = mathSupply as bigint;
  const mathDec = mathDecimals as number;
  const affBufferB = affBuffer as bigint;

  const cap = BigInt(AFFECTION_CAP) * 10n ** 18n;
  const affFilledPct = Number((affSupplyB * 10_000n) / cap) / 100;

  console.log("=== AFFECTION live reads (sources.md re-verify) ===");
  console.log("RPC:", RPC_URLS[0]);
  console.log("AFFECTION totalSupply:", formatUnits(affSupplyB, affDec), "Ⓐ");
  console.log("AFFECTION decimals:   ", affDec);
  console.log("AFFECTION contract buffer (self-balance):", formatUnits(affBufferB, affDec), "Ⓐ");
  console.log("AFFECTION cap:        ", AFFECTION_CAP.toString(), "(~", affFilledPct.toFixed(2), "% filled)");
  console.log("MATH totalSupply:     ", formatUnits(mathSupplyB, mathDec), "MATH");
  console.log("");
  console.log("Note: contract buffer ≈ 0 confirms just-in-time minting (Generate charges, BuyWith* drains, same tx).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
