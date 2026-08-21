// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

import {IYieldSource} from "../interfaces/IYieldSource.sol";

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
 *      Amounts on {deposit} and {withdraw} are plaintext `uint64` because only
 *      the pool aggregate ever crosses this boundary. Per-user amounts never
 *      do. The mock pulls / sends the corresponding confidential tokens using
 *      `FHE.asEuint64`, so the transfer is well-defined without an input proof.
 *
 *      Interest is computed as
 *      `principal * rateBps * elapsed / (10_000 * 365 days)` and is visible
 *      from {accrued} without a state-changing harvest: the view folds pending
 *      interest on the fly, and mutating calls persist it.
 */
contract MockYieldSource is ZamaEthereumConfig, IYieldSource, Ownable, ReentrancyGuardTransient {
    /// @notice Thrown when a caller other than the configured pool moves funds.
    error OnlyPool();

    /// @notice Thrown when a constructor or setter is handed the zero address.
    error ZeroAddress();

    /// @notice Thrown when a redeem exceeds principal plus unswept interest.
    error InsufficientLiquidity(uint64 requested, uint64 available);

    /// @notice Seconds in the 365-day year the APR is quoted against.
    uint64 private constant SECONDS_PER_YEAR = 365 days;

    /// @notice The confidential token this source accepts.
    address private immutable _asset;

    /// @notice Principal deposited by the pool, excluding accrued interest.
    uint64 private _totalDeposited;

    /// @notice Accrued-but-unswept interest already folded in from prior elapsed time.
    uint64 private _accrued;

    /// @notice Accrual rate in basis points per year, deliberately generous on testnet.
    uint16 public rateBps;

    /// @notice Timestamp accrual was last folded into `_accrued`.
    uint64 public lastAccrualAt;

    /// @notice The only address permitted to deposit and withdraw.
    address public pool;

    event RateUpdated(uint16 previousRateBps, uint16 newRateBps);
    event PoolUpdated(address indexed previousPool, address indexed newPool);
    event Accrued(uint64 amount, uint64 totalAccrued);

    constructor(address asset_, uint16 initialRateBps, address initialOwner) Ownable(initialOwner) {
        if (asset_ == address(0)) revert ZeroAddress();

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
    /// @dev Includes interest earned since `lastAccrualAt`, so a reader does
    ///      not have to wait for a mutating harvest to see a prize grow.
    function accrued() external view returns (uint64) {
        return _satAdd(_accrued, _pending());
    }

    /// @notice Owner-settable so a demo round can be tuned to produce a visible prize.
    function setRateBps(uint16 newRateBps) external onlyOwner {
        _accrue();
        emit RateUpdated(rateBps, newRateBps);
        rateBps = newRateBps;
    }

    function setPool(address newPool) external onlyOwner {
        if (newPool == address(0)) revert ZeroAddress();
        emit PoolUpdated(pool, newPool);
        pool = newPool;
    }

    /// @inheritdoc IYieldSource
    function deposit(uint64 amount) external nonReentrant {
        if (msg.sender != pool) revert OnlyPool();

        _accrue();
        _totalDeposited += amount;

        euint64 encrypted = FHE.asEuint64(amount);
        FHE.allowThis(encrypted);
        FHE.allowTransient(encrypted, _asset);
        IERC7984(_asset).confidentialTransferFrom(msg.sender, address(this), encrypted);
    }

    /// @inheritdoc IYieldSource
    function withdraw(uint64 amount, address to) external nonReentrant {
        if (msg.sender != pool) revert OnlyPool();
        if (to == address(0)) revert ZeroAddress();

        _accrue();

        uint64 available = _satAdd(_totalDeposited, _accrued);
        if (amount > available) revert InsufficientLiquidity(amount, available);

        // Interest first, so a prize harvest of `accrued()` does not eat the
        // principal that is still earning. Remaining amount, if any, is principal.
        if (amount <= _accrued) {
            _accrued -= amount;
        } else {
            uint64 fromPrincipal = amount - _accrued;
            _accrued = 0;
            _totalDeposited -= fromPrincipal;
        }

        euint64 encrypted = FHE.asEuint64(amount);
        FHE.allowThis(encrypted);
        FHE.allowTransient(encrypted, _asset);
        IERC7984(_asset).confidentialTransfer(to, encrypted);
    }

    // ---------------------------------------------------------------------
    // Accrual
    // ---------------------------------------------------------------------

    function _accrue() private {
        uint64 pending = _pending();
        if (pending > 0) {
            _accrued = _satAdd(_accrued, pending);
            emit Accrued(pending, _accrued);
        }
        lastAccrualAt = uint64(block.timestamp);
    }

    /// @dev Integer APR: at 20% (2_000 bps) a principal of 1e6 units produces
    ///      a few units of interest inside a 5-minute demo round. Tests use a
    ///      larger principal or a higher rate when they need a louder figure.
    function _pending() private view returns (uint64) {
        if (_totalDeposited == 0 || rateBps == 0) return 0;

        uint64 elapsed = uint64(block.timestamp) - lastAccrualAt;
        if (elapsed == 0) return 0;

        uint256 raw = (uint256(_totalDeposited) * uint256(rateBps) * uint256(elapsed)) /
            (uint256(10_000) * uint256(SECONDS_PER_YEAR));
        if (raw > type(uint64).max) return type(uint64).max;
        return uint64(raw);
    }

    function _satAdd(uint64 a, uint64 b) private pure returns (uint64) {
        uint256 sum = uint256(a) + uint256(b);
        if (sum > type(uint64).max) return type(uint64).max;
        return uint64(sum);
    }
}
