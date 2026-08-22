// Pure UniswapV2 constant-product math for the route map (Module D). No React/viem deps —
// fully unit-tested. The constant-product formula: x * y = k. With the 0.3% fee (tier-1
// accurate): amountOut = amountIn * 997 * reserveOut / (reserveIn * 1000 + amountIn * 997).
//
// For the route map we compute:
//   - spot price (reserveOut / reserveIn) — the marginal price at zero size
//   - amountOut(amountIn, reserveIn, reserveOut) — the actual output for a given input
//   - liquidity value (in quote token terms) — reserveQuote * 2 (both sides)

/** Spot price: how much `reserveOut` you get per 1 unit of `reserveIn` (same decimals). */
export function spotPrice(reserveIn: bigint, reserveOut: bigint): bigint {
  if (reserveIn === 0n) return 0n;
  return (reserveOut * 10n ** 18n) / reserveIn;
}

/**
 * UniswapV2 getAmountOut: the exact output for `amountIn` given reserves, accounting for
 * the 0.3% swap fee (997/1000).
 */
export function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (reserveIn === 0n || reserveOut === 0n) return 0n;
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

/**
 * Multi-hop getAmountsOut: given a path [token0, token1, …tokenN] and the reserves at each
 * hop, compute the final output. `reserves` is a list of [reserveIn, reserveOut] per hop.
 */
export function getAmountsOut(amountIn: bigint, reserves: Array<[bigint, bigint]>): bigint {
  let amount = amountIn;
  for (const [reserveIn, reserveOut] of reserves) {
    amount = getAmountOut(amount, reserveIn, reserveOut);
  }
  return amount;
}

/**
 * Effective price for `amountIn`: amountOut / amountIn (in base units, scaled to 1e18 for
 * precision). Degrades to spotPrice at amountIn → 0.
 */
export function effectivePrice(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn === 0n) return spotPrice(reserveIn, reserveOut);
  const out = getAmountOut(amountIn, reserveIn, reserveOut);
  return (out * 10n ** 18n) / amountIn;
}

/**
 * Slippage for `amountIn` vs the spot price, in basis points (0..10000).
 *   slippageBps = (spotPrice − effectivePrice) / spotPrice * 10000
 */
export function slippageBps(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (reserveIn === 0n) return 0n;
  const spot = spotPrice(reserveIn, reserveOut);
  if (spot === 0n) return 0n;
  const eff = effectivePrice(amountIn, reserveIn, reserveOut);
  return ((spot - eff) * 10000n) / spot;
}
