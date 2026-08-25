// Verified on PulseChain Blockscout: RNG at (unknown)
// is_verified: true, is_fully_verified: false
// compiler: v0.8.21+commit.d9974bed
// Retrieved: 2026-08-25


// File: @openzeppelin/contracts/token/ERC20/IERC20.sol


// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/IERC20.sol)

pragma solidity ^0.8.20;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the value of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the value of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 value) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the
     * allowance mechanism. `value` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

// File: @openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol


// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/extensions/IERC20Metadata.sol)

pragma solidity ^0.8.20;


/**
 * @dev Interface for the optional metadata functions from the ERC20 standard.
 */
interface IERC20Metadata is IERC20 {
    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() external view returns (uint8);
}

// File: @openzeppelin/contracts/utils/Context.sol


// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// File: @openzeppelin/contracts/interfaces/draft-IERC6093.sol


// OpenZeppelin Contracts (last updated v5.0.0) (interfaces/draft-IERC6093.sol)
pragma solidity ^0.8.20;

/**
 * @dev Standard ERC20 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC20 tokens.
 */
interface IERC20Errors {
    /**
     * @dev Indicates an error related to the current `balance` of a `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param balance Current balance for the interacting account.
     * @param needed Minimum amount required to perform a transfer.
     */
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC20InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC20InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `spender`’s `allowance`. Used in transfers.
     * @param spender Address that may be allowed to operate on tokens without being their owner.
     * @param allowance Amount of tokens a `spender` is allowed to operate with.
     * @param needed Minimum amount required to perform a transfer.
     */
    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC20InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `spender` to be approved. Used in approvals.
     * @param spender Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC20InvalidSpender(address spender);
}

/**
 * @dev Standard ERC721 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC721 tokens.
 */
interface IERC721Errors {
    /**
     * @dev Indicates that an address can't be an owner. For example, `address(0)` is a forbidden owner in EIP-20.
     * Used in balance queries.
     * @param owner Address of the current owner of a token.
     */
    error ERC721InvalidOwner(address owner);

    /**
     * @dev Indicates a `tokenId` whose `owner` is the zero address.
     * @param tokenId Identifier number of a token.
     */
    error ERC721NonexistentToken(uint256 tokenId);

    /**
     * @dev Indicates an error related to the ownership over a particular token. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param tokenId Identifier number of a token.
     * @param owner Address of the current owner of a token.
     */
    error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC721InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC721InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     * @param tokenId Identifier number of a token.
     */
    error ERC721InsufficientApproval(address operator, uint256 tokenId);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC721InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `operator` to be approved. Used in approvals.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC721InvalidOperator(address operator);
}

/**
 * @dev Standard ERC1155 Errors
 * Interface of the https://eips.ethereum.org/EIPS/eip-6093[ERC-6093] custom errors for ERC1155 tokens.
 */
interface IERC1155Errors {
    /**
     * @dev Indicates an error related to the current `balance` of a `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     * @param balance Current balance for the interacting account.
     * @param needed Minimum amount required to perform a transfer.
     * @param tokenId Identifier number of a token.
     */
    error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId);

    /**
     * @dev Indicates a failure with the token `sender`. Used in transfers.
     * @param sender Address whose tokens are being transferred.
     */
    error ERC1155InvalidSender(address sender);

    /**
     * @dev Indicates a failure with the token `receiver`. Used in transfers.
     * @param receiver Address to which tokens are being transferred.
     */
    error ERC1155InvalidReceiver(address receiver);

    /**
     * @dev Indicates a failure with the `operator`’s approval. Used in transfers.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     * @param owner Address of the current owner of a token.
     */
    error ERC1155MissingApprovalForAll(address operator, address owner);

    /**
     * @dev Indicates a failure with the `approver` of a token to be approved. Used in approvals.
     * @param approver Address initiating an approval operation.
     */
    error ERC1155InvalidApprover(address approver);

    /**
     * @dev Indicates a failure with the `operator` to be approved. Used in approvals.
     * @param operator Address that may be allowed to operate on tokens without being their owner.
     */
    error ERC1155InvalidOperator(address operator);

    /**
     * @dev Indicates an array length mismatch between ids and values in a safeBatchTransferFrom operation.
     * Used in batch transfers.
     * @param idsLength Length of the array of token identifiers
     * @param valuesLength Length of the array of token amounts
     */
    error ERC1155InvalidArrayLength(uint256 idsLength, uint256 valuesLength);
}

// File: @openzeppelin/contracts/token/ERC20/ERC20.sol


// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.20;





/**
 * @dev Implementation of the {IERC20} interface.
 *
 * This implementation is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using {_mint}.
 *
 * TIP: For a detailed writeup see our guide
 * https://forum.openzeppelin.com/t/how-to-implement-erc20-supply-mechanisms/226[How
 * to implement supply mechanisms].
 *
 * The default value of {decimals} is 18. To change this, you should override
 * this function so it returns a different value.
 *
 * We have followed general OpenZeppelin Contracts guidelines: functions revert
 * instead returning `false` on failure. This behavior is nonetheless
 * conventional and does not conflict with the expectations of ERC20
 * applications.
 *
 * Additionally, an {Approval} event is emitted on calls to {transferFrom}.
 * This allows applications to reconstruct the allowance for all accounts just
 * by listening to said events. Other implementations of the EIP may not emit
 * these events, as it isn't required by the specification.
 */
abstract contract ERC20 is Context, IERC20, IERC20Metadata, IERC20Errors {
    mapping(address account => uint256) private _balances;

    mapping(address account => mapping(address spender => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;

    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * All two of these values are immutable: they can only be set once during
     * construction.
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5.05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the default value returned by this function, unless
     * it's overridden.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view virtual returns (uint8) {
        return 18;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view virtual returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account) public view virtual returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `value`.
     */
    function transfer(address to, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, value);
        return true;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * NOTE: If `value` is the maximum `uint256`, the allowance is not updated on
     * `transferFrom`. This is semantically equivalent to an infinite approval.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 value) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, value);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20}.
     *
     * NOTE: Does not update the allowance if the current allowance
     * is the maximum `uint256`.
     *
     * Requirements:
     *
     * - `from` and `to` cannot be the zero address.
     * - `from` must have a balance of at least `value`.
     * - the caller must have allowance for ``from``'s tokens of at least
     * `value`.
     */
    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _transfer(from, to, value);
        return true;
    }

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to`.
     *
     * This internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead.
     */
    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(from, to, value);
    }

    /**
     * @dev Transfers a `value` amount of tokens from `from` to `to`, or alternatively mints (or burns) if `from`
     * (or `to`) is the zero address. All customizations to transfers, mints, and burns should be done by overriding
     * this function.
     *
     * Emits a {Transfer} event.
     */
    function _update(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) {
            // Overflow check required: The rest of the code assumes that totalSupply never overflows
            _totalSupply += value;
        } else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) {
                revert ERC20InsufficientBalance(from, fromBalance, value);
            }
            unchecked {
                // Overflow not possible: value <= fromBalance <= totalSupply.
                _balances[from] = fromBalance - value;
            }
        }

        if (to == address(0)) {
            unchecked {
                // Overflow not possible: value <= totalSupply or value <= fromBalance <= totalSupply.
                _totalSupply -= value;
            }
        } else {
            unchecked {
                // Overflow not possible: balance + value is at most totalSupply, which we know fits into a uint256.
                _balances[to] += value;
            }
        }

        emit Transfer(from, to, value);
    }

    /**
     * @dev Creates a `value` amount of tokens and assigns them to `account`, by transferring it from address(0).
     * Relies on the `_update` mechanism
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead.
     */
    function _mint(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _update(address(0), account, value);
    }

    /**
     * @dev Destroys a `value` amount of tokens from `account`, lowering the total supply.
     * Relies on the `_update` mechanism.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * NOTE: This function is not virtual, {_update} should be overridden instead
     */
    function _burn(address account, uint256 value) internal {
        if (account == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        _update(account, address(0), value);
    }

    /**
     * @dev Sets `value` as the allowance of `spender` over the `owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     *
     * Overrides to this logic should be done to the variant with an additional `bool emitEvent` argument.
     */
    function _approve(address owner, address spender, uint256 value) internal {
        _approve(owner, spender, value, true);
    }

    /**
     * @dev Variant of {_approve} with an optional flag to enable or disable the {Approval} event.
     *
     * By default (when calling {_approve}) the flag is set to true. On the other hand, approval changes made by
     * `_spendAllowance` during the `transferFrom` operation set the flag to false. This saves gas by not emitting any
     * `Approval` event during `transferFrom` operations.
     *
     * Anyone who wishes to continue emitting `Approval` events on the`transferFrom` operation can force the flag to
     * true using the following override:
     * ```
     * function _approve(address owner, address spender, uint256 value, bool) internal virtual override {
     *     super._approve(owner, spender, value, true);
     * }
     * ```
     *
     * Requirements are the same as {_approve}.
     */
    function _approve(address owner, address spender, uint256 value, bool emitEvent) internal virtual {
        if (owner == address(0)) {
            revert ERC20InvalidApprover(address(0));
        }
        if (spender == address(0)) {
            revert ERC20InvalidSpender(address(0));
        }
        _allowances[owner][spender] = value;
        if (emitEvent) {
            emit Approval(owner, spender, value);
        }
    }

    /**
     * @dev Updates `owner` s allowance for `spender` based on spent `value`.
     *
     * Does not update the allowance value in case of infinite allowance.
     * Revert if not enough allowance is available.
     *
     * Does not emit an {Approval} event.
     */
    function _spendAllowance(address owner, address spender, uint256 value) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < value) {
                revert ERC20InsufficientAllowance(spender, currentAllowance, value);
            }
            unchecked {
                _approve(owner, spender, currentAllowance - value, false);
            }
        }
    }
}

// File: @openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol


// OpenZeppelin Contracts (last updated v5.0.0) (token/ERC20/extensions/ERC20Burnable.sol)

pragma solidity ^0.8.20;



/**
 * @dev Extension of {ERC20} that allows token holders to destroy both their own
 * tokens and those that they have an allowance for, in a way that can be
 * recognized off-chain (via event analysis).
 */
abstract contract ERC20Burnable is Context, ERC20 {
    /**
     * @dev Destroys a `value` amount of tokens from the caller.
     *
     * See {ERC20-_burn}.
     */
    function burn(uint256 value) public virtual {
        _burn(_msgSender(), value);
    }

    /**
     * @dev Destroys a `value` amount of tokens from `account`, deducting from
     * the caller's allowance.
     *
     * See {ERC20-_burn} and {ERC20-allowance}.
     *
     * Requirements:
     *
     * - the caller must have allowance for ``accounts``'s tokens of at least
     * `value`.
     */
    function burnFrom(address account, uint256 value) public virtual {
        _spendAllowance(account, _msgSender(), value);
        _burn(account, value);
    }
}

// File: @openzeppelin/contracts/access/Ownable.sol


// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;


/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// File: addresses.sol


pragma solidity ^0.8.21;

address constant dead = address(0x000000000000000000000000000000000000dEaD);
address constant atropa = address(0x7a20189B297343CF26d8548764b04891f37F3414);
address constant trebizond = address(0x903030f7e2d6489F38B0f4F96F9b371ec7960F78);

address constant dai = address(0x6B175474E89094C44Da98b954EedeAC495271d0F);
address constant usdc = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
address constant usdt = address(0xdAC17F958D2ee523a2206206994597C13D831ec7);

address constant AtropaContract = address(0xCc78A0acDF847A2C1714D2A925bB4477df5d48a6);
address constant EasternLightningContract = address(0xCD6159D0a1aaE415E0c1504E90A5d741A28afc98);
address constant FinalContract = address(0x50E72874dCd7C198d370ac27c7B3cce9f9a0defd);
address constant KaContract = address(0x83a918056aB9316837Dc48a216119D679D561d91);
address constant BuckinghamContract = address(0xe5d3A6e88590fc2A8037D9CCbd816C05B1ff5f11);
address constant WheelContract = address(0xb9A44De20f26a027e467CB6c2F98766F01904189);
address constant LibertyContract = address(0xFE9b99eCC43cb423408b975cc5ff439e5ABaCb61);
address constant CherokeeContract = address(0xb4C1248812dAbF72cb2e82175b4c0aCffE4D2b10);
address constant DreidelContract = address(0x8A03b032c5494219B212e5a74A49e2aa7F9d206F);
address constant MantissaContract = address(0x0EB4EE7d5Ff28cbF68565A174f7E5e186c36B4b3);
address constant NeptuneContract = address(0x9A3796Cf41B7CbA6921fd50c3f5204ED6506C3e7);
address constant HarContract = address(0x557F7e30aA6D909Cfe8a229A4CB178ab186EC622);         // ʁ 
address constant ThetaContract = address(0xCd19062a6d3019b02A676D72e51D8de7A398dE25);       // Ө
address constant CROWSContract = address(0x203e366A1821570b2f84Ff5ae8B3BdeB48Dc4fa1);
address constant MonatsContract = address(0xf8AB3393b1f5CD6184Fb6800A1fC802043C4063e);
address constant LegalContract = address(0x0b1307dc5D90a0B60Be18D2634843343eBc098AF);
address constant ScissorsContract = address(0x1b8F9E19360D1dc94295D984b7Ca7eA9b810D9ee);
address constant ReadingContract = address(0xf69e9f943674027Cedf05564A8D5A01041d07c62);     // পঁদাে়নুিং
address constant DiContract = address(0x347BC40503E0CE23fE0F5587F232Cd2D07D4Eb89);          // 第作
address constant dOWNContract = address(0x2556F7f8d82EbcdD7b821b0981C38D9dA9439CdD);
address constant STAYContract = address(0x7674516ad438dd67A057fBc1119168d9A7d2a9B1);
address constant INDEPENDENCEContract = address(0x8B090509eAe0fEB4A0B934de1b4345161fA9a62d);
address constant LOLContract = address(0xA63F8061A67ecdbf147Cd1B60f91Cf95464E868D);         // ލ
address constant Bullion5Contract = address(0x77Bed67181CeF592472bcb7F97736c560340E006);
address constant Bullion8Contract = address(0x2959221675bdF0e59D0cC3dE834a998FA5fFb9F4);    // ⑧
address constant TreasuryBillContract = address(0x463413c579D29c26D59a65312657DFCe30D545A1);
address constant TeddyBearContract = address(0xd6c31bA0754C4383A41c0e9DF042C62b5e918f6d);
address constant PoppyContract = address(0xdE65090088Df0b2d80A5eC6A7B56ECE36ee83ce8);
address constant OjeonContract = address(0xFa4d9C6E012d946853386113ACbF166deC5465Bb);
address constant YuContract = address(0x52a4682880E990ebed5309764C7BD29c4aE22deB);          // 유
address constant YingContract = address(0x271197EFe41073681577CdbBFD6Ee1DA259BAa3c);        // 籯
address constant MetisContract = address(0x36d4Ac3DF7Bf8aa3843Ad40C8b3eB67e3d18b4e1);       // ไมิติซส์
address constant GaiContract = address(0xd6077A029Fb5BEF33b02391D7f0349c345F6DDb1);
address constant DiscoContract = address(0xb6936B8e82626405f6E601D54a8292881D86b47D);
address constant HOSTContract = address(0x1162104a7b8766784153Dd2D6aC0eCEAecD28117);
address constant DampfContract = address(0x08Fe5c72173044314A74705089d014a4416Ed71D);
address constant DEIContract = address(0xF77c946C18A77B5DdA5e839dA9818C4D1f087393);
address constant TlingitContract = address(0x54D88F0c4a738247DadF160923E1b1C5dc4F510f);
address constant AbUrbeConditaContract = address(0x7FB09EE1a2c0E8b6D1c4E19C0248B3CbC0113af6);
address constant SIMContract = address(0xBb341FD5C855c206f5538cc649f90d84Df19b65a);
address constant BinContract = address(0xf520404CF4fa5B633626333775b05F5dF94E1a9C);
address constant PhDContract = address(0x6236073377AC7e0aB694957dA5d7d4241e72EBc6);
address constant LilliesContract = address(0xE949a217809d1Fab4018E22d6810500399951dAE);
address constant KremlinContract = address(0x7F51FdB20246D7a673036f11C743E99A4AF01de0);
address constant TwoContract = address(0xDf6A16689A893095C721542e5d3CE55bBcc23aC6);         // ㉣
address constant TseContract = address(0x3d67511733d976800467119264C3d4Cd9FA23041);
address constant FrockContract = address(0x8B8b26bB6C5fD4867339ab2f0acf3aE5129BD2F0);
address constant QingDaoContract = address(0xE63191967735C52f5de78CE2471759a9963Ce118);
address constant TSFiContract = address(0x4243568Fa2bbad327ee36e06c16824cAd8B37819);
address constant GreenlandContract = address(0xdE4Ef7Ea464c7771803b9838AeA07cE41089b054);
address constant BuddhaghosaContract = address(0x840CBD20A70774BECAc4e932Fff6fb1f5417997F);
address constant ZuoContract = address(0x583d1C1427308f7f96BFd3E0d7A3F9674D8BF8ec);
address constant HegelBetContract = address(0x51C36aA04ffC2139F6d34436d0EDC7f5ffc6D6Fb);
address constant HahnarchContract = address(0x4a458D04909a42F79d31805762B2abc38ab9407d);
address constant RabContract = address(0x89E8cD6306AbbAB8e39eeD0D53566d8dC2E02c01);
address constant LoanContract = address(0xeE67825eF27588FAeE39cfefb465eB0A242A740c);
address constant FreebiesContract = address(0x48F628c079353ECC4DB75F0d05de9299e083f3C2);

address constant WMContract = address(0xA1BEe1daE9Af77dAC73aA0459eD63b4D93fC6d29);
address constant IRCContract = address(0xD64f26Bcf78df919D587b6743fcFf5b155815bd6);
address constant NoContract = address(0x1942Ba1EA7c21a070D70C4eFe64B21694283F23e);
address constant CallContract = address(0xD4FD96BA83d3E6FF1A0Baa44c32Def94e641D97c);        // 𐌎

address constant TeddyBear9Contract = address(0x1f737F7994811fE994Fe72957C374e5cD5D5418A);

address constant BondContract = address(0x25d53961a27791B9D8b2d74FB3e937c8EAEadc38);
address constant BailContract = address(0x8B16115fF716b4c52706122cb4e974f7a72E5Af1);
address constant WritingContract = address(0x26D5906c4Cdf8C9F09CBd94049f99deaa874fB0b);
address constant SukukContract = address(0x72f96a39AC9408b5458E5597BBC22060552dedF4);

// address constant FAContract = address(0xF2be09EB43c1eD2791d0324BaA0649e62CdA4BBF);
address constant hhFaContract = address(0xa28e8aA4d6257157de64a547c90B38C3c540eF72);
address constant NoNukesContract = address(0x174A0ad99c60c20D9B3D94c3095BC1fb9ddEFd62);
address constant WenTiContract = address(0xA537d6F4c1c8F8C41f1004cc34C00e7Db40179Cc);
address constant TwoCentClubContract = address(0x6293373BF0DAE2050641973D49b7b2f71adC91a1);
address constant BFFContract = address(0xE35A842eb1EDca4C710B6c1B1565cE7df13f5996);
address constant SECURITYContract = address(0x2234da59c2D5EDB197594C95dbbA7a99Bcd91230);
//
address constant TRSIContract = address(0x51A7aaBcCa69B3c0F82b3b9ce5104FDe3efAecE6);
address constant BELContract = address(0x4C1518286E1b8D5669Fe965EF174B8B4Ae2f017B);
address constant KLANContract = address(0xC196247AA267Db0DF216d5385bCD23e5cf25EA6A);
address constant SMGContract = address(0xa8e8412d9B4341239269cBA38ad949fE4870be34);
address constant iCEContract = address(0x2fA079d2dAA29Ec8925484F9E9021e9191fE4aE4);
address constant PWAContract = address(0x5d4cb28eA61125a1fD3c927162C6F1969DD26788);
address constant LITContract = address(0xf5E3Cc8d22B10d967bE49FE103e496F449C8604E);
address constant RZRContract = address(0x50e40e8555AaB6b9c6CFF691E14070b6F38142Cb);
address constant FLTContract = address(0x86F0985Cd6Ab3196ea8DceBa87B92a2e22124633);
address constant GokuldhamContract = address(0x920401FDce49Fc70A2D4cD70DB0dD90212a97f98);
address constant KPOPContract = address(0x982B52a54916B899c60031772cc85b041613510E);
address constant CiAContract = address(0x2e5898b2e107a3cAf4f0597aCFE5D2e6d73F2196);
address constant ACiDContract = address(0xf8b6e89b851e03c724aad1F5170230A60490b819);
address constant MaltaContract = address(0xee62EE9A354E55dF7C39209B4304161369333fF7);
address constant ZzkContract = address(0xe2e1a5d691cCB9E88b84e23A1166B4e6Bd6904Dc);
address constant ACABContract = address(0x241DA2613b0A01C2f60acB636b21A8E082E2f2F0);

//
address constant BillBurrContract = address(0xF7ebb9bc80fb6395373c6BbDF690fcFfb217a691);

//
address constant BonusContract = address(0xB8FaCE58CB05C55BBBA9c564A550cc2402A40b5b);

///
address constant LEPROSYContract = address(0x7759A6D283192ef2BA082923d28Bec6eBfAf9D68);

// royalty tokens
/*
0xC6F085DE4f388a48ce2942857455147A37870086
0x80C105217885707BA0003ffAe7Ab01466E5E8488
0xF2563864C22022deb03ce929c26C54033a69E9d5
0xA78feD26D175b4B2c83F69Ca3eA195123ca30381
0xdF606c14351fd52bF502d5F60D105320CF5D99D5
0xa9353a16cA53a2009fEBF62029F8555216588Fea
0x7ec9043c321A8759Ee5F917Da943979EC70Cf8e3
*/

//
address constant PIContract = address(0xA2262D7728C689526693aE893D0fD8a352C7073C);
address constant G5Contract = address(0x2fc636E7fDF9f3E8d61033103052079781a6e7D2);
// File: atropamath.sol


pragma solidity ^0.8.21;

library atropaMath {
    uint64 constant MotzkinPrime = 953467954114363;

    struct bar {
        address[] a;
    }
    
    function hashWith(address a, address b) public pure returns (uint256 hash) {        
        hash = 0;
        uint160 _a = uint160(a);
        uint160 _b = uint160(b) / 15;
        unchecked {
            while(hash == 0) {
                hash = (_a**_b)%MotzkinPrime;
                _b = _b/2;
            }
        }
        //return modExp(uint256(uint160(a)), uint256(uint160(b)), MotzkinPrime);
    }

    function modExp64(uint64 _b, uint64 _e, uint64 _m) public returns(uint64 result) {
        uint256 B = _b;
        uint256 E = _e;
        uint256 M = _m;
        uint64 R = uint64(modExp(B, E, M) % 18446744073709551615);
        return R;
    }

    function modExp(uint256 _b, uint256 _e, uint256 _m) public returns (uint256 result) {
        assembly {
            // Free memory pointer
            let pointer := mload(0x40)

            // Define length of base, exponent and modulus. 0x20 == 32 bytes
            mstore(pointer, 0x20)
            mstore(add(pointer, 0x20), 0x20)
            mstore(add(pointer, 0x40), 0x20)

            // Define variables base, exponent and modulus
            mstore(add(pointer, 0x60), _b)
            mstore(add(pointer, 0x80), _e)
            mstore(add(pointer, 0xa0), _m)

            // Store the result
            let value := mload(0xc0)

            // Call the precompiled contract 0x05 = bigModExp
            if iszero(call(not(0), 0x05, 0, pointer, 0xc0, value, 0x20)) {
                revert(0, 0)
            }

            result := mload(value)
        }
    }
}
// File: fa.sol


pragma solidity ^0.8.21;


library Conjecture {
    struct Fa {
        uint64 Base;
        uint64 Secret;
        uint64 Signal;
        uint64 Channel;
        uint64 Pole;
        uint64 Identity;
        uint64 Foundation;
        uint64 Element;
        uint64 Dynamo;
        uint64 Manifold;
        uint64 Ring;
        uint64 Barn;
        uint64 Coordinate;

        uint64 Tau;
        uint64 Eta;
        uint64 Kappa;
//        uint64 Rho;
//        uint64 Beta;
//        uint64 Phi;
        uint64 Alpha;

        uint8 Nu;        
    }

    function New(uint64 base, uint64 secret, uint64 signal) public returns(Fa memory) {
        Fa memory ee;
        ee.Tau = 0;
        Initialize(ee);
        Seed(ee, base, secret, signal);
        Tune(ee);
        return ee;
    }

    function Initialize(Fa memory ee) internal pure {
        ee.Base = ee.Secret = ee.Signal = ee.Channel = ee.Pole = 0;
        ee.Identity = ee.Foundation = ee.Element = 0;
        ee.Dynamo = 0;
        ee.Manifold = 0;
        ee.Ring = 0;
        ee.Barn = ee.Ring;
        ee.Eta = ee.Kappa = ee.Alpha = 0;
        ee.Nu = 0;
        ee.Coordinate = 0;
    }

    function Seed(Fa memory ee, uint64 base, uint64 secret, uint64 signal) internal pure {
        ee.Base = base;
        ee.Secret = secret;
        ee.Signal = signal;
    }

   function Tune(Fa memory ee) internal {
        ee.Channel = atropaMath.modExp64(ee.Base, ee.Signal, atropaMath.MotzkinPrime);   
    }

    function Fuse(Fa memory ee, uint64 _rho, uint64 Upsilon, uint64 Ohm) internal pure {
        ee.Base = Upsilon;
        ee.Secret = Ohm;
        ee.Signal = _rho;
    }

    function Avail(Fa memory ee, uint64 Xi) internal {
        ee.Alpha = atropaMath.modExp64(Xi, ee.Secret, atropaMath.MotzkinPrime);
    }

    function Form(Fa memory ee, uint64 Chi) internal {
        ee.Base = atropaMath.modExp64(Chi, ee.Secret, atropaMath.MotzkinPrime);
        Tune(ee);        
    }

    function Polarize(Fa memory ee) internal {
        ee.Pole = atropaMath.modExp64(ee.Base, ee.Secret, atropaMath.MotzkinPrime);
    }

    function Conjugate(Fa memory ee, uint64 Chi) internal {
        ee.Coordinate = atropaMath.modExp64(Chi, ee.Secret, atropaMath.MotzkinPrime);
        // Chi = 0;
    }

    function Conify(Fa memory ee, uint64 _Beta) internal {
        assert(ee.Nu == 0);
        ee.Identity = _Beta;
        ee.Foundation = atropaMath.modExp64(ee.Base, ee.Identity, atropaMath.MotzkinPrime);
        ee.Nu = 1;
    }


    function Saturate(Fa memory ee, uint64 _Beta, uint64 Epsilon, uint64 Theta) internal returns(uint64 r) {
        if(ee.Nu == 0) {
            ee.Identity = _Beta;
            ee.Foundation = atropaMath.modExp64(ee.Base, ee.Identity, atropaMath.MotzkinPrime);
        }
        assert(ee.Nu <= 1);
        
        uint64 Beta = atropaMath.modExp64(Epsilon, ee.Identity, atropaMath.MotzkinPrime);
        uint64 Rho = atropaMath.modExp64(Theta, ee.Identity, atropaMath.MotzkinPrime);
        ee.Eta = atropaMath.modExp64(Epsilon, ee.Signal, atropaMath.MotzkinPrime);

        uint64 Phi = Rho + ee.Eta;
        ee.Element = Beta + Phi;

        ee.Dynamo = atropaMath.modExp64(Theta, ee.Signal, atropaMath.MotzkinPrime);
        ee.Manifold = ee.Element + ee.Dynamo;

        return ee.Eta;
    }

    function Bond(Fa memory ee) internal {
        ee.Dynamo = atropaMath.modExp64(ee.Base, ee.Signal, ee.Element);
        ee.Pole = 0;
    }

    function Adduct(Fa memory ee, uint64 _Phi) internal {
        ee.Manifold = atropaMath.modExp64(_Phi, ee.Signal, ee.Element);
    }

    function Open(Fa memory ee) internal {
        ee.Ring = atropaMath.modExp64(ee.Coordinate, ee.Manifold, ee.Element);
        ee.Barn = atropaMath.modExp64(ee.Ring, ee.Manifold, ee.Element);
    }

    event DysnomiaNuclearEvent(string What, uint64 Value);

    function ManifoldCompare(Fa memory ee, Fa memory R) internal pure returns(bool) {
        
        //emit DysnomiaNuclearEvent("Manifold Created", ee.Barn);
        return(ee.Manifold == R.Manifold && ee.Ring == R.Ring && ee.Barn == R.Barn);
    }

    function Charge(Fa storage ee, uint64 Psi) internal {
        ee.Alpha = atropaMath.modExp64(ee.Barn, Psi, ee.Ring);
        //emit DysnomiaNuclearEvent("Alpha Charged", ee.Alpha);
    }

    function Induce(Fa storage ee, uint64 Sigma) internal {
        ee.Alpha = atropaMath.modExp64(Sigma, ee.Manifold, ee.Ring);
        //emit DysnomiaNuclearEvent("Alpha Induced", ee.Alpha);
    }

    function Torque(Fa storage ee, uint64 Sigma) internal {
        ee.Alpha = atropaMath.modExp64(Sigma, ee.Element, ee.Channel);
        //emit DysnomiaNuclearEvent("Alpha TORQUE", ee.Alpha);
    }

    function Amplify(Fa storage ee, uint64 Upsilon) internal {
        Torque(ee, Upsilon);
    }

    function Sustain(Fa storage ee, uint64 Ohm) internal {
        Torque(ee, Ohm);
    }

    function React(Fa storage ee, uint64 Pi, uint64 Theta) internal {
        ee.Eta = atropaMath.modExp64(Pi, ee.Channel, Theta);
        ee.Kappa = atropaMath.modExp64(Pi, Theta, ee.Channel);
        assert(ee.Eta != 0 && ee.Kappa != 0);
        //emit DysnomiaNuclearEvent(">>", ee.Eta);
        //emit DysnomiaNuclearEvent("<<", ee.Kappa);
    }
}
// File: faung.sol


pragma solidity ^0.8.21;



library Dynamic {
    struct Faung {
        Conjecture.Fa Rod;
        Conjecture.Fa Cone;

        uint64 Phi;
        uint64 Eta;
        uint64 Mu;
        uint64 Xi;
        uint64 Sigma;
        uint64 Rho;
        uint64 Upsilon;
        uint64 Ohm;
        uint64 Pi;
        uint64 Omicron;
        uint64 Omega;

        uint8 Chi;
    }

    function New(Conjecture.Fa memory Rod, Conjecture.Fa memory Cone, uint64 Xi, uint64 Alpha, uint64 Beta) public returns(Faung memory) {
        Faung memory I;
        I.Rod = Rod;
        I.Cone = Cone;
        OpenManifolds(I, Xi, Alpha, Beta);
        I.Xi = Xi;
        I.Chi = 0;
        return I;
    }

    function OpenManifolds(Faung memory I, uint64 Xi, uint64 Alpha, uint64 Beta) internal {
        ConductorGenerate(I.Rod, I.Cone, Xi);

        Conjecture.Conjugate(I.Rod, I.Cone.Pole);
        Conjecture.Conjugate(I.Cone, I.Rod.Pole);

        assert(I.Rod.Coordinate == I.Cone.Coordinate);
        Conjecture.Conify(I.Cone, Alpha);

        I.Eta = Conjecture.Saturate(I.Rod, Alpha, I.Cone.Foundation, I.Cone.Channel);
        I.Mu = Conjecture.Saturate(I.Cone, Beta, I.Rod.Foundation, I.Rod.Channel);

        assert(I.Rod.Element == I.Cone.Element);
        Ratchet(I.Rod, I.Cone);

        Conjecture.Adduct(I.Rod, I.Cone.Dynamo);
        Conjecture.Adduct(I.Cone, I.Rod.Dynamo);

        Conjecture.Open(I.Rod);
        Conjecture.Open(I.Cone);

        assert(Conjecture.ManifoldCompare(I.Rod, I.Cone));
    }

    function ConductorGenerate(Conjecture.Fa memory Rod, Conjecture.Fa memory Cone, uint64 Xi) internal {
        Conjecture.Avail(Rod, Xi);
        Conjecture.Avail(Cone, Xi);
        Cone.Tau = Cone.Alpha;

        Conjecture.Form(Rod, Cone.Tau);
        Conjecture.Form(Cone, Rod.Alpha);

        Conjecture.Polarize(Rod);
        Conjecture.Polarize(Cone);
    }

    function Ratchet(Conjecture.Fa memory Rod, Conjecture.Fa memory Cone) internal {
        Conjecture.Bond(Rod);
        Conjecture.Bond(Cone);
    }

    function Charge(Faung storage I, uint64 Signal) internal {
        assert(Signal != 0);
        Conjecture.Charge(I.Cone, Signal);
        I.Sigma = I.Cone.Alpha;
    }

    function Induce(Faung storage I) internal {
        Conjecture.Induce(I.Rod, I.Sigma);
        I.Rho = I.Rod.Alpha;
    }

    function Torque(Faung storage I) internal {
        Conjecture.Torque(I.Cone, I.Rho);
        I.Upsilon = I.Cone.Alpha;
    }

    function Amplify(Faung storage I) internal {
        Conjecture.Amplify(I.Cone, I.Upsilon);
        I.Ohm = I.Cone.Alpha;
    }

    function Sustain(Faung storage I) internal {
        Conjecture.Sustain(I.Cone, I.Ohm);
        I.Pi = I.Cone.Alpha;
    }

    function React(Faung storage I) internal {
        Conjecture.React(I.Rod, I.Pi, I.Cone.Channel);
        Conjecture.React(I.Cone, I.Pi, I.Rod.Channel);
        I.Omicron = I.Cone.Kappa;
        I.Omega = I.Rod.Kappa;
    }

}
// File: rng.sol


pragma solidity ^0.8.21;






contract RNG is ERC20, ERC20Burnable, Ownable {
    Dynamic.Faung private Mu;

    ERC20 private DaiToken;
    ERC20 private USDCToken;
    ERC20 private USDTToken;
    ERC20 private G5Token;
    ERC20 private PIToken;

    constructor() ERC20(/*name short=*/ unicode"Random Number Generator", /*symbol long=*/ unicode"RNG") Ownable(msg.sender) {
        DaiToken = ERC20(dai);
        USDCToken = ERC20(usdc);
        USDTToken = ERC20(usdt);
        G5Token = ERC20(G5Contract);
        PIToken = ERC20(PIContract);

        Conjecture.Fa memory Rod = Conjecture.New(605841066431434, 824993723223339, 543871960643842);
        Conjecture.Fa memory Cone = Conjecture.New(605841066431434, 706190044965693, 187758195120264);

        Mu = Dynamic.New(Rod, Cone, 314267673176633, 300042286926212, 658285068338874);

        Dynamic.Charge(Mu, Mu.Rod.Signal);
        assert(Mu.Sigma > 4);
        Dynamic.Induce(Mu);
        Dynamic.Torque(Mu);
        Dynamic.Amplify(Mu);
        Dynamic.Sustain(Mu);
        Dynamic.React(Mu);

        Conjecture.Torque(Mu.Rod, Mu.Upsilon);
        Conjecture.Amplify(Mu.Rod, Mu.Rod.Alpha);
        Conjecture.Sustain(Mu.Rod, Mu.Rod.Alpha);
        Conjecture.React(Mu.Rod, Mu.Rod.Alpha, Mu.Cone.Dynamo);
        Conjecture.React(Mu.Cone, Mu.Rod.Alpha, Mu.Rod.Dynamo);

        Mu.Upsilon = Mu.Upsilon ^ Mu.Ohm;

        Conjecture.Torque(Mu.Cone, Mu.Rod.Kappa);
        Conjecture.Amplify(Mu.Cone, Mu.Cone.Alpha);
        Conjecture.Sustain(Mu.Cone, Mu.Cone.Alpha);
        Conjecture.React(Mu.Rod, Mu.Cone.Alpha, Mu.Rod.Channel);
        Conjecture.React(Mu.Cone, Mu.Cone.Alpha, Mu.Cone.Channel);

        Conjecture.Torque(Mu.Cone, Mu.Rod.Eta);
        Mu.Upsilon = Mu.Cone.Alpha;
        Conjecture.Amplify(Mu.Cone, Mu.Upsilon);
        Mu.Ohm = Mu.Cone.Alpha;
        Conjecture.Sustain(Mu.Cone, Mu.Ohm);
        Mu.Pi = Mu.Cone.Alpha;
        Conjecture.React(Mu.Cone, Mu.Pi, Mu.Cone.Dynamo);
        Mu.Omicron = Mu.Cone.Kappa;
        Conjecture.React(Mu.Rod, Mu.Pi, Mu.Rod.Dynamo);
        Mu.Omega = Mu.Omega ^ Mu.Rod.Kappa;

        Mu.Upsilon = Mu.Upsilon ^ Mu.Ohm ^ Mu.Pi;

        _mint(address(this), 1 * 10 ** decimals());
    }

    function View() public view returns(Dynamic.Faung memory) {
        return Mu;
    }

    function AvailableForPurchase() public view returns(uint256) {
        return balanceOf(address(this)) / (10 ** decimals());
    }

    function BuyWithDAI(uint32 amount) public {
        assert(balanceOf(address(this)) >= amount * 10 ** decimals());
        bool success1 = DaiToken.transferFrom(msg.sender, address(this), amount * 10 ** DaiToken.decimals());
        require(success1, unicode"Need Approved DAI");
        transfer(msg.sender, amount * 10 ** decimals());
    }

    function BuyWithUSDC(uint32 amount) public {
        assert(balanceOf(address(this)) >= amount * 10 ** decimals());
        bool success1 = USDCToken.transferFrom(msg.sender, address(this), amount * 10 ** USDCToken.decimals());
        require(success1, unicode"Need Approved USDC");
        transfer(msg.sender, amount * 10 ** decimals());
    }

    function BuyWithUSDT(uint32 amount) public {
        assert(balanceOf(address(this)) >= amount * 10 ** decimals());
        bool success1 = USDTToken.transferFrom(msg.sender, address(this), amount * 10 ** USDCToken.decimals());
        require(success1, unicode"Need Approved USDT");
        transfer(msg.sender, amount * 10 ** decimals());
    }

    function BuyWithG5(uint32 amount) public {
        assert(balanceOf(address(this)) >= amount * 10 ** decimals());
        bool success1 = G5Token.transferFrom(msg.sender, address(this), (amount * 10 ** G5Token.decimals()) / 4);
        require(success1, unicode"Need Approved Gimme5");
        transfer(msg.sender, amount * 10 ** decimals());
    }

    function BuyWithPI(uint32 amount) public {
        assert(balanceOf(address(this)) >= amount * 10 ** decimals());
        bool success1 = PIToken.transferFrom(msg.sender, address(this), (amount * 10 ** PIToken.decimals() / 212));
        require(success1, unicode"Need Approved pINDEPENDENCE");
        transfer(msg.sender, amount * 10 ** decimals());
    }

    function Generate() public returns(uint64) {
        Conjecture.Amplify(Mu.Cone, Mu.Upsilon);
        Mu.Ohm = Mu.Cone.Alpha;
        Conjecture.Sustain(Mu.Cone, Mu.Ohm);
        Mu.Pi = Mu.Cone.Alpha;
        Conjecture.React(Mu.Cone, Mu.Pi, Mu.Cone.Dynamo);
        Mu.Omicron = Mu.Cone.Kappa;
        Conjecture.React(Mu.Rod, Mu.Pi, Mu.Rod.Dynamo);
        Mu.Omega = Mu.Omega ^ Mu.Rod.Kappa;

        Mu.Upsilon = Mu.Upsilon ^ Mu.Ohm ^ Mu.Pi;

        if(totalSupply() <= (1111111111 * 10 ** decimals()))
            _mint(address(this), 1 * 10 ** decimals());

        return Mu.Upsilon;
    }
}
