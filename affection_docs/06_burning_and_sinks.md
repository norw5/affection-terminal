# 6 · Burning Ⓐ & Supply Sinks

AFFECTION™ has two supply sinks: **explicit burns** (Ⓐ sent to burn addresses or removed
via `burn()`), and — more importantly for the ecosystem's economics — **sinks built into
other Dysnomia contracts** that pull Ⓐ in when they are used. Together they are the demand
side that offsets the mint supply.

## How the ecosystem absorbs Ⓐ (mechanism)

The Dysnomia token family is built on a shared base contract (`DYSNOMIA`) whose constructor
registers AFFECTION™ at a fixed market rate — 1:1 — and exposes:

```solidity
AddMarketRate(AFFECTIONContract, 1 * 10 ** decimals());   // Ⓐ priced 1:1 in the base

function Purchase(address _t, uint256 _a) public {
    uint256 cost = (_a * _marketRates[_t]) / (10 ** decimals());
    BuyToken.transferFrom(msg.sender, address(this), cost);   // take the priced input (Ⓐ)
    transfer(msg.sender, _a);                                  // send this token out
}
```

Buying one of these tokens with Ⓐ pulls the Ⓐ into that token's contract, where it is
either **held** (a soft sink — locked in the contract's balance) or, for tokens that
implement burning, **permanently removed**. Whether a given contract burns or merely holds
its Ⓐ is visible in its own verified source — treat "held" and "burned" as distinct: only
the second reduces `totalSupply()`.

Two properties of this family are worth knowing:

- **Supply caps are drawn from the RNG.** Each token's `maxSupply` is set from
  `Xiao.Random() % 111111` at deployment, and `_mintToCap()` mints to the contract's own
  balance one token at a time — the same charge-and-drain shape AFFECTION™ itself uses.
- **The family is large and factory-grown.** The ecosystem includes a long tail of these
  tokens (the "Qing" family and its CHATLOG/Dysnomia-named relatives), many deployed
  through factory contracts, each independently priced against Ⓐ and other market-rate
  tokens. This long tail — not any single contract — is the aggregate sink.

> The wider Atropa codebase also contains a treasury-minter family
> (bureau/federal/index/personal minters) that issues treasury-style tokens priced
> against a parent token. That is a separate mechanism and is not an AFFECTION™ sink;
> the Ⓐ sinks are the market-rate Purchase flow above, plus direct burns.

## Burns proper (what actually reduces supply)

Two on-chain actions permanently remove Ⓐ:

1. **`ERC20Burnable.burn()` / `burnFrom()`** — reduces `totalSupply()` and emits a
   `Transfer(from, 0x0, amount)` event.
2. **Transfers to burn addresses** — Ⓐ sent to `0x000…dEaD`, the zero address, or the
   PulseChain community burn address `0x000…0369` is unrecoverable in practice. This does
   *not* reduce `totalSupply()` (the tokens are held, not destroyed) but removes them from
   circulation all the same.

Both are visible in the Ⓐ contract's `Transfer` log events, which is the only trustworthy
way to compute burned amounts — any static figure goes stale the moment another burn
happens.

## Tracking it live (this portal)

The `/metrics` page computes everything from live chain reads, never from static lists:

- **Burn scan** — indexes Ⓐ `Transfer(…, burnAddr)` log events over a chosen window
  (24h / 7d / 30d / max) across all three burn addresses, with per-chunk progress. This
  catches both `burn()`-style events and transfers to dead addresses.
- **Burner balances** — reads `balanceOf(AFFECTION)` on a set of known sink contracts
  (the market-rate holders described above). A live balance is a *verifiable* claim —
  "this contract holds N Ⓐ right now" — regardless of how the list of tracked addresses
  was assembled. Held ≠ burned: a contract's balance can only be counted as permanently
  removed if its source actually burns.
- **Supply headroom** — `totalSupply()` vs the 1,111,111,111 cap for every capped
  ecosystem token, so the net effect of minting vs burning is directly visible.

To verify any burner yourself: read `balanceOf` on the Ⓐ contract for that address (held),
and scan Ⓐ `Transfer` logs with that address as the `to` topic (inflow) or `from` topic
(outflow/burn).
