import { AFFECTION_ADDR } from "@/config/registry";
import {
  BURN_ADDRESSES,
  type BurnAggregate,
  aggregateBurns,
  computeBurnRanges,
  decodeBurnLog,
} from "@/lib/metrics/burns";
import { publicClient } from "@/lib/rpc/client";
import { useEffect, useRef, useState } from "react";
import { parseAbiItem } from "viem";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export type BurnScanMode = "idle" | "24h" | "7d" | "30d" | "max";

export type BurnScanState = {
  mode: BurnScanMode;
  isScanning: boolean;
  progress: number;
  chunksDone: number;
  chunksTotal: number;
  /** chunks whose getLogs failed (RPC limits/timeouts) — the result may undercount */
  chunksFailed: number;
  result: BurnAggregate | null;
  cancelled: boolean;
  error: string | null;
};

const INITIAL: BurnScanState = {
  mode: "idle",
  isScanning: false,
  progress: 0,
  chunksDone: 0,
  chunksTotal: 0,
  chunksFailed: 0,
  result: null,
  cancelled: false,
  error: null,
};

const CHUNK_SIZE = 10_000n;
const MAX_DEPTH = 2_000_000n; // ~231d at the measured ~10s/block — a hard cap for the deep scan
const CHUNK_CONCURRENCY = 4;
const BLOCK_TIME_FALLBACK_S = 10; // PulseChain ≈ 10s/block (measured 2026-08)
const SECONDS: Record<"24h" | "7d" | "30d", number> = {
  "24h": 86_400,
  "7d": 604_800,
  "30d": 2_592_000,
};

/** Estimate blocks/second from the latest block vs a block ~10k back. */
async function estimateBlocksPerSecond(latest: bigint): Promise<number> {
  try {
    const probeFrom = latest > 10_000n ? latest - 10_000n : 0n;
    const [latestBlock, probeBlock] = await Promise.all([
      publicClient.getBlock({ blockNumber: latest }),
      publicClient.getBlock({ blockNumber: probeFrom }),
    ]);
    const dt = Number(latestBlock.timestamp) - Number(probeBlock.timestamp);
    if (dt <= 0) return 1 / BLOCK_TIME_FALLBACK_S;
    return Number(latest - probeFrom) / dt;
  } catch {
    // Timestamp reads failed — fall back to the measured block time (~10s/block = 0.1/s).
    // A wildly wrong rate would mislabel the time-window presets (2s was the old, wrong assumption).
    return 1 / BLOCK_TIME_FALLBACK_S;
  }
}

export function useBurns() {
  const [state, setState] = useState<BurnScanState>(INITIAL);
  const cancelRef = useRef(false);
  const runRef = useRef(0);

  // Stop any in-flight scan when the component unmounts (the chunk pipeline would
  // otherwise keep fetching + setState on a dead component).
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      runRef.current++;
    };
  }, []);

  async function scan(mode: Exclude<BurnScanMode, "idle">) {
    const runId = ++runRef.current;
    cancelRef.current = false;
    setState({ ...INITIAL, mode, isScanning: true });
    try {
      const latest = await publicClient.getBlockNumber();
      let depth: bigint;
      if (mode === "max") {
        depth = MAX_DEPTH;
      } else {
        const bps = await estimateBlocksPerSecond(latest);
        depth = BigInt(Math.round(SECONDS[mode] * bps));
      }
      if (depth > latest + 1n) depth = latest + 1n;
      if (depth > MAX_DEPTH) depth = MAX_DEPTH;

      const ranges = computeBurnRanges(latest, depth, CHUNK_SIZE);
      const totalRanges = ranges.length;
      const allLogs: NonNullable<ReturnType<typeof decodeBurnLog>>[] = [];
      let chunksDone = 0;
      let chunksFailed = 0;

      // Bounded-concurrency fetch: spin up N workers, each pulling the next chunk index.
      let nextIdx = 0;
      const workers = Array.from({ length: Math.min(CHUNK_CONCURRENCY, totalRanges) }, async () => {
        while (true) {
          if (runRef.current !== runId) return; // a newer scan superseded this one
          if (cancelRef.current) return;
          const i = nextIdx++;
          if (i >= totalRanges) return;
          const range = ranges[i];
          if (!range) continue;
          const [fromBlock, toBlock] = range;
          try {
            const logs = await publicClient.getLogs({
              address: AFFECTION_ADDR,
              event: transferEvent,
              // Server-side filter on the indexed `to` topic (OR across burn addresses) —
              // without it every Transfer in the range is fetched, not just burns.
              args: { to: [...BURN_ADDRESSES] },
              fromBlock,
              toBlock,
            });
            for (const log of logs) {
              const decoded = decodeBurnLog(log);
              if (decoded) allLogs.push(decoded);
            }
          } catch {
            // Chunk failed (RPC limit / timeout) — count it and continue with the rest.
            chunksFailed++;
          }
          chunksDone++;
          if (runRef.current === runId) {
            setState((s) => ({
              ...s,
              progress: (chunksDone / totalRanges) * 100,
              chunksDone,
              chunksTotal: totalRanges,
            }));
          }
        }
      });
      await Promise.all(workers);

      if (runRef.current !== runId) return; // superseded
      const cancelled = cancelRef.current;
      const result = aggregateBurns(allLogs);
      setState({
        ...INITIAL,
        mode,
        result,
        progress: 100,
        chunksDone,
        chunksTotal: totalRanges,
        chunksFailed,
        cancelled,
      });
    } catch (err) {
      if (runRef.current !== runId) return;
      setState({ ...INITIAL, mode, error: err instanceof Error ? err.message : "scan failed" });
    }
  }

  function cancel() {
    cancelRef.current = true;
  }

  function reset() {
    cancelRef.current = true;
    runRef.current++;
    setState(INITIAL);
  }

  return { state, scan, cancel, reset };
}
