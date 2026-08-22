# 2 · Contract Mechanics (AFFECTION™)

This is the precise, contract‑level explanation of how AFFECTION™ works. All statements here
are derived from the verified on‑chain source in [`sources/`](sources/)
(`affection.sol`, `conjecture.sol`, `dynamic.sol`, `faung.sol`, `fa.sol`, `addresses.sol`).

## Inheritance chain

```
Affection   is  ERC20, ERC20Burnable, Ownable, Dynamic
Dynamic      is  ERC20, ERC20Burnable, Ownable, Conjecture   (adds the "Mu"/Faung state machine)
Conjecture   is  ERC20, ERC20Burnable, Ownable               (adds _mintToCap, the cap, and aa = MATH)
```

So `Affection` is, in effect, an ERC‑20 with a `Conjecture`‑style capped minter, a
`Dynamic`‑style on‑chain state machine (`Mu`), and five fixed‑rate `BuyWith*` redeem
functions. The "weird" state‑machine functions (`Alpha`, `Beta`, `Upsilon`, `Pi`, `Rho`,
`Generate`, `View`) all belong to the `Conjecture`/`Dynamic` machinery.

## The `Conjecture` base — cap and the math library

```solidity
// conjecture.sol
uint64 constant public MotzkinPrime = 953467954114363;
atropaMath internal aa = atropaMath(libAtropaMathContract);   // aa == MATH v1.1 (0xB680F0cc810317933F234f67EB6A9E923407f05D)

function _mintToCap() internal {
    if (totalSupply() <= (1111111111 * 10 ** decimals()))
        _mint(address(this), 1 * 10 ** decimals());
}
```

Two things to notice:

1. **`aa` is the MATH v1.1 contract.** `libAtropaMathContract` =
   `0xB680F0cc810317933F234f67EB6A9E923407f05D`
   (see [`05_ecosystem_tokens.md`](05_ecosystem_tokens.md)). AFFECTION™ uses MATH's
   `Random()` (which in turn calls the RNG contract) and `modExp64()` for all of its
   pseudo‑random "manifold" arithmetic. **MATH must be live for AFFECTION™ to mint.**
2. **The cap is `1,111,111,111` Ⓐ** (a 10‑digit repunit, ≈1.111B). `_mintToCap()` mints
   exactly **1 whole Ⓐ** (1e18 base units) to `address(this)` on every call, but only while
   `totalSupply()` is still at or below that ceiling. Once the cap is reached, `_mintToCap`
   silently becomes a no‑op and the contract stops minting.

The constant `MotzkinPrime = 953467954114363` is the modulus used by every `modExp64`
operation in the state machine (it is a prime; the name is an in‑joke — it is used as a
modulus for modular exponentiation, i.e. `base^exp mod MotzkinPrime`).

## The `Dynamic` base — the `Mu` (Faung) state machine

`Dynamic` holds one piece of storage:

```solidity
Faung internal Mu;     // the "Mund" state — two Fa rods (Rod & Cone) + a ring of greek letters
```

`Faung` (see `faung.sol`) is a struct of two `Fa` rods plus a set of `uint64` "registers"
(`Phi, Eta, Mu, Xi, Sigma, Rho, Upsilon, Ohm, Pi, Omicron, Omega` and a `uint8 Chi`). Each
`Fa` rod (`fa.sol`) is itself a struct of `uint64` fields (`Base, Secret, Signal, Channel,
Pole, Identity, Foundation, Element, Dynamo, Manifold, Ring, Barn, Coordinate, Tau, Eta,
Kappa, Alpha` + `uint8 Nu`).

`Dynamic` provides the high‑level state‑machine ops that the `Affection` contract exposes
publicly: `Alpha`, `Beta`, `Upsilon`, `Pi`, `Rho`, `Generate`, `View`. Each one drives the
`Mu` state forward via `Conjecture` primitives (`Seed`, `Tune`, `Form`, `Polarize`,
`Conjugate`, `Conify`, `Saturate`, `Bond`, `Adduct`, `Open`, `Charge`, `Induce`, `Torque`,
`Amplify`, `Sustain`, `React`), all of which compute `modExp64(..., ..., MotzkinPrime)`.

**You do not need to understand the state machine to use AFFECTION™.** The only operation
that matters for minting is `Generate()`.

## How `Generate()` mints Ⓐ

`Generate()` is the public RNG entry point. Tracing the calls:

```solidity
// affection.sol
function Generate() public returns(uint64) {
    Amplify(Mu.Cone, Mu.Upsilon);  // Conjecture.Amplify  -> Torque  (no mint)
    Sustain(Mu.Cone, Mu.Ohm);     // Conjecture.Sustain  -> Torque  (no mint)
    React(Mu.Cone, Mu.Pi, Mu.Cone.Dynamo);   // Conjecture.React -> _mintToCap()  (mint #1)
    React(Mu.Rod, Mu.Pi, Mu.Rod.Dynamo);     // Conjecture.React -> _mintToCap()  (mint #2)
    Mu.Omega = Mu.Omega ^ Mu.Rod.Kappa;
    Mu.Upsilon = Mu.Upsilon ^ Mu.Ohm ^ Mu.Pi;
    _mintToCap();                            //                                                (mint #3)
    return Mu.Upsilon;
}
```

`Conjecture.React()` calls `_mintToCap()` once at its top, and `Generate()` calls `React`
twice plus one final `_mintToCap()`. Therefore:

> **Each `Generate()` call mints exactly 3 Ⓐ to the contract's own balance**
> (while supply is below the 1,111,111,111 cap), and returns a `uint64` derived from the
> `Mu.Upsilon` state register.

This is the property that makes batch minting possible: a batcher can loop `Generate()`
`loops` times — crediting `3 * loops` Ⓐ to the contract — and then call
`BuyWith*(loops * 3)` to drain exactly that amount back out to the user, all within one
transaction (see [`04_multi_mint_contracts.md`](04_multi_mint_contracts.md)).

On‑chain confirmation: `balanceOf(AFFECTION_address)` ≈ 0 (≈4.6e‑11 Ⓐ) — the contract holds
almost no standing buffer; minting is "just‑in‑time" and the buffer is drained by the same
transaction that charges it.

## The `BuyWith*` redeem functions

Each `BuyWith*` takes an intermediate token **from the caller** (via `transferFrom`, so the
caller must `approve` first) and transfers **`amount` Ⓐ from the contract's own balance** to
the caller. The contract's balance is replenished by prior `Generate()` calls.

| Function | Takes (from caller) | Gives (to caller) | Effective rate |
|---|---|---|---|
| `BuyWithG5(amount)`   | `amount / 5`   G5  | `amount` Ⓐ | **1 G5  = 5 Ⓐ**  |
| `BuyWithPI(amount)`   | `amount / 300` PI  | `amount` Ⓐ | **1 PI  = 300 Ⓐ** |
| `BuyWithMATH(amount)` | `amount` MATH       | `amount` Ⓐ | **1 MATH = 1 Ⓐ** |
| `BuyWithFa(amount)`   | `amount * 4`  Fa   | `amount` Ⓐ | **4 Fa  = 1 Ⓐ**  (1 Fa = 0.25 Ⓐ) |
| `BuyWithFaung(amount)`| `amount * 2`  Faung| `amount` Ⓐ | **2 Faung = 1 Ⓐ** (1 Faung = 0.5 Ⓐ) |

> `amount` is in Ⓐ base units (1e18 = 1 Ⓐ). Integer division applies, so `amount` should be
> a multiple of 5 (G5) or 300 (PI) to avoid dust loss.

Because the intermediates are themselves mintable with pDAI/pUSDC at 1:1‑equivalent rates
(see [`03_minting_routes.md`](03_minting_routes.md)), **the effective floor price of 1 Ⓐ is
1 pDAI (≈ 1 pUSDC)** via the G5 / PI / MATH routes.

## Other public functions (state machine)

| Function | Signature | Purpose |
|---|---|---|
| `Alpha` | `(uint64 _a)` | Advance `Mu` via `Charge/Induce/Torque/Amplify/Sustain/React`; mints (calls `React` + `_mintToCap`). |
| `Beta`  | `(uint64 _b)` | Advance `Mu.Rod`/`Mu.Cone`; mints (`_mintToCap`). |
| `Upsilon` | `(uint64 _a, bool Phi)` | Set `Mu.Upsilon = Phi ? _a ^ Mu.Ohm ^ Mu.Pi : _a ^ Mu.Ohm`; mints. |
| `Pi` | `()` | Advance `Mu` (Torque/Amplify/Sustain/React); mints. |
| `Rho` | `()` | Advance `Mu`; mints. |
| `View` | `() view returns (Faung)` | Read the full `Mu` state (the RNG internal state). |
| `MotzkinPrime` | `() view returns (uint64)` | Returns `953467954114363`. |
| `Generate` | `() returns (uint64)` | **The RNG + the primary minting step (3 Ⓐ/call).** |

Standard ERC‑20 (`name`, `symbol`, `decimals`, `totalSupply`, `balanceOf`, `transfer`,
`transferFrom`, `approve`, `allowance`) and ERC20Burnable (`burn`, `burnFrom`) are inherited.
`Ownable` provides `owner()`, `transferOwnership`, `renounceOwnership`.

## Gas note

`Generate()` performs several `modExp64` calls (precompile `0x05`, bigModExp) each call, so
it is noticeably heavier than a plain ERC‑20 mint. This is why batching matters — grouping
many `Generate()` + `BuyWith*` pairs into one transaction amortises the base transaction
overhead and removes the two-transaction sandwich window (see
[`04_multi_mint_contracts.md`](04_multi_mint_contracts.md)).
