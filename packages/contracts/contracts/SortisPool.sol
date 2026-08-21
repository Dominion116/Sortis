// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// Only the encrypted TYPES are imported here. They are already load bearing: the
// ticket layout and the ABI are written against them. The `FHE` library itself
// arrives in Phase 3 with the first real encrypted operation, rather than being
// imported now and sitting unused.
import {euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IYieldSource} from "./interfaces/IYieldSource.sol";

/**
 * @title SortisPool
 * @notice Custody for the confidential prize savings pool. Accepts ERC-7984
 *         deposits, holds encrypted per-user balances, issues tickets, processes
 *         withdrawals, and routes idle funds to the configured yield source.
 *
 * @dev PHASE 2 SKELETON. The deposit path lands in Phase 3, withdrawals and
 *      yield routing in Phase 4. What is fixed here, and what later phases must
 *      not casually change, is the ticket storage layout, because both the draw
 *      engine and the frontend are written against it.
 *
 *      THE TICKET MODEL (PRD 3.2)
 *      Each deposit appends a ticket carrying a running `cumulative` sum rather
 *      than merely incrementing a balance. The cumulative is computed once at
 *      append time, at a cost of a single encrypted addition per deposit. That
 *      is what turns winner selection from a quadratic draw-time computation
 *      into a linear sweep, and encrypted operations are far too expensive to
 *      pay for quadratically.
 *
 *      Eligibility follows the Premium Bonds convention: a ticket must exist
 *      before a round opens to take part in that round's draw, so mid-round
 *      deposits roll into the next round.
 */
contract SortisPool is ZamaEthereumConfig, Ownable {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    /**
     * @notice One deposit's claim on the prize, expressed as an encrypted range.
     * @param owner       Plain address. Deliberately public: the draw's privacy
     *                    rests on amounts and outcomes being unreadable, not on
     *                    hiding that an address took part at all.
     * @param amount      Encrypted deposit amount.
     * @param cumulative  Encrypted running sum of every ticket up to and
     *                    including this one. The draw compares a random value
     *                    against `[previous.cumulative, this.cumulative)`.
     * @param active      Encrypted flag a withdrawal flips to false.
     * @param roundId     The round this ticket first becomes eligible for.
     */
    struct Ticket {
        address owner;
        euint64 amount;
        euint64 cumulative;
        ebool active;
        uint64 roundId;
    }

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    /// @notice Thrown by any path whose implementation is scheduled for a later phase.
    error NotImplemented();

    /// @notice Thrown when a caller other than the configured draw engine calls a draw-only path.
    error OnlyDrawEngine();

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice The confidential (ERC-7984) token this pool denominates in.
    address public immutable asset;

    /// @notice Where idle funds earn. Swappable by design, see {IYieldSource}.
    IYieldSource public yieldSource;

    /// @notice `SortisDraw`, the only contract allowed to credit prizes.
    address public drawEngine;

    /// @notice Append-only ticket list. Index is the ticket id the sweep walks.
    Ticket[] internal _tickets;

    /// @notice Encrypted principal per depositor. Only the owner can decrypt their own.
    mapping(address => euint64) internal _balances;

    /// @notice Encrypted, unclaimed winnings per address.
    /// @dev Written for EVERY participant on every draw, winners and losers
    ///      alike, via `FHE.select`. If only the winner's slot changed, the state
    ///      diff alone would identify them, so uniform writes are the privacy
    ///      guarantee rather than an inefficiency to be optimised away later.
    mapping(address => euint64) internal _claimable;

    /// @notice Monotonic round counter. Round 0 is the pre-open state.
    uint64 public currentRoundId;

    /// @notice Timestamp the current round opened.
    uint64 public roundOpenedAt;

    /// @notice Fixed round length in seconds. Two deployments: demo (300s) and standard.
    uint64 public roundDuration;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    /// @dev No amount is emitted. Emitting one, even encrypted, invites a
    ///      correlation attack against transaction ordering.
    event Deposited(address indexed owner, uint256 indexed ticketId, uint64 indexed roundId);
    event Withdrawn(address indexed owner, uint256 indexed ticketId, uint64 indexed roundId);
    event RoundOpened(uint64 indexed roundId, uint64 openedAt, uint256 ticketCount);
    event YieldSourceUpdated(address indexed previousSource, address indexed newSource);
    event DrawEngineUpdated(address indexed previousEngine, address indexed newEngine);

    // ---------------------------------------------------------------------
    // Construction
    // ---------------------------------------------------------------------

    constructor(address asset_, uint64 roundDuration_, address initialOwner) Ownable(initialOwner) {
        asset = asset_;
        roundDuration = roundDuration_;
    }

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyDrawEngine() {
        if (msg.sender != drawEngine) revert OnlyDrawEngine();
        _;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Number of tickets ever appended, the sweep's upper bound.
    function ticketCount() external view returns (uint256) {
        return _tickets.length;
    }

    /// @notice The caller's encrypted principal handle, decryptable only by them.
    function balanceHandleOf(address account) external view returns (euint64) {
        return _balances[account];
    }

    /// @notice The caller's encrypted unclaimed winnings handle.
    function claimableHandleOf(address account) external view returns (euint64) {
        return _claimable[account];
    }

    /// @notice Public ticket metadata. Encrypted fields are returned as handles.
    function ticketAt(
        uint256 ticketId
    ) external view returns (address owner, euint64 amount, euint64 cumulative, ebool active, uint64 roundId) {
        Ticket storage t = _tickets[ticketId];
        return (t.owner, t.amount, t.cumulative, t.active, t.roundId);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setYieldSource(address newSource) external onlyOwner {
        emit YieldSourceUpdated(address(yieldSource), newSource);
        yieldSource = IYieldSource(newSource);
    }

    function setDrawEngine(address newEngine) external onlyOwner {
        emit DrawEngineUpdated(drawEngine, newEngine);
        drawEngine = newEngine;
    }

    // ---------------------------------------------------------------------
    // Deposits and withdrawals — Phase 3 and Phase 4
    // ---------------------------------------------------------------------

    /**
     * @notice Deposit a confidential amount and receive a ticket for the next round.
     * @dev Phase 3. Will: verify the input proof, pull tokens via the ERC-7984
     *      confidential transfer, append a ticket whose `cumulative` is the
     *      previous cumulative plus this amount, and grant the depositor
     *      decryption rights over their own balance.
     */
    function deposit(externalEuint64, bytes calldata) external pure {
        revert NotImplemented();
    }

    /**
     * @notice Withdraw principal, available at any time including mid-round.
     * @dev Phase 4. Marks the ticket inactive WITHOUT rebuilding the cumulative
     *      sums above it. Rebuilding is linear and would have to run on every
     *      withdrawal, so the gap is left in place and handled at draw time as a
     *      rollover. That is a documented outcome, not a defect.
     */
    function withdraw(uint256, externalEuint64, bytes calldata) external pure {
        revert NotImplemented();
    }

    // ---------------------------------------------------------------------
    // Draw engine hooks — Phase 5
    // ---------------------------------------------------------------------

    /**
     * @notice Credit an encrypted (possibly zero) prize to a ticket owner.
     * @dev Phase 5. Called once per ticket per sweep batch, for winners and
     *      losers alike, with the amount gated by `FHE.select`.
     */
    function creditClaimable(address, euint64) external view onlyDrawEngine {
        revert NotImplemented();
    }

    /**
     * @notice Open the next round and freeze the eligible ticket set.
     * @dev Phase 5.
     */
    function openNextRound() external view onlyDrawEngine returns (uint64) {
        revert NotImplemented();
    }
}
