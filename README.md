# AFF_TERMINAL

A decentralized, client-side web portal for the **AFFECTION™ (Ⓐ)** token ecosystem on
[PulseChain](https://pulsechain.com) (chainId 369). No backend, no database, no telemetry. It
reads chain state via public RPCs and signs transactions in the browser.

> Not financial advice. DYOR. Every live value is read from a public PulseChain RPC — re-verify
> on-chain before acting.

## Modules

- **Overview** — live AFFECTION/MATH supply vs cap, headroom, contract buffer, canonical addresses.
- **Knowledge Base** — the committed reference docs (markdown), copy-pasteable ABIs/addresses, and
  a client-side bundle export (docs + registry + verified Solidity, zipped in-browser).
- **Mint** *(P4)* — auto-router (pStable → intermediate → AFFECTION → PulseX) with live
  profitability, custom routing, and a raw/IDE console. Replaces the legacy `mint.aff.icu`.
- **Batcher** *(P5)* — deploy your own `UnifiedAffectionBatcher` (full-route atomic, cap-aware)
  from the frontend; opt-in atomic-sell variant documented.
- **Metrics** *(P3)* — supply headroom, burns (log scan), live PulseX route map.

`⌘K` / `Ctrl+K` opens the command palette to jump to any module or doc.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # pure static -> dist/  (host on Vercel / Cloudflare Pages)
npm test           # unit tests (formatting, math, address helpers)
npm run verify-supply   # re-verify the canonical live RPC reads from affection_docs/sources.md
```

Requirements: Node 18+ (tested on Node 22). `npm`, no pnpm/bun needed.

## Architecture

- **Vite 5 + React 18 + TypeScript 5 (strict)** — pure-static SPA, no SSR.
- **viem v2 + wagmi v2** — RPC + wallet. viem `fallback` transport over 4 PulseChain RPCs.
- **TanStack Query v5** for live data (polling/dedup); **TanStack Router** (code-based) for URLs;
  **Zustand** for terminal UI state.
- **Tailwind v3 + CSS custom properties** — terminal/TUI aesthetic, self-hosted JetBrains Mono.
- **Radix UI** primitives (restyled), **react-markdown** for docs, **JSZip** for the bundle export.
- **Biome** (lint/format), **Vitest** (tests).

Read the committed [`AGENTS.md`](./AGENTS.md) for the full orientation map, and the (local,
gitignored) `docs/ARCHITECTURE.md` for the long-form plan.

## Source of truth

- `affection_docs/` — committed. The knowledge base (markdown), machine-readable
  `registry/*.json` (addresses + minting rates), and verified Solidity `sources/`. The app
  imports these at build time via `import.meta.glob`, so they must stay in the repo.
- `docs/` — gitignored. Local planning notes + the large recovered-contract dump
  (`docs/solidity/`, also at `github.com/busytoby/atropa_pulsechain`).

## License

Code is provided as-is for the community. Ecosystem contracts retain their original SPDX
identifiers (see `affection_docs/sources/`).
