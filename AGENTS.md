# AGENTS.md — orientation for AI agents working on AFF_TERMINAL

> Read this first. It is the committed, self-contained guide to orienting in this codebase.
> The long-form architecture plan lives in the (gitignored) `docs/ARCHITECTURE.md`. The
> ecosystem *domain* knowledge lives in the committed `affection_docs/` directory.

## What this is

AFF_TERMINAL is a **strictly static, client-side web portal** for the AFFECTION™ (Ⓐ) token
ecosystem on **PulseChain (chainId 369)**. No backend, no database, no telemetry. It reads
chain state via public RPCs and signs transactions in the browser via wagmi.

## The two source-of-truth directories (do not confuse them)

| Directory | Committed? | Role |
|---|---|---|
| `affection_docs/` | **YES** | **Canonical user-facing knowledge base**: markdown KB, `registry/*.json` (addresses + minting rates), verified Solidity `sources/` (canonical AFFECTION-family contracts ONLY). Imported by the app at build time via `import.meta.glob`. **Do not gitignore.** No references to defunct community sites/portals/lists — every claim traces to contract code or on-chain data. The pre-canonization working version is backed up at `docs/affection_docs_working_backup/` (gitignored). |
| `docs/` | **no (gitignored)** | Local planning (`ARCHITECTURE.md`), the recovered-contract dump `docs/solidity/` (also on GitHub at `busytoby/atropa_pulsechain`), the original community burner list, and the pre-canonization docs backup. Reference only. |

If a value like an address or minting rate is wrong, fix it in `affection_docs/registry/*.json`
— the typed config in `src/config/registry.ts` derives from those JSON files at build time.

## Stack

Vite 5 + React 18 + TypeScript 5 (strict) · viem v2 + wagmi v2 · TanStack Query v5 +
TanStack Router (code-based) · Zustand · Tailwind v3 + CSS custom properties (terminal theme) ·
Radix UI primitives · react-markdown · JSZip/file-saver · Biome (lint/format) · Vitest (tests).

## Commands

```bash
npm install            # install deps (node_modules is gitignored)
npm run dev            # vite dev server (http://localhost:5173)
npm run build          # tsc --noEmit && vite build  ->  dist/  (pure static, host on Vercel/CF Pages)
npm run typecheck      # tsc --noEmit
npm test               # vitest run
npm run test:watch     # vitest
npm run lint           # biome check src
npm run format         # biome check --write src   (applies safe formatting/fixes)
npm run verify-supply  # tsx scripts/verify-supply.ts  (re-verify live reads from affection_docs/sources.md)
npm run verify-mint    # tsx scripts/verify-mint-profitability.ts [loops]  (live P4 auto-router read)
npm run compile-batcher # tsx scripts/compile-batcher.ts  (solc -> contracts/artifacts/*.json)
npm run verify-batcher  # tsx scripts/verify-batcher-deploy.ts  (live P5 creation eth_call probe)
```

## Architecture in one map

```
src/
  config/        chain.ts (PulseChain, NO multicall3) · rpc.ts (4 RPCs) · wagmi.ts
                 registry.ts (← affection_docs/registry/*.json) · constants.ts
                 abis/*.ts (affection, math, erc20) · routes.ts (minting graph)
                 pulsex.ts (V1+V2 factory/WPLS/ABIs) · mint.ts (routes + token specs + gas model)
                 batcher.ts (compiled ABI + bytecode + constructor defaults)
  lib/
    rpc/         client.ts (viem fallback transport) · health.ts (status-bar probe)
    format/      units.ts (bigint→human) · address.ts (checksum/shorten/scanner)  [+ tests]
    highlight/   tokenize.ts (dep-free sol/ts/json/bash/text) · Highlight.tsx  [+ tests]
    verify/      facts.ts (sources.md §2 reads + checkFact)  [+ tests]
    metrics/     burns.ts (range chunking + aggregation + decode, pure)  [+ tests]
    pulsex/      math.ts (UniswapV2 spot/amountOut/slippage, pure) · pairs.ts (discovery)  [+ tests]
    mint/        profitability.ts (swap pathfinder + profit engine, pure) · routePlan.ts (batcher tx model)  [+ tests]
    batcher/     validate.ts (on-chain batcher address probe)
    docs/        loader.ts (import.meta.glob of *.md/*.sol/*.json + BATCHER_SOURCES from contracts/)
    bundle/      export.ts (client-side zip: docs + registry + canonical sources + batchers/)
  hooks/         useSupply · useRpcStatus · useWallet · useVerifyChain                 · useEcosystemSupply (all 7 tokens) · useBurns (parallel chunked + cancel + time windows)
                 · useBurnerBalances (balanceOf on known burners) · usePulseXPairs (V1 + V2 discovery + cross-quote pairs)
                 · useMintData (supply + swap graph) · useMintBalances (all mint-relevant token balances)
                 · useSimulateDeploy (creation eth_call probe) · useSimulateBatcherStep (per-step eth_call)
                 · useNetworkContext (baseFee / block fullness / block time) · useTrackPendingTxs (session tx log polling)
  stores/        ui.ts (zustand: command palette) · txLog.ts (zustand: persisted session tx log)
                 · batchers.ts (zustand: persisted per-wallet deployed-batcher memory)
  components/
    ui/          Panel · Button · Stat · CodeBlock · CopyButton · PhaseNotice · Tabs
    layout/      Header · Sidebar · RpcStatusBar · WalletButton · CommandPalette · TxPanel · Logo · nav · ErrorBoundary
    kb/          MarkdownView · VerifyOverlay
    metrics/      SupplyGauges · BurnsPanel (unrendered) · BurnerBalancesPanel (unrendered) · RouteMap
    mint/         AutoRouter (route+size selector) · BatcherBar · MintExecute · RawConsole · RouteFlow
    shared/      AddressChip · AddressCard
  routes/        router.tsx (code-based route tree) · RootLayout · Dashboard · KBIndex · KBDoc
                 · Mint (2-tab: mint + raw console) · Batcher (deploy-only wizard) · Metrics  (Metrics is full P3)
  styles/        globals.css (terminal design tokens)
  main.tsx       providers: Wagmi → QueryClient → Router
```

The batchers the portal writes live in `contracts/` (Module C, P5). Self-contained Solidity
(`UnifiedAffectionBatcher.sol` mint-only + `AtomicArbBatcher.sol` opt-in mint+sell), compiled to
`contracts/artifacts/*.json` via `npm run compile-batcher` (the `solc` npm package — no global
solc/foundry needed). The artifacts are committed (the app imports them at build time, like
`affection_docs/`); recompile with `npm run compile-batcher` after editing a `.sol`. Nothing is
deployed by default — the wizard deploys each user's own instance.

## Key engineering facts (verified on-chain, not assumed)

- **Multicall3 is absent** on PulseChain (`eth_getCode` at the canonical address → `0x`). Reads
  therefore use **parallel `eth_call`s** (Promise.all of `readContract`), not viem's multicall.
  Do not configure `multicall3` on the chain.
- **4 RPCs** are live and used in a viem `fallback` transport with `rank: true`. The status bar
  probes them independently (lib/rpc/health.ts).
- `Generate()` mints exactly **3** AFFECTION per call; cap is **1,111,111,111** for both AFFECTION
  and MATH. `_mintToCap` no-ops at the cap — the future batcher must clamp `loops`.
- **The legacy community multi-mint contracts are no longer interacted with by the portal
  at all** (P12 deprecation). The `/mint` terminal drives only the portal's own batcher
  contracts (`UnifiedAffectionBatcher` / `AtomicArbBatcher` in `contracts/`); the
  `MULTI_MINT_CONTRACTS` registry block, `multiMintAbi`, `buildMintPlan` /
  `buildMintPlanFromIntermediate`, `useMultiMintTax` / `useMintWallet` / `useSimulateMint`,
  and the old `CustomMint` Tier-2 component have all been removed. The recovered community
  multi-mint sources remain under `docs/multi-mint-contracts-src/` (gitignored) for
  historical reference only. The canonical AFFECTION/MATH/G5/PI token contracts DO match
  their recovered sources (dispatchers verified).
- `/kb/$doc` rendering requires the `/kb` route to be a **layout route** with an index child
  (`src/routes/router.tsx`): the layout renders `<Outlet />`, the index route carries `KBIndex`,
  `$doc` carries `KBDoc`. If KBIndex is attached directly to the parent `/kb` route, the child
  `$doc` route matches but never mounts (no Outlet) — the doc page silently shows the index.
- The AFFECTION contract holds ~0 of its own token (just-in-time minting: `Generate` charges,
  `BuyWith*` drains, same tx). Live buffer is read on the dashboard.
- `pUSDT` is **bugged** in MATH v1.1 — never offer the pUSDT→MATH route.
- **PulseX V2 factory** is `0x1715a3e4a142d8b698131108995174f37aeba10d` (verified on-chain:
  `eth_getCode` → 28k chars, `allPairsLength()` → 65k+ pairs). Discovered by calling `factory()`
  on a live AFFECTION/WPLS pair. **PulseX V1 factory** is `0x29eA7545DEf87022BAdc76323F373EA1e707C523`
  (verified on the PulseChain explorer as `PulseXFactory`; same UniswapV2 selectors). The route map
  + profitability engine discover pairs on BOTH. **WPLS** (Wrapped Pulse) is `0xA1077a294dDE1B09bB078844df40758a5D0f9a27`.
  See `src/config/pulsex.ts` for the full ABIs + selectors.
- **PulseChain network parameters (confirmed + measured 2026-08):** block time ~10s
  (10–12s typical; measured 10.0s avg over 30 blocks — NOT the 2s often assumed),
  block gas limit ~45M, full EIP-1559 (type-2) support. Gas economics differ from
  Ethereum: only 25% of the baseFee is burned — the validator keeps the other 75% plus
  100% of the priorityFee — so priority-fee bidding is the effective speed-up lever for
  pending txs. Gas-hungry mints (a 100-loop MATH route = 14.75M gas = ~33% of a block)
  can take minutes to land during congestion even at adequate prices.
- **Burn addresses** tracked: `0x0`, `0x000…dEaD`, and the PulseChain community burn address
  `0x000…0369` (in `src/lib/metrics/burns.ts`). Known burner/locker contracts are in
  `src/config/burners.ts` (community list, unverified; the live `balanceOf` read is verifiable).

## Status / where to pick up (phases)

See `docs/ARCHITECTURE.md §7` for the full phase plan. Current status:

- **P0 (scaffold) — DONE.** Bootable terminal shell: header/logo/wallet, sidebar nav, ⌘K command
  palette, bottom RPC status bar, KB docs rendering from `affection_docs/*.md` (react-markdown),
  client-side bundle export (JSZip), live supply read (AFFECTION + MATH + contract buffer) proving
  the read pipeline end-to-end, 23 unit tests, clean typecheck/lint/build.
- **P1 (config+RPC) — DONE** (folded into P0): registry/abis/routes, viem fallback client, health
  probe, `useSupply`/`useRpcStatus`.
- **P2 (Module A full) — DONE.** Dep-free syntax highlighter (`src/lib/highlight/`, sol/ts/json/bash/text,
  token colors in `globals.css`, 29 unit tests) wired into `CodeBlock` + the KB markdown renderer; rich
  `AddressCard` registry view for all ecosystem tokens; per-fact "verify against chain" overlay
  (`src/lib/verify/facts.ts` + `useVerifyChain` + `VerifyOverlay`) re-running the canonical `sources.md §2`
  `eth_call`s with ✓/✗/! status. 67 unit tests, clean typecheck/lint/build.
- **P3 (Module D) — DONE.** Supply headroom for all 7 ecosystem tokens (`useEcosystemSupply` +
  `SupplyGauges`); burns scan of `Transfer(…,0x0)` + `Transfer(…,0xdEaD)` log events with bounded
  + deep-scan modes + progress (`useBurns` + `BurnsPanel`); PulseX V2 route map — factory
  `0x1715…a10d` discovered on-chain, `getPair` + `getReserves` for each ecosystem token × WPLS/pDAI/pUSDC,
  SVG liquidity graph + pair table (`usePulseXPairs` + `RouteMap`). Pure burn range/aggregate + UniswapV2
  math logic unit-tested (32 new tests → 99 total). Clean typecheck/lint/build.
- **P4 (Module B) — DONE.** Three-tier minting terminal (`/mint`, tabbed): Tier-1 Auto-Router +
  profitability engine, Tier-2 Custom Routing with simulate-before-sign execution, Tier-3 Raw
  Console. Pure swap pathfinder + profit engine in `src/lib/mint/profitability.ts` (26 new tests
  → 125 total): `buildSwapGraph`, `bestExitPath` (1–3 hop DFS over the live Ⓐ/WPLS/pStable graph),
  `computeRouteProfitability` (cap-clamped), `recommendBest` (cross-stable by `profitBps`). Config in
  `src/config/mint.ts` (clean-route table + the 4-step explicit mint plan via the legacy
  `MultiMath/G5/PI` + `MultiAffection` contracts). Hooks: `useMintData` (supply + cross-quote swap
  graph), `useMintWallet` (balances/allowances), `useSimulateMint` (per-step `eth_call`).
  Components: `AutoRouter` (route-flow + profitability table + best-route recommend),
  `CustomMint` (route/loops picker + pre-simulated 4-step execution via wagmi `useWriteContract`),
  `RawConsole` (paste address + human-readable ABI → selector/calldata/simulate/send, replacing the
  down `scgui.aff.icu` — no Monaco, kept lightweight via viem's `parseAbi`/`encodeFunctionData`).
  Live re-verify script: `npm run verify-mint`. Nav no longer shows a "P4" badge for mint.
  Trust posture held: every approval + mint is explicit + pre-simulated; nothing auto-signs.
- **P5 (Module C) — DONE.** Wrote `UnifiedAffectionBatcher.sol` (mint-only, full-route atomic,
  cap-aware, immutable/ownerless, back-compatible `multiBuyWith`, defensive `rescue`) + opt-in
  `AtomicArbBatcher.sol` (mint+sell via a PulseX V2 router swap leg, extends the base). Both in
  `contracts/`, self-contained Solidity (inline minimal interfaces — no external imports, trivial to
  re-compile + audit). Compiled to `contracts/artifacts/*.json` via `npm run compile-batcher`
  (the `solc` npm package — no global solc/foundry). Config in `src/config/batcher.ts` (typed ABI +
  bytecode + constructor defaults + `buildConstructorArgs`). Hook: `useSimulateDeploy`
  (creation `eth_call` with no `to` — probes the deploy for reverts before the user signs, holding the
  trust posture). Route `src/routes/Batcher.tsx` rewritten as the 4-step wizard: choose variant →
  edit constructor params (default canonical) → pre-simulated deploy via wagmi `useDeployContract`
  (the deployed address is derived from the user's wallet nonce — they control it) → "mint via my
  batcher" (2-step atomic: approve pStable → `batcher.mintFromStable`, a strict upgrade over the legacy
  4-step in `/mint`; both steps pre-simulated). Annotated source shown inline (raw `?raw` import) +
  diff vs legacy `MultiAffection`. 9 new unit tests → 134 total. Live re-verify script:
  `npm run verify-batcher` (probes both constructors' creation `eth_call` against PulseChain — both
  succeed, returning deployed runtime bytecode). Nav no longer shows a "P5" badge for batcher.
- **P6 — DONE (hardening).** Production-ready:
  - **Code-split routes** via `React.lazy` — the initial dashboard chunk dropped from 647KB/193KB-gzip
    to 247KB/79KB-gzip; each route (`/mint`, `/batcher`, `/metrics`, `/kb/*`) is its own chunk loaded
    on navigation (preloaded on hover via `defaultPreload: "intent"`). A `Suspense` fallback in
    `RootLayout` shows a loading state during chunk fetch. The Vite 500KB warning is gone.
  - **Deploy config** — `vercel.json` (SPA rewrites + immutable asset caching + security headers
    `X-Content-Type-Options`/`Referrer-Policy`/`X-Frame-Options`) + `public/_redirects` for
    Cloudflare Pages SPA routing.
  - **Session tx log** (`src/stores/txLog.ts` + `useTrackPendingTxs` + `TxPanel`) — every write flow
    (mint, approve, deploy, raw-console send) appends an entry to a persisted localStorage log;
    `useTrackPendingTxs` polls `getTransactionReceipt` for each pending tx and mirrors its on-chain
    status (signing → confirming → confirmed/reverted/failed) into the store. A bottom-docked
    `TxPanel` (toggled from the header) surfaces the audit trail: status dot, label, scanner link,
    block confirmed in. Persists across refreshes (stale pending txs marked failed on re-hydration).
    11 new unit tests → 145 total.
  - **a11y** — skip-to-content link, `aria-current="page"` on active nav, `role="progressbar"` +
    `aria-valuenow/min/max` on the deep-scan progress bar, `tabIndex={-1}` on the main content for
    focus management, `<main id="main">` landmark. Dialog/palette already had Radix a11y + `sr-only`
    titles from earlier phases.
  - **Trust posture held**: the tx log is pure client-side (no telemetry, no backend); it's an
    audit trail for the user's own signed activity. Nothing is auto-signed.
- **P8 — DONE (post-ship audit + hardening).** Full review that shipped two root-cause fixes
  and a set of live-verified hardening changes:
  - **KB doc routing fixed** — `/kb/$doc` never rendered (the index component was attached
    directly to the `/kb` route, so the child `$doc` route matched but had no `<Outlet />` to
    mount into). The route tree now uses the canonical layout + index pattern
    (`src/routes/router.tsx`: `KbLayout` renders `<Outlet />`, `kbIndexRoute` carries
    `KBIndex`, `kbDocRoute` carries `KBDoc`; `createAppRouter(history?)` exported for tests).
    Regression-tested by mounting the full app in jsdom (`src/routes/router.test.tsx`).
  - **Tier-2 mint execution fixed** — the portal called `multiBuyWith(address,uint256)`
    (0xcc93bb90), a selector that exists in NO deployed multi-mint contract (verified by
    dispatcher extraction from `eth_getCode`). Every post-approval step's pre-simulation
    reverted with an empty reason, so the buttons never enabled. The plan builders now use the
    real deployed ABI (`multiBuyWithDAI/USDC` on MultiMath 1.1, `multiBuyWithDAI` on
    MultiG5/PI, `multiBuyWithMATH/G5/PI` on MultiAffection — arg semantics verified from
    historical tx logs: N whole intermediate tokens / N Generate loops). 14 new unit tests
    pin every function selector to the deployed bytecode (`src/config/mint.test.ts`).
  - **Tax surfacing** — the deployed multi-mints carry an owner-settable tax (0 live, max 15)
    + admin withdrawal functions the recovered sources omit. New `useMultiMintTax` reads them
    live; CustomMint shows them and warns when non-zero. `npm run verify-mint` now also
    asserts every execution selector is present in the deployed bytecode + reads live taxes.
  - **Burns scan fixed** — `getLogs` now filters server-side on the indexed `to` topic
    (OR across the 3 burn addresses; verified live — zero non-burn leakage, and it no longer
    pulls every AFFECTION Transfer in range), failed chunks are counted + surfaced as a
    partial-result warning, the block-rate fallback was corrected (30/s → 0.5/s — a failed
    probe used to silently turn "24h" into a ~231d scan), and an unmount guard cancels
    in-flight chunk fetchers on navigation.
  - **PulseX pair discovery fixed** — the base-token filter excluded names starting with "p",
    which silently dropped pINDEPENDENCE (PI) from the route map. Stables are now excluded by
    address (the quote set), keeping PI.
  - **Input hardening** — `parseWholeInput` (units.ts) replaces raw `BigInt(e.target.value)`
    in the loops inputs (typing "1." or "1e5" used to throw an uncaught SyntaxError in
    onChange with no error boundary).
  - **Markdown fix** — the inline `code` renderer no longer spreads react-markdown's `node`
    prop onto the DOM.
  - Docs corrected to the deployed reality: `04_multi_mint_contracts.md` (verified deployed
    ABI table + admin surface + evidence txs), `07_interaction_and_tools.md`, `sources.md`,
    and this file. 183 unit tests, clean typecheck/lint/build; dev smoke 200 on all routes;
    `verify-supply` / `verify-mint` / `verify-batcher` all pass live.
- **P9 — DONE (knowledge-base canonization).** `affection_docs/` reworked from "working
  research mashup" to the canonical user-facing KB (pre-canonization working version backed
  up at `docs/affection_docs_working_backup/`, gitignored):
  - **All defunct-community throwbacks removed** — no more references to the gone gitbooks,
    `aff.aff.icu`/`scgui.aff.icu` portals, the bots repo, community spreadsheets, tip jar
    (removed from the registry JSON + Dashboard too; replaced with Fa/Faung chips), or
    exploratory "community framing suggests…" quotes (replaced with definitive statements
    from our own analysis). Official links are now ONLY Telegram + the dev's YouTube
    (`@靈脅用`) + the Atropa GitHub repo. Shortened `0x…` address/hashes replaced with full
    values; `sources.md` reframed to a two-source provenance policy (verified contract
  source + live RPC reads; the gitbook scrape section replaced by a non-citation policy).
  - **`04_multi_mint_contracts.md` fully rewritten** — it now documents the portal's OWN
    batchers (`UnifiedAffectionBatcher` / `AtomicArbBatcher`: design guarantees, per-loop
    table, wizard deploy path, gas limits) instead of the old recovered community
    multi-mints. The legacy contracts get one deliberately-scoped non-endorsement note (they
    are still driven by `/mint` Tier-2 compat mode with live tax surfacing).
  - **`sources/multi-*.sol` removed from `affection_docs/`** (not maintained/vouched for);
    the export bundle now ships a `batchers/` folder with our own contracts instead
    (`BATCHER_SOURCES` in `lib/docs/loader.ts`, wired into `lib/bundle/export.ts`).
  - **`06_burning_and_sinks.md` rewritten** — no static burn-amount tables, no "Maria?"
    column, no community-list citations. Documents the verified `DYSNOMIA` market-rate
    Purchase mechanism (hold-vs-burn distinction, RNG-drawn caps, factory-grown Qing family)
    + the live tracking story (burn scan, burner balances as verifiable held-claims).
  - **Code hardening that came with the pass** — top-level `ErrorBoundary`
    (`components/layout/ErrorBoundary.tsx` wrapping the provider tree in `main.tsx`);
    RPC-degradation surfacing (`useBurnTotals.degraded` + BurnsPanel warning,
    `usePulseXPairs.failedReads` + RouteMap warning — failed reads no longer render as
    indistinguishable zeros/empties); `useMintData` graph/data memoized on query-data
    identities (stops per-render DFS recomputation in the AutoRouter).
  - Registry: `tip_jar` removed; `multi_mint_contracts` restructured into an annotated
    object (`{$comment, contracts}`) consumed via `.contracts` in `registry.ts`.
- **P10 — DONE (mint gas UX + measured gas model).** Root-caused a "slow-confirming"
  batcher mint (tx 0xc8fca2a5…21921f: 100-loop MATH route, 14.75M gas = 33% of a block,
  network congested at 80–100% full blocks — the tx was healthy, just block-sized) and
  shipped the data-driven fixes:
  - **Measured gas model** — receipts give Random() ≈ 36.2k, Generate() ≈ 39.8k, G5 mint
    ≈ 11.5k gas; full MATH-route loop ≈ 147.5k. The old "~2000 Generate() calls /
    ~6000 Ⓐ per tx" figure was ~7× too optimistic. `GAS_PER_LOOP` /
    `maxLoopsPerTx()` in `src/config/mint.ts`; routePlan per-tx ceilings corrected
    (1000/1100) + tests updated; docs (03/04) carry the measured tables.
  - **Network context surfacing** — new `useNetworkContext` (baseFee, block fullness,
    block gas limit, measured block time) shown in both /batcher step 4 and /mint Tier-2;
    `eth_estimateGas` wired into `useSimulateMint` + `useSimulateBatcherStep` so every
    mint step shows "~14.8M gas (33% of a block)".
  - **Large-tx confirmation warnings** — when estimated gas ≥ 25% of a block: explains
    multi-minute pends during congestion, why wallet "speed up" still needs block space,
    that raising the priority fee is the effective lever (validators keep 100% of it),
    and suggests splitting. The wizard blocks loops beyond the per-route gas ceiling.
  - **Block time corrected 2s → 10s** (measured; also fixes the burns fallback constant +
    the "2M blocks (~231d)" label — was wrongly "~46d").
  - SIM_GAS raised 30M → 42M (30M made sims of 200+ loop MATH mints fail with out-of-gas
    even though the block allows them).
- **P11 — DONE (deployed-batcher memory).** The wizard no longer forgets your batcher on
  refresh: `src/stores/batchers.ts` (zustand + localStorage, per-wallet, tested) saves the
  deployed address on deploy-confirm; `/batcher` panel 0 offers the remembered batcher
  ("use it ▸" / "forget"), accepts a manually-entered address, and validates any address
  on-chain before unlocking the mint UI (`eth_getCode` + the `AFFECTION()`/`PDAI()`
  immutables must return the canonical addresses; `ROUTER()` presence detects the
  mint-sell variant). The approve step is now driven by the LIVE on-chain allowance
  (`allowance(wallet, batcher)` per stable) — a restored/re-registered batcher with an
  existing max-approval skips straight to the mint, no redundant approval tx.
- **P7 — DONE (polish & UX hardening).** Targeted fixes from a pre-ship review:
  - **Mint terminal (Module B) rework** — Tier-1 Auto-Router is now interactive: any route row is
    clickable (keyboard + mouse) to focus its flow, a "mint this route ▸" CTA hands the route +
    size to Tier-2 (so a user can mint any route, profitable or not), a loops/amount-in toggle,
    inline loops + approval-count explanation ("2 approvals + 2 mint txs, not hundreds"), and a
    wallet-balances panel (pDAI/pUSDC/MATH/G5/PI/Ⓐ) when connected (`useMintBalances`). Tier-2
    CustomMint accepts the preset and adds a "start from intermediate (skip pStable)" mode
    (`buildMintPlanFromIntermediate` — 1 approval + 1 tx for users who already hold MATH/G5/PI),
    shows the intermediate balance + needed amount, and labels the exact approval/tx count.
    `Mint.tsx` lifts a `preset` into shared state to bridge the two tabs.
  - **Metrics (Module D) rework** — burns scan rewritten: parallel chunked `getLogs` (4 concurrent,
    not sequential) with a cancel button, time-window presets (24h / 7d / 30d / max) that estimate
    block counts from the live block time, per-chunk progress (no more 50% snaps), and the
    PulseChain `0x369` burn address added to `BURN_ADDRESSES`. New `BurnerBalancesPanel` +
    `useBurnerBalances` read `balanceOf(AFFECTION)` on each known burner/locker contract
    (`src/config/burners.ts`, the community `tokens_that_burn_aff` list) — a cheap, scan-free
    complement to the log scan. PulseX **V1** factory (`0x29eA…C523`, verified on the explorer)
    added to `pulsex.ts`; `usePulseXPairs` now discovers pairs on V1 + V2 and tags each with its
    factory version; the route map shows a `ven` column + per-version counts; the mint swap graph
    picks up V1 liquidity automatically.
  - **KB / docs cleanup** — `MarkdownView` now resolves same-directory `.md` links to `/kb/$slug`
    routes (the table-of-contents links work). Removed all mentions of the down `aff.aff.icu` /
    `mint.aff.icu` / `scgui.aff.icu` portals + reframed provenance (`sources.md §3`) to not cite
    the gone gitbook as a source (on-chain contracts + live RPC reads are the only sources). Moved
    the internal `08_portal_and_tools_roadmap.md` to gitignored `docs/` (all its modules are
    implemented; not user-facing). Rewrote `07_interaction_and_tools.md` for a public audience.
  - **RPC 403 handling** — `lib/rpc/health.ts` now backs off failing RPCs (2m → 4m → 8m … capped
    32m) so a 403'ing endpoint isn't probed every 30s; a successful probe resets the counter.
  - **Verify check fix** — the AFFECTION buffer fact threshold raised from 1 Ⓐ to 100 Ⓐ (dust
    tolerance — the contract holds ~a few Ⓐ of dust, still ≈ 0 vs 366M supply; the just-in-time
    invariant holds).
  - **RawConsole fix** — `coerceArg` now falls back to zero-values (0n / zero-address / 0x) for
    empty inputs, so selecting `balanceOf` no longer shows "cannot encode args" before you type.
  - **Dashboard/logo** — the `AFF::TERMINAL` logo is now a link to `/`; the modules panel on the
    overview no longer lists "overview" itself.
  - **Typography/contrast** — lightened `--c-text-dim` (#8b8f99→#9ea2ac) and `--c-text-faint`
    (#5b5f68→#71757e) for readability; bumped the Tailwind small font tokens +1px (xs 11→12,
    sm 12→13, base 13→14) and converted all explicit `text-[0.6875rem]` (11px) to `text-xs`.
  - **Copy everywhere** — `CopyButton` added to all shortened-address surfaces (RouteMap factory +
    pairs, BurnsPanel burn targets, Batcher deploy hash + deployed address; AddressChip/AddressCard
    already had it). Full addresses remain in the markdown docs (selectable).
  - **Tests**: 146 total (was 145; +1 for the 0x369 burn-address decode). Clean typecheck/lint/build;
    dev smoke 200 on all routes. Trust posture held throughout.
- **P12 — DONE (legacy multi-mint deprecation + /mint rework + /metrics cleanup).**
  - **Legacy community multi-mints fully removed** — confirmed `/mint` Tier-2 was driving the
    legacy `MultiMath/G5/PI` + `MultiAffection` contracts (the official AFFECTION
    `BuyWith*` only drains; it does not call `Generate()`, so the legacy batchers existed to
    loop the charge step). Removed all portal interaction with them: `MULTI_MINT_CONTRACTS`
    registry block + `MultiMintContract` type, `multiMintAbi` / `MultiMintFn`, `buildMintPlan` /
    `buildMintPlanFromIntermediate`, the `multiMint` / `mintFn` fields on `INTERMEDIATES`,
    `useMultiMintTax` / `useMintWallet` / `useSimulateMint`, the `CustomMint` Tier-2 component,
    `src/config/mint.test.ts` (rewritten for the retained config), and the `multi_mint_contracts`
    + `multi_mint_per_loop` blocks from `affection_docs/registry/*.json`. The recovered sources
    stay under `docs/multi-mint-contracts-src/` (gitignored) for historical reference only.
  - **`/mint` terminal reworked to 2 tabs** — Tab 1 "mint" is a single unified flow: a batcher
    bar (remembers / validates / deploys-link), a route+size selector (evolved AutoRouter with
    profitability table + RouteFlow, auto-selects the best route, reports the selection live),
    and an execute panel (`MintExecute`) that drives the user's OWN batcher in both `mintFromStable`
    (full) and `multiBuyWith` (from-intermediate) modes — approve + mint on the same tab so
    consecutive mints never jump tabs. Tab 2 is the Raw Console (unchanged). New components:
    `BatcherBar.tsx`, `MintExecute.tsx`; `AutoRouter.tsx` reworked. `Mint.tsx` lifts the
    selection + active batcher into shared state.
  - **`/batcher` slimmed to deploy-only** — keeps choose-variant → constructor params →
    simulate+deploy + the inline source view + the deployed-batcher memory save-on-confirm.
    Removed the "already have a batcher?" panel + the "mint via your batcher" panel (both moved
    to `/mint`) and the "older community batchers (non-endorsed)" panel. Added a post-deploy
    "go to /mint" link. `validateBatcherAddress` + `BATCHER_PROBE_ABI` extracted to
    `src/lib/batcher/validate.ts`; `useSimulateBatcherStep` extracted to
    `src/hooks/useSimulateBatcherStep.ts` (shared by `/batcher` and `/mint`).
  - **`routePlan.ts` reframed to the batcher model** — execution is 1 atomic tx per batch (not
    the old 2-tx intermediate-then-AFFECTION split); `totalTxs` = ceil(loops /
    maxLoopsPerTx(intermediate)); `approvals` = 1 (one-time per session); the old
    `intermediateTokensNeeded` / `intermediateMintCalls` / `affectionMintCalls` /
    `piBugWarning` fields are gone (the batcher loops internally — no per-call PI bug).
  - **`/metrics` cleanup** — removed the burns section (`BurnsPanel` + `BurnerBalancesPanel` +
    their explanatory paragraphs) from the metrics page; the underlying libs/hooks/tests are
    kept in place, just unrendered, for later re-enablement. Added the cross-quote pairs
    (WPLS/pDAI, WPLS/pUSDC, pDAI/pUSDC) to `usePulseXPairs` so the route map includes the
    on-ramp from native to the pStables minting needs (discovered on BOTH V1 + V2, consistent
    with the /mint profitability swap graph).
  - **Docs** — `04_multi_mint_contracts.md` legacy section removed + wizard wording updated
    (minting now at `/mint`); `sources.md` legacy blockquote removed; `07_interaction_and_tools.md`
    portal-section updated; `AGENTS.md` engineering-fact corrected + this entry added.
  - **Tests**: 184 total (was 188; net −4 — the 14 legacy multi-mint selector/plan tests were
    deleted, 20 new config + routePlan tests added). Clean typecheck/lint/build. The
    `verify-mint-profitability` script now checks the compiled batcher ABI instead of the
    legacy bytecode dispatchers. Trust posture held: every approve + mint + deploy is still
    explicit + pre-simulated; nothing auto-signs.
- **P13 — DONE (comprehensive audit + hardening).** Full code review and security audit
  across all 50+ source files (Solidity contracts, mint engine, RPC/chain, wallet
  integration, frontend security, deploy config). No CRITICAL or HIGH issues found;
  2 MEDIUM + 4 LOW fixes shipped:
  - **`Content-Security-Policy` header added** to `vercel.json` — restricts script-src,
    connect-src (RPC whitelist), frame-ancestors, font/img sources. Defense-in-depth for
    a wallet-connected dApp. `style-src 'unsafe-inline'` required by Tailwind.
  - **`minOut` set to expected output** in `MintExecute.tsx` — was `0n`, which silently
    allowed cap-clamped mints to return a fraction of the expected Ⓐ. Now set to
    `loops * 3n * 10n**18n` so near-cap mints revert instead of surprising the user.
    Both the simulation args and the write call args updated.
  - **Remembered batcher re-validated on-chain** on "use it" click in `BatcherBar.tsx` —
    was a straight restore from localStorage, now calls `validateBatcherAddress()` first
    (defense-in-depth against tampered localStorage).
  - **Constructor param address validation** in `Batcher.tsx` — per-field `isAddress()`
    check with inline error/✓ indicators and deploy button blocked on invalid params.
  - **Payable functions handled** in `RawConsole.tsx` — split `isWrite` into
    `isNonpayableWrite` / `isPayable`; the send button is only shown for nonpayable
    functions; payable functions get an info note ("sending PLS not supported in this
    console, use simulate").
  - **Boot splash removed** from DOM in `main.tsx` — `document.getElementById("boot")?.remove()`
    before React mounts, so the pre-hydration splash doesn't linger as a hidden element.
  - 190 unit tests, clean typecheck/lint/build.

## Conventions

- **No comments unless asked** is the general rule, BUT this project deliberately keeps
  explanatory header comments on config/contract files (they encode on-chain facts). Keep them.
- TypeScript: `verbatimModuleSyntax` is on — use `import type` for type-only imports.
- Biome handles lint+format (double quotes, semicolons, 100 cols). Run `npm run format` before
  committing. Do not add ESLint/Prettier.
- Path alias `@/` → `src/`. `affection_docs/` is imported via relative paths from
  `src/config/registry.ts` and `src/lib/docs/loader.ts` (3 levels up).
- Trust rule: the portal **never auto-approves/auto-signs**. Every approval + mint + deploy is
  explicit and pre-simulated.

## Security note on `npm audit`

`npm audit` reports issues in **dev/transitive** deps (vite, vitest, axios, ws, and the
WalletConnect chain pulled transitively by `@wagmi/connectors`). None reach the production bundle
— verified: no `reown`/`appkit` strings in `dist/`. The portal only uses the `injected()`
connector. Do **not** run `npm run dev` on a host exposed to untrusted networks (dev-server CVEs).
