// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IYieldSource} from "../interfaces/IYieldSource.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockYieldSource
 * @notice SEPOLIA ONLY. Accrues a configurable rate against a pre-funded
 *         reserve so that demo draws have something real to pay out.
 *
 * @dev Sepolia has no genuine yield. The honest options were to fake yield
 *      silently or to make the simulation explicit and swappable; this is the
 *      second. Every prize figure sourced from this contract is labelled
 *      "simulated testnet yield" in the interface.
 *
 *      PHASE 2 SKELETON. Accrual mathematics, reserve accounting and the pool
 *      wiring land in Phase 4. Only the storage layout, events and the
 *      `IYieldSource` surface are fixed here, so that `SortisPool` can be
 *      written against a stable shape.
 */
contract MockYieldSource is IYieldSource, Ownable {
    /// @notice Thrown by any path whose implementation is scheduled for a later phase.
    error NotImplemented();

    /// @notice The confidential token this source accepts.
    address private immutable _asset;

    /// @notice Principal deposited by the pool, excluding accrued interest.
    uint64 private _totalDeposited;

    /// @notice Accrued-but-unswept interest, in the asset's smallest unit.
    uint64 private _accrued;

    /// @notice Accrual rate in basis points per year, deliberately generous on testnet.
    uint16 public rateBps;

    /// @notice Timestamp accrual was last folded into `_accrued`.
    uint64 public lastAccrualAt;

    /// @notice The only address permitted to deposit and withdraw, set in Phase 4.
    address public pool;

    event RateUpdated(uint16 previousRateBps, uint16 newRateBps);
    event PoolUpdated(address indexed previousPool, address indexed newPool);
    event Accrued(uint64 amount, uint64 totalAccrued);

    constructor(address asset_, uint16 initialRateBps, address initialOwner) Ownable(initialOwner) {
        _asset = asset_;
        rateBps = initialRateBps;
        lastAccrualAt = uint64(block.timestamp);
    }

    /// @inheritdoc IYieldSource
    function asset() external view returns (address) {
        return _asset;
    }

    /// @inheritdoc IYieldSource
    function totalDeposited() external view returns (uint64) {
        return _totalDeposited;
    }

    /// @inheritdoc IYieldSource
    function accrued() external view returns (uint64) {
        return _accrued;
    }

    /// @notice Owner-settable so a demo round can be tuned to produce a visible prize.
    function setRateBps(uint16 newRateBps) external onlyOwner {
        emit RateUpdated(rateBps, newRateBps);
        rateBps = newRateBps;
    }

    function setPool(address newPool) external onlyOwner {
        emit PoolUpdated(pool, newPool);
        pool = newPool;
    }

    /// @inheritdoc IYieldSource
    /// @dev Phase 4.
    function deposit(uint64) external pure {
        revert NotImplemented();
    }

    /// @inheritdoc IYieldSource
    /// @dev Phase 4.
    function withdraw(uint64, address) external pure {
        revert NotImplemented();
    }
}
