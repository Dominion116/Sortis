# Sortis contracts

Hardhat workspace for the Sortis confidential prize savings protocol. Encrypted
state and the draw itself are implemented with [`@fhevm/solidity`](https://docs.zama.ai)
on the Zama Protocol; the pool's token is ERC-7984 via OpenZeppelin's
confidential contracts.

> **Status: Phase 2 of 13 complete.** The toolchain, the repository layout and
> the contract skeletons are in place, and the ERC-7984 integration is proven
> against the mock coprocessor. Deposits (Phase 3), withdrawals and yield
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
