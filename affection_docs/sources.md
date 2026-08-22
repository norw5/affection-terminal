# Sources & Provenance

Every non‑trivial fact in this knowledge base is traceable to one of two places: the
verified on‑chain contract source, or a re‑runnable live RPC read. This file lists them
and shows how to re‑verify each.

## 1 · Verified on‑chain contract source

The authoritative source for all contract mechanics. Fetched from the PulseChain scanner
(Blockscout) API:

```
https://api.scan.pulsechain.com/api/v2/smart-contracts/0x24F0154C1dCe548AdF15da2098Fdd8B8A3B8151D
```

The response includes `source_code` (the `affection.sol` single file, 4,081 chars) and
`additional_sources` (the imported files: `dynamic.sol`, `conjecture.sol`, `faung.sol`,
`fa.sol`, `addresses.sol`, plus the OpenZeppelin v5 imports). The full verified set is
committed in [`sources/`](sources/). The relevant mappings:

| `sources/` file | Role | Key facts it anchors |
|---|---|---|
| `affection.sol`   | The `Affection` contract        | `BuyWithG5/PI/MATH/Fa/Faung` rates; `Generate()` mints 3; inherits `Dynamic` |
| `conjecture.sol`  | The `Conjecture` base           | `_mintToCap()`; cap `1,111,111,111`; `aa = atropaMath(libAtropaMathContract)`; `MotzkinPrime` |
| `dynamic.sol`     | The `Dynamic` base              | `Mu` (Faung) state machine; `OpenManifolds`, `React` (which calls `_mintToCap`) |
| `faung.sol`       | `struct Faung` (the `Mu` state)  | Fields: `Rod`, `Cone`, greek‑letter registers |
| `fa.sol`          | `struct Fa` (a rod)             | Fields: `Base`, `Secret`, `Signal`, …, `Alpha`, `Nu` |
| `addresses.sol`   | The address constants          | `libAtropaMathContract`, `PIContract`, `G5Contract`, `dai/usdc/usdt`, etc. |

The MATH / G5 / PI contract sources are verified on the PulseChain scanner (Blockscout)
and cross‑checked against the verified source committed in [`sources/`](sources/):
- G5: `0x2fc636E7fDF9f3E8d61033103052079781a6e7D2`
- PI: `0xA2262D7728C689526693aE893D0fD8a352C7073C`
- MATH v1.1: `0xB680F0cc810317933F234f67EB6A9E923407f05D`
- RNG: `0xa96BcbeD7F01de6CEEd14fC86d90F21a36dE2143`

The portal's own batcher contracts (`UnifiedAffectionBatcher.sol`,
`AtomicArbBatcher.sol` — see [`04_multi_mint_contracts.md`](04_multi_mint_contracts.md))
are authored and maintained by this portal. Their sources ship in the knowledge bundle
export; the portal re-asserts on every release that the compiled artifacts match the 
committed source 
(`npm run compile-batcher` + `npm run verify-batcher` in the portal repository).

> Older community-deployed "multi-mint" batchers exist on-chain. Their sources are
> deliberately **not** part of this knowledge base or its export bundle: the deployed
> bytecode does not match the source copies that circulated, and the deployed contracts
> carry an admin surface those copies do not describe. The portal neither maintains nor
> endorses them; see the note at the end of
> [`04_multi_mint_contracts.md`](04_multi_mint_contracts.md).

## 2 · Live RPC reads (re‑verify these)

All "live" numbers (supplies, decimals) were read via `eth_call` against
`https://rpc.pulsechain.com` on the date of writing. To re‑run them:

```bash
python3 - <<'PY'
import json, urllib.request
RPC='https://rpc.pulsechain.com'
def call(to, data):
    body={'jsonrpc':'2.0','id':1,'method':'eth_call','params':[{'to':to,'data':data},'latest']}
    r=json.load(urllib.request.urlopen(urllib.request.Request(RPC, data=json.dumps(body).encode(), headers={'Content-Type':'application/json'}), timeout=30))
    return int(r['result'],16) if 'result' in r and r['result'] not in (None,'0x') else r
A='0x24F0154C1dCe548AdF15da2098Fdd8B8A3B8151D'
ts=call(A,'0x18160ddd'); dc=call(A,'0x313ce567')   # totalSupply(), decimals()
print('AFFECTION supply =', ts/10**dc, ' decimals =', dc)
# MATH / G5 / PI / RNG / Fa / Faung likewise — see 05_ecosystem_tokens.md for their addresses
PY
```

The `eth_call` selectors used: `totalSupply()`=`0x18160ddd`, `decimals()`=`0x313ce567`,
`balanceOf(addr)`=`0x70a08231+addr32`, `name()`=`0x06fdde03`, `symbol()`=`0x95d89b41`.

**Numbers as of writing** (re‑verify before republishing on the portal):

| Token | `totalSupply()` | decimals | cap |
|---|---|---|---|
| AFFECTION™ (Ⓐ) | ~366,634,963.4 | 18 | 1,111,111,111 |
| MATH v1.1 | ~340,567,095.0 | 18 | 1,111,111,111 |
| GIMME FIVE (G5) | ~1,199,887.0 | 18 | — |
| pINDEPENDENCE (PI) | ~95,926.999… | 18 | — |
| RNG | ~340,587,571.0 | 18 | — |
| libConjecture (Fa) | ~2,846.0 | 18 | — |
| libDynamic (Faung) | ~3.0 | 18 | — |
| Ⓐ balance held by the Ⓐ contract itself | ~4.6e‑11 (≈ 0) | 18 | — |

> The Ⓐ contract holding ≈ 0 of its own balance confirms the "just‑in‑time" minting model:
> `Generate()` charges the buffer and `BuyWith*` drains it within the same transaction
> (see [`02_contract_mechanics.md`](02_contract_mechanics.md)).

## 3 · Provenance policy

This knowledge base is self-contained: every non-trivial fact is anchored to the verified
on-chain contract source (section 1) or a re-runnable live RPC read (section 2). Earlier
community materials (documentation sites, portals, spreadsheets, token lists) that informed
the initial research are no longer publicly available and are **not cited as sources** —
where such framing differed from the on-chain reality, the on-chain value is authoritative
(see the reconciliation notes below). Nothing in the docs or the export bundle depends on
any external site staying up.

## Reconciliation notes (where loose framing was imprecise)

- **Supply cap:** often loosely quoted as "1 billion"; the real on‑chain cap is
  `1,111,111,111` (~1.11B) — a 10‑digit repunit, traced in `Conjecture._mintToCap()`. The
  on-chain value is authoritative.
- **`Generate()` rate:** it mints **exactly 3 Ⓐ per call**, not an unspecified amount.
  Traced via `Generate()` → 2× `Conjecture.React` (+1 each) + 1× `_mintToCap` = 3.
- **MATH sub‑routes (G5→MATH = 4:1, PI→MATH = 212:1):** these are *worse* than the
  pDAI‑equivalent (5:1 and 300:1). The exact `/4` and `/212` divisors come straight from
  the MATH v1.1 source.
- **pUSDT is bugged** in MATH v1.1 — verified in the contract source; never offer the
  pUSDT→MATH route.
- **Burn figures:** static "amount burned" lists go stale immediately and are not
  published here. Burns are computed from Ⓐ log events and live balance reads — see
  [`06_burning_and_sinks.md`](06_burning_and_sinks.md).

## How to keep this file honest

The numbers in section 2 drift as supply is minted and burned. The portal should run the
RPC reads live (module M3) and the docs should be regenerated/checked against them
periodically. The contract mechanics (section 1) are immutable — they only need re‑checking
if AFFECTION is ever upgraded (it is not upgradeable — no proxy; `is_verified=true`,
`Proxy=None`).
