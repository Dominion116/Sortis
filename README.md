# Sortis.

**A confidential prize savings protocol on the Zama Protocol.**

Sortis is a no-loss prize savings pool. You deposit a confidential token, your deposit sits in a shared pool earning yield, and at the end of each round the yield is handed to one depositor as a prize instead of being spread thinly across everyone. Nobody loses their principal — you can withdraw it at any time. The only thing at stake is the interest you would otherwise have earned.

Balances, deposits and winnings are encrypted end to end using fully homomorphic encryption (FHE). The draw itself runs over ciphertext, so the contract selects a winner without ever learning who the participants are or how much they hold. Only the winner can decrypt their own prize — and the fairness of the draw stays publicly checkable by anyone.

| | |
|---|---|
| **Program** | [Zama Developer Program, Mainnet Season 4](https://www.zama.org/post/zama-developer-program-mainnet-season-4), Bounty Track |
| **Submission deadline** | 5 September 2026, 23:59 AOE |
| **Target network** | Ethereum Sepolia |
| **Status** | Phase 13 submission-readiness pass — live on Sepolia, verified, faucet open, and served by the web app — see [Implementation Plan](docs/implementation-plan.md) |

---

## Contents

- [Why Sortis](#why-sortis)
- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Routes](#routes)
- [Getting started](#getting-started)
- [Testing](#testing)
- [Deployed contracts](#deployed-contracts-sepolia)
- [Verifiability & threat model](#verifiability--threat-model)
- [Known limitations](#known-limitations)
- [Implementation plan](#implementation-plan)
- [Bounty compliance](#bounty-compliance)
- [License](#license)

---

## Why Sortis

The idea of a no-loss lottery is not new. Britain has been running one since 1957 under the name Premium Bonds, with winning numbers drawn by a machine called ERNIE, built by the same engineers who broke codes at Bletchley Park. PoolTogether brought the mechanism onchain in 2019.

The problem with the onchain version is that it gives up the one thing savers quietly care about: every deposit, every balance, every person's odds of winning, and every payout sits in public view on a block explorer, forever.

Sortis closes that gap. It uses fully homomorphic encryption so the pool can operate — and draw a winner — entirely over encrypted state. What stays public is exactly what a saver already expects to be public in any pooled savings product (the total value locked); what stays private is everything that identifies a person.

The name comes from the Latin *sors, sortis*: a lot, a share, a portion drawn by chance. It's the root of *sortition*, the practice of allocating something by drawing lots rather than by choice or influence — the same mechanism this protocol implements, named without naming the technology.

## How it works

1. **Deposit.** A user deposits a confidential ERC-7984 token. The pool appends a **ticket** — an encrypted amount plus a running encrypted cumulative sum — rather than just incrementing a balance.
2. **Yield.** Idle pool funds are routed to a pluggable yield source. Interest accrues to the pool, not to individual balances.
3. **Draw.** At the end of a round, the ticket list is frozen, the encrypted grand total is publicly decrypted, and the contract draws a random value onchain and reduces it modulo that total. The contract then sweeps every ticket over ciphertext to find the one whose cumulative range contains the random value — without ever decrypting who owns which ticket.
4. **Claim.** Every participant's encrypted claimable balance is written on every draw (winners *and* losers, via `FHE.select`), so no one can infer the outcome from which storage slots changed. Only the winner can decrypt a non-zero prize.
5. **Withdraw.** Principal is withdrawable at any time, including mid-round — doing so simply voids that round's ticket.

## Architecture

Three problems make this build genuinely hard; everything else is ordinary application engineering:

1. Selecting a winner weighted by encrypted balances without decrypting anything.
2. Producing believable yield on a testnet that has none.
3. Making the draw verifiable to an outside observer while keeping participants private.

### Contract set

| Contract | Responsibility |
|---|---|
| `SortisPool` | Custody. Accepts confidential token deposits, holds encrypted per-user balances, issues tickets, processes withdrawals, and routes idle funds to the yield source |
| `SortisDraw` | The draw engine. Snapshots the ticket set, requests encrypted randomness, sweeps the cumulative sums and credits the prize. Referred to as **ERNIE** in the interface and event names |
| `IYieldSource` | Minimal interface — `deposit`, `withdraw`, `accrued` — so the yield backend can be swapped without touching the pool |
| `MockYieldSource` | Sepolia only. Accrues a configurable rate against a pre-funded reserve so draws have something real to pay out |
| `MorphoYieldSource` | Mainnet path, written but not deployed. Targets the Steakhouse Confidential Prime USDC vault on Morpho |
| `SortisFaucet` | Mints test cUSDT to any address on a cooldown, for reviewers and demo users |

### The ticket model

Each ticket carries:

- `owner` — a plain address
- `amount` — an `euint64` holding the encrypted deposit
- `cumulative` — an `euint64` holding the running sum of every ticket up to and including this one
- `active` — an `ebool` that a withdrawal can flip to `false`

`cumulative` is computed at append time (one encrypted addition per deposit), turning what would otherwise be a quadratic draw-time computation into a linear one. Eligibility follows the Premium Bonds convention: a ticket must exist before the round opens to take part in that round's draw. Deposits made mid-round roll into the next one.

### Winner selection over ciphertext

```
ebool  lower = FHE.le(prevCumulative, r);
ebool  upper = FHE.lt(r, ticket.cumulative);
ebool  hit   = FHE.and(FHE.and(lower, upper), ticket.active);
euint64 add  = FHE.select(hit, prizeAmount, FHE.asEuint64(0));
claimable[ticket.owner] = FHE.add(claimable[ticket.owner], add);
```

1. The round closes; the ticket list is frozen and its length emitted.
2. The pool total (not its composition) is publicly decrypted via oracle callback.
3. The contract draws `r` using onchain encrypted randomness and reduces it modulo the plaintext total.
4. The sweep walks every ticket, computing an encrypted "is this the winning range" boolean per ticket.
5. **Every** ticket's owner — winner or not — receives an `FHE.select`-gated addition to their encrypted claimable balance. Uniform writes are what make the privacy guarantee real; if only the winner's slot changed, the state diff alone would reveal them.

Because encrypted operations are expensive, the sweep is **resumable**: `SortisDraw` keeps a cursor and a keeper calls `stepDraw` in batches until the cursor reaches the end. The frontend renders this as a live progress indicator rather than hiding it behind a spinner.

**Voided tickets.** A mid-round withdrawal marks a ticket inactive without rebuilding the cumulative sums above it (rebuilding is linear and would need to run on every withdrawal). If the random draw lands inside a voided range, no ticket qualifies, no prize is credited, and the prize rolls into the next round — the same behavior Premium Bonds and most real-world lotteries already have.

### Yield on a network that has none

Sepolia has no real yield. Rather than fake it silently, the yield source is a pluggable interface and the UI is explicit about which implementation is live. `MockYieldSource` accrues against a pre-funded reserve at a deliberately high rate so a demo round produces a visible prize in minutes, and every prize figure is labeled **simulated testnet yield**. `MorphoYieldSource` is written against the same interface, targets the Steakhouse Confidential Prime USDC vault on Morpho, and is not deployed — its presence demonstrates a real mainnet path rather than a mock permanently welded to the core contract.

## Tech stack

| Layer | Choice | Reasoning |
|---|---|---|
| Contracts | Solidity 0.8.27, Hardhat, `fhevm-hardhat-template` | Zama's own template; ships the mock coprocessor for local unit testing without a network |
| FHE library | `@fhevm/solidity` | `euint64` arithmetic, encrypted comparison, `FHE.select`, onchain encrypted randomness |
| Token standard | ERC-7984 via OpenZeppelin confidential contracts | The protocol standard for confidential tokens — audited, not bespoke |
| Frontend framework | Next.js 16 App Router, React 19, TypeScript | Already the working environment |
| Styling | Tailwind CSS v4 with shadcn/ui | Component primitives without a design system to fight |
| Motion | framer-motion | Used sparingly — mainly the draw sequence and balance reveal |
| Icons | lucide-react | Consistent line weight, no licensing questions |
| Wallet layer | Reown AppKit over wagmi v2 and viem | Broad wallet coverage, one connect surface |
| Encryption client | Zama Relayer SDK | Browser-side input encryption and the EIP-712 user decryption flow |
| Data | viem log reads with TanStack Query | No indexer to run or pay for — Sepolia log volume is trivial |
| Keeper | Vercel Cron calling a route handler | Triggers rounds and steps the draw sweep on a schedule |
| Hosting | Vercel | Preview deployments per branch, stable production URL for reviewers |

### Two integration traps

- **Relayer SDK is browser-only WebAssembly.** Importing it at module scope anywhere the App Router can touch during server rendering breaks the build. It must live behind a client-only dynamic import with `ssr: false`, initialize inside an effect, and gate every dependent call behind a `ready` flag.
- **Reown AppKit needs `ssr: true`** on the wagmi config with cookie storage — otherwise the first paint shows a disconnected wallet that snaps to connected, which reads as broken on first impression.

## Repository structure

```
sortis/
  packages/
    contracts/                Hardhat workspace
      contracts/
        SortisPool.sol
        SortisDraw.sol
        interfaces/IYieldSource.sol
        token/ConfidentialUSDT.sol    ERC-7984 test token (cUSDT)
        yields/MockYieldSource.sol
        yields/MorphoYieldSource.sol  (stub, mainnet path)
      test/
      scripts/deploy.ts
    web/                       Next.js 16 application
      app/
      components/
      lib/fhevm/               SDK bootstrap, decryption helpers
      lib/contracts/           generated ABIs and addresses
  docs/
    sortis-implementation.docx   original PRD
    implementation-plan.md       phased build plan
  README.md
```

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing page. No wallet required. Explains the product and sells the idea |
| `/app` | The pool — deposit, withdraw, current encrypted balance, ticket status |
| `/app/draws` | Round history, countdown to the next draw, live sweep progress |
| `/app/prizes` | Claim and decrypt winnings |
| `/verify/[roundId]` | Public verification of a single draw. No wallet required |
| `/faucet` | One-click test tokens |
| `/how-it-works` | Technical explanation, contract addresses, links to the repository |

## Getting started

> The workspace is complete through the submission-readiness phase (see the [implementation plan](docs/implementation-plan.md)). The contracts and both pool configurations are live and verified on Sepolia, the faucet mints test tokens, and the web app provides the pool, draw monitor, private prizes, public verification, and protocol guide.


### Prerequisites

- Node.js 20+
- npm or pnpm
- A Sepolia-funded wallet (for contract deployment and the keeper) — get Sepolia ETH from a public faucet
- A Reown (WalletConnect) project ID

### Install

```bash
git clone https://github.com/<org>/sortis.git
cd sortis
npm install
```

### Environment variables

Contracts (`packages/contracts/.env`):

```bash
SEPOLIA_RPC_URL=          # optional, falls back to a public Sepolia endpoint
DEPLOYER_PRIVATE_KEY=     # throwaway testnet key only
KEEPER_ADDRESS=           # optional, defaults to the deployer
ETHERSCAN_API_KEY=        # optional, Sourcify verification runs without it
```

Web (`packages/web/.env.local`):

```bash
NEXT_PUBLIC_REOWN_PROJECT_ID=
NEXT_PUBLIC_SEPOLIA_RPC_URL=
NEXT_PUBLIC_RELAYER_URL=
```

Vercel production-only variables:

```bash
CRON_SECRET=                 # shared secret for /api/cron/keeper
SORTIS_KEEPER_PRIVATE_KEY=   # Sepolia keeper hot key, never exposed to the browser
NEXT_PUBLIC_SEPOLIA_RPC_URL= # optional RPC override for the keeper and /api/rpc proxy
ZAMA_FHEVM_API_KEY=          # optional relayer authentication
```

Contract addresses are not environment variables. `deploy:sepolia` writes them into `packages/web/lib/contracts/addresses.ts`, which is committed, so a checkout points at the live deployment with no configuration.

### Run contracts

```bash
cd packages/contracts
npm run compile
npm run test                     # 102 passing, against the mock coprocessor
npm run lint && npm run typecheck

npm run deploy:sepolia           # deploy both pool configs, write deployments/sepolia.json
npm run verify:sepolia           # Sourcify v2 plus Etherscan, idempotent
npm run smoke:sepolia            # faucet drip to a fresh address, then a live deposit
```

`deploy:sepolia` also regenerates `packages/web/lib/contracts/addresses.ts`, so the frontend never carries hand-copied addresses. Note that re-running it deploys a *new* set of contracts rather than reusing the existing ones. The addresses below are already live, so there is no need to redeploy to try the protocol.

### Run the web app

```bash
cd packages/web
npm run dev
```

## Testing

- Unit tests against the Hardhat mock coprocessor for every encrypted path, including the cumulative-sum invariant
- A property test that a random value drawn across the full range selects exactly one active ticket, run over 20 seeded ticket lists
- An explicit test that the voided-ticket case produces a rollover rather than a silent failure or double credit
- A test asserting that losers' storage slots are rewritten on every draw. A regression here would silently destroy the privacy guarantee
- Gas and HCU measurement per ticket for the sweep, used to set `DEFAULT_BATCH_SIZE = 8` (see [contracts README](packages/contracts/README.md#gas-and-hcu-accounting))
- `npm run smoke:sepolia`, which drips the faucet to a freshly generated address and puts a real encrypted deposit through the live demo pool, so the encrypted path is proven against the actual coprocessor and relayer rather than only the mock
- The Sepolia smoke script covers faucet → encrypted deposit. The full deposit → round close → draw → claim → withdraw walkthrough is documented in [`docs/phase-13-checklist.md`](docs/phase-13-checklist.md) and requires a funded keeper, relayer access, and a wallet that wins a live draw.

**Coverage** (solidity-coverage against the mock coprocessor, `MorphoYieldSource` skipped as a documented stub):

| | Statements | Lines | Functions | Branches |
|---|---|---|---|---|
| All contracts | **97.1%** | **98.1%** | 94.4% | 79.1% |

The one revert the suite does not hit is `WinnerCountInvariantViolated`, which requires the KMS to sign a winner count the coprocessor never produces. A keeper who submits a mismatched count fails signature verification instead.

## Deployed contracts (Sepolia)

Every contract below is verified on both Etherscan and Sourcify, so the source you read is the source that runs. The canonical machine-readable record is [`packages/contracts/deployments/sepolia.json`](packages/contracts/deployments/sepolia.json), which is what generates [`packages/web/lib/contracts/addresses.ts`](packages/web/lib/contracts/addresses.ts).

Shared:

| Contract | Address |
|---|---|
| Confidential token (cUSDT) | [`0x0E8c04AFd8d4483b0925aF1b4E5a88dde28F0Ff0`](https://sepolia.etherscan.io/address/0x0E8c04AFd8d4483b0925aF1b4E5a88dde28F0Ff0) |
| `SortisFaucet` | [`0x5550e92d4C252763797948Fb751c7116809F7cdb`](https://sepolia.etherscan.io/address/0x5550e92d4C252763797948Fb751c7116809F7cdb) |

Demo pool, one round every 5 minutes, so a reviewer arriving at a random moment is never far from a complete draw:

| Contract | Address |
|---|---|
| `SortisPool` | [`0x2238975477e0F90B2084C5C64c61E41fFe7B8F97`](https://sepolia.etherscan.io/address/0x2238975477e0F90B2084C5C64c61E41fFe7B8F97) |
| `SortisDraw` | [`0x30E3eF09C9Ec68bd228f4593382dFF3fe9521E62`](https://sepolia.etherscan.io/address/0x30E3eF09C9Ec68bd228f4593382dFF3fe9521E62) |
| `MockYieldSource` | [`0x7C2dF99d75a14c224d8AD7d24311334f16B92237`](https://sepolia.etherscan.io/address/0x7C2dF99d75a14c224d8AD7d24311334f16B92237) |

Standard pool, one round every 24 hours, the round length a real savings product would use:

| Contract | Address |
|---|---|
| `SortisPool` | [`0xCCE648f68874F3bf15Bc713a02b8264a2fD0f990`](https://sepolia.etherscan.io/address/0xCCE648f68874F3bf15Bc713a02b8264a2fD0f990) |
| `SortisDraw` | [`0x31d445D5A59f74F139926Ccbc56C18ed506ed39e`](https://sepolia.etherscan.io/address/0x31d445D5A59f74F139926Ccbc56C18ed506ed39e) |
| `MockYieldSource` | [`0x41E2a43f1Bff35b230686B2B58121eA1CDfb1048`](https://sepolia.etherscan.io/address/0x41E2a43f1Bff35b230686B2B58121eA1CDfb1048) |

`MorphoYieldSource` is intentionally not deployed. It is the documented mainnet path, and a contract that reverts on every call would only be noise on a block explorer.

Each `MockYieldSource` is pre-funded, so a demo draw pays a real prize immediately rather than waiting for a depositor base to build up. Every prize figure is labelled **simulated testnet yield**.

## Verifiability & threat model

Checked against PRD section 3.4, claim by claim. The draw's fairness has to be checkable by someone who can never see who took part.

### What the protocol guarantees (PRD 3.4)

| PRD claim | How it is enforced |
|---|---|
| The ticket set is frozen and its length published before randomness is requested | `closeRound` snapshots `eligibleTicketCount` and emits `ErnieRoundClosed` *before* `drawRandom`. Mid-round deposits are tagged for the next round and are not in that prefix. |
| Randomness is generated onchain by the protocol, not supplied by an operator | `FHE.randEuint64()` inside `drawRandom`. The keeper can choose *when* to call it, not *what* it returns. The deployer has no extra input. |
| The random value is publicly decrypted after settlement; combined with the published total, anyone can confirm it fell inside the valid range | `ErnieRandomDrawn` and `Round.revealedRandom` are written in `settle`, after the sweep. `r < revealedTotal` is checkable from events alone. |
| A publicly decrypted winner count must equal 1, or 0 in the rollover case; any other value halts settlement | `settle` verifies a KMS proof over the encrypted count. 1 pays, 0 rolls over, anything else reverts `WinnerCountInvariantViolated` and does not open the next round. |
| The full sequence of handles, total, random value and settled prize is emitted and rendered on a public verification page | `ErnieRoundClosed`, `ErnieTotalRequested`, `ErnieTotalRevealed`, `ErnieSweepAdvanced`, `ErnieRandomDrawn`, `ErnieSettled` / `ErnieRolledOver`. `/verify/[roundId]` is Phase 11; the events are already the page's data source. |

### What stays public on purpose

- That an address participated (`Ticket.owner` is plaintext; `Deposited` / `Withdrawn` name the caller)
- The frozen ticket count and the decrypted grand total (TVL of the eligible set)
- The decrypted random value, after settlement
- Whether a round settled or rolled over, and the prize amount
- Timing: when deposits and withdrawals happened, relative to round open/close

Participation is not a secret in a prize savings pool. Hiding the address would not hide the transaction origin anyway.

### What an observer cannot reconstruct

- How large any one ticket was, or the odds attached to any address
- Which ticket the random value landed in, and therefore who won
- A loser's claimable ciphertext still changes on every draw, so the state diff does not identify the winner. A dedicated test reads the mapping storage word and asserts it moves for every participant, including anyone who lost twice.

### What the observer *can* infer, honestly

- A withdrawal happened, so some range on the number line is now a rollover gap. They cannot tell how wide it is.
- On a first deposit into an empty pool, FHEVM handle derivation aliases `cumulative` onto the depositor's balance (identical operands `add(0, transferred)`). That reveals nothing beyond the depositor's own amount, which they already know, and is pinned by tests.
- The keeper can delay `closeRound` or `stepDraw`. They cannot pick the winner, and they cannot skip the winner-count check.

### What this does not claim

- The keeper is not decentralised. It is a hot key on testnet, stated as a convenience.
- Yield on Sepolia is simulated. `MockYieldSource` is labelled everywhere a prize figure appears.
- Ciphertext handles themselves are visible in storage. Privacy rests on the encryption and the uniform writes, not on hiding that a slot exists.

## Known limitations

- **Simulated yield.** Sepolia has no real yield source; `MockYieldSource` is clearly labeled everywhere a prize figure appears.
- **Centralized keeper.** The round keeper is a Vercel Cron job holding a hot key, stated openly as a testnet convenience. A production deployment would move round advancement to a permissionless, incentivized keeper.
- **Rollover on voided tickets.** A random draw landing inside a withdrawn ticket's range produces no winner for that round by design, not by bug.
- **Single pool, single prize tier** for this submission — see [Open questions](docs/implementation-plan.md) for the tradeoffs considered.

## Implementation plan

The build is sequenced into 13 phases, starting with the public landing page and ending with submission readiness. See [`docs/implementation-plan.md`](docs/implementation-plan.md) for the full breakdown, scope, and exit criteria per phase.

## Bounty compliance

| Requirement | How Sortis satisfies it |
|---|---|
| Functioning dApp: contracts plus frontend | Hardhat workspace and a Next.js app in one monorepo, both public on GitHub |
| Working demo deployed on a website | Vercel deployment with a public landing page, live pool and draw monitor on Sepolia, public verification, private prizes, and a one-click faucet |
| Three-minute video, real person only | Screen recording with live voice — no AI-generated video or voice |
| An X thread or article introducing the project | Thread tagging `@zama` with `#ZamaDeveloperProgram`, published before the deadline |
| Deployed on Sepolia | All contracts on Sepolia, addresses published on the site and in this README |
| Production quality, beyond proof of concept | Full test suite, documented threat model, gas/HCU accounting, a real yield adapter interface, verified deployments, keeper hardening notes, and an audit-ready README |

### Submission checklist

The remaining submission actions are external to the repository: record the
three-minute live demo with a real person and voice, publish the project post
or X thread tagging `@zama` and `#ZamaDeveloperProgram`, and paste the final
production URL plus those links into the bounty form. The implementation and
deployment checklist is [`docs/phase-13-checklist.md`](docs/phase-13-checklist.md).

## License

TBD.
