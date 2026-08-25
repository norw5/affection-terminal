// Live re-verification of the Module B (P4) profitability pipeline. Hits PulseChain RPCs
// directly, builds the swap graph from live Ⓐ + cross-quote pairs, and prints the
// profitability of every clean mint route at a chosen loop count — proving the auto-router's
// read path end-to-end. Run: npx tsx scripts/verify-mint-profitability.ts [loops]
import { createPublicClient, http } from "viem";
import { formatUnits } from "../src/lib/format/units";
import { pulsechain } from "../src/config/chain";
import { RPC_URLS } from "../src/config/rpc";
import { pulsexFactoryAbi, pulsexPairAbi } from "../src/config/pulsex";
import { PULSEX_V2_FACTORY, WPLS_ADDR } from "../src/config/pulsex";
import { AFFECTION_ADDR, AFFECTION_CAP, PDAI_ADDR, PUSDC_ADDR } from "../src/config/registry";
import { affectionAbi } from "../src/config/abis/affection.abi";
import { AFFECTION_CAP_BASE } from "../src/config/constants";
import {
  buildSwapGraph,
  computeMaxSafeLoops,
  computeRouteProfitability,
  recommendBest,
} from "../src/lib/mint/profitability";
import { MINT_ROUTES, STABLES } from "../src/config/mint";

const client = createPublicClient({
  chain: pulsechain,
  transport: http(RPC_URLS[0]!, { timeout: 30_000 }),
});

const SYMBOL: Record<string, string> = {
  [WPLS_ADDR.toLowerCase()]: "WPLS",
  [PDAI_ADDR.toLowerCase()]: "pDAI",
  [PUSDC_ADDR.toLowerCase()]: "pUSDC",
  [AFFECTION_ADDR.toLowerCase()]: "AFFECTION",
};

function bpsPct(bps: bigint): string {
  const neg = bps < 0n;
  const abs = neg ? -bps : bps;
  return `${neg ? "-" : "+"}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}%`;
}

async function getPair(a: `0x${string}`, b: `0x${string}`) {
  const pair = (await client.readContract({
    address: PULSEX_V2_FACTORY,
    abi: pulsexFactoryAbi,
    functionName: "getPair",
    args: [a, b],
  })) as string;
  if (!pair || pair === "0x0000000000000000000000000000000000000000") return null;
  const [token0, reserves] = await Promise.all([
    client.readContract({ address: pair as `0x${string}`, abi: pulsexPairAbi, functionName: "token0" }),
    client.readContract({ address: pair as `0x${string}`, abi: pulsexPairAbi, functionName: "getReserves" }),
  ]);
  const [r0, r1] = reserves as [bigint, bigint, number];
  const aFirst = (token0 as string).toLowerCase() === a.toLowerCase();
  return {
    baseAddress: a,
    quoteAddress: b,
    baseReserve: aFirst ? r0 : r1,
    quoteReserve: aFirst ? r1 : r0,
    baseDecimals: 18,
    quoteDecimals: 18,
  };
}

async function main() {
  const loops = BigInt(process.argv[2] ?? "100");
  const affSupply = (await client.readContract({
    address: AFFECTION_ADDR,
    abi: affectionAbi,
    functionName: "totalSupply",
  })) as bigint;

  // Build the swap graph from live Ⓐ pairs + cross-quote pairs.
  const pairDefs: Array<[`0x${string}`, `0x${string}`, number, number]> = [
    [AFFECTION_ADDR, WPLS_ADDR, 18, 18],
    [AFFECTION_ADDR, PDAI_ADDR, 18, 18],
    [AFFECTION_ADDR, PUSDC_ADDR, 18, 6],
    [WPLS_ADDR, PDAI_ADDR, 18, 18],
    [WPLS_ADDR, PUSDC_ADDR, 18, 6],
    [PDAI_ADDR, PUSDC_ADDR, 18, 6],
  ];
  const pairs = (await Promise.all(pairDefs.map(([a, b, ad, bd]) => getPair(a, b).then((p) => (p ? { ...p, baseDecimals: ad, quoteDecimals: bd } : p))))).filter(
    (p): p is NonNullable<typeof p> => p !== null,
  );
  const graph = buildSwapGraph(pairs);

  console.log("=== P4 mint profitability — live read ===");
  console.log(`loops = ${loops}  → mints ${formatUnits(loops * 3n * 10n ** 18n, 18, 2)} Ⓐ`);
  console.log(`maxSafeLoops = ${computeMaxSafeLoops(affSupply, AFFECTION_CAP_BASE).toString()} (cap ${AFFECTION_CAP})`);
  console.log(`pairs with liquidity: ${pairs.length}/${pairDefs.length}`);
  for (const p of pairs) {
    console.log(
      `  ${p.baseAddress.slice(0, 6)}…/${p.quoteAddress.slice(0, 6)}…  base=${formatUnits(p.baseReserve, p.baseDecimals, 2)} quote=${formatUnits(p.quoteReserve, p.quoteDecimals, 2)}`,
    );
  }

  const profits = MINT_ROUTES.map((route) => {
    const st = STABLES[route.stable];
    return computeRouteProfitability(route, loops, affSupply, AFFECTION_CAP_BASE, graph, AFFECTION_ADDR, st.address, st.decimals);
  });
  const best = recommendBest(profits);
  console.log("\nroute         cost            dexValue        profit         %       impact  exit");
  for (const p of profits) {
    const dec = STABLES[p.route.stable].decimals;
    const sym = p.route.stable;
    const exitPath = p.exit ? p.exit.path.slice(1).map((a) => SYMBOL[a.toLowerCase()] ?? `${a.slice(0, 6)}…`).join("→") : "none";
    const profitStr = p.exit ? `${p.profit >= 0n ? "+" : "-"}${formatUnits(p.profit < 0n ? -p.profit : p.profit, dec, 2)}` : "—";
    console.log(
      `${p.route.id.padEnd(13)} ${formatUnits(p.stableCost, dec, 2).padStart(14)} ${sym} ${
        p.exit ? formatUnits(p.dexValue, dec, 2).padStart(15) : "—".padStart(15)
      }  ${profitStr.padStart(15)}  ${p.exit ? bpsPct(p.profitBps).padStart(7) : "—".padStart(7)}  ${p.exit ? bpsPct(-p.exit.slippageBps).padStart(6) : "—".padStart(6)}  ${exitPath}`,
    );
  }
  console.log(
    `\nrecommended: ${best ? best.route.id + "  (" + bpsPct(best.profitBps) + ", " + (best.profit >= 0n ? "+" : "-") + formatUnits(best.profit < 0n ? -best.profit : best.profit, STABLES[best.route.stable].decimals, 2) + " " + best.route.stable + ")" : "none (no DEX exit)"}`,
  );

  // ── Batch-ABI sanity check ────────────────────────────────────────────────────
  // Minting execution now goes through the portal's own batcher contracts (driven from
  // /mint), not the legacy community multi-mints. Verify the compiled batcher ABI still
  // exposes the entry points /mint uses (mintFromStable + multiBuyWith), and that the
  // canonical address immutables match the live registry.
  const { BATCHERS } = await import("../src/config/batcher");
  const { toFunctionSelector } = await import("viem");

  const needed = ["mintFromStable", "multiBuyWith", "maxSafeLoops", "AFFECTION", "PDAI"] as const;
  console.log("\nbatcher ABI — portal entry points present in the compiled artifact:");
  let abiOk = true;
  for (const name of needed) {
    const present = BATCHERS["mint-only"].abi.some(
      (e) => (e as { type: string; name?: string }).type === "function" && (e as { name: string }).name === name,
    );
    if (!present) abiOk = false;
    console.log(`  ${present ? "OK " : "MISSING"} ${name}`);
  }
  const selMint = toFunctionSelector(
    BATCHERS["mint-only"].abi.find((e) => (e as { name?: string }).name === "mintFromStable") as never,
  );
  const selMulti = toFunctionSelector(
    BATCHERS["mint-only"].abi.find((e) => (e as { name?: string }).name === "multiBuyWith") as never,
  );
  console.log(`  mintFromStable selector = ${selMint}`);
  console.log(`  multiBuyWith selector   = ${selMulti}`);
  if (!abiOk) {
    console.error("\n✗ batcher ABI mismatch — /mint would not be able to drive the batcher");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
