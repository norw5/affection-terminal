// SPDX-License-Identifier: MIT
//
// UnifiedAffectionBatcher — the AFF_TERMINAL default batcher (Module C, P5).
//
// Supersedes the six legacy `multi-*.sol` community contracts. The legacy design is
// fragmented per target: `MultiMath` only mints MATH, `MultiAffection` only mints AFFECTION,
// so the canonical pDAI -> MATH -> AFFECTION route is TWO transactions with a sandwich
// window between them. This batcher does the FULL route in ONE transaction:
//
//   pull pStable -> mint intermediate (charge+drain for MATH, direct-mint for G5/PI)
//   -> Generate() x N -> BuyWith* -> return AFFECTION to msg.sender.
//
// Guarantees:
//   - Immutable (no owner, no upgrade, no pause). Constructor sets canonical addresses.
//   - Full-route atomic (no sandwich window between legs).
//   - Cap-aware: clamps `loops` to floor((cap - totalSupply) / 3) so Generate() never no-ops.
//   - Mint-only (no DEX interaction = small audit surface). The opt-in sell variant is
//     AtomicArbBatcher.sol.
//   - Back-compatible `multiBuyWith(address, loops)` for the partial (intermediate-already-held) route.
//   - Defensive `rescue` for non-canonical stuck tokens (sends to msg.sender; canonical tokens locked).
//
// Economics (verified against affection_docs/registry/minting_rates.json + sources):
//   - Generate() mints exactly 3 AFFECTION per call.
//   - perLoop: MATH 3e18, G5 0.6e18, PI 0.01e18 (intermediate base units per 1 Generate loop).
//   - All three clean routes cost exactly 1 pStable per 1 AFFECTION (the hard floor).
//   - pUSDT is intentionally NOT supported (bugged in MATH v1.1).
//   - pUSDC is 6 decimals; only the MATH route accepts it (G5/PI accept pDAI only).
//
// Self-contained: minimal inline interfaces, no external imports (trivial to compile + audit).

pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

interface IAffection {
    function Generate() external returns (uint64);
    function BuyWithG5(uint256 amount) external;
    function BuyWithPI(uint256 amount) external;
    function BuyWithMATH(uint256 amount) external;
}

interface IMath {
    function Random() external returns (uint64);      // mints 1 MATH to the MATH contract (charges buffer)
    function BuyWithDAI(uint256 amount) external;      // drains `amount` MATH to caller, takes `amount` pDAI
    function BuyWithUSDC(uint256 amount) external;     // drains `amount` MATH to caller, takes `amount` pUSDC (6 dec)
}

interface IMintable {                                   // G5 / PI: direct-mint with pDAI, 1 token per call
    function BuyWithDAI() external;
}

contract UnifiedAffectionBatcher {
    // ─── Immutable canonical addresses (constructor-set; default = canonical) ───
    address public immutable AFFECTION;
    address public immutable MATH;
    address public immutable G5;
    address public immutable PI;
    address public immutable PDAI;
    address public immutable PUSDC;

    // ─── Constants (verified on-chain) ───
    uint256 public constant CAP = 1_111_111_111 * 1e18;   // AFFECTION + MATH cap (whole-token base units)
    uint256 public constant AFF_PER_LOOP = 3 * 1e18;        // Generate() mints exactly 3 AFFECTION
    uint256 private constant E18 = 1e18;

    // ─── Per-route config (constructor-set, effectively immutable) ───
    // intermediate -> base units of intermediate needed per 1 Generate() loop.
    mapping(address => uint256) public perLoop;
    // intermediate -> strategy: true = MATH (charge via Random + drain via BuyWithDAI/USDC),
    // false = G5/PI (direct-mint via BuyWithDAI loop).
    mapping(address => bool) public isChargeAndDrain;

    constructor(
        address aff,
        address math,
        address g5,
        address pi,
        address pdai,
        address pusdc
    ) {
        AFFECTION = aff;
        MATH = math;
        G5 = g5;
        PI = pi;
        PDAI = pdai;
        PUSDC = pusdc;

        // One-time max-approvals (set in the constructor so every later mint is approval-free):
        //   pStables -> {MATH, G5, PI}  (so the batcher can pay for the intermediate mint)
        //   intermediates -> AFFECTION  (so AFFECTION can take the intermediate in BuyWith*)
        IERC20(pdai).approve(math, type(uint256).max);
        IERC20(pdai).approve(g5, type(uint256).max);
        IERC20(pdai).approve(pi, type(uint256).max);
        IERC20(pusdc).approve(math, type(uint256).max);
        IERC20(math).approve(aff, type(uint256).max);
        IERC20(g5).approve(aff, type(uint256).max);
        IERC20(pi).approve(aff, type(uint256).max);

        // perLoop + strategy (from affection_docs/registry/minting_rates.json).
        perLoop[math] = 3 * E18;            // 3 MATH per loop -> 3 AFFECTION (1 MATH = 1 AFFECTION)
        isChargeAndDrain[math] = true;
        perLoop[g5] = 6 * 1e17;             // 0.6 G5 per loop -> 3 AFFECTION (1 G5 = 5 AFFECTION)
        isChargeAndDrain[g5] = false;
        perLoop[pi] = 1 * 1e16;             // 0.01 PI per loop -> 3 AFFECTION (1 PI = 300 AFFECTION)
        isChargeAndDrain[pi] = false;
    }

    // ─── Views ───────────────────────────────────────────────────────────────────

    /** Max safe Generate() loops given the current supply (cap-aware clamp). */
    function maxSafeLoops() public view returns (uint256) {
        uint256 supply = IERC20(AFFECTION).totalSupply();
        if (supply >= CAP) return 0;
        return (CAP - supply) / AFF_PER_LOOP;
    }

    // ─── Core internal mint (returns AFFECTION minted, leaves it on this contract) ───

    function _mintToSelf(address stable, address intermediate, uint256 loops) internal returns (uint256 affOut) {
        require(loops > 0, "zero loops");

        uint256 safe = maxSafeLoops();
        uint256 effLoops = loops > safe ? safe : loops;
        require(effLoops > 0, "cap reached");

        affOut = effLoops * AFF_PER_LOOP; // 3 * effLoops AFFECTION (base units)

        uint256 imNeeded = perLoop[intermediate]; // 0 if unknown intermediate
        require(imNeeded > 0, "unknown intermediate");
        imNeeded = imNeeded * effLoops;

        // Direct-mint intermediates (G5/PI) mint 1 whole token per call, so imNeeded must be
        // a whole number of tokens. (For MATH this also holds — Random() mints 1 MATH/call.)
        require(imNeeded % E18 == 0, "loops not multiple of granularity");
        uint256 calls = imNeeded / E18; // whole intermediate tokens to mint/charge

        bool isPUSDC = stable == PUSDC;
        if (isPUSDC) {
            // G5/PI accept pDAI only (BuyWithDAI); only MATH accepts pUSDC (BuyWithUSDC).
            require(intermediate == MATH, "pUSDC only for MATH");
        } else {
            require(stable == PDAI, "unsupported stable");
        }

        // Pull the pStable cost = 3 * effLoops (whole) in the stable's decimals.
        // pDAI (18 dec): cost = affOut (= 3*effLoops * 1e18).  pUSDC (6 dec): cost = affOut / 1e12.
        uint256 stableCost = isPUSDC ? affOut / 1e12 : affOut;
        require(IERC20(stable).transferFrom(msg.sender, address(this), stableCost), "stable pull failed");

        if (isChargeAndDrain[intermediate]) {
            // MATH strategy: Random() x `calls` charges the MATH contract buffer, then
            // BuyWithDAI/USDC(imNeeded) drains `calls` MATH to this batcher.
            IMath m = IMath(intermediate);
            for (uint256 i = 0; i < calls; i++) {
                m.Random();
            }
            if (isPUSDC) {
                m.BuyWithUSDC(imNeeded);
            } else {
                m.BuyWithDAI(imNeeded);
            }
        } else {
            // G5/PI strategy: BuyWithDAI() x `calls` mints `calls` intermediate to this batcher
            // (each call takes 5 pDAI for G5 / 300 pDAI for PI).
            IMintable mk = IMintable(intermediate);
            for (uint256 i = 0; i < calls; i++) {
                mk.BuyWithDAI();
            }
        }

        // Charge the AFFECTION buffer: Generate() x effLoops (mints 3*effLoops AFFECTION to AFFECTION contract).
        IAffection aff = IAffection(AFFECTION);
        for (uint256 i = 0; i < effLoops; i++) {
            aff.Generate();
        }

        // Drain AFFECTION to this batcher via the matching BuyWith* (takes the intermediate,
        // sends `affOut` AFFECTION here). The constructor approved intermediate -> AFFECTION.
        if (intermediate == MATH) {
            aff.BuyWithMATH(affOut);
        } else if (intermediate == G5) {
            aff.BuyWithG5(affOut);
        } else if (intermediate == PI) {
            aff.BuyWithPI(affOut);
        } else {
            revert("unknown intermediate"); // perLoop > 0 check above limits this branch
        }
    }

    // ─── Public entrypoints ───────────────────────────────────────────────────────

    /**
     * Full atomic route: pStable -> intermediate -> AFFECTION, in one transaction.
     * `minOut` is the minimum AFFECTION (base units) the caller will accept — revert on
     * slippage / cap-clamp below it. Returns the AFFECTION minted and sent to msg.sender.
     */
    function mintFromStable(
        address stable,
        address intermediate,
        uint256 loops,
        uint256 minOut
    ) external returns (uint256 affOut) {
        affOut = _mintToSelf(stable, intermediate, loops);
        require(affOut >= minOut, "minOut not met");
        require(IERC20(AFFECTION).transfer(msg.sender, affOut), "AFFECTION transfer failed");
    }

    /**
     * Back-compatible partial route (legacy `MultiAffection.multiBuyWith` shape): the caller
     * already holds the intermediate token. Pulls it, runs Generate() x loops + BuyWith*,
     * and sends `loops * 3` AFFECTION to msg.sender. Cap-aware. Useful when the user minted
     * the intermediate separately and only wants the AFFECTION leg atomic.
     */
    function multiBuyWith(address intermediate, uint256 loops) external returns (uint256 affOut) {
        require(loops > 0, "zero loops");
        uint256 safe = maxSafeLoops();
        uint256 effLoops = loops > safe ? safe : loops;
        require(effLoops > 0, "cap reached");
        affOut = effLoops * AFF_PER_LOOP;
        uint256 imNeeded = perLoop[intermediate];
        require(imNeeded > 0, "unknown intermediate");
        imNeeded = imNeeded * effLoops;
        require(imNeeded % E18 == 0, "loops not multiple of granularity");

        // Pull the intermediate from the caller (caller must have approved this batcher).
        require(IERC20(intermediate).transferFrom(msg.sender, address(this), imNeeded), "intermediate pull failed");

        IAffection aff = IAffection(AFFECTION);
        for (uint256 i = 0; i < effLoops; i++) {
            aff.Generate();
        }
        if (intermediate == MATH) {
            aff.BuyWithMATH(affOut);
        } else if (intermediate == G5) {
            aff.BuyWithG5(affOut);
        } else if (intermediate == PI) {
            aff.BuyWithPI(affOut);
        } else {
            revert("unknown intermediate");
        }
        require(IERC20(AFFECTION).transfer(msg.sender, affOut), "AFFECTION transfer failed");
    }

    // ─── Defensive rescue (ownerless recovery) ────────────────────────────────────
    //
    // Sends the full balance of a NON-canonical token to msg.sender. Canonical tokens
    // (AFFECTION, MATH, G5, PI, pDAI, pUSDC) are locked — the batcher is just-in-time and
    // never holds a standing balance of them between transactions, but locking them protects
    // the flow mid-transaction. Anyone may call this: for a token the batcher has no claim
    // on, "first to recover" is the only ownerless option.
    function rescue(address token) external {
        require(
            token != AFFECTION && token != MATH && token != G5 && token != PI && token != PDAI && token != PUSDC,
            "canonical locked"
        );
        uint256 bal = IERC20(token).balanceOf(address(this));
        require(IERC20(token).transfer(msg.sender, bal), "rescue transfer failed");
    }
}
