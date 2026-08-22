# 1 · Overview

## What is AFFECTION™?

**AFFECTION™ (Ⓐ)** is an ERC‑20 token on **PulseChain**, created by the developer known as
**414** (also the creator of the **Atropa** and **Dysnomia** ecosystems). It is the
**gateway token** of the Dysnomia ecosystem: it is used to mint / purchase other ecosystem
tokens, to fuel on‑chain randomness, and it is burned by various Dysnomia "Qing" tokens
when they are used.

- **Contract address:** `0x24F0154C1dCe548AdF15da2098Fdd8B8A3B8151D`
- **Name / symbol:** `AFFECTION™` / `Ⓐ`
- **Decimals:** 18
- **License:** "Sharia" (SPDX identifier used across the ecosystem)
- **Verified:** yes — source on the PulseChain scanner (Blockscout) is fully verified
  (`v0.8.21+commit.d9974bed`, optimizer disabled).

## The ecosystem

AFFECTION™ sits inside a layered family of contracts:

```
                         Atropa  (414)
                           │
                      ┌────┴────┐
                   Dysnomia  AFFECTION™  (this token)
                   (L2 / "Mund"        │
                    state machine)     │  gateway / RNG / base currency
                                 ┌─────┴───────┬──────────┬──────────┐
                          libAtropaMath  pINDEPENDENCE  GIMME FIVE  RNG
                              (MATH)          (ⓟ)          (⑤)      (RNG)
                                │
                     libConjecture (Fa) · libDynamic (Faung)
```

- **Atropa** — the top‑level project. Its contract corpus lives at
  `github.com/busytoby/atropa_pulsechain`.
- **Dysnomia** — the on‑chain "language"/state‑machine layer that AFFECTION™ is built on
  (the `Conjecture` / `Dynamic` / `Faung`("Mu") machinery — see
  [`02_contract_mechanics.md`](02_contract_mechanics.md)).
- **AFFECTION™** — the gateway currency + on‑chain RNG of the ecosystem.
- **Intermediate minting tokens** — GIMME FIVE (G5), pINDEPENDENCE (PI), libAtropaMath
  (MATH), libConjecture (Fa), libDynamic (Faung). Each is itself mintable with pDAI/pUSDC
  (or with another intermediate token) and each can be "redeemed" into AFFECTION™ at a
  fixed rate — see [`03_minting_routes.md`](03_minting_routes.md).
- **RNG** — `0xa96BcbeD7F01de6CEEd14fC86d90F21a36dE2143`. The primitive randomness source
  that MATH and AFFECTION both call (`Generate()`).

AFFECTION™ is the gateway for acquiring other tokens in the ecosystem, and its
`Generate()` function doubles as an on‑chain source of pseudo‑random numbers usable by
other contracts and dApps. Both properties are direct consequences of the verified
contract source (see [`02_contract_mechanics.md`](02_contract_mechanics.md)).

## Supply

| | Value | Source |
|---|---|---|
| **Hard cap (max supply)** | **1,111,111,111 Ⓐ** (~1.111 billion) | `_mintToCap()` in `Conjecture` — see [`02_contract_mechanics.md`](02_contract_mechanics.md) |
| **Circulating supply (live read)** | **~366.6M Ⓐ** | `totalSupply()` via RPC — see [`sources.md`](sources.md) to re‑run |
| **Initial mint** | 1 Ⓐ to the contract itself | `constructor`: `_mint(address(this), 1 * 10 ** decimals())` |

The cap is a 10‑digit repunit (`1,111,111,111`, ≈1.111 billion).

## Utilities

1. **Gateway / base currency** — used to mint or buy other Dysnomia/Atropa tokens.
2. **On‑chain RNG** — `Generate()` returns a `uint64` and advances the contract's internal
   `Mu` (Faung) state. Other contracts call AFFECTION™'s `Generate()` to obtain randomness
   (MATH v1.1's `Random()` depends on the RNG contract's `Generate()`).
3. **Burn sink** — a long tail of "Qing" Dysnomia tokens burn Ⓐ when used (see
   [`06_burning_and_sinks.md`](06_burning_and_sinks.md)).
4. **Arbitrage vehicle** — fixed contract mint prices + floating PulseX prices create
   recurring arbitrage (see [`03_minting_routes.md`](03_minting_routes.md)).

## How you acquire Ⓐ

1. **Buy on the open market** — PulseX (pair: Ⓐ/WPLS).
2. **Mint from the contract** by burning an intermediate ecosystem token via one of
   `BuyWithG5`, `BuyWithPI`, `BuyWithMATH`, `BuyWithFa`, `BuyWithFaung`. Because the
   intermediates are themselves mintable with pDAI/pUSDC, the effective cost is **1 pDAI
   per Ⓐ** on the three main routes — a hard floor.

> Tokens marked "no longer mintable" in the registry must be bought on the open market
> rather than minted. AFFECTION™ itself is **still mintable** (supply ≪ cap).
