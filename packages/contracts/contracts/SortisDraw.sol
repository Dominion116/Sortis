// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

import {SortisPool} from "./SortisPool.sol";

/**
 * @title SortisDraw
 * @notice The draw engine, referred to as ERNIE in the interface and in event
 *         names, after the machine that has drawn Premium Bonds since 1957.
 *
 * @dev PHASE 5. Selects exactly one winner over ciphertext, resumably, with a
 *      well-defined rollover when the random value lands in a voided ticket.
 *
 *      HOW A ROUND SETTLES
 *      1. The round closes. The ticket list is frozen and its length emitted, so
 *         nobody can be added or removed after randomness is known.
 *      2. The encrypted grand total is marked publicly decryptable. A KMS proof
 *         is submitted back on-chain; only the total, never its composition.
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
 *      Public decryption follows FHEVM 0.11: `FHE.makePubliclyDecryptable` on
 *      chain, `publicDecrypt` off chain, `FHE.checkSignatures` on the way back.
 *      There is no `requestDecryption` oracle in this toolchain; the keeper
 *      (or anyone holding a valid KMS proof) is the callback.
 *
 *      WHY THE SWEEP IS RESUMABLE
 *      Encrypted comparisons are expensive enough that a large ticket list will
 *      not settle inside one block's gas limit. A cursor is persisted and a
 *      keeper calls `stepDraw` in batches. The frontend renders that cursor as
 *      real progress rather than hiding the wait behind a spinner.
 */
contract SortisDraw is ZamaEthereumConfig, Ownable, ReentrancyGuardTransient {
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

    /// @notice Thrown when a caller other than the keeper calls a keeper-only path.
    error OnlyKeeper();

    /// @notice Thrown when a call arrives in a state that cannot handle it.
    error InvalidRoundState(RoundState actual);

    /// @notice Thrown when `closeRound` is called before the configured duration has elapsed.
    error RoundNotExpired();

    /// @notice Thrown when `stepDraw` is handed a zero batch size.
    error InvalidBatchSize();

    /// @notice Thrown when `settle` is called before the sweep cursor has reached the end.
    error SweepIncomplete(uint256 cursor, uint256 total);

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

    /// @notice Round currently being drawn (or open). Historical rounds stay in `_rounds`.
    uint64 public drawingRoundId;

    /// @notice Round id to round record.
    mapping(uint64 => Round) internal _rounds;

    /// @notice Encrypted grand total published at close. Used to verify the KMS proof.
    mapping(uint64 => euint64) internal _encryptedTotal;

    /// @notice Encrypted random value, reduced modulo the revealed total.
    mapping(uint64 => euint64) internal _encryptedRandom;

    /// @notice Encrypted count of tickets whose range contained the random value.
    mapping(uint64 => euint64) internal _encryptedWinnerCount;

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

    /// @notice Encrypted grand total handle, publicly decryptable after close.
    function totalHandle(uint64 roundId) external view returns (euint64) {
        return _encryptedTotal[roundId];
    }

    /// @notice Encrypted random handle, publicly decryptable after the sweep completes.
    function randomHandle(uint64 roundId) external view returns (euint64) {
        return _encryptedRandom[roundId];
    }

    /// @notice Encrypted winner-count handle, publicly decryptable after the sweep completes.
    function winnerCountHandle(uint64 roundId) external view returns (euint64) {
        return _encryptedWinnerCount[roundId];
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
     * @notice Open the next pool round. The keeper's first call, and a no-op
     *         for anyone else: settlement already opens the next round itself.
     * @dev Round 0 is the pool's pre-open state. Deposits made then are eligible
     *      for round 1, which this starts. A round already in flight cannot be
     *      skipped.
     */
    function openRound() external onlyKeeper {
        _requireIdle();
        _openNext();
    }

    /**
     * @notice Freeze the ticket list and request public decryption of the total.
     * @dev Freezing before randomness is requested is what makes the draw
     *      checkable by an outsider: the candidate set is committed first.
     *      Accrued yield is harvested into the pool at this point and combined
     *      with any prize carried from a previous rollover, so the prize is
     *      a fixed number for the rest of the round even if more interest
     *      accrues during the sweep.
     */
    function closeRound() external onlyKeeper nonReentrant {
        if (drawingRoundId == 0) revert InvalidRoundState(RoundState.Open);
        Round storage r = _rounds[drawingRoundId];
        if (r.state != RoundState.Open) revert InvalidRoundState(r.state);
        if (!pool.isRoundExpired()) revert RoundNotExpired();

        r.closedAt = uint64(block.timestamp);
        r.frozenTicketCount = pool.eligibleTicketCount();

        uint64 harvested = pool.accrued();
        r.prizeAmount = harvested + rolloverBalance;
        rolloverBalance = 0;
        if (harvested > 0) {
            pool.recallFromYield(harvested, address(pool));
        }

        r.state = RoundState.Closed;
        emit ErnieRoundClosed(drawingRoundId, r.frozenTicketCount, r.closedAt);

        // Nothing to draw over: treat as a rollover so the (possibly zero) prize
        // carries and the next round can open. No randomness is consumed.
        if (r.frozenTicketCount == 0) {
            _rollover(r);
            return;
        }

        _encryptedTotal[drawingRoundId] = pool.publishRoundTotal();
        r.state = RoundState.AwaitingTotal;
        emit ErnieTotalRequested(drawingRoundId);
    }

    /**
     * @notice Callback delivering the publicly decrypted grand total.
     * @dev Permissionless: the KMS proof is the authorisation. Replay is
     *      prevented by the state transition out of `AwaitingTotal`.
     */
    function onTotalRevealed(uint64 total, bytes calldata decryptionProof) external {
        Round storage r = _rounds[drawingRoundId];
        if (r.state != RoundState.AwaitingTotal) revert InvalidRoundState(r.state);
        if (r.revealedTotal != 0) revert InvalidRoundState(r.state);

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(_encryptedTotal[drawingRoundId]);
        FHE.checkSignatures(handles, abi.encode(total), decryptionProof);

        r.revealedTotal = total;
        emit ErnieTotalRevealed(drawingRoundId, total);

        // A published total of zero means every eligible ticket is zero-width.
        // `FHE.rem` cannot take a zero divisor, and no random value can land
        // in an empty range, so this is a rollover rather than a draw.
        if (total == 0) {
            _rollover(r);
        }
    }

    /**
     * @notice Draw the random value and reduce it modulo the revealed total.
     * @dev Randomness is generated on chain by the protocol, never supplied
     *      by an operator. The plaintext random is not published here: it
     *      stays encrypted through the sweep and is revealed at settlement,
     *      matching the verification-page contract that `revealedRandom` is
     *      available after settlement.
     */
    function drawRandom() external onlyKeeper {
        Round storage r = _rounds[drawingRoundId];
        if (r.state != RoundState.AwaitingTotal) revert InvalidRoundState(r.state);
        if (r.revealedTotal == 0) revert InvalidRoundState(r.state);

        euint64 raw = FHE.randEuint64();
        euint64 reduced = FHE.rem(raw, r.revealedTotal);
        FHE.allowThis(reduced);
        _encryptedRandom[drawingRoundId] = reduced;

        euint64 zero = FHE.asEuint64(0);
        FHE.allowThis(zero);
        _encryptedWinnerCount[drawingRoundId] = zero;

        r.state = RoundState.Sweeping;
    }

    /**
     * @notice Advance the encrypted sweep by up to `batchSize` tickets.
     * @dev The core loop, per ticket (executed inside `SortisPool.sweepTicket`
     *      because the ticket handles are granted to the pool, not to this
     *      contract):
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
     *
     *      When the cursor reaches the end, the winner-count and random handles
     *      are marked publicly decryptable so `settle` can verify the invariant.
     */
    function stepDraw(uint256 batchSize) external onlyKeeper nonReentrant {
        if (batchSize == 0) revert InvalidBatchSize();

        Round storage r = _rounds[drawingRoundId];
        if (r.state != RoundState.Sweeping) revert InvalidRoundState(r.state);
        if (r.sweepCursor >= r.frozenTicketCount) revert SweepIncomplete(r.sweepCursor, r.frozenTicketCount);

        uint256 end = r.sweepCursor + batchSize;
        if (end > r.frozenTicketCount) end = r.frozenTicketCount;

        euint64 random = _encryptedRandom[drawingRoundId];
        euint64 prize = FHE.asEuint64(r.prizeAmount);
        FHE.allowThis(prize);
        FHE.allowTransient(random, address(pool));
        FHE.allowTransient(prize, address(pool));

        euint64 count = _encryptedWinnerCount[drawingRoundId];
        for (uint256 i = r.sweepCursor; i < end; ) {
            ebool hit = pool.sweepTicket(i, random, prize);
            count = FHE.add(count, FHE.asEuint64(hit));
            unchecked {
                ++i;
            }
        }
        FHE.allowThis(count);
        _encryptedWinnerCount[drawingRoundId] = count;

        r.sweepCursor = end;
        emit ErnieSweepAdvanced(drawingRoundId, end, r.frozenTicketCount);

        if (end == r.frozenTicketCount) {
            FHE.makePubliclyDecryptable(count);
            FHE.makePubliclyDecryptable(random);
        }
    }

    /**
     * @notice Verify the winner-count invariant and settle, or roll over.
     * @dev Takes the KMS-signed plaintext of the winner count and the random
     *      value. Count must be 1 (pay the already-credited winner) or 0
     *      (rollover: every credit was zero). Any other value reverts and
     *      leaves the round halted.
     */
    function settle(
        uint64 winnerCount,
        uint64 randomValue,
        bytes calldata decryptionProof
    ) external onlyKeeper nonReentrant {
        Round storage r = _rounds[drawingRoundId];
        if (r.state != RoundState.Sweeping) revert InvalidRoundState(r.state);
        if (r.sweepCursor != r.frozenTicketCount) revert SweepIncomplete(r.sweepCursor, r.frozenTicketCount);

        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(_encryptedWinnerCount[drawingRoundId]);
        handles[1] = FHE.toBytes32(_encryptedRandom[drawingRoundId]);
        FHE.checkSignatures(handles, abi.encode(winnerCount, randomValue), decryptionProof);

        r.revealedRandom = randomValue;
        emit ErnieRandomDrawn(drawingRoundId, randomValue, r.revealedTotal);

        if (winnerCount == 1) {
            r.state = RoundState.Settled;
            emit ErnieSettled(drawingRoundId, r.prizeAmount, randomValue);
            _openNext();
            return;
        }

        if (winnerCount == 0) {
            _rollover(r);
            return;
        }

        revert WinnerCountInvariantViolated(winnerCount);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _requireIdle() internal view {
        if (drawingRoundId == 0) return;
        RoundState s = _rounds[drawingRoundId].state;
        if (s != RoundState.Settled && s != RoundState.RolledOver) {
            revert InvalidRoundState(s);
        }
    }

    function _openNext() internal {
        uint64 id = pool.openNextRound();
        drawingRoundId = id;
        _rounds[id].state = RoundState.Open;
        _rounds[id].openedAt = uint64(block.timestamp);
    }

    function _rollover(Round storage r) internal {
        r.state = RoundState.RolledOver;
        rolloverBalance += r.prizeAmount;
        emit ErnieRolledOver(drawingRoundId, r.prizeAmount);
        _openNext();
    }
}
