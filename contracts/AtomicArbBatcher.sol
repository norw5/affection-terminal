// SPDX-License-Identifier: MIT
//
// AtomicArbBatcher — the opt-in mint+sell variant (Module C, P5).
//
// Extends UnifiedAffectionBatcher with a final PulseX V2 swap leg, so mint + sell happen
// in ONE transaction (defeats sell-side sniping too). The trade-off: the sell leg adds a
// DEX-interaction audit surface (the PulseX router). The deployment wizard defaults to the
// mint-only UnifiedAffectionBatcher and clearly flags this variant as advanced/opt-in.
//
// `mintAndSwap(stable, intermediate, loops, minAffOut, path[], amountOutMin, deadline)`:
//   1. mint AFFECTION to this contract (reuses the verified _mintToSelf),
//   2. swap the minted AFFECTION along `path` via the PulseX V2 router,
//   3. send the swap proceeds (a pStable) to msg.sender.
//
// The router address is a constructor param (the wizard surfaces it for user verification;
// PulseX V2 router is a known UniswapV2 fork). The batcher approves AFFECTION -> router once
// in the constructor. Everything else is inherited (immutable, cap-aware, ownerless, rescue).
//
// RISK NOTICE (shown in the wizard): the sell leg interacts with the PulseX router, which is
// outside the AFFECTION/MATH contract set. Review the router + path before signing. If you do
// not want DEX interaction, use the mint-only UnifiedAffectionBatcher instead.

pragma solidity ^0.8.24;

import "./UnifiedAffectionBatcher.sol";

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract AtomicArbBatcher is UnifiedAffectionBatcher {
    address public immutable ROUTER;

    constructor(
        address aff,
        address math,
        address g5,
        address pi,
        address pdai,
        address pusdc,
        address router
    ) UnifiedAffectionBatcher(aff, math, g5, pi, pdai, pusdc) {
        ROUTER = router;
        // One-time approval: AFFECTION -> router (so the swap leg can move the minted Ⓐ).
        IERC20(AFFECTION).approve(router, type(uint256).max);
    }

    /**
     * Mint AFFECTION then swap it via the PulseX V2 router, all atomically.
     * `path` must start with AFFECTION and end with the token you want to receive
     * (e.g. [AFFECTION, WPLS, pDAI]). `amountOutMin` protects against swap slippage;
     * `minAffOut` protects against the mint being cap-clamped below expectations.
     * Returns the AFFECTION minted (the swap proceeds go straight to msg.sender).
     */
    function mintAndSwap(
        address stable,
        address intermediate,
        uint256 loops,
        uint256 minAffOut,
        address[] calldata path,
        uint256 amountOutMin,
        uint256 deadline
    ) external returns (uint256 affOut) {
        affOut = _mintToSelf(stable, intermediate, loops);
        require(affOut >= minAffOut, "minAffOut not met");

        require(path.length >= 2, "path too short");
        require(path[0] == AFFECTION, "path must start with AFFECTION");

        // Swap the minted AFFECTION. The router pulls Ⓐ (approved in the constructor) and
        // sends the proceeds to msg.sender.
        IUniswapV2Router(ROUTER).swapExactTokensForTokens(
            affOut,
            amountOutMin,
            path,
            msg.sender,
            deadline
        );
        // No final AFFECTION transfer here — the AFFECTION was consumed by the swap.
    }
}
