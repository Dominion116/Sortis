// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

import {ConfidentialUSDT} from "./token/ConfidentialUSDT.sol";

/**
 * @title SortisFaucet
 * @notice Mints test cUSDT to any address on a cooldown, so a reviewer can
 *         arrive with an empty wallet and still take part in the pools.
 *
 * @dev The drip amount is public by construction. Encrypting a well-known
 *      constant would add coprocessor cost without hiding anything a block
 *      explorer cannot already see (the `Minted` event on the token). The
 *      faucet therefore calls `ConfidentialUSDT.mint`, the same plaintext
 *      path used by tests and deploy seeding.
 *
 *      Cooldown is keyed on the recipient, not the caller, so filling the
 *      same address from a second wallet does not bypass the wait.
 */
contract SortisFaucet is Ownable, ReentrancyGuardTransient {
    /// @notice Thrown when a constructor or drip is handed the zero address.
    error ZeroAddress();

    /// @notice Thrown when the drip amount would be zero.
    error InvalidDripAmount();

    /// @notice Thrown when the cooldown would be zero.
    error InvalidCooldown();

    /// @notice Thrown when `to` has already claimed inside the cooldown window.
    error CooldownNotElapsed(address account, uint64 readyAt);

    /// @notice The confidential token this faucet mints.
    ConfidentialUSDT public immutable token;

    /// @notice Plaintext units minted per successful drip.
    uint64 public dripAmount;

    /// @notice Seconds a recipient must wait between drips.
    uint64 public cooldown;

    /// @notice Timestamp of the last successful drip per recipient.
    mapping(address => uint64) public lastClaimAt;

    event Dripped(address indexed to, uint64 amount);
    event DripAmountUpdated(uint64 previousAmount, uint64 newAmount);
    event CooldownUpdated(uint64 previousCooldown, uint64 newCooldown);

    constructor(address token_, uint64 dripAmount_, uint64 cooldown_, address initialOwner) Ownable(initialOwner) {
        if (token_ == address(0)) revert ZeroAddress();
        if (dripAmount_ == 0) revert InvalidDripAmount();
        if (cooldown_ == 0) revert InvalidCooldown();

        token = ConfidentialUSDT(token_);
        dripAmount = dripAmount_;
        cooldown = cooldown_;
    }

    /// @notice Mint `dripAmount` cUSDT to the caller, subject to the cooldown.
    function drip() external {
        _drip(msg.sender);
    }

    /// @notice Mint `dripAmount` cUSDT to `to`, subject to that address's cooldown.
    function dripTo(address to) external {
        _drip(to);
    }

    /// @notice When `account` may next claim. Zero means they have never claimed.
    function readyAt(address account) external view returns (uint64) {
        uint64 last = lastClaimAt[account];
        if (last == 0) return 0;
        return last + cooldown;
    }

    function setDripAmount(uint64 newAmount) external onlyOwner {
        if (newAmount == 0) revert InvalidDripAmount();
        emit DripAmountUpdated(dripAmount, newAmount);
        dripAmount = newAmount;
    }

    function setCooldown(uint64 newCooldown) external onlyOwner {
        if (newCooldown == 0) revert InvalidCooldown();
        emit CooldownUpdated(cooldown, newCooldown);
        cooldown = newCooldown;
    }

    function _drip(address to) private nonReentrant {
        if (to == address(0)) revert ZeroAddress();

        uint64 last = lastClaimAt[to];
        if (last != 0) {
            uint64 next = last + cooldown;
            if (block.timestamp < next) revert CooldownNotElapsed(to, next);
        }

        lastClaimAt[to] = uint64(block.timestamp);
        uint64 amount = dripAmount;
        token.mint(to, amount);
        emit Dripped(to, amount);
    }
}
