// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IYieldSource} from "../interfaces/IYieldSource.sol";

/**
 * @title MorphoYieldSource
 * @notice The mainnet path: written against the same interface as the mock,
 *         targeting the Steakhouse Confidential Prime USDC vault on Morpho.
 *
 * @dev DELIBERATELY NOT DEPLOYED. Its purpose is to demonstrate that the yield
 *      seam is real, rather than a mock permanently welded into the core
 *      contract. If `SortisPool` can only ever talk to `MockYieldSource`, the
 *      claim of a production path is not credible; this file is the evidence
 *      that the interface is genuinely implementable against a live vault.
 *
 *      PHASE 2 STUB. Vault integration is out of scope for this submission.
 */
contract MorphoYieldSource is IYieldSource {
    /// @notice Thrown on every path: this contract is a documented stub.
    error NotDeployed();

    /// @notice The Morpho vault this source would route into.
    address public immutable vault;

    /// @notice The confidential token this source accepts.
    address private immutable _asset;

    constructor(address asset_, address vault_) {
        _asset = asset_;
        vault = vault_;
    }

    /// @inheritdoc IYieldSource
    function asset() external view returns (address) {
        return _asset;
    }

    /// @inheritdoc IYieldSource
    function deposit(uint64) external pure {
        revert NotDeployed();
    }

    /// @inheritdoc IYieldSource
    function withdraw(uint64, address) external pure {
        revert NotDeployed();
    }

    /// @inheritdoc IYieldSource
    function accrued() external pure returns (uint64) {
        revert NotDeployed();
    }

    /// @inheritdoc IYieldSource
    function totalDeposited() external pure returns (uint64) {
        revert NotDeployed();
    }
}
