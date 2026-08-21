// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

import {IYieldSource} from "./interfaces/IYieldSource.sol";

/**
 * @title SortisPool
 * @notice Custody for the confidential prize savings pool. Accepts ERC-7984
 *         deposits, holds encrypted per-user balances, issues tickets, processes
 *         withdrawals, and routes idle funds to the configured yield source.
 *
 * @dev PHASE 3. The deposit path and round bookkeeping are implemented here.
 *      Withdrawals and yield routing remain Phase 4, the draw hooks Phase 5.
 *      The ticket storage layout is fixed and later phases must not casually
 *      change it, because both the draw engine and the frontend are written
 *      against it.
 *
 *      THE TICKET MODEL (PRD 3.2)
 *      Each deposit appends a ticket carrying a running `cumulative` sum rather
 *      than merely incrementing a balance. The cumulative is computed once at
 *      append time, at a cost of a single encrypted addition per deposit. That
 *      is what turns winner selection from a quadratic draw-time computation
 *      into a linear sweep, and encrypted operations are far too expensive to
 *      pay for quadratically.
 *
 *      Tickets therefore tile the number line into contiguous half-open ranges:
 *      ticket i owns `[cumulative(i-1), cumulative(i))`. A random value below
 *      the grand total lands in exactly one range, which is the whole trick.
 *
 *      Eligibility follows the Premium Bonds convention: a ticket must exist
 *      before a round opens to take part in that round's draw, so mid-round
 *      deposits roll into the next round.
 */
contract SortisPool is ZamaEthereumConfig, Ownable, ReentrancyGuardTransient {
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

    /// @notice Thrown when a constructor or setter is handed the zero address.
    error ZeroAddress();

    /**
     * @notice Thrown when the depositor has not made this pool an ERC-7984 operator.
     * @dev The token would revert on its own, but with a generic spender error.
     *      Failing here instead gives the Phase 9 deposit flow something specific
     *      to react to, since "approve the pool" is a recoverable user action
     *      rather than a bug.
     */
    error DepositNotApproved(address depositor);

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

    /**
     * @notice How many tickets are eligible for the currently open round.
     * @dev Tickets are appended in order and their `roundId` never decreases, so
     *      the eligible set is always a prefix of `_tickets`. Snapshotting the
     *      length when a round opens therefore captures eligibility in O(1),
     *      and Phase 5's `closeRound` freezes the sweep against this figure
     *      rather than re-deriving it per ticket.
     */
    uint256 public eligibleTicketCount;

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
        if (asset_ == address(0)) revert ZeroAddress();

        asset = asset_;
        roundDuration = roundDuration_;

        // Round 0 is deliberately left open as the pre-open state. Deposits made
        // now are eligible for round 1, which the keeper opens once the pool is
        // wired. Nothing has to be deposited "before deployment finishes" for a
        // depositor to make the first real draw.
        roundOpenedAt = uint64(block.timestamp);
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

    /// @notice The round a deposit made right now would first be eligible for.
    function nextEligibleRoundId() external view returns (uint64) {
        return currentRoundId + 1;
    }

    /// @notice When the currently open round is due to close.
    function roundEndsAt() external view returns (uint64) {
        return roundOpenedAt + roundDuration;
    }

    /// @notice Whether the open round has run its full duration.
    /// @dev A read for the Phase 10 keeper and the countdown UI. It does not
    ///      close anything on its own; only the draw engine closes rounds.
    function isRoundExpired() external view returns (bool) {
        return block.timestamp >= roundOpenedAt + roundDuration;
    }

    /**
     * @notice Encrypted grand total staked in the currently open round.
     * @dev The last eligible ticket's cumulative IS the total, which is why the
     *      cumulative is worth an encrypted addition per deposit. Returns an
     *      uninitialised handle when the round has no eligible tickets, and
     *      Phase 5 treats that as "no draw to run" rather than as a total of 0.
     */
    function roundTotalHandle() external view returns (euint64) {
        if (eligibleTicketCount == 0) return euint64.wrap(0);
        return _tickets[eligibleTicketCount - 1].cumulative;
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
    // Deposits — Phase 3
    // ---------------------------------------------------------------------

    /**
     * @notice Deposit a confidential amount and receive a ticket for the next round.
     *
     * @param encryptedAmount Ciphertext handle produced by the relayer SDK, bound
     *                        to this contract and to `msg.sender`.
     * @param inputProof      Zero-knowledge proof that the ciphertext is well formed.
     * @return ticketId       Index of the appended ticket, also the sweep's cursor value.
     *
     * @dev The depositor must first call `setOperator(pool, until)` on the asset,
     *      which is ERC-7984's approval equivalent.
     *
     *      THE AMOUNT CREDITED IS THE AMOUNT THAT ACTUALLY MOVED
     *      ERC-7984 transfers cannot revert on insufficient balance without
     *      leaking the balance, so `confidentialTransferFrom` clamps and returns
     *      what really moved. Crediting the *requested* amount instead of the
     *      returned one would let anyone mint pool credit from an empty wallet.
     *      Every line below therefore uses `transferred`.
     *
     *      An over-large deposit consequently succeeds with a transferred amount
     *      of zero and appends a zero-width ticket, `[C, C)`, which no random
     *      value can ever land in. That is the correct outcome and it is not
     *      rejected, because rejecting it would require branching on an encrypted
     *      comparison, and that branch is exactly the balance leak the standard
     *      is avoiding.
     */
    function deposit(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant returns (uint256 ticketId) {
        if (!IERC7984(asset).isOperator(msg.sender, address(this))) {
            revert DepositNotApproved(msg.sender);
        }

        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);

        // The token has to be able to compute over the amount to move it. The
        // grant is transient, so it lasts this transaction only.
        FHE.allowTransient(requested, asset);
        euint64 transferred = IERC7984(asset).confidentialTransferFrom(msg.sender, address(this), requested);

        // Persist the pool's own access to every handle it is about to store.
        // Without this the values would be unusable in later transactions, and
        // the failure would surface at draw time rather than here.
        FHE.allowThis(transferred);

        euint64 previousCumulative = _tickets.length == 0
            ? euint64.wrap(0)
            : _tickets[_tickets.length - 1].cumulative;

        // The single encrypted addition per deposit that the whole draw design
        // is built to buy. `FHE.add` treats the uninitialised first cumulative
        // as zero, so the empty-pool case needs no special handling.
        euint64 cumulative = FHE.add(previousCumulative, transferred);
        FHE.allowThis(cumulative);

        ebool active = FHE.asEbool(true);
        FHE.allowThis(active);

        // Eligibility: this ticket joins the NEXT round, never the open one.
        uint64 eligibleFrom = currentRoundId + 1;

        ticketId = _tickets.length;
        _tickets.push(
            Ticket({owner: msg.sender, amount: transferred, cumulative: cumulative, active: active, roundId: eligibleFrom})
        );

        euint64 newBalance = FHE.add(_balances[msg.sender], transferred);
        _balances[msg.sender] = newBalance;
        FHE.allowThis(newBalance);

        // What the depositor may read: their own running balance, their own
        // ticket amount, and whether that ticket is still live.
        FHE.allow(newBalance, msg.sender);
        FHE.allow(transferred, msg.sender);
        FHE.allow(active, msg.sender);

        // What the depositor may NOT read: `cumulative`. It is granted to this
        // contract only, and that restriction is load bearing rather than
        // cautious. A user who could decrypt two of their own cumulatives would
        // recover the sum of every deposit made in between by subtraction, which
        // is precisely the information the pool exists to keep private. Only the
        // round's final total is ever made public, by the Phase 5 oracle
        // request, and only because a verifiable draw requires it.

        emit Deposited(msg.sender, ticketId, eligibleFrom);
    }

    // ---------------------------------------------------------------------
    // Withdrawals — Phase 4
    // ---------------------------------------------------------------------

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
    // Round bookkeeping — Phase 3
    // ---------------------------------------------------------------------

    /**
     * @notice Open the next round and freeze the eligible ticket set.
     * @return The id of the round now open.
     * @dev Called by `SortisDraw` as the last step of settling the previous
     *      round. Every ticket appended before this call becomes eligible;
     *      everything appended after it waits for the round after this one.
     */
    function openNextRound() external onlyDrawEngine returns (uint64) {
        uint64 opened = currentRoundId + 1;

        currentRoundId = opened;
        roundOpenedAt = uint64(block.timestamp);
        eligibleTicketCount = _tickets.length;

        emit RoundOpened(opened, roundOpenedAt, eligibleTicketCount);
        return opened;
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
}
