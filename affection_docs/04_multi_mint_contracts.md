# 4 · Batch Minting — The Portal's Batcher Contracts

Manual minting is two problems in one:

1. **It's two (or more) transactions.** You must "charge" the contract balance with
   `Generate()` (or `Random()` / `BuyWithDAI()` for the intermediates) and *then* "redeem"
   with `BuyWith*` — in separate calls that can be sandwiched or front‑run.
2. **The intermediates mint 1 token per call.** `G5.BuyWithDAI()` mints exactly 1 G5;
   `PI.BuyWithDAI()` mints exactly 1 PI; `Affection.Generate()` mints exactly 3 Ⓐ (see
   [`02_contract_mechanics.md`](02_contract_mechanics.md)). Minting 1,000 Ⓐ manually is
   therefore ~334 separate `Generate()` calls + 1 `BuyWith*` — too many transactions.

The portal ships its own **batcher contracts** that solve both by doing the whole route in
one transaction: they `transferFrom` the payment token from the caller, loop the "charge"
step, call `BuyWith*`, and `transfer` the freshly‑minted Ⓐ straight back to the caller —
all atomically. This packs hundreds of mints into a single transaction (amortising gas)
and removes the sandwich window entirely.

## The two contracts

| Contract | What it does | Trust surface |
|---|---|---|
| **`UnifiedAffectionBatcher`** | Mint-only. Full route pStable → intermediate → Ⓐ in one call. The default. | AFFECTION / MATH / G5 / PI contracts only — no DEX interaction. |
| **`AtomicArbBatcher`** | Extends the above with an opt-in final leg: swap the minted Ⓐ on PulseX V2, so mint + sell are one transaction. | Adds the PulseX V2 router (an external contract). Advanced, opt-in. |

Both are single, self-contained Solidity files (inline minimal interfaces, **no external
imports**) with no proxy, no upgrade path, and **no admin functions** — there is no owner,
no pause, no tax, no withdrawal. Addresses are `immutable` constructor parameters, so the
contract you deploy is the contract you get, forever.

## Design guarantees

1. **Full-route atomic.** `mintFromStable(stable, intermediate, loops, minOut)` performs
   pStable → intermediate → Ⓐ in one transaction. The intermediate never sits exposed in
   your wallet between legs.
2. **Cap-aware.** `Generate()` mints 3 Ⓐ per call *only while supply is below the
   1,111,111,111 cap* — near the cap `_mintToCap` no-ops and a fixed `BuyWith*(loops*3)`
   would revert with `ERC20InsufficientBalance`. The batcher exposes
   `maxSafeLoops()` (the cap headroom ÷ 3) and clamps or reverts accordingly, so it can
   never be tricked into an unpayable redemption by the cap.
3. **Ownerless + immutable.** No `setOwner`, no `setTax`, no `withdraw*`. Nothing can be
   changed after deployment. The constructor sets the canonical approvals once
   (pStables → {MATH, G5, PI}, intermediates → AFFECTION) so every later mint is
   approval-free for the batcher itself.
4. **Slippage-protected.** `minOut` reverts the whole transaction if the minted amount
   falls below your expectation (e.g. by cap clamping).
5. **Back-compatible partial route.** `multiBuyWith(intermediate, loops)` handles the
   case where you already hold the intermediate: pulls it, runs the Generate loop +
   `BuyWith*`, and sends `loops * 3` Ⓐ back — still one transaction, still cap-aware.
6. **Defensive `rescue(token)`.** Anyone may recover a *non-canonical* token that was
   accidentally airdropped to the batcher. Canonical tokens (Ⓐ, MATH, G5, PI, pDAI, pUSDC)
   are locked out of `rescue` — the batcher is just-in-time and never holds a standing
   balance of them.
7. **Deterministic economics.** The per-loop table is burned in at construction:

| Intermediate | `perLoop` (tokens per Generate loop) | Meaning | Route cost |
|---|---|---|---|
| MATH | `3e18`  | 3 MATH per loop → 3 Ⓐ (1 MATH = 1 Ⓐ) | 1 pStable / Ⓐ |
| G5   | `0.6e18` | 0.6 G5 per loop → 3 Ⓐ (1 G5 = 5 Ⓐ) | 1 pDAI / Ⓐ |
| PI   | `0.01e18` | 0.01 PI per loop → 3 Ⓐ (1 PI = 300 Ⓐ) | 1 pDAI / Ⓐ |

All three routes converge on the **1 pStable / 1 Ⓐ floor** (see
[`03_minting_routes.md`](03_minting_routes.md)). Sanity check: each `perLoop` × the
divisor in the corresponding `BuyWith*` equals `3`, the Ⓐ minted per loop.

## The `AtomicArbBatcher` sell leg (opt-in)

`mintAndSwap(stable, intermediate, loops, minAffOut, path[], amountOutMin, deadline)`
mints Ⓐ exactly like `mintFromStable`, then swaps the minted Ⓐ along `path` via the
PulseX V2 router and sends the proceeds straight to you — mint and sell in one
transaction, closing the sell-side sandwich window too.

The trade-off is an extra audit surface: the swap leg interacts with the PulseX router,
which is outside the AFFECTION/MATH contract set. Review the router address and path
before signing. If you don't want DEX interaction at all, deploy the mint-only
`UnifiedAffectionBatcher` — the wizard defaults to it and flags the arb variant as
advanced.

## Deploying your own

The `/batcher` page in this portal is a deployment wizard:

1. **Choose a variant** — mint-only (default) or mint+sell (advanced, needs a router address).
2. **Review the constructor parameters** — pre-filled with the canonical addresses; every
   parameter is editable and the full annotated source is shown inline.
3. **Deploy** — the wizard pre-simulates the deployment (a creation `eth_call`) before
   you sign anything, and the deployed address is derived from *your* wallet nonce, so
   the contract is entirely yours.
4. **Mint via your batcher** — two steps (approve pStable → `mintFromStable`), both
   pre-simulated in the UI.

Because the source is a single self-contained file, it can also be compiled and deployed
with any standard toolchain (e.g. `solc` or Remix) without special setup. The full source
of both contracts ships in this portal's knowledge bundle export. Recompiling
locally is a one-command affair in the portal's repository (`npm run compile-batcher`).

## Gas and loop limits

Measured on-chain (receipts, 2026‑08): `Random()` ≈ 36.2k gas, `Generate()` ≈ 39.8k gas,
a G5 mint ≈ 11.5k gas. One full MATH-route loop inside the batcher (3× `Random` +
1× `Generate`) costs ≈ **147.5k gas** — verified by a live 100‑loop
`mintFromStable(pUSDC, MATH, 100)` that used 14,751,057 gas. Against the ~45M block gas
limit (keep ~10% headroom), the practical per‑transaction ceilings are:

| Route | Gas per loop (measured) | Max loops per tx | ≈ Ⓐ per tx |
|---|---|---|---|
| MATH | ~148k (3× Random + Generate) | ~270 | ~810 Ⓐ |
| G5   | ~46k (0.6× G5 mint + Generate) | ~870 | ~2610 Ⓐ |
| PI   | ~40k (0.01× PI mint + Generate) | ~1000 | ~3000 Ⓐ |

The G5 route is the most gas‑efficient of the three for the same Ⓐ amount; larger mints
simply split across multiple `mintFromStable` calls.

> **Confirmation expectations.** A 100‑loop MATH‑route mint is ~33% of an entire block —
> such a transaction only fits in blocks with enough spare capacity. During network
> congestion (blocks near‑full, elevated base fee) it can sit pending for several minutes
> even at a reasonable gas price, and a wallet "speed up" re-submits the same nonce and
> still has to wait for block space. That is normal behavior, not a stuck transaction:
> wait it out, or split the mint into smaller loops. The wizard surfaces live network
> context (base fee, block fullness, ~10s block time) and the estimated gas before you
> sign.

> **How gas works on PulseChain.** Fully EIP‑1559 (type‑2 transactions with
> `maxFeePerGas` / `maxPriorityFeePerGas`), ~10–12s average block time. Unlike Ethereum,
> only **25% of the base fee is burned — the validator keeps the other 75% plus 100% of
> the priority fee.** Practical consequence for a pending gas‑heavy mint: raising the
> *priority fee* is the effective speed‑up lever (validators are paid it in full), while
> the base fee only needs to clear the current block's threshold. Legacy (type‑0)
> transactions with a plain `gasPrice` work too but can't distinguish the two components.

## A note on the older community batchers

Earlier community-deployed "multi-mint" batchers exist on-chain. The portal does not
maintain, endorse, or document them: analysis of their deployed bytecode shows an admin
surface (owner, settable tax, token/PLS withdrawal functions) that circulating copies of
their source do not reflect — a trust surface the portal's own batchers deliberately
eliminate by having no admin surface at all. The `/mint` terminal retains a legacy
compatibility mode that can drive those older contracts, with every step pre-simulated
against the live chain state and their current tax read surfaced before you sign; it is
offered for completeness, not as a recommendation. The recommended path is deploying
your own batcher above — one transaction, no admin keys, no tax, source you can read.
