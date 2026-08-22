# 3 · Minting Routes & the Floor Price

## The core idea

AFFECTION™ **cannot be minted directly with pDAI**. Instead you mint an *intermediate*
ecosystem token with a stablecoin (or with another intermediate), and then redeem that
intermediate for Ⓐ via a `BuyWith*` function. The contract rates are fixed; the market
(PulseX) prices float — the gap is the arbitrage.

All three "main" routes converge on the same effective cost:

> **1 Ⓐ  ≈  1 pDAI  ≈  1 pUSDC**

This is the **hard floor price** for freshly‑minted Ⓐ. (The `Fa` and `Faung` routes are
priced differently because those tokens' own minting economics differ — see
[Other routes](#other-routes-fa--faung).)

## Rate table (authoritative)

| Route | Step 1: mint intermediate | Step 2: redeem for Ⓐ | Net (pDAI → Ⓐ) | Contract fn |
|---|---|---|---|---|
| **G5**  | 5 pDAI → 1 G5 (`BuyWithDAI`) | 1 G5 → 5 Ⓐ (`BuyWithG5`) | 5 pDAI → 5 Ⓐ → **1 pDAI/Ⓐ** | `BuyWithG5` |
| **pINDEPENDENCE (PI)** | 300 pDAI → 1 PI (`BuyWithDAI`) | 1 PI → 300 Ⓐ (`BuyWithPI`) | 300 pDAI → 300 Ⓐ → **1 pDAI/Ⓐ** | `BuyWithPI` |
| **MATH (v1.1)** | 1 pDAI → 1 MATH (`BuyWithDAI`) | 1 MATH → 1 Ⓐ (`BuyWithMATH`) | 1 pDAI → 1 Ⓐ → **1 pDAI/Ⓐ** | `BuyWithMATH` |
| **MATH via pUSDC** | 1 pUSDC → 1 MATH (`BuyWithUSDC`) | 1 MATH → 1 Ⓐ | 1 pUSDC → 1 Ⓐ → **1 pUSDC/Ⓐ** | `BuyWithMATH` |
| **Fa** | (mint Fa — see tokens) | 4 Fa → 1 Ⓐ (`BuyWithFa`) | depends on Fa price | `BuyWithFa` |
| **Faung** | (mint Faung — see tokens) | 2 Faung → 1 Ⓐ (`BuyWithFaung`) | depends on Faung price | `BuyWithFaung` |

These rates are fixed in the verified contract source
([`sources/affection.sol`](sources/affection.sol)) and exported as machine‑readable data in
[`registry/minting_rates.json`](registry/minting_rates.json).

## Why the floor is 1 pDAI

Take the G5 route as the cleanest example:

- `G5.BuyWithDAI()` takes `5 * 10**18` pDAI and mints `1 * 10**18` G5 → **1 G5 costs 5 pDAI**.
- `Affection.BuyWithG5(amount)` takes `amount / 5` G5 and sends `amount` Ⓐ → **1 G5 yields 5 Ⓐ**.
- Chain them: 5 pDAI → 1 G5 → 5 Ⓐ, i.e. **1 pDAI per Ⓐ**.

The PI route is the same with a 300× multiplier, and the MATH route is 1:1 directly. So all
three routes have identical unit economics; which one is *profitable* at a given moment
depends only on gas and on which intermediate is cheapest to source.

## The arbitrage

Because contract rates are fixed but PulseX prices move:

- If Ⓐ trades **above ~1 pDAI** on PulseX, mint Ⓐ (via G5/PI/MATH) and sell on PulseX.
- If an intermediate (G5/PI/MATH) trades **below its mint cost in pDAI terms**, buy it on
  PulseX and redeem it for Ⓐ via the contract — you capture the discount.

During market dislocations the spread between the fixed contract rates and the floating
PulseX prices can range from single‑digit percentages to multiples of the mint cost. The
real risks are: (a) the market moving against you between leg 1 and leg 2, (b) mint
snipers front‑running a manual mint, and (c) gas spikes. (a) and (b) are exactly what
batching eliminates — see [`04_multi_mint_contracts.md`](04_multi_mint_contracts.md).

## Step‑by‑step (manual, single mint)

Using the **MATH route** as the canonical example:

1. **Approve pDAI to MATH v1.1.** On the pDAI contract, call
   `approve(0xB680F0cc810317933F234f67EB6A9E923407f05D, amount)`.
2. **Charge the MATH contract's balance.** Call `MATH.Random()` — this mints 1 MATH to the
   MATH contract itself (up to the 1,111,111,111 MATH cap) and returns a random `uint64`.
   You need as many `Random()` calls as the MATH you want to withdraw.
3. **Withdraw MATH to your wallet.** Call `MATH.BuyWithDAI(amount)` — takes `amount` pDAI,
   sends `amount` MATH to you (this drains the buffer that `Random()` filled).
   *(⚠️ use pDAI or pUSDC, **not** pUSDT — pUSDT is bugged in MATH v1.1.)*
4. **Approve MATH to AFFECTION.** On the MATH contract, call
   `approve(0x24F0154C1dCe548AdF15da2098Fdd8B8A3B8151D, amount)`.
5. **Charge the AFFECTION contract's balance.** Call `Affection.Generate()` once per 3 Ⓐ
   you want to withdraw (each call mints 3 Ⓐ to the contract — see
   [`02_contract_mechanics.md`](02_contract_mechanics.md)).
6. **Redeem Ⓐ.** Call `Affection.BuyWithMATH(amount)` — takes `amount` MATH, sends `amount`
   Ⓐ to you.
7. **Sell** Ⓐ (or MATH) on PulseX for PLS/pDAI if realising profit; otherwise hold.

The G5 and PI routes are identical in shape: approve pDAI → `G5.BuyWithDAI()` /
`PI.BuyWithDAI()` (these mint 1 token per call, so you loop them) → approve the intermediate
to AFFECTION → `Affection.Generate()` × N → `Affection.BuyWithG5(amount)` /
`BuyWithPI(amount)`.

## Important gotchas

- **`amount` granularity.** `BuyWithG5` divides by 5 and `BuyWithPI` by 300 (integer
  division); use `amount` that is a multiple of 5 or 300 to avoid losing dust.
- **You must "charge" before you "redeem".** `BuyWith*` transfers out of the contract's *own*
  balance, so you (or a batcher contract) must call `Generate()` (for Ⓐ) or
  `Random()`/`BuyWithDAI()` (for the intermediates) enough times *first* in the same
  transaction, otherwise `BuyWith*` reverts with `ERC20InsufficientBalance`.
- **pUSDT is bugged in MATH v1.1** — verified in the contract source; use pDAI/pUSDC for MATH.
- **Minting stops at the cap.** Both Ⓐ (1,111,111,111) and MATH (1,111,111,111) stop
  minting once their ceiling is hit. Current Ⓐ supply ≈ 366.6M, so this is not imminent.
- **Snipers.** A single manual `Generate()` + `BuyWith*` is two public transactions and can
  be sandwiched. Use the portal's batcher to do it atomically
  ([`04_multi_mint_contracts.md`](04_multi_mint_contracts.md)).

## Transaction count per route (practical limits)

Every step of the mint is a gas-charged contract call. Measured on-chain (receipts,
2026‑08): `Random()` ≈ 36.2k gas, `Generate()` ≈ 39.8k gas, a G5 mint ≈ 11.5k gas. With a
~45M block gas limit and ~10% headroom, that puts the per‑transaction ceilings at
roughly **1000 `Generate()` calls** (~3000 Ⓐ) for the charge leg — and, for the *atomic*
batcher route (which does the intermediate mint **and** the Generate loop in one tx), at
~270 MATH-route loops / ~870 G5-route loops / ~1000 PI-route loops per transaction.

| Target Ⓐ | Loops | MATH route (atomic) | G5 route (atomic) |
|---|---|---|---|
| 300 Ⓐ | 100 | 1 tx (~14.8M gas, ~33% of a block) | 1 tx (~4.6M gas) |
| 870 Ⓐ | 290 | at the gas ceiling (~43M gas) | 1 tx (~13.5M gas) |
| 2700 Ⓐ | 900 | 3–4 txs (split) | at the gas ceiling |

The portal's `/batcher` wizard does the full route (pStable → intermediate → Ⓐ) in **one
transaction** — no multi-tx choreography, no sandwich window, cap-aware loop clamping — and
the `/mint` terminal drives the same routes with explicit, pre-simulated steps. For amounts
within the gas limit one transaction is all you need; larger amounts split across batches.

> **Confirmation expectations for large mints.** A gas‑heavy transaction (a 100‑loop
> MATH‑route mint is ~33% of an entire block) only fits in blocks with enough spare
> capacity. During network congestion — blocks near‑full, elevated base fee — such a
> transaction can sit pending for several minutes even at a reasonable gas price, and a
> wallet "speed up" (same nonce, higher fee) still has to wait for block space. This is
> normal: either wait it out or split the mint into smaller transactions. The wizard
> shows the live network context (base fee, block fullness) and each step's estimated gas
> so you know what to expect before signing.
