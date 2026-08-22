// Pure logic for the burns scan (Module D). The RPC reads are in useBurns; this module
// holds the testable pieces: block-range chunking + log aggregation. No viem/React deps.

import { type Log, getAddress } from "viem";

export type BurnLog = {
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
  from: string;
  to: string;
  value: bigint;
};

export type BurnAggregate = {
  totalBurned: bigint;
  count: number;
  byAddress: Record<string, { total: bigint; count: number }>;
  fromBlock: bigint | null;
  toBlock: bigint | null;
};

export const BURN_ADDRESSES = [
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dEaD",
  "0x0000000000000000000000000000000000000369", // PulseChain community burn address
] as const;
export const DEAD_ADDRESS: `0x${string}` = "0x000000000000000000000000000000000000dEaD";
export const ZERO_ADDRESS: `0x${string}` = "0x0000000000000000000000000000000000000000";
export const PULSECHAIN_BURN_ADDRESS: `0x${string}` = "0x0000000000000000000000000000000000000369";

/**
 * Compute the block ranges to scan for a depth (total blocks) given a chunk size.
 * Goes backwards from `toBlock` (inclusive). Returns ordered [fromBlock, toBlock] pairs.
 *
 *   computeBurnRanges(10000n, 5000n, 2000n)
 *   → [[8001n, 10000n], [6001n, 8000n], [5001n, 6000n]]  (3 chunks, total 5000 blocks)
 */
export function computeBurnRanges(
  toBlock: bigint,
  depth: bigint,
  chunkSize: bigint,
): Array<[bigint, bigint]> {
  if (depth <= 0n || chunkSize <= 0n) return [];
  const ranges: Array<[bigint, bigint]> = [];
  let end = toBlock;
  let remaining = depth;
  while (remaining > 0n && end >= 0n) {
    const size = remaining < chunkSize ? remaining : chunkSize;
    let start = end - size + 1n;
    if (start < 0n) start = 0n;
    ranges.push([start, end]);
    remaining -= end - start + 1n;
    end = start - 1n;
  }
  return ranges;
}

/**
 * Aggregate decoded burn logs into a summary. Deduplicates by (txHash, logIndex) so a
 * re-scan overlap never double-counts. Groups by the burn target address.
 */
export function aggregateBurns(logs: BurnLog[]): BurnAggregate {
  const seen = new Set<string>();
  let totalBurned = 0n;
  let count = 0;
  const byAddress: Record<string, { total: bigint; count: number }> = {};
  let fromBlock: bigint | null = null;
  let toBlock: bigint | null = null;

  for (const log of logs) {
    const key = `${log.txHash}:${log.logIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    totalBurned += log.value;
    count++;
    const bucket = byAddress[log.to] ?? { total: 0n, count: 0 };
    bucket.total += log.value;
    bucket.count++;
    byAddress[log.to] = bucket;
    if (fromBlock === null || log.blockNumber < fromBlock) fromBlock = log.blockNumber;
    if (toBlock === null || log.blockNumber > toBlock) toBlock = log.blockNumber;
  }

  return { totalBurned, count, byAddress, fromBlock, toBlock };
}

/** Decode a viem Log into a BurnLog (or null if not a Transfer to a burn address). */
export function decodeBurnLog(log: Log): BurnLog | null {
  const topics = log.topics;
  if (topics.length < 3) return null;
  const fromTopic = topics[1];
  const toTopic = topics[2];
  if (!fromTopic || !toTopic) return null;
  const from = `0x${fromTopic.slice(-40)}`;
  const to = `0x${toTopic.slice(-40)}`;
  const isBurn = BURN_ADDRESSES.some((a) => a.toLowerCase() === to.toLowerCase());
  if (!isBurn) return null;
  let value = 0n;
  if (log.data && log.data !== "0x") {
    value = BigInt(log.data);
  }
  return {
    blockNumber: log.blockNumber ?? 0n,
    txHash: log.transactionHash ?? "",
    logIndex: log.logIndex ?? 0,
    from,
    to: getAddress(to),
    value,
  };
}

/** Format a bigint as a percentage of a total, for the "X% of supply" display. */
export function burnPctOfSupply(burned: bigint, supply: bigint): string {
  if (supply === 0n) return "0%";
  const pct = (burned * 10000n) / supply;
  const whole = pct / 100n;
  const frac = pct % 100n;
  return `${whole}.${frac < 10n ? `0${frac}` : frac}%`;
}
