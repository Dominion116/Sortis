# Sortis — Implementation Plan

Source of truth: `docs/sortis-implementation.docx` (PRD v1.0, drafted 11 August 2026) and the [official bounty announcement](https://www.zama.org/post/zama-developer-program-mainnet-season-4) — Zama Developer Program, Mainnet Season 4. This document breaks that PRD into 13 sequential build phases.

## Sequencing rationale

The PRD's own schedule (section 7) front-loads the contracts, because the draw mathematics is the only part with genuine unknowns. This plan reorders execution to **start with the landing page** instead. Three reasons:

1. The landing page needs no contracts, no wallet, and no FHE SDK — it can be built and deployed to Vercel on day one, giving a stable public URL to iterate against for the rest of the build.
2. It forces the brand (`brand-guidelines`) and interaction language (`frontend-design`) — the ciphertext reveal, the tabular numerals, the editorial-institutional composition — to be settled early, so every later screen reuses established primitives instead of inventing its own.
3. Section 4 of the PRD is explicit that "the judge journey is the product." Having the sell-the-idea surface finished first means every subsequent phase is building toward a page that already argues the case well.

Nothing about the underlying scope changes — this is the same 25-day, 6-week-equivalent PRD program, resequenced. The original window mapping (11–17 Aug contracts, 18–24 Aug app shell, 25–31 Aug draws/verification/landing, 1–4 Sep deliverables, 5 Sep submit) is a useful pacing check: by the time Phase 6 (contract test suite) closes, roughly the first PRD window should have elapsed, even though the phases themselves run in a different order.

Each phase below lists its goal, dependencies, deliverables, key tasks, and exit criteria. A phase is not "done" until its exit criteria are met — partial completion rolls into the next work session rather than being marked complete.

---

## Phase 1 — Landing page & brand foundation

**Status:** Complete.

**Goal:** Ship the public-facing `/` route that sells the idea, with no wallet and no contracts required.

**Depends on:** Nothing. This is the starting point.

**Deliverables**
- Next.js 16 project scaffolded at `packages/web` (App Router, React 19, TypeScript, Tailwind v4)
- Sortis brand tokens declared in Tailwind `@theme`, adapted from the Hikari template: a shadcn-style neutral light/dark palette plus one Brand Blue accent, Inter/CalSans/Noto Sans Mono fonts, per `brand-guidelines`
- Light/dark mode via `next-themes`, toggleable from the nav, dark mode is a first-class state rather than an unused config
- The seven landing sections from PRD 4.2, in fixed order, with mocked/static data, plus one added trust-strip section:
  1. Hero, one-sentence pitch, live-look statistics strip (total pooled, next-draw countdown, participant count, and a masked ciphertext balance) using placeholder values
  2. Powered by, a lightweight text trust strip naming the real dependencies (Zama Protocol, ERC-7984, OpenZeppelin, Ethereum Sepolia), added because the Hikari layout places a trust signal directly under the hero and Sortis has real ones to name
  3. The problem, a real screenshot of an existing onchain prize pool's fully public balances, set against the Sortis equivalent
  4. How it works, three beats (deposit encrypts, pool earns, draw runs over ciphertext), with the ciphertext itself animated rather than asserted
  5. The draw, live, countdown, most recent settled round, Etherscan-linked tx hash (placeholder link until Phase 7)
  6. The no-loss guarantee, principal withdrawable any time, prize is yield only
  7. Under the hood, Zama Protocol, ERC-7984, deployed addresses (placeholder), repo link, test coverage figure (placeholder)
  8. FAQ and footer
- The ciphertext-reveal micro-interaction built as a reusable component now, even though it has nothing real to decrypt yet (fed mock data). This is the signature interaction per `frontend-design` and it needs to exist before other screens reuse it
- Deployed to Vercel with a stable preview/production URL

**Key tasks**
- Initialize monorepo root (`package.json` workspaces, root `tsconfig.json`, shared ESLint/Prettier config)
- Install and configure shadcn/ui with the Hikari-derived radius/color tokens, used close to their default shapes rather than overridden away from them
- Build the countdown and statistics-strip components with `tabular-nums` from the start
- Source or mock the "problem" screenshot comparison honestly (label mock data as illustrative until Phase 7 addresses can replace it)
- Wire Vercel project, connect repo, confirm preview deployments per branch

**Exit criteria**
- `/` is live on a public Vercel URL
- Page matches PRD 4.2 section order exactly (plus the added Powered-by strip); no glassmorphism, no particle/ripple/marquee/confetti effects, no emoji, no second accent hue beyond Brand Blue (per `frontend-design` anti-patterns)
- Lighthouse accessibility check passes in both light and dark mode; Brand Blue on `background` passes AA at any size, `muted-foreground` is never used for load-bearing text
- `prefers-reduced-motion` is respected across all animated elements
- No em dash or en dash appears anywhere in page copy (per `brand-guidelines`)

---

## Phase 2 — Monorepo & contracts foundation

**Status:** Complete.

**Goal:** Stand up the Hardhat workspace so encrypted contract logic can be written and unit-tested locally.

**Depends on:** Phase 1 (for the shared root tooling it already established).

**Deliverables**
- `packages/contracts` scaffolded from `fhevm-hardhat-template`
- Solidity 0.8.27 toolchain, Hardhat config targeting local mock coprocessor + Sepolia
- `@fhevm/solidity` and OpenZeppelin confidential contracts (ERC-7984) installed
- Repository layout matches the PRD's target tree (`contracts/`, `test/`, `deploy/`, `interfaces/`, `yield/`)
- CI skeleton (lint + compile + test) — even a minimal GitHub Actions workflow — so regressions surface immediately

**Key tasks**
- Confirm the mock coprocessor runs unit tests without hitting a live network
- Stub out `SortisPool.sol`, `SortisDraw.sol`, `interfaces/IYieldSource.sol` as empty/skeleton contracts that compile
- Set up `.env.example` for `packages/contracts` (RPC URL, deployer key, Etherscan key)
- Confirm a throwaway ERC-7984 confidential token deploys and transfers on the mock coprocessor, to validate the standard integration before building on top of it

**Exit criteria**
- `npx hardhat compile` and `npx hardhat test` succeed with a trivial passing test
- A confidential token can be minted and transferred in a test against the mock coprocessor
- CI runs green on the skeleton

---

## Phase 3 — Pool custody & the ticket model

**Status:** Complete.

**Goal:** `SortisPool` accepts confidential deposits and maintains the encrypted ticket list correctly.

**Depends on:** Phase 2.

**Deliverables**
- `SortisPool.sol` deposit path: accepts ciphertext + input proof, appends a ticket (`owner`, `amount: euint64`, `cumulative: euint64`, `active: ebool`)
- Cumulative sum computed at append time (one encrypted addition per deposit — PRD 3.2)
- Per-user encrypted balance tracking with decryption rights granted to the depositor over their own balance
- Round-eligibility rule: a ticket must exist before the round opens to count in that round's draw; mid-round deposits roll to the next round
- Unit tests covering the cumulative-sum invariant specifically

**Key tasks**
- Implement encrypted balance storage and the `deposit()` entry point
- Implement round-boundary bookkeeping (current round id, round-open timestamp/block)
- Grant per-user decryption rights (`FHE.allow` / equivalent) on deposit
- Write the cumulative-sum invariant test: after N deposits, the last ticket's `cumulative` decrypts (in test-only mode) to the sum of all active ticket amounts

**Exit criteria**
- Deposit → ticket-append → cumulative-sum sequence is unit tested against the mock coprocessor and passing
- Gas cost of a single deposit is measured and recorded (early baseline for Phase 6's full accounting)

---

## Phase 4 — Withdrawals & yield source interface

**Status:** Complete.

**Goal:** Principal is withdrawable at any time, and idle funds have somewhere real (if simulated) to earn yield.

**Depends on:** Phase 3.

**Deliverables**
- Withdrawal path: decrements encrypted balance, marks the ticket `active = false`, transfers confidential tokens back — available mid-round
- `IYieldSource.sol` (`deposit`, `withdraw`, `accrued`)
- `MockYieldSource.sol`: Sepolia-only, accrues against a pre-funded reserve at a configurable (deliberately high) rate
- `SortisPool` routes idle funds to the configured `IYieldSource` implementation
- Tests: withdrawal correctly voids a ticket without corrupting cumulative sums for tickets appended after it

**Key tasks**
- Implement `withdraw()` including the inactive-ticket flag flip
- Implement `MockYieldSource` with an owner-settable accrual rate
- Wire pool-level `accrued()` read for "total pooled" style UI later
- Confirm (via test) that a withdrawal never rewrites cumulative sums above it — this is intentional per PRD 3.3, not an oversight, so the test should assert the gap remains rather than assert it's fixed

**Exit criteria**
- Withdraw path unit tested, including the "ticket becomes voided but sums above it are untouched" behavior
- `MockYieldSource` accrual is visible in a test within minutes of simulated time at the configured rate

---

## Phase 5 — Draw engine (SortisDraw / "ERNIE")

**Status:** Complete. See `AGENTS.md` and `packages/contracts/README.md` for what landed and the decisions that bind Phase 6.

**Goal:** Select exactly one winner over ciphertext, resumably, with a well-defined rollover case.

**Depends on:** Phase 4.

**Deliverables**
- `SortisDraw.sol`: round close, public decryption request for the grand total, onchain encrypted randomness draw, modulo reduction against the plaintext total
- Resumable sweep: cursor-based `stepDraw(batchSize)` that walks tickets, computes the encrypted range-membership boolean per ticket, and applies `FHE.select` writes to every ticket owner's claimable balance (winners and losers alike)
- Rollover handling: if the random value lands in a voided ticket's gap, no winner is credited and the prize carries to the next round
- Winner-count invariant check (must decrypt to exactly 1, or 0 in the rollover case) that halts settlement on any other value
- Two pool configurations wired for the demo: a realistic-length round and a continuous 5-minute demo round (PRD section 4, "reviewer arrives when nothing is happening")

**Key tasks**
- Implement round-close freezing of the ticket list and length event
- Implement the oracle callback for public decryption of the total
- Implement the onchain randomness draw and modulo reduction
- Implement the batched sweep with cursor persistence across transactions
- Implement the winner-count invariant and settlement gating
- Implement rollover-to-next-round logic

**Exit criteria**
- A full round (close → decrypt total → draw random → sweep in batches → settle) completes against the mock coprocessor in a test
- Sweep is verified resumable across multiple transactions/batches
- Rollover case is exercised by a test that deliberately voids the ticket the random value would have hit

---

## Phase 6 — Contract test suite, gas accounting & threat-model documentation

**Goal:** Turn the contracts from "working" into "production quality, beyond proof of concept" per the bounty's own bar.

**Depends on:** Phase 5.

**Deliverables**
- Full unit test suite against the mock coprocessor for every encrypted path (PRD section 6)
- Property test: a random value drawn across the full range selects exactly one active ticket, run over many seeded rounds
- Explicit test that losers' storage slots are written on every draw (regression here silently destroys the privacy guarantee — this test matters more than it looks)
- Gas measurement per ticket for the sweep, recorded in the README
- Threat model write-up: what an observer can and cannot reconstruct from public state (maps to PRD 3.4)
- Coverage report with a real, published number

**Key tasks**
- Write/expand tests until every encrypted branch is covered
- Run and record gas profiling for `deposit`, `withdraw`, and `stepDraw` at varying batch sizes, to set the real-world batch-size default
- Draft the threat-model section for the README (verifiability guarantees, privacy guarantees, what stays public vs. private)

**Exit criteria**
- Coverage number is real and recorded in the README (not a placeholder)
- Gas-per-ticket figure is recorded and used to set the production batch-size default
- Threat model section is written and cross-checked against PRD 3.4's claims line by line

---

## Phase 7 — Sepolia deployment, faucet & address publishing

**Goal:** Everything from Phases 2–6 is live on Sepolia and reachable by a reviewer with an empty wallet.

**Depends on:** Phase 6.

**Deliverables**
- Deploy scripts for `SortisPool`, `SortisDraw`, `MockYieldSource`, `SortisFaucet`, and the confidential token, targeting Sepolia
- `SortisFaucet.sol`: mints test cUSDT to any address on a cooldown
- Both pool configurations deployed (realistic-length + continuous 5-minute demo pool)
- Contract addresses published in the README and wired into `packages/web/lib/contracts`
- Etherscan verification for all deployed contracts

**Key tasks**
- Fund a deployer wallet with Sepolia ETH
- Run deploy scripts, verify on Etherscan, record addresses
- Pre-fund `MockYieldSource`'s reserve so demo draws pay out real prizes immediately
- Update the README's "Deployed contracts" table and Phase 1's placeholder Etherscan links

**Exit criteria**
- All contracts are live on Sepolia, verified, and addresses are in the README
- Faucet successfully mints test tokens to a fresh address end to end
- An integration test run manually against Sepolia (not just the mock) completes one deposit successfully

---

## Phase 8 — Frontend application shell

**Goal:** Wallet connection and the FHE SDK bootstrap work correctly, including the two integration traps called out in the PRD.

**Depends on:** Phase 7 (needs real deployed addresses to connect against) and Phase 1 (extends the existing web app rather than starting a new one).

**Deliverables**
- Provider tree: `WagmiProvider` (Reown AppKit, `ssr: true`, cookie storage) → `QueryClientProvider` → `FhevmProvider` (client-only, dynamic import, `ssr: false`)
- `FhevmProvider` exposes an SDK instance and a `ready` flag; every encrypting/decrypting component consumes both and renders a skeleton until ready
- Non-ciphertext contract reads go through ordinary wagmi hooks and don't block on SDK readiness
- Network-mismatch handling: detect non-Sepolia connection and offer a one-click switch
- `/faucet` route wired to the live `SortisFaucet` contract

**Key tasks**
- Resolve the Relayer SDK / App Router SSR conflict on a throwaway page first, per the PRD's own risk mitigation, before touching real screens
- Confirm Reown AppKit's cookie-storage config eliminates the disconnected-then-connected flash on first paint
- Build the `ready`-gated skeleton pattern once, as a shared component, for reuse across Phases 9–11

**Exit criteria**
- Wallet connects, stays connected across reload, and never flashes a disconnected state on first paint
- SDK becomes `ready` without blocking non-ciphertext page content
- `/faucet` mints real Sepolia test tokens through the UI

---

## Phase 9 — Pool app: deposit, withdraw, balance reveal

**Goal:** `/app` — the core save-and-see-your-balance loop, with the ciphertext reveal as the centerpiece interaction.

**Depends on:** Phase 8.

**Deliverables**
- Deposit flow: amount entry → browser-side encryption + input proof (Relayer SDK) → confidential token allowance approval → `deposit()` call → pending-for-current-round state shown in plain language
- Balance reveal: masked ciphertext by default, EIP-712 user-decryption flow on reveal, in-memory session keypair (never persisted to `localStorage`), subsequent reveals need no further signature
- Withdrawal flow: available any time, explicit copy that withdrawing forfeits the in-progress round's ticket
- Real (non-mock) ciphertext-reveal animation replacing Phase 1's mocked version, wired to the actual decrypted value

**Key tasks**
- Implement the encrypt → approve → deposit sequence with clear pending/error states
- Implement the EIP-712 signature flow and in-memory keypair caching
- Implement the reveal animation against real data, reusing the Phase 1 component
- Implement withdrawal with the forfeiture warning surfaced before confirmation

**Exit criteria**
- A fresh wallet can deposit faucet-minted tokens and see a pending ticket
- Reveal requires exactly one signature per session, not one per reveal
- Withdrawal correctly returns funds and the UI reflects the voided ticket

---

## Phase 10 — Draws, live sweep progress & the keeper

**Goal:** `/app/draws` shows a round actually resolving, with the batched sweep rendered as a real progress mechanism.

**Depends on:** Phase 9.

**Deliverables**
- Vercel Cron job hitting a route handler that holds a keeper hot key, closing rounds and calling `stepDraw` on a schedule
- `/app/draws`: round history, countdown to next draw, live sweep progress bar tracking the onchain cursor
- "Awaiting oracle" state shown explicitly while the public-decryption callback is pending, so the UI never appears frozen
- Round history and draw state sourced from event logs via viem, cached and revalidated with TanStack Query — no database, no indexer

**Key tasks**
- Implement the cron route handler with appropriate auth/secret to prevent unauthorized triggering
- Implement countdown and progress-bar components with `tabular-nums`
- Implement the oracle-pending state distinctly from the sweeping state (different labels, not just different colors, per `frontend-design` accessibility guidance)
- Confirm the continuous 5-minute demo pool keeps a round always within reach of a newly arriving reviewer

**Exit criteria**
- A full round on Sepolia (close → oracle callback → randomness → sweep → settle) completes via the cron-driven keeper without manual intervention
- `/app/draws` accurately reflects live on-chain state through at least one complete real round
- A reviewer arriving at a random time sees an in-progress or imminent draw on the demo pool

---

## Phase 11 — Verification page & prizes

**Goal:** `/verify/[roundId]` proves a settled draw was fair to an outside observer; `/app/prizes` delivers the "moment of finding out."

**Depends on:** Phase 10.

**Deliverables**
- `/verify/[roundId]`: ticket count, published total, decrypted random value, settled prize, and the full event/handle trail for that round — no wallet required
- `/app/prizes`: claim and decrypt winnings, with the reveal treated as the emotional core of the product, not a flat state readout
- Rollover rounds are clearly labeled as such (distinct label, not just a color/tint difference)

**Key tasks**
- Build the verification page purely from public event data (reads should work with no wallet connected)
- Implement the claim/decrypt flow on `/app/prizes`, reusing the Phase 9 EIP-712 decryption pattern
- Design the win-reveal moment deliberately — this is called out in the PRD as deserving real interface attention, not a toast notification

**Exit criteria**
- Any settled round on Sepolia can be independently verified at `/verify/[roundId]` by someone with no wallet and no prior context
- A test wallet that won a demo-pool round can claim and decrypt its prize through `/app/prizes`
- Rollover rounds render distinctly and correctly on both pages

---

## Phase 12 — How it works, FAQ polish & end-to-end QA

**Goal:** Close the loop on documentation-as-interface and validate the entire judge journey as one sequence.

**Depends on:** Phase 11.

**Deliverables**
- `/how-it-works`: technical explanation, live contract addresses, repository link, test coverage figure — pulling real data rather than restating Phase 1's placeholders
- Landing page (`/`) FAQ and "under the hood" sections updated from placeholder to real data (addresses, coverage, live tx links)
- Full integration test: deposit → round close → draw → claim → withdraw as one sequence on Sepolia (PRD section 6)
- Cross-browser / cold-wallet QA pass simulating the judge journey from PRD section 4: arrival with no test tokens, faucet, deposit, watch or wait for a draw, verify, done in under three minutes

**Key tasks**
- Replace every remaining placeholder from Phase 1 with live data
- Run and record the full Sepolia integration test
- Time an actual cold-start walkthrough against the "ninety seconds to an opinion, three minutes to a resolved draw" bar and fix whatever breaks that timing
- Fix any accessibility, copy, or state-labeling issues found during the walkthrough

**Exit criteria**
- Every route works end to end from a genuinely empty wallet with no prior context
- The full deposit-to-withdraw integration test passes on Sepolia
- A timed walkthrough meets the PRD's own judge-journey timing bar

---

## Phase 13 — Submission readiness

**Goal:** Everything the bounty form requires that isn't code.

**Depends on:** Phase 12.

**Deliverables**
- Three-minute demo video: real person, live screen recording, live voice (no AI-generated video or voice — the form explicitly disqualifies this)
- X thread or article introducing the project, tagging `@zama` with `#ZamaDeveloperProgram`, published before the deadline
- README finalized: real coverage number, real gas figures, real deployed addresses, threat model, honest limitations section
- Deployment hardening: confirm the production Vercel URL is stable, cron jobs are resilient to a missed tick, and the keeper wallet is funded well past the deadline
- Code freeze, then a buffer window for whatever the encrypted-decryption callback path does differently on Sepolia than it did against the mock (the PRD flags this explicitly as the likely last-minute surprise)

**Key tasks**
- Script and record the video against the finished, deployed product — not a local build
- Draft and publish the X thread
- Final README read-through as if by a reviewer who has never seen the project
- Freeze code; only fix regressions discovered during the buffer window

**Exit criteria**
- All bounty form requirements are satisfied and cross-checked against the [Bounty compliance](../README.md#bounty-compliance) table in the README
- Submission happens with hours to spare, not minutes, per the PRD's own instruction

---

## Open questions carried forward from the PRD

These were explicitly left open in the PRD (section 9) and should be revisited before or during the phases noted:

- **Single pool vs. multiple denominations** — current inclination is one pool, done properly. Revisit only if Phase 6 shows the sweep cost has meaningful headroom.
- **Single winner vs. tiered prizes** — tiers multiply sweep cost by tier count. Default to single prize unless Phase 6's gas accounting proves tiers affordable.
- **Publishing the winner's address as opt-in** — stays off unless there's time to implement it as a genuine, explicit user choice (Phase 11 at the earliest).
- **Onchain-governed vs. fixed round length** — fixed is simpler and nothing in the bounty rewards governance; treat as fixed for all 13 phases unless directed otherwise.
