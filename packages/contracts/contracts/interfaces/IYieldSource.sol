// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IYieldSource
 * @notice The seam between the pool's custody logic and wherever idle funds
 *         actually earn. Keeping this minimal is deliberate: it is what allows
 *         `MockYieldSource` (Sepolia) and `MorphoYieldSource` (mainnet path) to
 *         be swapped without touching `SortisPool`.
 *
 * @dev Amounts here are PLAINTEXT `uint64`, not `euint64`, and that is a design
 *      decision rather than an oversight. Only the pool's aggregate balance ever
 *      reaches a yield source, and the aggregate is deliberately public: it is
 *      the figure any pooled savings product already discloses, and the prize is
 *      computed from it, so hiding it would make a draw impossible to verify.
 *      Per-user amounts never cross this boundary.
 */
interface IYieldSource {
    /// @notice The confidential token this source accepts.
    function asset() external view returns (address);

    /// @notice Move `amount` of `asset()` from the caller into the yield backend.
    function deposit(uint64 amount) external;

    /// @notice Redeem `amount` of `asset()` from the backend and send it to `to`.
    function withdraw(uint64 amount, address to) external;

    /**
     * @notice Interest earned on top of principal and not yet swept by the pool.
     * @dev This is the figure a round's prize is drawn from.
     */
    function accrued() external view returns (uint64);

    /// @notice Principal currently deposited by the pool, excluding `accrued()`.
    function totalDeposited() external view returns (uint64);
}
