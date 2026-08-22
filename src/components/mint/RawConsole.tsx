// Module B — Tier 3: Raw Console. A lightweight, dependency-free ABI/calldata explorer
// that replaces the down scgui.aff.icu. Paste a contract address + a human-readable ABI,
// pick a function, fill args, and: view the 4-byte selector + encoded calldata, simulate
// (eth_call) with decoded output / revert reason, or send (if nonpayable + wallet connected).
//
// Uses viem's parseAbi / getAbiItem / encodeFunctionData / decodeFunctionResult — no Monaco
// (kept out to preserve the static, lightweight bundle; the terminal aesthetic is served by
// plain inputs). Monaco can be lazy-dropped in later without changing this interface.
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Panel } from "@/components/ui/Panel";
import { AFFECTION_ADDR } from "@/config/registry";
import { useWallet } from "@/hooks/useWallet";
import { publicClient } from "@/lib/rpc/client";
import { useTxLogStore } from "@/stores/txLog";
import { useMemo, useState } from "react";
import {
  type Abi,
  type AbiFunction,
  type Address,
  encodeFunctionData,
  getAbiItem,
  getAddress,
  parseAbi,
  toFunctionSelector,
} from "viem";
import { useWriteContract } from "wagmi";

const DEFAULT_ABI = `function Generate() returns (uint64)
function BuyWithG5(uint256 amount)
function BuyWithPI(uint256 amount)
function BuyWithMATH(uint256 amount)
function totalSupply() view returns (uint256)
function balanceOf(address account) view returns (uint256)
function decimals() view returns (uint8)
function owner() view returns (address)`;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/** Coerce a string input to the TS value viem expects for a given ABI parameter type.
 *  Empty inputs fall back to zero-values (0n / zero-address / 0x) so that selecting a
 *  function with args still encodes valid calldata instead of showing an error. */
function coerceArg(type: string, raw: string): unknown {
  const t = type.replace(/\[\]$/, "").trim();
  const v = raw.trim();
  const isBool = t === "bool";
  const isInt = t.startsWith("int") || t.startsWith("uint");
  const isAddr = t === "address";
  const isBytes = t.startsWith("bytes");
  if (isBool) return v === "true";
  if (isInt) return v === "" ? 0n : BigInt(v);
  if (isAddr) return v === "" ? ZERO_ADDRESS : getAddress(v);
  if (isBytes) return (v === "" ? "0x" : v) as `0x${string}`;
  return raw;
}

export function RawConsole() {
  const wallet = useWallet();
  const [address, setAddress] = useState(AFFECTION_ADDR);
  const [abiText, setAbiText] = useState(DEFAULT_ABI);
  const [funcName, setFuncName] = useState("Generate");
  const [args, setArgs] = useState<string[]>([]);
  const [simOut, setSimOut] = useState<{ ok: boolean; text: string } | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const addTx = useTxLogStore((s) => s.add);
  const setTxStatus = useTxLogStore((s) => s.setStatus);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const abi: Abi | null = useMemo(() => {
    try {
      const lines = abiText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("//"));
      if (lines.length === 0) return null;
      return parseAbi(lines.map((l) => l as never)) as unknown as Abi;
    } catch {
      return null;
    }
  }, [abiText]);

  const item: AbiFunction | null = useMemo(() => {
    if (!abi) return null;
    try {
      const it = getAbiItem({ abi, name: funcName });
      if (!it || it.type !== "function") return null;
      return it as AbiFunction;
    } catch {
      return null;
    }
  }, [abi, funcName]);

  const functions = useMemo(() => {
    if (!abi) return [];
    return abi.filter((m) => m.type === "function").map((f) => f.name);
  }, [abi]);

  const selector = useMemo(() => (item ? toFunctionSelector(item) : null), [item]);

  const calldata = useMemo(() => {
    if (!abi || !item) return null;
    try {
      const coerced = (item.inputs ?? []).map((inp, i) => coerceArg(inp.type, args[i] ?? ""));
      return encodeFunctionData({ abi, functionName: funcName, args: coerced });
    } catch (e) {
      return null;
    }
  }, [abi, item, funcName, args]);

  const isView = item?.stateMutability === "view" || item?.stateMutability === "pure";
  const isWrite = item?.stateMutability === "nonpayable" || item?.stateMutability === "payable";

  async function simulate() {
    if (!abi || !item || !calldata) return;
    setSimBusy(true);
    setSimOut(null);
    try {
      const coerced = (item.inputs ?? []).map((inp, i) => coerceArg(inp.type, args[i] ?? ""));
      if (isView) {
        const res = await publicClient.readContract({
          address: getAddress(address),
          abi,
          functionName: funcName,
          args: coerced,
        });
        setSimOut({ ok: true, text: formatResult(res) });
      } else {
        await publicClient.simulateContract({
          address: getAddress(address),
          abi,
          functionName: funcName,
          args: coerced,
          account: wallet.address ?? "0x0000000000000000000000000000000000000000",
          gas: 30_000_000n,
        });
        setSimOut({ ok: true, text: "sim ✓ — eth_call did not revert (would succeed)." });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSimOut({ ok: false, text: msg.length > 400 ? `${msg.slice(0, 400)}…` : msg });
    } finally {
      setSimBusy(false);
    }
  }

  async function send() {
    if (!abi || !item || !calldata || !wallet.address) return;
    setTxHash(null);
    const txId = addTx({ module: "raw", label: `${funcName}(${address.slice(0, 10)}…)` });
    try {
      const coerced = (item.inputs ?? []).map((inp, i) => coerceArg(inp.type, args[i] ?? ""));
      const hash = await writeContractAsync({
        address: getAddress(address),
        abi,
        functionName: funcName,
        args: coerced,
      });
      setTxHash(hash);
      setTxStatus(txId, { hash, status: "confirming" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxStatus(txId, { status: "failed", error: msg.slice(0, 120) });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="target">
        <div className="flex flex-col gap-2 text-xs">
          <label className="flex flex-col gap-1 text-text-faint">
            contract address
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value as Address)}
              className="border border-border bg-panel-2 px-2 py-1 text-text focus-ring"
            />
          </label>
          <label className="flex flex-col gap-1 text-text-faint">
            human-readable ABI (one function per line)
            <textarea
              value={abiText}
              onChange={(e) => setAbiText(e.target.value)}
              rows={8}
              className="resize-y border border-border bg-panel-2 px-2 py-1 font-mono text-text focus-ring"
            />
          </label>
          {abi === null && <span className="text-err">ABI parse error — fix the lines above.</span>}
        </div>
      </Panel>

      {abi && (
        <Panel title="function + args">
          <div className="flex flex-col gap-2 text-xs">
            <label className="flex flex-col gap-1 text-text-faint">
              function
              <select
                value={funcName}
                onChange={(e) => {
                  setFuncName(e.target.value);
                  setArgs([]);
                  setSimOut(null);
                }}
                className="border border-border bg-panel-2 px-2 py-1 text-text focus-ring"
              >
                {functions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            {item && (
              <div className="flex flex-wrap items-center gap-2 text-text-dim">
                <span className="text-info">{item.name}</span>
                <span className="text-text-faint">({item.inputs?.length ?? 0} args)</span>
                <span className="text-text-faint">·</span>
                <span className="text-text-faint">{item.stateMutability}</span>
                <span className="text-text-faint">·</span>
                <span className="text-text-faint">selector</span>
                <code className="text-warn">{selector ?? "?"}</code>
              </div>
            )}
            {(item?.inputs ?? []).map((inp, i) => (
              <label key={`${inp.name ?? i}-${i}`} className="flex flex-col gap-1 text-text-faint">
                {inp.name ? `${inp.name} (${inp.type})` : `arg ${i} (${inp.type})`}
                <input
                  value={args[i] ?? ""}
                  onChange={(e) => {
                    const next = [...args];
                    next[i] = e.target.value;
                    setArgs(next);
                  }}
                  className="border border-border bg-panel-2 px-2 py-1 text-text focus-ring"
                />
              </label>
            ))}

            {calldata ? (
              <div className="flex flex-col gap-1 border border-border bg-panel-2 px-2 py-1">
                <div className="flex items-center gap-2 text-text-faint">
                  <span>calldata</span>
                  <CopyButton value={calldata} />
                </div>
                <code className="break-all text-text-dim">{calldata}</code>
              </div>
            ) : (
              <span className="text-err">cannot encode args — check input types.</span>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" disabled={!calldata || simBusy} onClick={simulate}>
                {simBusy ? "simulating…" : isView ? "read (eth_call)" : "simulate (eth_call)"}
              </Button>
              {isWrite && (
                <Button
                  variant="accent"
                  size="sm"
                  disabled={!calldata || !wallet.address || writePending || wallet.isWrongChain}
                  onClick={send}
                  title={!wallet.address ? "connect a wallet to send" : ""}
                >
                  {writePending ? "signing…" : "send tx"}
                </Button>
              )}
              {isWrite && !wallet.isConnected && (
                <span className="text-text-faint">connect a wallet to send write txs</span>
              )}
              {isWrite && wallet.isWrongChain && (
                <span className="text-warn">switch to PulseChain</span>
              )}
              {txHash && (
                <span className="text-text-dim">
                  tx {txHash.slice(0, 10)}…{txHash.slice(-4)} sent
                </span>
              )}
            </div>

            {simOut && (
              <pre
                className={`whitespace-pre-wrap break-words border border-border bg-panel-2 px-2 py-1 text-xs ${simOut.ok ? "text-ok" : "text-err"}`}
              >
                {simOut.text}
              </pre>
            )}
          </div>
        </Panel>
      )}

      <Panel title="how it works">
        <p className="text-xs leading-snug text-text-faint">
          The ABI is parsed with viem's <code>parseAbi</code> (human-readable form, e.g.{" "}
          <code>function Generate() returns (uint64)</code>). The 4-byte selector uses{" "}
          <code>toFunctionSelector</code>; calldata uses <code>encodeFunctionData</code>. Reads use{" "}
          <code>readContract</code> (decoded return); writes simulate via{" "}
          <code>simulateContract</code> from your address (or zero-address) with a fixed gas probe.
          Sending a write tx requires a connected wallet — every send is an explicit sign. No
          backend, no telemetry.
        </p>
      </Panel>
    </div>
  );
}

/** Format a decoded read result into a readable string (handles tuples/arrays). */
function formatResult(res: unknown): string {
  if (typeof res === "bigint") return `${res.toString()} (bigint)`;
  if (Array.isArray(res)) return res.map(formatResult).join("\n");
  if (res && typeof res === "object") {
    return Object.entries(res)
      .map(([k, v]) => `${k}: ${formatResult(v)}`)
      .join("\n");
  }
  return String(res);
}
