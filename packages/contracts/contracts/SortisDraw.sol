// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// No FHE import yet, deliberately. Every value in `Round` is plaintext: the
// frozen ticket count, the sweep cursor, and the publicly decrypted total and
// random value are all meant to be readable by anyone verifying a draw. The
// encrypted types arrive in Phase 5 with the sweep that actually needs them.
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {SortisPool} from "./SortisPool.sol";

/**
 * @title SortisDraw
 * @notice The draw engine, referred to as ERNIE in the interface and in event
 *         names, after the machine that has drawn Premium Bonds since 1957.
 *
 * @dev PHASE 2 SKELETON. The full engine lands in Phase 5. The state machine and
 *      events are fixed here because the frontend's live sweep progress view and
 *      the public verification page are both written against them.
 *
 *      HOW A ROUND SETTLES
 *      1. The round closes. The ticket list is frozen and its length emitted, so
 *         nobody can be added or removed after randomness is known.
 *      2. The encrypted grand total is publicly decrypted by oracle callback.
 *         Only the total, never its composition.
 *      3. A random value is drawn using on-chain encrypted randomness and
 *         reduced modulo the plaintext total. The deployer has no more influence
 *         over the outcome than any user.
 *      4. A resumable sweep walks the ticket list, computing per ticket whether
 *         the random value falls inside that ticket's encrypted cumulative
 *         range, and applies an `FHE.select`-gated credit to EVERY owner.
 *      5. A winner count is publicly decrypted as an invariant. It must be
 *         exactly 1, or 0 in the rollover case; any other value halts
 *         settlement rather than paying out something unexplained.
 *
 *      WHY THE SWEEP IS RESUMABLE
 *      Encrypted comparisons are expensive enough that a large ticket list will
 *      not settle inside one block's gas limit. A cursor is persisted and a
 *      keeper calls `stepDraw` in batches. The frontend renders that cursor as
 *      real progress rather than hiding the wait behind a spinner.
 */
contract SortisDraw is ZamaEthereumConfig, Ownable {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    /**
     * @notice Lifecycle of a single round. Each state is surfaced in the UI with
     *         its own label, because "awaiting oracle" and "sweeping" are
     *         genuinely different waits and must not look identical to a user.
     */
    enum RoundState {
        Open, // accepting deposits toward this round
        Closed, // ticket list frozen, total not yet decrypted
        AwaitingTotal, // public decryption of the grand total requested
        Sweeping, // walking tickets in batches
        Settled, // winner credited, invariant satisfied
        RolledOver // random value landed in a voided range, prize carried forward
    }

    struct Round {
        RoundState state;
        uint64 openedAt;
        uint64 closedAt;
        /// @notice Ticket-list length at close. The sweep's fixed upper bound.
        uint256 frozenTicketCount;
        /// @notice Cursor into the ticket list; equals `frozenTicketCount` when done.
        uint256 sweepCursor;
        /// @notice Publicly decrypted grand total, available from `AwaitingTotal` onward.
        uint64 revealedTotal;
        /// @notice Publicly decrypted random value, available after settlement.
        uint64 revealedRandom;
        /// @notice Prize for this round, funded from accrued yield.
        uint64 prizeAmount;
    }

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    /// @notice Thrown by any path whose implementation is scheduled for Phase 5.
    error NotImplemented();

    /// @notice Thrown when a caller other than the keeper calls a keeper-only path.
    error OnlyKeeper();

    /**
     * @notice Thrown when the publicly decrypted winner count is neither 1 nor 0.
     * @dev A halt, not a warning. Any other value means the cumulative-range
     *      arithmetic is wrong, and paying out on top of that would be worse
     *      than stopping.
     */
    error WinnerCountInvariantViolated(uint64 count);

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice The pool whose tickets this engine draws over.
    SortisPool public immutable pool;

    /// @notice Address permitted to advance rounds. A Vercel Cron hot key on testnet.
    /// @dev Stated openly as a centralised testnet convenience. A production
    ///      deployment would move this to a permissionless, incentivised keeper.
    address public keeper;

    /// @notice Round id to round record.
    mapping(uint64 => Round) internal _rounds;

    /// @notice Prize carried forward from rollover rounds, added to the next prize.
    uint64 public rolloverBalance;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    /// @dev The `Ernie*` prefix is intentional and load bearing for the UI copy.
    event ErnieRoundClosed(uint64 indexed roundId, uint256 frozenTicketCount, uint64 closedAt);
    event ErnieTotalRequested(uint64 indexed roundId);
    event ErnieTotalRevealed(uint64 indexed roundId, uint64 total);
    event ErnieRandomDrawn(uint64 indexed roundId, uint64 randomValue, uint64 total);
    event ErnieSweepAdvanced(uint64 indexed roundId, uint256 cursor, uint256 frozenTicketCount);
    event ErnieSettled(uint64 indexed roundId, uint64 prizeAmount, uint64 randomValue);
    event ErnieRolledOver(uint64 indexed roundId, uint64 carriedPrize);
    event KeeperUpdated(address indexed previousKeeper, address indexed newKeeper);

    // ---------------------------------------------------------------------
    // Construction
    // ---------------------------------------------------------------------

    constructor(address pool_, address keeper_, address initialOwner) Ownable(initialOwner) {
        pool = SortisPool(pool_);
        keeper = keeper_;
    }

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert OnlyKeeper();
        _;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Full record for a round, powering `/verify/[roundId]` with no wallet.
    function roundAt(uint64 roundId) external view returns (Round memory) {
        return _rounds[roundId];
    }

    /// @notice Sweep progress as (cursor, total), rendered as a progress bar.
    function sweepProgress(uint64 roundId) external view returns (uint256 cursor, uint256 total) {
        Round storage r = _rounds[roundId];
        return (r.sweepCursor, r.frozenTicketCount);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setKeeper(address newKeeper) external onlyOwner {
        emit KeeperUpdated(keeper, newKeeper);
        keeper = newKeeper;
    }

    // ---------------------------------------------------------------------
    // Round lifecycle — Phase 5
    // ---------------------------------------------------------------------

    /**
     * @notice Freeze the ticket list and request public decryption of the total.
     * @dev Phase 5. Freezing before randomness is requested is what makes the
     *      draw checkable by an outsider: the candidate set is committed first.
     */
    function closeRound() external view onlyKeeper {
        revert NotImplemented();
    }

    /**
     * @notice Oracle callback delivering the publicly decrypted grand total.
     * @dev Phase 5.
     */
    function onTotalRevealed(uint256, uint64, bytes[] calldata) external pure {
        revert NotImplemented();
    }

    /**
     * @notice Draw the random value and reduce it modulo the revealed total.
     * @dev Phase 5. Randomness is generated on chain by the protocol, never
     *      supplied by an operator.
     */
    function drawRandom() external view onlyKeeper {
        revert NotImplemented();
    }

    /**
     * @notice Advance the encrypted sweep by up to `batchSize` tickets.
     * @dev Phase 5. The core loop, per ticket:
     *
     *      ebool  lower = FHE.le(prevCumulative, r);
     *      ebool  upper = FHE.lt(r, ticket.cumulative);
     *      ebool  hit   = FHE.and(FHE.and(lower, upper), ticket.active);
     *      euint64 add  = FHE.select(hit, prizeAmount, FHE.asEuint64(0));
     *      claimable[ticket.owner] = FHE.add(claimable[ticket.owner], add);
     *
     *      The final line runs for every ticket, not only the winning one. That
     *      uniformity is the privacy guarantee and there is a dedicated test in
     *      Phase 6 asserting losers' slots are written, because a regression
     *      here would be silent.
     */
    function stepDraw(uint256) external view onlyKeeper {
        revert NotImplemented();
    }

    /**
     * @notice Verify the winner-count invariant and settle, or roll over.
     * @dev Phase 5.
     */
    function settle() external view onlyKeeper {
        revert NotImplemented();
    }
}
