// One-shot: verify the PulseX V2 factory + discover ecosystem pairs + reserves.
// Run: npx tsx scripts/verify-pulsex.ts
import { createPublicClient, http, getAddress } from "viem";
import { pulsechain } from "../src/config/chain";
import { RPC_URLS } from "../src/config/rpc";
import {
  AFFECTION_ADDR,
  G5_ADDR,
  MATH_ADDR,
  PDAI_ADDR,
  PI_ADDR,
  PUSDC_ADDR,
} from "../src/config/registry";

const WPLS = "0xA1077a294dDE1B09bB078844df40758a5D0f9a27";
const FACTORY = "0x1715a3e4a142d8b698131108995174f37aeba10d";

const client = createPublicClient({ chain: pulsechain, transport: http(RPC_URLS[0]!, { timeout: 30_000 }) });

async function callRaw(to: string, data: string): Promise<string | null> {
  try {
    const res = await client.call({ to: to as `0x${string}`, data: data as `0x${string}` });
    return res.data ?? null;
  } catch {
    return null;
  }
}

const pad = (addr: string) => addr.slice(2).toLowerCase().padStart(64, "0");

async function getPair(tokenA: string, tokenB: string): Promise<string | null> {
  // getPair(address,address) = 0xe6a43905
  const res = await callRaw(FACTORY, `0xe6a43905${pad(tokenA)}${pad(tokenB)}`);
  if (!res || res === "0x") return null;
  const pair = `0x${res.slice(-40)}`;
  return pair === "0x0000000000000000000000000000000000000000" ? null : getAddress(pair);
}

async function getReserves(pair: string): Promise<[bigint, bigint] | null> {
  // getReserves() = 0x0902f1ac
  const res = await callRaw(pair, "0x0902f1ac");
  if (!res || res === "0x") return null;
  const r0 = BigInt(res.slice(0, 66));
  const r1 = BigInt("0x" + res.slice(66, 130));
  return [r0, r1];
}

async function getToken(pair: string, which: 0 | 1): Promise<string | null> {
  const sel = which === 0 ? "0x0dfe1681" : "0xd21220a7";
  const res = await callRaw(pair, sel);
  if (!res || res === "0x") return null;
  return getAddress(`0x${res.slice(-40)}`);
}

async function main() {
  const code = await client.getCode({ address: FACTORY as `0x${string}` });
  console.log("factory code:", code === undefined ? "MISSING" : `${code!.length} chars`);

  // allPairsLength() = 0x574f2ba3
  const apl = await callRaw(FACTORY, "0x574f2ba3");
  console.log("allPairsLength:", apl ? Number(BigInt(apl)) : "?");

  console.log("\n=== ecosystem pair discovery ===");
  const targets: Array<[string, string, string]> = [
    ["AFFECTION", "WPLS", WPLS],
    ["AFFECTION", "pDAI", PDAI_ADDR],
    ["AFFECTION", "pUSDC", PUSDC_ADDR],
    ["MATH", "WPLS", WPLS],
    ["MATH", "pDAI", PDAI_ADDR],
    ["G5", "WPLS", WPLS],
    ["G5", "pDAI", PDAI_ADDR],
    ["PI", "WPLS", WPLS],
    ["PI", "pDAI", PDAI_ADDR],
    ["MATH", "AFFECTION", AFFECTION_ADDR],
    ["G5", "AFFECTION", AFFECTION_ADDR],
    ["PI", "AFFECTION", AFFECTION_ADDR],
  ];
  for (const [aSym, bSym, bAddr] of targets) {
    const pair = await getPair(AFFECTION_ADDR, bAddr);
    const label = `${aSym}/${bSym}`;
    if (!pair) {
      console.log(`  ${label.padEnd(16)} no pair`);
      continue;
    }
    const [t0, t1] = await Promise.all([getToken(pair, 0), getToken(pair, 1)]);
    const [reserves] = await Promise.all([getReserves(pair)]);
    if (reserves) {
      const [r0, r1] = reserves;
      console.log(
        `  ${label.padEnd(16)} pair=${pair} t0=${t0?.slice(0, 8)} r0=${(Number(r0) / 1e18).toFixed(2)} t1=${t1?.slice(0, 8)} r1=${(Number(r1) / 1e18).toFixed(2)}`,
      );
    }
  }

  // Also try: MATH/pDAI, G5/pDAI, PI/pDAI directly (not via AFFECTION)
  console.log("\n=== direct ecosystem/pStable pairs ===");
  for (const [sym, addr] of [["MATH", MATH_ADDR], ["G5", G5_ADDR], ["PI", PI_ADDR]] as const) {
    for (const [bsym, baddr] of [["pDAI", PDAI_ADDR], ["WPLS", WPLS]] as const) {
      const pair = await getPair(addr, baddr);
      if (!pair) {
        console.log(`  ${sym}/${bsym}: no pair`);
        continue;
      }
      const [t0, t1] = await Promise.all([getToken(pair, 0), getToken(pair, 1)]);
      const [r0, r1] = (await getReserves(pair)) ?? [0n, 0n];
      console.log(
        `  ${sym}/${bsym}: pair=${pair} t0=${t0?.slice(0, 8)}(${(Number(r0) / 1e18).toFixed(2)}) t1=${t1?.slice(0, 8)}(${(Number(r1) / 1e18).toFixed(2)})`,
      );
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
