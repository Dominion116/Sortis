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
 * @dev PHASE 5. Deposits, withdrawals, yield routing and the draw-engine hooks
 *      (publishing the round total, the per-ticket sweep, crediting claimable)
 *      are implemented here. The ticket storage layout is fixed and later
 *      phases must not casually change it, because both the draw engine and the
 *      frontend are written against it.
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

    /// @notice Thrown when a caller other than the configured draw engine calls a draw-only path.
    error OnlyDrawEngine();

    /// @notice Thrown when the open round has no encrypted total to publish.
    error NoRoundTotal();

    /// @notice Thrown when a constructor or setter is handed the zero address.
    error ZeroAddress();

    /// @notice Thrown when `ticketId` is outside the appended list.
    error InvalidTicket(uint256 ticketId);

    /// @notice Thrown when a caller tries to withdraw a ticket they do not own.
    error NotTicketOwner(uint256 ticketId);

    /// @notice Thrown when a yield-routing call is made before a source is configured.
    error YieldSourceNotSet();

    /// @notice Thrown when a caller other than the owner or the draw engine routes yield.
    error UnauthorizedYieldRouter();

    /**
     * @notice Thrown when the depositor has not made this pool an ERC-7984 operator.
     * @dev The token would revert on its own, but with a generic spender error.
     *      Failing here instead gives the Phase 9 deposit flow something specific
     *      to react to, since "approve the pool" is a recoverable user action
     *      rather than a bug.
     */
    error DepositNotApproved(address depositor);

    /// @notice Thrown when a claim request decrypts to zero.
    error NothingToClaim();

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

    /// @dev Owner configures the source; the draw engine harvests prizes from it.
    modifier onlyYieldManager() {
        if (msg.sender != owner() && msg.sender != drawEngine) revert UnauthorizedYieldRouter();
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

    /**
     * @notice Claim part or all of the caller's encrypted winnings.
     * @dev The requested amount stays encrypted. The pool clamps it to the
     *      caller's claimable balance, updates the encrypted slot, and sends
     *      the confidential token without exposing the amount onchain.
     */
    function claim(externalEuint64 encryptedAmount, bytes calldata inputProof) external nonReentrant {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 available = _claimable[msg.sender];
        ebool canClaim = FHE.le(requested, available);
        euint64 amount = FHE.select(canClaim, requested, available);
        FHE.allowThis(amount);
        _claimable[msg.sender] = FHE.sub(available, amount);
        FHE.allowThis(_claimable[msg.sender]);
        FHE.allow(_claimable[msg.sender], msg.sender);
        IERC7984(asset).confidentialTransfer(msg.sender, amount);
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
    function roundTotalHandle() public view returns (euint64) {
        if (eligibleTicketCount == 0) return euint64.wrap(0);
        return _tickets[eligibleTicketCount - 1].cumulative;
    }

    /**
     * @notice Interest earned on idle funds and not yet swept into a prize.
     * @dev Forwards to the configured yield source. Returns 0 when none is set,
     *      so the Phase 9 statistics strip can read this unconditionally.
     */
    function accrued() external view returns (uint64) {
        if (address(yieldSource) == address(0)) return 0;
        return yieldSource.accrued();
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    /**
     * @notice Point the pool at a yield backend, or at `address(0)` to unset.
     * @dev Grants the new source operator rights over this pool's confidential
     *      token so `allocateToYield` can move a publicly known aggregate in.
     *      Individual deposits never take that path: they stay encrypted here
     *      so a withdrawal does not have to wait on an oracle.
     */
    function setYieldSource(address newSource) external onlyOwner {
        address previous = address(yieldSource);
        if (previous != address(0) && previous != newSource) {
            IERC7984(asset).setOperator(previous, 0);
        }

        emit YieldSourceUpdated(previous, newSource);
        yieldSource = IYieldSource(newSource);

        if (newSource != address(0)) {
            IERC7984(asset).setOperator(newSource, type(uint48).max);
        }
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
            Ticket({
                owner: msg.sender,
                amount: transferred,
                cumulative: cumulative,
                active: active,
                roundId: eligibleFrom
            })
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
        // cautious. A user who could decrypt two cumulatives would recover the
        // sum of every deposit made in between by subtraction, which is
        // precisely the information the pool exists to keep private. Only the
        // round's final total is ever made public, by the Phase 5 oracle
        // request, and only because a verifiable draw requires it.
        //
        // One caveat, found by test rather than by reading: FHEVM handles are
        // deterministic hashes of the operation and its operands, so on the very
        // first deposit `cumulative` and the depositor's balance are both
        // `add(0, transferred)` and are therefore the SAME handle, which the
        // grant above makes readable. That is safe, because handles collide only
        // when the operands do, and identical operands mean identical values:
        // the depositor learns nothing beyond their own deposit. From the second
        // ticket onward the chain includes somebody else's amount, the handles
        // diverge, and the restriction bites. There is a test pinning both
        // halves of this so a change in handle derivation cannot pass silently.

        emit Deposited(msg.sender, ticketId, eligibleFrom);
    }


    // ---------------------------------------------------------------------
    // Withdrawals — Phase 4
    // ---------------------------------------------------------------------

    /**
     * @notice Withdraw a ticket's principal, available at any time including mid-round.
     * @dev Marks the ticket inactive WITHOUT rebuilding the cumulative sums above
     *      it. Rebuilding is linear and would have to run on every withdrawal, so
     *      the gap is left in place and handled at draw time as a rollover. That
     *      is a documented outcome, not a defect (PRD 3.3).
     *
     *      `active` is encrypted, so a second withdraw cannot be reverted on
     *      without decrypting it. The transfer is therefore gated with `FHE.select`:
     *      a live ticket sends its amount, an already-voided one sends zero, and
     *      a double-withdraw cannot mint extra tokens.
     */
    function withdraw(uint256 ticketId) external nonReentrant {
        if (ticketId >= _tickets.length) revert InvalidTicket(ticketId);

        Ticket storage t = _tickets[ticketId];
        if (t.owner != msg.sender) revert NotTicketOwner(ticketId);

        euint64 toSend = FHE.select(t.active, t.amount, FHE.asEuint64(0));
        FHE.allowThis(toSend);

        ebool inactive = FHE.asEbool(false);
        FHE.allowThis(inactive);
        FHE.allow(inactive, msg.sender);
        t.active = inactive;

        euint64 newBalance = FHE.sub(_balances[msg.sender], toSend);
        _balances[msg.sender] = newBalance;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);

        FHE.allowTransient(toSend, asset);
        IERC7984(asset).confidentialTransfer(msg.sender, toSend);

        emit Withdrawn(msg.sender, ticketId, t.roundId);
    }

    // ---------------------------------------------------------------------
    // Yield routing — Phase 4
    // ---------------------------------------------------------------------

    /**
     * @notice Move a publicly known amount of idle funds into the yield source.
     * @dev Amounts on this path are plaintext by construction: only the pool
     *      aggregate ever crosses the yield boundary (see {IYieldSource}).
     *      Individual deposits never take this path; they stay encrypted in the
     *      pool so they can be withdrawn without waiting on an oracle. Tests
     *      call this with known amounts; Phase 5 uses it after a round total is
     *      publicly decrypted.
     */
    function allocateToYield(uint64 amount) external nonReentrant onlyYieldManager {
        if (address(yieldSource) == address(0)) revert YieldSourceNotSet();
        yieldSource.deposit(amount);
    }

    /**
     * @notice Redeem a publicly known amount from the yield source and send it to `to`.
     * @dev Used to return principal to this pool, and in Phase 5 to harvest
     *      accrued interest as the round's prize.
     */
    function recallFromYield(uint64 amount, address to) external nonReentrant onlyYieldManager {
        if (address(yieldSource) == address(0)) revert YieldSourceNotSet();
        if (to == address(0)) revert ZeroAddress();
        yieldSource.withdraw(amount, to);
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
     * @notice Mark the open round's encrypted grand total as publicly decryptable.
     * @dev The handle lives on this contract (it is the last eligible ticket's
     *      cumulative), so only this contract can flip the ACL. The draw engine
     *      then fetches a KMS proof off-chain and submits it to `onTotalRevealed`.
     *      Called once per close, before randomness is drawn, so the candidate
     *      set is committed in public before anyone can know the draw.
     */
    function publishRoundTotal() external onlyDrawEngine returns (euint64 total) {
        total = roundTotalHandle();
        if (euint64.unwrap(total) == 0) revert NoRoundTotal();
        FHE.makePubliclyDecryptable(total);
    }

    /**
     * @notice Walk one ticket: compute the encrypted range-membership boolean,
     *         and credit the (possibly zero) prize to its owner.
     * @dev The FHE work lives here rather than on `SortisDraw` because the
     *      ticket handles are granted to this contract only. Crossing that
     *      boundary would mean an extra `FHE.allow` per field per ticket, paid
     *      on every sweep. The draw engine still owns the state machine, the
     *      cursor and the winner-count accumulator; it just cannot see the
     *      plaintext of `hit`.
     *
     *      `randomValue` and `prize` must have been `FHE.allowTransient`'d to
     *      this contract by the caller in the same transaction.
     *
     * @return hit Encrypted "this ticket's range contains r and is still live".
     *             Granted to the draw engine so it can add it into the
     *             winner-count ciphertext.
     */
    function sweepTicket(
        uint256 ticketId,
        euint64 randomValue,
        euint64 prize
    ) external onlyDrawEngine returns (ebool hit) {
        if (ticketId >= _tickets.length) revert InvalidTicket(ticketId);

        Ticket storage t = _tickets[ticketId];
        euint64 prevCumulative = ticketId == 0 ? euint64.wrap(0) : _tickets[ticketId - 1].cumulative;

        // Ticket i owns [cumulative(i-1), cumulative(i)). Inactive tickets still
        // occupy their range; a hit that fails the `active` check is the
        // rollover case, not a skip-to-neighbour.
        ebool lower = FHE.le(prevCumulative, randomValue);
        ebool upper = FHE.lt(randomValue, t.cumulative);
        hit = FHE.and(FHE.and(lower, upper), t.active);

        euint64 addend = FHE.select(hit, prize, FHE.asEuint64(0));
        FHE.allowThis(addend);
        _creditClaimable(t.owner, addend);

        // The draw engine needs `hit` to accumulate the winner-count invariant.
        FHE.allowThis(hit);
        FHE.allow(hit, msg.sender);
    }

    /**
     * @notice Credit an encrypted (possibly zero) prize to a ticket owner.
     * @dev Called once per ticket per sweep batch, for winners and losers
     *      alike, with the amount gated by `FHE.select`. Uniform writes are
     *      the privacy guarantee: if only the winner's slot changed, the
     *      state diff alone would identify them.
     */
    function creditClaimable(address account, euint64 amount) external onlyDrawEngine {
        _creditClaimable(account, amount);
    }

    function _creditClaimable(address account, euint64 amount) private {
        euint64 newClaimable = FHE.add(_claimable[account], amount);
        _claimable[account] = newClaimable;
        FHE.allowThis(newClaimable);
        FHE.allow(newClaimable, account);
    }
}
