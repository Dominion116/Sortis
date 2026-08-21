# Sortis — agent notes

Living briefing for coding agents. Update this file at the end of every
implementation phase with what landed, what was decided, and what the next
phase should not re-litigate.

Source of truth for *what to build*: [`docs/implementation-plan.md`](docs/implementation-plan.md)
and [`docs/sortis-implementation.docx`](docs/sortis-implementation.docx).
Source of truth for *what is already true of the contracts*:
[`packages/contracts/README.md`](packages/contracts/README.md).

**Current status: Phase 5 of 13 complete.** Next is Phase 6 (contract test
suite, gas accounting, threat-model documentation).

---

## What this project is

A confidential no-loss prize savings protocol on the Zama Protocol (FHEVM).
Depositors put ERC-7984 confidential tokens into a pool; idle funds earn yield;
at the end of each round the yield is awarded to one depositor selected over
ciphertext. Principal is withdrawable at any time. The draw is publicly
verifiable without revealing who held which ticket.

Bounty: Zama Developer Program, Mainnet Season 4. Deadline 5 September 2026.

---

## Layout

```
packages/web         Next.js 16 landing page (Phase 1). App shell is Phase 8+.
packages/contracts   Hardhat + FHEVM mock coprocessor.
docs/                PRD and the 13-phase plan.
```

Contracts live at `packages/contracts`. Run compile/test/lint from there, or
via the root `contracts:*` npm scripts. `hardhat-deploy` is deliberately
absent (npm workspace hoisting breaks it); `scripts/deploy.ts` uses plain ethers.

---

## Hard rules that keep coming back

- Ticket `cumulative` is computed at append time. Do not move that cost to draw
  time. Do not rebuild cumulatives on withdraw: the gap is the rollover case.
- `cumulative` is granted to the pool only, never to the depositor. Decrypting
  two cumulatives recovers every deposit in between by subtraction.
- Every participant's `_claimable` slot is written on every draw, winners and
  losers, via `FHE.select`. If only the winner's slot changes, the state diff
  identifies them.
- A deposit credits what actually moved (`confidentialTransferFrom`'s return),
  never what was requested. ERC-7984 cannot revert on insufficient balance
  without leaking it.
- `IYieldSource` deals in plaintext `uint64`. Only the pool aggregate crosses
  that boundary. Per-user amounts never do.
- FHEVM config base is `ZamaEthereumConfig`, not `SepoliaConfig`. Covers
  mainnet, Sepolia and chainid 31337.
- `evmVersion: "cancun"` and the optimizer are load bearing.
- No em dash or en dash in user-facing copy (`brand-guidelines`).
- Unimplemented paths revert with a named error, never silently succeed.
- Public decryption in this toolchain is FHEVM 0.11:
  `FHE.makePubliclyDecryptable` on chain, `fhevm.publicDecrypt` off chain,
  `FHE.checkSignatures` on the way back. There is no `FHE.requestDecryption`.

---

## Phase log

### Phase 1 — Landing page and brand foundation (complete)

Shipped `packages/web` as a Next.js 16 App Router landing page with the Sortis
brand tokens, light/dark mode, and the PRD 4.2 section order plus a Powered-by
strip. Ciphertext-reveal exists as a reusable component fed mock data. No
wallet, no contracts.

### Phase 2 — Monorepo and contracts foundation (complete)

`packages/contracts` scaffolded from the FHEVM Hardhat template. Solidity
0.8.27, mock coprocessor, `@fhevm/solidity@0.11.1`, ERC-7984 via OpenZeppelin
confidential contracts. Skeletons for `SortisPool`, `SortisDraw`,
`IYieldSource`. CI at `.github/workflows/ci.yml`. ConfidentialUSDT mints and
transfers against the mock. `yields/` not `yield/` because TypeChain would emit
a `yield` reserved word.

### Phase 3 — Pool custody and the ticket model (complete)

`SortisPool.deposit` appends a ticket `(owner, amount, cumulative, active,
roundId)`, computes the encrypted running sum, tracks per-user encrypted
balances, grants the depositor decryption of their own balance/amount/active
flag. Eligibility: a ticket joins the *next* round. Cumulative-sum invariant
tested, including contiguous non-overlapping ranges.

Finding: on a *first* deposit, `cumulative` and the depositor's balance are the
same handle (`add(0, transferred)`). Safe (identical values) and pinned by two
tests. From the second ticket onward the handles diverge.

### Phase 4 — Withdrawals and yield source (complete)

`withdraw` voids a ticket with `FHE.select` so a second withdraw cannot mint.
Cumulatives above the voided ticket are not rebuilt. `IYieldSource` +
`MockYieldSource` (plaintext amounts, interest-first redeem, view includes
pending accrual). Pool `allocateToYield` / `recallFromYield` move a publicly
known aggregate. `MorphoYieldSource` remains a documented stub.

### Phase 5 — Draw engine (complete) — this session

`SortisDraw` is no longer a skeleton. A keeper-driven state machine runs:

1. `openRound` — first kick; later rounds open themselves on settle/rollover.
2. `closeRound` — requires expiry; freezes `eligibleTicketCount`; harvests
   `accrued()` into the pool; folds `rolloverBalance` into this prize; marks
   the encrypted total publicly decryptable.
3. `onTotalRevealed(total, proof)` — permissionless; `FHE.checkSignatures`
   against the stored total handle. Total of 0 rolls over (cannot `FHE.rem`
   by zero).
4. `drawRandom` — `FHE.randEuint64` then `FHE.rem(r, total)`. Random stays
   encrypted through the sweep; plaintext is published at settlement.
5. `stepDraw(batchSize)` — cursor-batched. Per ticket the pool computes
   `hit = le(prev, r) && lt(r, cumulative) && active` and credits
   `select(hit, prize, 0)` to `_claimable[owner]`. Winner count accumulates
   as `FHE.asEuint64(hit)`. Last batch marks winner-count and random publicly
   decryptable.
6. `settle(winnerCount, random, proof)` — invariant must decrypt to 1
   (Settled) or 0 (RolledOver). Any other value reverts
   `WinnerCountInvariantViolated` and *halts* the round.

The FHE range check lives in `SortisPool.sweepTicket`, not in `SortisDraw`,
because ticket handles are granted to the pool. The draw engine still owns
the state machine, the cursor and the winner-count ciphertext.

Two pool configs remain in `scripts/deploy.ts`: demo 300s, standard 24h.

Tests in `test/SortisDraw.test.ts` cover the three exit criteria (full round,
resumable sweep, deliberate void-then-rollover) plus empty-round rollover,
loser-slot writes, prize carry, and both round durations. Suite is 73 passing.

Gas added this phase: `stepDraw` ~416k first ticket, ~398k subsequent.

Do not "fix" these:

- `onTotalRevealed` / `settle` signatures are FHEVM 0.11 (`uint64` + proof
  bytes), not the Phase 2 skeleton's `(uint256, uint64, bytes[])`.
- Random is *not* emitted as plaintext at `drawRandom`. `ErnieRandomDrawn`
  fires in `settle`, matching `Round.revealedRandom` "available after
  settlement".
- A mid-sweep withdraw of the hit ticket is a valid rollover. That is how
  the rollover test is constructed (debugger-decrypt `r`, void that ticket,
  then step). In production `r` is still encrypted at that point.

---

## Next: Phase 6

Goal: turn the contracts from "working" into "production quality, beyond
proof of concept".

Deliverables called out in the plan:

- Full unit suite for every encrypted path (expand, do not replace, Phase 5).
- Property test: a random value across the full range selects exactly one
  active ticket, many seeded rounds.
- Explicit test that losers' storage slots are written (Phase 5 already
  checks handles are non-zero; Phase 6 should pin the write itself).
- Gas per ticket for the sweep, recorded in the README, used to pick a
  production `batchSize` default.
- Threat-model write-up mapping PRD 3.4 line by line.
- Coverage report with a real published number.

Claim/decrypt of `_claimable` is Phase 11, not Phase 6. Faucet and Sepolia
deploy are Phase 7. Frontend wallet/SDK is Phase 8.

---

## Commands

```bash
# from repo root
npm run contracts:compile
npm run contracts:test
npm run contracts:lint
npm run contracts:typecheck

# from packages/contracts
REPORT_GAS=true npm run test    # Phase 6 accounting
npm run coverage                # Phase 6 published number
```
