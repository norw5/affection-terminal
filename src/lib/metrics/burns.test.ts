import type { Log } from "viem";
import { describe, expect, it } from "vitest";
import {
  type BurnLog,
  aggregateBurns,
  burnPctOfSupply,
  computeBurnRanges,
  decodeBurnLog,
} from "./burns";

describe("computeBurnRanges", () => {
  it("chunks a depth into equal-sized ranges going backwards", () => {
    expect(computeBurnRanges(10000n, 5000n, 2000n)).toEqual([
      [8001n, 10000n],
      [6001n, 8000n],
      [5001n, 6000n],
    ]);
  });

  it("handles a remainder chunk (smaller than chunkSize)", () => {
    expect(computeBurnRanges(10000n, 5000n, 3000n)).toEqual([
      [7001n, 10000n],
      [5001n, 7000n],
    ]);
  });

  it("single chunk when depth <= chunkSize", () => {
    expect(computeBurnRanges(100n, 50n, 200n)).toEqual([[51n, 100n]]);
    expect(computeBurnRanges(100n, 200n, 200n)).toEqual([[0n, 100n]]);
  });

  it("returns empty for zero/negative depth", () => {
    expect(computeBurnRanges(1000n, 0n, 100n)).toEqual([]);
  });

  it("returns empty for zero chunkSize", () => {
    expect(computeBurnRanges(1000n, 100n, 0n)).toEqual([]);
  });

  it("does not go below block 0", () => {
    const ranges = computeBurnRanges(100n, 500n, 50n);
    const last = ranges[ranges.length - 1];
    expect(last).toBeDefined();
    if (last) expect(last[0]).toBeGreaterThanOrEqual(0n);
  });
});

describe("aggregateBurns", () => {
  const logs: BurnLog[] = [
    {
      blockNumber: 100n,
      txHash: "0xaaa",
      logIndex: 0,
      from: "0x1",
      to: "0x0000000000000000000000000000000000000000",
      value: 100n,
    },
    {
      blockNumber: 101n,
      txHash: "0xbbb",
      logIndex: 0,
      from: "0x2",
      to: "0x000000000000000000000000000000000000dEaD",
      value: 200n,
    },
    {
      blockNumber: 102n,
      txHash: "0xccc",
      logIndex: 1,
      from: "0x3",
      to: "0x0000000000000000000000000000000000000000",
      value: 50n,
    },
  ];

  it("sums total burned and counts", () => {
    const r = aggregateBurns(logs);
    expect(r.totalBurned).toBe(350n);
    expect(r.count).toBe(3);
  });

  it("groups by burn address", () => {
    const r = aggregateBurns(logs);
    expect(r.byAddress["0x0000000000000000000000000000000000000000"]).toEqual({
      total: 150n,
      count: 2,
    });
    expect(r.byAddress["0x000000000000000000000000000000000000dEaD"]).toEqual({
      total: 200n,
      count: 1,
    });
  });

  it("tracks block range", () => {
    const r = aggregateBurns(logs);
    expect(r.fromBlock).toBe(100n);
    expect(r.toBlock).toBe(102n);
  });

  it("deduplicates by (txHash, logIndex)", () => {
    const first = logs[0];
    const dup = first ? [...logs, { ...first }] : logs;
    const r = aggregateBurns(dup);
    expect(r.count).toBe(3);
    expect(r.totalBurned).toBe(350n);
  });

  it("handles empty input", () => {
    const r = aggregateBurns([]);
    expect(r.totalBurned).toBe(0n);
    expect(r.count).toBe(0);
    expect(r.fromBlock).toBeNull();
  });
});

describe("decodeBurnLog", () => {
  it("decodes a Transfer to 0x0 as a burn", () => {
    const log = {
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x000000000000000000000000aabb0000000000000000000000000000000000cc",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ],
      data: "0x0de0b6b3a7640000",
      blockNumber: 1234n,
      transactionHash: "0xtx",
      logIndex: 5,
    };
    const decoded = decodeBurnLog(log as Log);
    expect(decoded).not.toBeNull();
    expect(decoded?.value).toBe(1000000000000000000n);
    expect(decoded?.to).toBe("0x0000000000000000000000000000000000000000");
    expect(decoded?.txHash).toBe("0xtx");
    expect(decoded?.logIndex).toBe(5);
  });

  it("decodes a Transfer to 0xdEaD as a burn", () => {
    const log = {
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x0",
        "0x000000000000000000000000000000000000000000000000000000000000dead",
      ],
      data: "0xff",
      blockNumber: 1n,
      transactionHash: "0x",
      logIndex: 0,
    };
    const decoded = decodeBurnLog(log as Log);
    expect(decoded).not.toBeNull();
    expect(decoded?.to).toBe("0x000000000000000000000000000000000000dEaD");
    expect(decoded?.value).toBe(255n);
  });

  it("decodes a Transfer to the PulseChain 0x369 burn address as a burn", () => {
    const log = {
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x0",
        "0x0000000000000000000000000000000000000000000000000000000000000369",
      ],
      data: "0x64",
      blockNumber: 5n,
      transactionHash: "0x369tx",
      logIndex: 2,
    };
    const decoded = decodeBurnLog(log as Log);
    expect(decoded).not.toBeNull();
    expect(decoded?.to).toBe("0x0000000000000000000000000000000000000369");
    expect(decoded?.value).toBe(100n);
  });

  it("rejects a non-burn Transfer (to is a normal address)", () => {
    const log = {
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x0",
        "0x000000000000000000000000aabb0000000000000000000000000000000000cc",
      ],
      data: "0x64",
    };
    expect(decodeBurnLog(log as Log)).toBeNull();
  });

  it("rejects a log with fewer than 3 topics", () => {
    expect(decodeBurnLog({ topics: ["0x1"] } as unknown as Log)).toBeNull();
  });
});

describe("burnPctOfSupply", () => {
  it("computes a percentage with 2 decimals", () => {
    expect(burnPctOfSupply(5n * 10n ** 18n, 200n * 10n ** 18n)).toBe("2.50%");
  });

  it("returns 0% for zero supply", () => {
    expect(burnPctOfSupply(100n, 0n)).toBe("0%");
  });

  it("handles 100%", () => {
    expect(burnPctOfSupply(100n, 100n)).toBe("100.00%");
  });
});
