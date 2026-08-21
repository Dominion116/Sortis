# Sortis.

**A confidential prize savings protocol on the Zama Protocol.**

Sortis is a no-loss prize savings pool. You deposit a confidential token, your deposit sits in a shared pool earning yield, and at the end of each round the yield is handed to one depositor as a prize instead of being spread thinly across everyone. Nobody loses their principal — you can withdraw it at any time. The only thing at stake is the interest you would otherwise have earned.

Balances, deposits and winnings are encrypted end to end using fully homomorphic encryption (FHE). The draw itself runs over ciphertext, so the contract selects a winner without ever learning who the participants are or how much they hold. Only the winner can decrypt their own prize — and the fairness of the draw stays publicly checkable by anyone.

| | |
|---|---|
| **Program** | [Zama Developer Program, Mainnet Season 4](https://www.zama.org/post/zama-developer-program-mainnet-season-4), Bounty Track |
| **Submission deadline** | 5 September 2026, 23:59 AOE |
| **Target network** | Ethereum Sepolia |
| **Status** | In development, Phase 2 of 13 complete (contracts foundation) — see [Implementation Plan](docs/implementation-plan.md) |

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

> The workspace is being built out phase by phase — see the [implementation plan](docs/implementation-plan.md) for current status. The monorepo and the contracts workspace now exist; deposits, withdrawals and the draw engine are Phases 3 to 5, and every unimplemented path reverts with `NotImplemented()` rather than silently succeeding.

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
SEPOLIA_RPC_URL=
DEPLOYER_PRIVATE_KEY=
ETHERSCAN_API_KEY=
```

Web (`packages/web/.env.local`):

```bash
NEXT_PUBLIC_REOWN_PROJECT_ID=
NEXT_PUBLIC_SEPOLIA_RPC_URL=
NEXT_PUBLIC_POOL_ADDRESS=
NEXT_PUBLIC_DRAW_ADDRESS=
NEXT_PUBLIC_FAUCET_ADDRESS=
NEXT_PUBLIC_RELAYER_URL=
```

### Run contracts

```bash
cd packages/contracts
npm run compile
npm run test                     # 13 passing, against the mock coprocessor
npm run lint && npm run typecheck
npm run deploy:sepolia           # Phase 7
```

### Run the web app

```bash
cd packages/web
npm run dev
```

## Testing

- Unit tests against the Hardhat mock coprocessor for every encrypted path, including the cumulative-sum invariant
- A property test that a random value drawn across the full range selects exactly one active ticket, run over many seeded rounds
- An explicit test that the voided-ticket case produces a rollover rather than a silent failure or double credit
- A test asserting that losers' storage slots are written — a regression here would silently destroy the privacy guarantee
- Gas measurement per ticket for the sweep, published here once available, so batching limits are documented rather than discovered
- An integration test on Sepolia covering deposit → round close → draw → claim → withdraw as one sequence

Coverage will be reported here with a real number once the contract suite lands (see [implementation plan](docs/implementation-plan.md)).

## Deployed contracts (Sepolia)

| Contract | Address |
|---|---|
| `SortisPool` | _pending deployment_ |
| `SortisDraw` | _pending deployment_ |
| `SortisFaucet` | _pending deployment_ |
| Confidential token (cUSDT) | _pending deployment_ |

## Verifiability & threat model

The draw's fairness has to be checkable by someone who can never see who took part:

- The ticket set is frozen and its length published **before** randomness is requested, so nobody can be added or removed after the fact.
- Randomness is generated onchain by the protocol, not supplied by an operator — the deployer has no more influence over the outcome than any user.
- The random value is publicly decrypted after settlement; combined with the published total, anyone can confirm it fell inside the valid range.
- The contract publicly decrypts a winner count as an invariant. It must equal one, or zero in the rollover case — any other value halts settlement.
- The full sequence (handles, total, random value, settled prize) is emitted as events and rendered on a public verification page, one per draw.

What an observer *cannot* reconstruct: who held which ticket, or how large it was.

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
| Working demo deployed on a website | Vercel deployment with a public landing page, a live pool on Sepolia, and a one-click faucet |
| Three-minute video, real person only | Screen recording with live voice — no AI-generated video or voice |
| An X thread or article introducing the project | Thread tagging `@zama` with `#ZamaDeveloperProgram`, published before the deadline |
| Deployed on Sepolia | All contracts on Sepolia, addresses published on the site and in this README |
| Production quality, beyond proof of concept | Full test suite, documented threat model, gas accounting, a real yield adapter interface, and an audit-ready README |

## License

TBD.
