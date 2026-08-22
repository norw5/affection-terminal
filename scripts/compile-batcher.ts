// Compiles the contracts/ *.sol files to artifacts (ABI + bytecode) in contracts/artifacts/.
// Uses the `solc` npm package (the JS build of solc) — no global solc/foundry needed.
// Self-contained .sol files (inline minimal interfaces) keep import resolution trivial:
// AtomicArbBatcher imports UnifiedAffectionBatcher from the same directory.
//
// Run: npm run compile-batcher
import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import type { Abi } from "viem";

const require = createRequire(import.meta.url);
const solc = require("solc") as typeof import("solc");

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "contracts");
const OUT_DIR = path.join(SRC_DIR, "artifacts");

const FILES = [
  "UnifiedAffectionBatcher.sol",
  "AtomicArbBatcher.sol",
];

function findImports(p: string) {
  const resolved = path.join(SRC_DIR, path.basename(p));
  if (fs.existsSync(resolved)) {
    return { contents: fs.readFileSync(resolved, "utf8") };
  }
  return { error: `file not found: ${p}` };
}

function compile() {
  const sources: Record<string, { content: string }> = {};
  for (const f of FILES) {
    sources[f] = { content: fs.readFileSync(path.join(SRC_DIR, f), "utf8") };
  }

  const input = {
    language: "Solidity" as const,
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "shanghai",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "evm.methodIdentifiers", "userdoc", "devdoc"],
        },
      },
    },
  };

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports }),
  ) as {
    contracts?: Record<string, Record<string, ContractJson>>;
    errors?: Array<{ severity: string; formattedMessage?: string; message?: string }>;
  };

  if (output.errors?.some((e) => e.severity === "error")) {
    for (const e of output.errors) {
      console.error(e.formattedMessage ?? e.message);
    }
    process.exit(1);
  }
  for (const e of output.errors ?? []) {
    console.warn(e.formattedMessage ?? e.message);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const written: string[] = [];
  for (const file of FILES) {
    const contracts = output.contracts?.[file];
    if (!contracts) continue;
    for (const [name, data] of Object.entries(contracts)) {
      const abi = data.abi as Abi;
      const artifact = {
        contractName: name,
        abi,
        bytecode: `0x${data.evm.bytecode.object}` as `0x${string}`,
        deployedBytecode: `0x${data.evm.deployedBytecode.object}` as `0x${string}`,
        methodIdentifiers: data.evm.methodIdentifiers,
        // Surfaces which intermediate/stable combos each contract supports (for the wizard).
        // AtomicArbBatcher gets a "sell leg" flag.
        metadata: {
          sourceFile: file,
          variant: name === "AtomicArbBatcher" ? "mint+sell (opt-in)" : "mint-only",
        },
        userdoc: data.userdoc,
        devdoc: data.devdoc,
      };
      const outPath = path.join(OUT_DIR, `${name}.json`);
      fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
      written.push(outPath);
    }
  }
  console.log(`\ncompiled ${written.length} contract(s):`);
  for (const w of written) {
    const sz = fs.statSync(w).size;
    const a = JSON.parse(fs.readFileSync(w, "utf8"));
    console.log(`  ${path.relative(ROOT, w)}  (${sz} bytes, ${a.abi.length} ABI entries, ${a.bytecode.length / 2 - 1} bytes bytecode)`);
  }
}

type ContractJson = {
  abi: unknown[];
  evm: {
    bytecode: { object: string };
    deployedBytecode: { object: string };
    methodIdentifiers: Record<string, string>;
  };
  userdoc: unknown;
  devdoc: unknown;
};

compile();
