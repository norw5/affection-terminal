# AFFECTION™ (Ⓐ) — Knowledge Base & Documentation

A consolidated, verified reference for the **AFFECTION™ (Ⓐ)** token and its surrounding
**Atropa / Dysnomia** ecosystem on **PulseChain**. This directory is the single source of
truth for both humans and AI agents — every fact below is traceable to either the on-chain
verified contract source or a live RPC read. See [`sources.md`](sources.md) for full
provenance.

> **Contract address:** `0x24F0154C1dCe548AdF15da2098Fdd8B8A3B8151D` · PulseChain ·
> Verified (Solidity `v0.8.21`, no optimizer) · Name `AFFECTION™` · Symbol `Ⓐ` · 18 decimals

---

## TL;DR

- **AFFECTION™** is the gateway token of the Dysnomia ecosystem, created by the developer
  known as **414**. It is an ERC-20 with a capped supply and an on-chain pseudo-random
  number generator (`Generate()`).
- **Supply cap: `1,111,111,111` Ⓐ (~1.111 billion).** Enforced by `_mintToCap()` in the
  `Conjecture` base contract — a 10-digit repunit.
- **Current circulating supply: ~366.6M Ⓐ** (read live via `totalSupply()` — see
  [`sources.md`](sources.md)). The cap is far from reached, so minting is still active.
- **Hard floor price: 1 Ⓐ ≈ 1 pDAI ≈ 1 pUSDC.** You cannot mint Ⓐ directly with pDAI;
  you route through an intermediate ecosystem token (G5 / pINDEPENDENCE / MATH). All three
  main routes are exactly 1:1 in pDAI‑equivalent value.
- **Minting model:** `Generate()` mints **exactly 3 Ⓐ per call** into the contract's own
  balance (2× `React` + 1× `_mintToCap`). The `BuyWith*` functions then transfer that
  buffer to the caller in exchange for intermediate tokens at fixed rates.
- **Arbitrage:** because the contract prices are fixed but PulseX market prices float,
  buying intermediate tokens (or Ⓐ itself) on PulseX and redeeming/minting through the
  contract captures the spread. The portal ships its own atomic batcher contracts to do
  the full route in one transaction.

---

## Table of contents

| # | Document | What it covers |
|---|----------|----------------|
| 1 | [`01_overview.md`](01_overview.md) | What AFFECTION™ is, the ecosystem, creator, supply, utilities |
| 2 | [`02_contract_mechanics.md`](02_contract_mechanics.md) | Deep dive: inheritance, `Generate()`, `BuyWith*`, the `Conjecture`/`Dynamic` bases, `_mintToCap`, the cap, the `Mu` (Faung) state machine |
| 3 | [`03_minting_routes.md`](03_minting_routes.md) | Every minting route, exact rates, pDAI‑equivalence, the floor price, and the arbitrage logic |
| 4 | [`04_multi_mint_contracts.md`](04_multi_mint_contracts.md) | Batch minting — the portal's own atomic batcher contracts, design guarantees, deployment |
| 5 | [`05_ecosystem_tokens.md`](05_ecosystem_tokens.md) | GIMME FIVE, pINDEPENDENCE, libAtropaMath v1.1 (MATH), RNG, libConjecture (Fa), libDynamic (Faung) — contract details & rates |
| 6 | [`06_burning_and_sinks.md`](06_burning_and_sinks.md) | Supply sinks: the market-rate burn/hold mechanism, burns proper, live burn tracking |
| 7 | [`07_interaction_and_tools.md`](07_interaction_and_tools.md) | How to interact (this portal, manual calls, RPC), official links |
| — | [`registry/addresses.json`](registry/addresses.json) | Machine‑readable address registry |
| — | [`registry/minting_rates.json`](registry/minting_rates.json) | Machine‑readable minting‑rate table |
| — | [`sources/`](sources/) | Verified canonical contract source (`affection.sol`, `dynamic.sol`, `conjecture.sol`, `faung.sol`, `fa.sol`, `addresses.sol`) — the batcher sources ship in the bundle export |
| — | [`sources.md`](sources.md) | Provenance: where each fact came from and how to re‑verify |

---

## Quick navigation for AI agents

- **Addresses:** [`registry/addresses.json`](registry/addresses.json)
- **Minting rates (authoritative):** [`registry/minting_rates.json`](registry/minting_rates.json)
- **Cap & supply mechanics:** [`02_contract_mechanics.md`](02_contract_mechanics.md) → "Supply cap"
- **Why `Generate()` mints 3:** [`02_contract_mechanics.md`](02_contract_mechanics.md) → "How `Generate()` mints"
- **Contract source (verified):** [`sources/affection.sol`](sources/affection.sol) +
  [`sources/conjecture.sol`](sources/conjecture.sol) + [`sources/dynamic.sol`](sources/dynamic.sol)
