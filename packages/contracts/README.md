# Sortis contracts

Hardhat workspace for the Sortis confidential prize savings protocol. Encrypted
state and the draw itself are implemented with [`@fhevm/solidity`](https://docs.zama.ai)
on the Zama Protocol; the pool's token is ERC-7984 via OpenZeppelin's
confidential contracts.

> **Status: Phase 6 of 13 complete.** The contract suite is past "it works":
> every encrypted path is under test against the mock coprocessor, including a
> property test that a random value across the full range selects exactly one
> active ticket, and a storage-diff test that losers' claimable slots are
> rewritten on every draw. Sweep gas and HCU are measured; the keeper default
> batch size is 8. Statement coverage is 97.1% (98.1% of lines). The threat
> model lives in the root README and is checked against PRD 3.4. Phase 7 is
> Sepolia deployment, the faucet, and publishing addresses.


## Layout

```
contracts/
  SortisPool.sol              Custody, encrypted balances, the ticket list
  SortisDraw.sol              The draw engine ("ERNIE"): close, draw, sweep, settle
  interfaces/IYieldSource.sol The swappable yield seam
  token/ConfidentialUSDT.sol  ERC-7984 test token (cUSDT)
  yields/MockYieldSource.sol  Sepolia only, simulated accrual
  yields/MorphoYieldSource.sol Mainnet path, deliberately not deployed
test/                         Mocha + chai against the FHEVM mock coprocessor
scripts/deploy.ts             Deployment and wiring
```

The directory is `yields/`, not `yield/`, because TypeChain generates
`export * as yield from ...` per source directory and `yield` is a reserved word
in strict-mode TypeScript, which breaks the generated types.

## Setup

```bash
# From the repository root, so npm resolves the workspace graph.
npm install

cp packages/contracts/.env.example packages/contracts/.env
```

`.env` is only needed to touch Sepolia. The test suite runs entirely in process
against the mock coprocessor and needs no RPC URL, no key and no relayer.

## Commands

Run from `packages/contracts`, or from the root with `npm run <script> --workspace=contracts`.

| Command | Purpose |
|---|---|
| `npm run compile` | Compile with solc 0.8.27, Cancun, optimizer on |
| `npm run test` | Full suite against the mock coprocessor, no network |
| `npm run lint` | solhint over `contracts/**/*.sol` |
| `npm run typecheck` | `tsc --noEmit` over config, tests and deploy scripts |
| `npm run coverage` | solidity-coverage against the mock (set `SOLIDITY_COVERAGE=true`, or just run this: `hardhat.config.ts` sets it when the coverage task is invoked) |
| `REPORT_GAS=true npm run test` | Adds the hardhat-gas-reporter table |
| `npm run deploy:sepolia` | Deploy and wire the contract set (Phase 7) |

## Toolchain notes

Two settings in `hardhat.config.ts` are load bearing and should not be
"tidied up":

- **`evmVersion: "cancun"`.** The coprocessor precompiles assume it. Lowering
  this breaks every FHE operation.
- **`optimizer.enabled: true`.** FHEVM contracts are large enough that the
  optimizer is not optional if they are to fit the deployment size limit.

The Mocha timeout is set to 180s because encrypted operations under the mock are
genuinely slow, not because tests are hanging.

## Design decisions worth knowing before editing

- **Ticket cumulative sums are computed at append time**, one encrypted addition
  per deposit. This is what makes the draw a linear sweep instead of a quadratic
  draw-time computation. Do not move this cost to draw time.
- **`IYieldSource` deals in plaintext `uint64`.** Only the pool aggregate crosses
  that boundary, and the aggregate is deliberately public: the prize is computed
  from it, so hiding it would make a draw impossible to verify. Per-user amounts
  never reach a yield source. User principal therefore stays encrypted in the
  pool (so `withdraw(ticketId)` does not wait on an oracle); `allocateToYield`
  is how a known aggregate is routed in to earn.
- **`MockYieldSource.withdraw` takes interest first.** Harvesting `accrued()` as
  a prize must not eat the principal that is still earning. Remaining amount, if
  any, is principal.
- **Withdrawals do not rebuild cumulative sums above the voided ticket.**
  Rebuilding is linear and would run on every withdrawal. The gap is left in
  place and resolves at draw time as a rollover, which is the same behaviour
  Premium Bonds has had since 1957.
- **Every participant's claimable slot is written on every draw**, winners and
  losers alike, via `FHE.select`. This is the privacy guarantee, not an
  inefficiency: if only the winner's slot changed, the state diff would identify
  them. A Phase 6 test reads the raw mapping storage word before and after two
  successive draws and asserts it moves for every participant, including anyone
  who lost both times.
- **Public decryption is FHEVM 0.11, not the old oracle callback.** There is no
  `FHE.requestDecryption` in `@fhevm/solidity@0.11.1`. Close marks the total
  `makePubliclyDecryptable`; the keeper (or anyone with a KMS proof) submits
  `onTotalRevealed`. The same pattern settles the winner-count invariant. The
  skeleton's `onTotalRevealed(uint256, uint64, bytes[])` signature was updated
  to match.
- **The FHE sweep loop runs inside `SortisPool.sweepTicket`.** Ticket handles
  are granted to the pool, not to the draw engine. Crossing that boundary would
  cost an extra `FHE.allow` per field per ticket, paid on every sweep.
  `SortisDraw` still owns the state machine, the cursor and the winner-count
  accumulator.
- **A deposit credits what actually moved, never what was requested.** ERC-7984
  cannot revert on insufficient balance without leaking the balance, so
  `confidentialTransferFrom` clamps and returns the real figure. Crediting the
  requested amount would let anyone mint pool credit from an empty wallet, so
  `deposit()` uses the returned `transferred` value everywhere. An over-large
  deposit therefore succeeds and appends a zero-width ticket that no random value
  can land in, which is the correct outcome rather than an edge case to reject.
- **`cumulative` is granted to the pool only, never to the depositor.** Anyone
  able to decrypt two cumulatives recovers the sum of every deposit made between
  them by subtraction. Only the round's final total is ever made public, and only
  because a verifiable draw requires it.

## Gas and HCU accounting

Measured under the mock coprocessor. Most of the cost is FHEVM coprocessor work
rather than EVM storage: input-proof verification, confidential transfers, and
the encrypted additions, comparisons and selects. Figures are recorded rather
than asserted against a threshold, since a bound in the test suite would only
pin today's coprocessor pricing in place as a requirement.

| Path | Gas | Notes |
|---|---|---|
| First deposit into an empty pool (cold storage) | ~706,000 | |
| Subsequent deposit (warm storage) | ~665,000 | |
| Withdraw a live ticket | ~494,000 | |
| `stepDraw` batch of 1 | ~416,000 (~416k/ticket) | HCU global 724,160, depth 416,032 |
| `stepDraw` batch of 2 | ~721,000 (~361k/ticket) | HCU global 1,448,224, depth 523,032 |

HCU (homomorphic compute units) are the coprocessor's own meter. The protocol
caps a transaction at 20,000,000 global HCU and 5,000,000 sequential depth.
Global HCU scales roughly linearly with tickets in the batch (~724k each).
Depth grows with the winner-count accumulator: about 416k for the first ticket
plus ~107k for each additional one in the same transaction.

`SortisDraw.DEFAULT_BATCH_SIZE` is **8**. At the numbers above that is about
2.9M gas, 5.8M global HCU (29% of the cap) and ~1.2M depth (24% of the cap).
A batch of 16 would still fit, but 8 leaves headroom if coprocessor pricing
moves, and a 5-minute demo pool will not have hundreds of tickets. The keeper
can always pass a smaller size; `stepDraw` does not hard-code the constant.


## Verified toolchain versions

Pinned exactly, because the FHEVM peer graph is strict and a floating range here
produces an unresolvable install rather than a warning:

| Package | Version |
|---|---|
| `@fhevm/solidity` | 0.11.1 |
| `@fhevm/hardhat-plugin` | 0.4.2 |
| `@fhevm/mock-utils` | 0.4.2 |
| `@zama-fhe/relayer-sdk` | 0.4.1 |
| `@openzeppelin/confidential-contracts` | 0.5.3 |
| `hardhat` | 2.29.1 |

Note that the FHEVM config base contract is `ZamaEthereumConfig`, not the
`SepoliaConfig` shown in older Zama examples. It covers mainnet, Sepolia and
chainid 31337, so the same contract works under the mock and on Sepolia.

`hardhat-deploy` is deliberately absent. In an npm workspace it hoists to the
repo root while `hardhat` nests under `packages/contracts`, and the plugin then
cannot resolve `hardhat/types/runtime`. `scripts/deploy.ts` uses plain ethers.

## Phase 2 exit criteria

- [x] `hardhat compile` and `hardhat test` succeed — 13 passing
- [x] A confidential token can be minted and transferred against the mock
      coprocessor, including the off-chain ciphertext + input-proof path, with a
      test asserting a third party *cannot* decrypt someone else's balance
- [x] `solhint` reports zero problems and `tsc --noEmit` is clean
- [x] CI skeleton (compile, lint, typecheck, test) at `.github/workflows/ci.yml`
- [x] Repository layout matches the PRD's target tree
- [x] `.env.example` present for RPC URL, deployer key and Etherscan key

## Phase 3 exit criteria

- [x] `hardhat compile` and `hardhat test` succeed — 35 passing
- [x] Deposit, ticket-append and cumulative-sum sequence unit tested against the
      mock coprocessor, including the stated invariant: after N deposits the last
      ticket's `cumulative` decrypts to the sum of every ticket amount
- [x] Ranges proven contiguous and non-overlapping, so a random value selects
      exactly one ticket rather than none or two
- [x] Cumulative chain proven correct across interleaved depositors, not just for
      a single depositor
- [x] Round eligibility proven: a mid-round deposit is tagged for the next round
      and excluded from the open round's total
- [x] Depositor can decrypt their own balance and their own ticket amount, and
      cannot decrypt another depositor's balance or an aggregating cumulative
- [x] Gas cost of a single deposit measured and recorded above
- [x] `solhint` reports zero problems and `tsc --noEmit` is clean

One finding worth carrying forward: on a *first* deposit the ticket's
`cumulative` and the depositor's balance are computed from identical operands,
`add(0, transferred)`, and FHEVM derives handles deterministically from the
operation and its operands, so the two are literally the same handle and the
grant over the balance carries to the cumulative. This is safe, because colliding
handles mean identical values and the depositor learns nothing beyond their own
deposit, but it is pinned by two tests rather than left to be rediscovered: one
asserting the aliasing exists, one asserting that a cumulative aggregating
somebody else's deposit is unreadable by everyone.

## Phase 4 exit criteria

- [x] `hardhat compile` and `hardhat test` succeed — 61 passing
- [x] Withdraw path unit tested: principal returns, the ticket's `active` flag
      flips to false, and a second withdraw cannot mint extra tokens
- [x] Cumulative-gap invariant: after a withdrawal the sums of tickets appended
      after it are untouched, and a later deposit continues the chain *including*
      the gap rather than closing it
- [x] Mid-round withdrawal is allowed and does not shrink `eligibleTicketCount`
- [x] `MockYieldSource` accrual is visible from the view within minutes of
      simulated time at the configured rate, with no harvest required
- [x] `SortisPool.accrued()` forwards to the configured source (and returns 0
      when none is set); `allocateToYield` / `recallFromYield` move a publicly
      known aggregate across the yield boundary
- [x] `solhint` reports zero problems and `tsc --noEmit` is clean

## Phase 5 exit criteria

- [x] `hardhat compile` and `hardhat test` succeed — 73 passing
- [x] A full round (close → decrypt total → draw random → sweep in batches →
      settle) completes against the mock coprocessor, with exactly one winner
      credited the harvested prize and losers credited zero
- [x] Sweep is resumable: cursor persists across transactions, `settle` reverts
      with `SweepIncomplete` until the cursor reaches the frozen ticket count
- [x] Rollover: voiding the ticket the random value would have hit produces
      winner-count 0, no prize credited, and the prize carried into
      `rolloverBalance`
- [x] Empty eligible set at close rolls over immediately, without consuming
      randomness
- [x] Two pool configurations exist in `scripts/deploy.ts`: demo (300s) and
      standard (24h), both exercised in tests
- [x] `solhint` reports zero problems and `tsc --noEmit` is clean

## Phase 6 exit criteria

- [x] `hardhat compile` and `hardhat test` succeed — 89 passing
- [x] Property test: across 20 seeded ticket lists, every `r` in `[0, total)`
      selects at most one active ticket, exactly one when nothing is voided,
      and the on-chain random value matches the same geometry
- [x] Losers' storage slots are written: the claimable mapping word changes
      for every participant on every draw, including anyone who lost twice
- [x] Gas and HCU per ticket recorded above; `DEFAULT_BATCH_SIZE = 8`
- [x] Threat model in the root README, checked against PRD 3.4 line by line
- [x] Coverage is a real published number: **97.1% statements, 98.1% lines**
      (94.4% functions, 79.1% branches). `MorphoYieldSource` is skipped as a
      documented stub. The one deliberately unhit revert is
      `WinnerCountInvariantViolated`, which requires the KMS to sign a count
      the coprocessor never produces
- [x] `solhint` reports zero problems and `tsc --noEmit` is clean


