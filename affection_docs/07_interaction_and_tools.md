# 7 · Interacting with the Contracts & Tooling

## This portal

The **AFFECTION™ Terminal** (this site) is a strictly static, client-side web portal with a
three-tier minting terminal, a batcher deployment wizard, and a metrics dashboard.
Everything runs in your browser: reads go straight to public PulseChain RPCs, and writes
are signed by your own wallet via wagmi — no backend, no telemetry, no custodial
intermediary.

- **Knowledge base** (`/kb`) — this documentation, plus contract ABIs, addresses, and a
  build-time bundle export.
- **Minting terminal** (`/mint`) — Tier-1 Auto-Router (profitability), Tier-2 Custom Routing
  (explicit pre-simulated steps), Tier-3 Raw Console (paste ABI → call any function).
- **Batcher wizard** (`/batcher`) — deploy your own atomic mint batcher
  ([`04_multi_mint_contracts.md`](04_multi_mint_contracts.md)).
- **Metrics** (`/metrics`) — supply headroom, burns, PulseX route map.

## Block explorer

**Blockscout for PulseChain** (`ipfs.scan.pulsechain.com` — 302-redirects to the
IPFS-hosted instance) is the canonical block explorer. Its "Read Contract" / "Write
Contract" tabs let you call any verified contract directly — useful as a fallback to the
raw console here.

## Manual interaction (direct contract calls)

A single manual mint (MATH → Ⓐ) is, end to end:

```text
1. pDAI.approve(MATH, amount)                    # approve pDAI -> MATH
2. MATH.Random()  (repeat N times)              # charge MATH contract with N MATH
3. MATH.BuyWithDAI(amount)                       # withdraw `amount` MATH to your wallet
4. MATH.approve(AFFECTION, amount)               # approve MATH -> AFFECTION
5. AFFECTION.Generate()  (repeat amount/3 times) # charge AFFECTION contract with amount Ⓐ
6. AFFECTION.BuyWithMATH(amount)                 # redeem `amount` Ⓐ to your wallet
7. (sell Ⓐ on PulseX for PLS/pDAI if realising profit)
```

Full addresses: MATH `0xB680F0cc810317933F234f67EB6A9E923407f05D`, AFFECTION
`0x24F0154C1dCe548AdF15da2098Fdd8B8A3B8151D`, pDAI
`0x6B175474E89094C44Da98b954EedeAC495271d0F`.

> ⚠️ A bot can always front‑run a manual mint — it is two public transactions with a
> window between them. That is exactly what the portal's batcher eliminates: the
> `/batcher` wizard deploys a full-route atomic batcher in a few clicks, and every
> deployment is pre-simulated before you sign. Treat the batched path as the default.

The same manual sequence can be run from any tool that can make contract calls — the
portal's Tier-3 Raw Console, the block explorer's Write Contract tab, or a wallet with
contract-call support. The batcher sources shipped in the knowledge bundle are single
self-contained Solidity files, so any standard toolchain (e.g. `solc` or Remix) can also
compile and deploy them without special setup — see
[`04_multi_mint_contracts.md`](04_multi_mint_contracts.md) for the design and the wizard
for the supported path.

## RPC

PulseChain public RPCs (the portal uses a fallback pool over these; availability of any
public endpoint varies over time):

- `https://rpc.pulsechain.com` (also `wss://...` for logs)
- `https://rpc-pulsechain.g4mm4.io`
- `https://rpc.pulsechainstats.com`

All "live" numbers in this knowledge base were read via `eth_call` — see
[`sources.md`](sources.md) for the exact calls to reproduce them.

## Official links

- **Telegram:** `t.me/affection_pls`
- **YouTube:** [@靈脅用](https://www.youtube.com/@%E9%9D%88%E8%84%85%E7%94%A8)
- **GitHub:** [github.com/busytoby/atropa_pulsechain](https://github.com/busytoby/atropa_pulsechain)
