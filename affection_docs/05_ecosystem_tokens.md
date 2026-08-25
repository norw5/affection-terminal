# 5 · Ecosystem Tokens (contract details)

All addresses are on **PulseChain**. pDAI / pUSDC / pUSDT are the PulseChain forked
copies of DAI / USDC / USDT (same addresses as on Ethereum mainnet).

## pDAI / pUSDC / pUSDT (the "pStables")

| Token | Address | Decimals |
|---|---|---|
| pDAI  | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | 18 |
| pUSDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 6 |
| pUSDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | 6 |

These are the base "fuel" for the whole minting graph: G5, PI, and MATH are all minted with
pDAI/pUSDC (and pUSDT where it works), and Ⓐ is then minted from those.

---

## GIMME FIVE (G5 / ⑤)

| | |
|---|---|
| **Address** | `0x2fc636E7fDF9f3E8d61033103052079781a6e7D2` |
| **Name / Symbol** | `GIMME FIVE` / `⑤` |
| **Decimals** | 18 |
| **Owner** | `0x8B090509eAe0fEB4A0B934de1b4345161fA9a62d` (the `INDEPENDENCE` contract) |
| **Verified** | yes |
| **Still mintable** | yes (uncapped — no supply cap) |
| **Supply (at writing)** | ~1.2M G5 |

Contract: `contract atropacoin is ERC20, ERC20Burnable, Ownable`. No supply cap — `BuyWithDAI()` calls `_mint(msg.sender, 1e18)` unconditionally. Minting functions:

| Function | Takes | Mints | Rate |
|---|---|---|---|
| `BuyWithDAI()`  | 5 pDAI  | 1 G5 | 1 G5 = 5 pDAI |
| `BuyWithUSDC()` | 5 pUSDC | 1 G5 | 1 G5 = 5 pUSDC |
| `BuyWithUSDT()` | 5 pUSDT | 1 G5 | 1 G5 = 5 pUSDT |

Each call mints exactly **1 G5** (no `amount` argument), so to mint N G5 you call it N times
(or batch it — see [`04_multi_mint_contracts.md`](04_multi_mint_contracts.md)). Redeem into
Ⓐ via `Affection.BuyWithG5(amount)` at **1 G5 = 5 Ⓐ**.

---

## pINDEPENDENCE (PI / ⓟ)

| | |
|---|---|
| **Address** | `0xA2262D7728C689526693aE893D0fD8a352C7073C` |
| **Name / Symbol** | `pINDEPENDENCE` / `ⓟ` |
| **Decimals** | 18 |
| **Owner** | `0x8B090509eAe0fEB4A0B934de1b4345161fA9a62d` (the `INDEPENDENCE` contract) |
| **Verified** | yes |
| **Still mintable** | yes (uncapped — no supply cap) |
| **Supply (at writing)** | ~95,927 PI |

Same shape as G5, but 300×. Also uncapped — `BuyWithDAI()` calls `_mint(msg.sender, 1e18)` unconditionally.

| Function | Takes | Mints | Rate |
|---|---|---|---|
| `BuyWithDAI()`  | 300 pDAI  | 1 PI | 1 PI = 300 pDAI |
| `BuyWithUSDC()` | 300 pUSDC | 1 PI | 1 PI = 300 pUSDC |
| `BuyWithUSDT()` | 300 pUSDT | 1 PI | 1 PI = 300 pUSDT |

Each call mints **1 PI**. Redeem into Ⓐ via `Affection.BuyWithPI(amount)` at **1 PI = 300 Ⓐ**.

> Note: PI is **scarce** (~96k live supply) and 300 pDAI per token, so it's the
> "whale‑sized" route — useful when batching big mints, less useful for small ones.

---

## libAtropaMath v1.1 (MATH)

| | |
|---|---|
| **Address** | `0xB680F0cc810317933F234f67EB6A9E923407f05D` |
| **Name / Symbol** | `libAtropaMath v1.1` / `MATH` |
| **Decimals** | 18 |
| **Cap** | `1,111,111,111` MATH (same repunit as Ⓐ) |
| **Verified** | yes |
| **Still mintable** | yes (`Random()` mints while supply ≤ cap) |
| **Supply (at writing)** | ~340.6M MATH |
| **Used by** | the AFFECTION™ contract (`aa = atropaMath(libAtropaMathContract)`) |

MATH is special: it is **the math/RNG library AFFECTION™ depends on**. AFFECTION™'s
`Conjecture` base does `atropaMath internal aa = atropaMath(libAtropaMathContract)`, then
uses `aa.Random()` and `aa.modExp64(...)` for all its state‑machine arithmetic. MATH's
`Random()` itself calls the RNG contract's `Generate()`.

```solidity
uint64 constant public MotzkinPrime = 953467954114363;
function Random() public returns(uint64) {
    if (totalSupply() <= (1111111111 * 10 ** decimals()))
        _mint(address(this), 1 * 10 ** decimals());   // mint 1 MATH to the contract
    return RandomNumberGeneratorToken.Generate();      // RNG = 0xa96BcbeD7F01de6CEEd14fC86d90F21a36dE2143
}
```

Redeem functions (drain the contract's MATH buffer to the caller):

| Function | Takes | Mints/sends | Rate |
|---|---|---|---|
| `BuyWithDAI(amount)`   | `amount` pDAI           | `amount` MATH | 1 MATH = 1 pDAI |
| `BuyWithUSDC(amount)`  | `amount` pUSDC (6 dec)   | `amount` MATH | 1 MATH = 1 pUSDC |
| `BuyWithUSDT(amount)`  | `amount` pUSDT (6 dec)  | `amount` MATH | ⚠️ **bugged** (verified in source) — don't use |
| `BuyWithG5(amount)`    | `amount / 4` G5         | `amount` MATH | 1 G5 = 4 MATH |
| `BuyWithPI(amount)`    | `amount / 212` PI        | `amount` MATH | 1 PI = 212 MATH |
| `BuyWithMATH(amount)`   | `amount` MATH v1.0 (`0x5EF3011243B03f817223A19f277638397048A0DC`) | `amount` MATH v1.1 | 1:1 |

Plus utility functions: `hashWith(a,b)` (pure), `modExp(b,e,m)` (uses precompile `0x05`),
`modExp64(b,e,m)`, `MotzkinPrime` (view).

Redeem MATH into Ⓐ via `Affection.BuyWithMATH(amount)` at **1 MATH = 1 Ⓐ** (so the full
pDAI→MATH→Ⓐ route is exactly 1 pDAI → 1 Ⓐ).

> The G5→MATH (4:1) and PI→MATH (212:1) rates are *worse* than the pDAI‑equivalent (which
> would be 5:1 and 300:1). So those sub‑routes are only worth it when G5/PI trade cheap.

---

## Random Number Generator (RNG)

| | |
|---|---|
| **Address** | `0xa96BcbeD7F01de6CEEd14fC86d90F21a36dE2143` |
| **Decimals** | 18 |
| **Verified** | yes |
| **Still mintable** | yes |
| **Supply (at writing)** | ~340.6M RNG |

The bottom of the stack — the primitive randomness source that MATH (and through it,
AFFECTION™) calls. `Generate()` returns a `uint64` and advances an internal `Mu`/Faung
state (same `Conjecture`/`Dynamic` machinery as AFFECTION™). Also has
`AvailableForPurchase()` (view) and `BuyWithDAI/USDC/USDT/G5/PI(amount: uint32)`.

> Note: unverified RNG‑labelled clones exist elsewhere in the ecosystem. The canonical RNG
> is the verified `0xa96BcbeD7F01de6CEEd14fC86d90F21a36dE2143` — the contract MATH v1.1's
> source actually calls.

---

## libConjecture v1.0 (Fa)

| | |
|---|---|
| **Address** | `0x232a27AB6941281b3f474Fe5fF7Cc89816fB675A` |
| **Decimals** | 18 |
| **Verified** | yes |
| **Still mintable** | yes |
| **Supply (at writing)** | ~2,846 Fa |

The "lower‑level" conjecture token. It exposes the raw state‑machine verbs
(`Charge`, `Amplify`, `Avail`, `Bond`, `Conify`, `Conjugate`, `Adduct`, `Open`,
`ManifoldCompare`) plus `BuyWithG5/PI/MATH(amount)` redeem functions. Redeem into Ⓐ via
`Affection.BuyWithFa(amount)` at **4 Fa = 1 Ⓐ**.

> Note: unverified Fa‑labelled clones exist elsewhere in the ecosystem. The canonical Fa
> is the verified `0x232a27AB6941281b3f474Fe5fF7Cc89816fB675A` — the address the AFFECTION
> contract's `libConjectureContract` resolves to in `addresses.sol`.

---

## libDynamic v1.0 (Faung)

| | |
|---|---|
| **Address** | `0x73A19FaFb359faf519C9707b781dfdB88407d10d` |
| **Decimals** | 18 |
| **Verified** | yes |
| **Still mintable** | yes (per the registry; `?` in the table) |
| **Supply (at writing)** | ~3 Faung |

The "Faung" token — the same `Conjecture`/`Dynamic` machinery, exposing `Charge`,
`Amplify`, `ConductorGenerate`, `BuyWithFa/G5/MATH/PI(amount)`. Redeem into Ⓐ via
`Affection.BuyWithFaung(amount)` at **2 Faung = 1 Ⓐ**. With only ~3 Faung in existence this
is effectively a novelty route.

> Note: unverified Faung‑labelled clones exist elsewhere in the ecosystem. The canonical
> Faung is the verified `0x73A19FaFb359faf519C9707b781dfdB88407d10d` — the address the
> AFFECTION contract's `libDynamicContract` resolves to.

---

## BLÄTTER™ (sibling, no longer mintable)

| | |
|---|---|
| **Address** | `0xCe1d47CE3A91E054C111d9cC3B4bae50843200da` |
| **Name / Symbol** | `BLÄTTER™` / `ออกจาก🄮` |
| **Verified** | no (not verified) |
| **Still mintable** | no |

A sibling token in the wider ecosystem. Not verified and no longer mintable — buy on the
open market only. Documented for completeness; not part of the minting graph.
