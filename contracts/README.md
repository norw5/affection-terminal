# contracts/

The AFF_TERMINAL batchers (Module C, P5). Nothing here is deployed by default — the deployment
wizard at `/batcher` lets each user deploy *their own* instance from the frontend.

## Status: **DONE (P5)**

Both contracts are written, compiled to `artifacts/*.json` (`npm run compile-batcher`), and
wired into the deployment wizard. Live re-verify the deploy with `npm run verify-batcher` (probes
both constructors' creation `eth_call` against PulseChain — both succeed).

## Deployed contracts

### `UnifiedAffectionBatcher.sol` (default, mint-only)

Supersedes the six legacy `multi-*.sol` contracts. Does the **full route in one transaction**:
pull pStable → mint intermediate (charge+drain for MATH via `Random()`+`BuyWithDAI/USDC`, or
direct-mint for G5/PI via `BuyWithDAI()` loops) → `Generate()` × N → `BuyWith*` → return
AFFECTION to `msg.sender`. Cap-aware (clamps `loops` to `floor((cap − supply)/3)` via
`maxSafeLoops()`), immutable/ownerless, back-compatible `multiBuyWith(address, loops)`,
defensive `rescue` (non-canonical stuck tokens to `msg.sender`; canonical tokens locked).

**Why it's better than the legacy batchers:** `MultiMath` only mints MATH and `MultiAffection`
only mints AFFECTION, so the canonical pDAI→MATH→Ⓐ route is *two transactions* with a sandwich
window between them. The unified batcher makes it atomic end-to-end.

### `AtomicArbBatcher.sol` (opt-in, mint + sell)

Extends `UnifiedAffectionBatcher` with a final PulseX V2 swap leg (`mintAndSwap` calls the
verified `_mintToSelf` then `router.swapExactTokensForTokens`), so mint + sell happen in one tx
(defeats sell-side sniping). **Opt-in only** — the sell leg adds DEX-interaction audit surface.
The wizard defaults to the mint-only batcher and clearly flags the extra risk. The router
address is a constructor param (user-supplied + on-chain-verified; defaults to `0x0` which the
wizard blocks before deploy).

## Economics recap (verified)

With `loops` as the unit: `loops × Generate()` = `3·loops` AFFECTION. The intermediate needed
per loop = the `perLoop` table (G5 0.6e18, PI 0.01e18, MATH 3e18). All three pStable routes cost
exactly `3·loops` pStable for `3·loops` AFFECTION — the 1 pStable/Ⓐ floor. pUSDC (6 dec) is only
accepted on the MATH route (G5/PI accept pDAI only). pUSDT is intentionally NOT supported
(bugged in MATH v1.1).

## Compilation

`npm run compile-batcher` uses the `solc` npm package (the JS build of solc 0.8.36) — no global
solc/foundry needed. The `.sol` files are self-contained (inline minimal `IERC20`/`IAffection`/
`IMath`/`IMintable`/`IUniswapV2Router` interfaces, no external imports), so import resolution is
trivial and the contracts are easy to re-audit. Output: `artifacts/{Contract}.json` (ABI +
bytecode + method identifiers).
