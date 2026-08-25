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
| `conjecture.sol`  | The `Conjecture` abstract base  | `_mintToCap()`; cap `1,111,111,111`; `aa = atropaMath(libAtropaMathContract)`; `MotzkinPrime` |
| `dynamic.sol`     | The `Dynamic` abstract base     | `Mu` (Faung) state machine; `OpenManifolds`, `React` (which calls `_mintToCap`) |
| `faung.sol`       | `struct Faung` (the `Mu` state)  | Fields: `Rod`, `Cone`, greek‑letter registers |
| `fa.sol`          | `struct Fa` (a rod)             | Fields: `Base`, `Secret`, `Signal`, …, `Alpha`, `Nu` |
| `addresses.sol`   | The address constants          | `libAtropaMathContract`, `PIContract`, `G5Contract`, `dai/usdc/usdt`, etc. |
| `math_v1_1_atropaMath.sol` | MATH v1.1 token (`0xB680…f05D`) | `Random()` mints 1 MATH with cap `1,111,111,111`; `BuyWithDAI/USDC` drain; `BuyWithG5/PI/MATH` sub-routes |
| `math_v1_0_atropaMath.sol` | MATH v1.0 token (`0x5EF3…A0DC`) | Older MATH; `Random()` mints 1 MATH **uncapped**; accepted 1:1 by v1.1 `BuyWithMATH` |
| `G5_atropacoin.sol` | G5 token (`0x2fc6…e7D2`) | `BuyWithDAI()` mints 1 G5 for 5 pDAI **uncapped**; `contract atropacoin is ERC20, ERC20Burnable, Ownable` |
| `PI_atropacoin.sol` | PI token (`0xA226…073C`) | `BuyWithDAI()` mints 1 PI for 300 pDAI **uncapped**; same `atropacoin` contract, different constructor |
| `rng.sol` | RNG token (`0xa96B…2143`) | `Generate()` mints 1 RNG with cap `1,111,111,111`; the primitive RNG that MATH.Random() calls |
| `fa_v1_0.sol` | Fa / libConjecture v1.0 (`0x232a…675A`) | Concrete `Conjecture` token with `_mintToCap` (cap `1,111,111,111`); `BuyWithG5/PI/MATH` redeem |
| `faung_v1_0.sol` | Faung / libDynamic v1.0 (`0x73A1…d10d`) | Concrete `Dynamic` token with `_mintToCap` (cap `1,111,111,111`); `BuyWithG5/PI/MATH/Fa` redeem |

The abstract bases (`conjecture.sol`, `dynamic.sol`) are the inheritance chain that
AFFECTION uses; the concrete token files (`fa_v1_0.sol`, `faung_v1_0.sol`) are the
standalone deployed contracts at their own addresses. Both are included for completeness.

The MATH / G5 / PI contract sources are verified on the PulseChain scanner (Blockscout)
and committed in [`sources/`](sources/):
- G5: `0x2fc636E7fDF9f3E8d61033103052079781a6e7D2` — `G5_atropacoin.sol`
- PI: `0xA2262D7728C689526693aE893D0fD8a352C7073C` — `PI_atropacoin.sol`
- MATH v1.1: `0xB680F0cc810317933F234f67EB6A9E923407f05D` — `math_v1_1_atropaMath.sol`
- MATH v1.0: `0x5EF3011243B03f817223A19f277638397048A0DC` — `math_v1_0_atropaMath.sol`
- RNG: `0xa96BcbeD7F01de6CEEd14fC86d90F21a36dE2143` — `rng.sol`
- Fa: `0x232a27AB6941281b3f474Fe5fF7Cc89816fB675A` — `fa_v1_0.sol`
- Faung: `0x73A19FaFb359faf519C9707b781dfdB88407d10d` — `faung_v1_0.sol`

The portal's own batcher contracts (`UnifiedAffectionBatcher.sol`,
`AtomicArbBatcher.sol` — see [`04_multi_mint_contracts.md`](04_multi_mint_contracts.md))
are authored and maintained by this portal. Their sources ship in the knowledge bundle
export; the portal re-asserts on every release that the compiled artifacts match the 
committed source 
(`npm run compile-batcher` + `npm run verify-batcher` in the portal repository).

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
