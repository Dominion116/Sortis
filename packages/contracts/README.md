# Sortis contracts

Hardhat workspace for the Sortis confidential prize savings protocol. Encrypted
state and the draw itself are implemented with [`@fhevm/solidity`](https://docs.zama.ai)
on the Zama Protocol; the pool's token is ERC-7984 via OpenZeppelin's
confidential contracts.

> **Status: Phase 3 of 13 complete.** The toolchain, the repository layout and
> the ERC-7984 integration are proven against the mock coprocessor, and the
> pool now takes confidential deposits, maintains the encrypted ticket list with
> its cumulative sums, and tracks round eligibility. Withdrawals and yield
> (Phase 4) and the draw engine (Phase 5) are not implemented yet. Every such
> path reverts with `NotImplemented()` rather than silently succeeding, so
> nothing can be accidentally built on top of a no-op.


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
| `npm run coverage` | solidity-coverage (real figure published in Phase 6) |
| `REPORT_GAS=true npm run test` | Adds the gas report (Phase 6 accounting) |
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
  never reach a yield source.
- **Withdrawals do not rebuild cumulative sums above the voided ticket.**
  Rebuilding is linear and would run on every withdrawal. The gap is left in
  place and resolves at draw time as a rollover, which is the same behaviour
  Premium Bonds has had since 1957.
- **Every participant's claimable slot is written on every draw**, winners and
  losers alike, via `FHE.select`. This is the privacy guarantee, not an
  inefficiency: if only the winner's slot changed, the state diff would identify
  them. Phase 6 adds a dedicated regression test for it because a failure here
  would otherwise be silent.
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

## Deposit gas baseline

Measured under the mock coprocessor, single deposit, recorded here as the Phase 3
baseline that Phase 6's full accounting builds on:

| Path | Gas |
|---|---|
| First deposit into an empty pool (cold storage) | ~705,000 |
| Subsequent deposit (warm storage) | ~665,000 |

Most of this is FHEVM coprocessor work rather than EVM storage: one input-proof
verification, one confidential transfer, and the encrypted additions for the
cumulative and the running balance. The figure is recorded rather than asserted
against a threshold, since a bound in the test suite would only pin today's
coprocessor pricing in place as a requirement.


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


