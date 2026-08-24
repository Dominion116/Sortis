# Sortis — agent notes

Living briefing for coding agents. Update this file at the end of every
implementation phase with what landed, what was decided, and what the next
phase should not re-litigate.

Source of truth for *what to build*: [`docs/implementation-plan.md`](docs/implementation-plan.md)
and [`docs/sortis-implementation.docx`](docs/sortis-implementation.docx).
Source of truth for *what is already true of the contracts*:
[`packages/contracts/README.md`](packages/contracts/README.md).

**Current status: Phase 9 of 13 complete.** Next is Phase 10 (live draws,
sweep progress, and the keeper).

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
packages/web         Next.js 16 landing page (Phase 1) + app shell (Phase 8).
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

### Phase 5 — Draw engine (complete)

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

### Phase 6 — Contract test suite, gas, threat model (complete)

89 tests passing. Coverage: 97.1% statements, 98.1% lines, 94.4% functions,
79.1% branches (`MorphoYieldSource` skipped).

New tests, not replacements:

- `test/SortisDraw.property.test.ts`: 20 seeded ticket lists, every `r` in
  `[0, total)` selects at most one active ticket (exactly one if nothing is
  voided). A live encrypted draw's `r` matches the same geometry.
- Losers' storage slots: raw mapping word changes for every participant on
  *every* draw, including anyone who lost twice. Handle `!= 0` was not
  enough; a skip-if-already-zero optimisation would have passed Phase 5.
- Extra encrypted-path coverage on `SortisDraw`: keeper rotation, in-flight
  `openRound`, replay of `onTotalRevealed`, mid-round deposit excluded from
  the sweep, same-owner two tickets, zero-width total rollover, DEFAULT
  batch size, draw-hook access, mismatched KMS count rejected.

Gas/HCU (mock coprocessor):

| | gas/ticket | global HCU | depth |
|---|---|---|---|
| `stepDraw` batch 1 | ~416k | 724,160 | 416,032 |
| `stepDraw` batch 2 | ~361k | 1,448,224 | 523,032 |

Protocol caps: 20M global HCU, 5M depth per tx. Depth grows with the
winner-count accumulator (~107k per extra ticket in the same batch).

`SortisDraw.DEFAULT_BATCH_SIZE = 8` (~2.9M gas, ~5.8M global HCU, ~1.2M
depth). 16 would still fit; 8 leaves headroom.

Threat model: root README, tabled against every PRD 3.4 claim, plus an
honest "what the observer can infer" section (participation public, first
deposit handle aliasing, keeper can delay but not choose).

Do not "fix" these:

- `WinnerCountInvariantViolated` is unhit in tests. The mock coprocessor
  will not sign a count of 2 over a well-formed sweep. A keeper who lies
  about the count fails `checkSignatures` instead. That is the real
  guarantee; the halt is for ciphertext-math bugs the KMS would then
  honestly report.
- Coverage must be run with `SOLIDITY_COVERAGE=true`. `hardhat.config.ts`
  sets it when argv includes `coverage`, so `npm run coverage` works on
  Windows.

---

### Phase 7 — Sepolia deployment, faucet, address publishing (complete)

102 tests passing. Everything from Phases 2 to 6 is live on Sepolia, both
pool configs, all eight contracts verified on Etherscan *and* Sourcify.

Live addresses (chainId 11155111, deployer/keeper
`0x70f77A5C36eBD667360F6021bF4A95d274B3530e`):

| | address |
|---|---|
| cUSDT | `0x0E8c04AFd8d4483b0925aF1b4E5a88dde28F0Ff0` |
| faucet | `0x5550e92d4C252763797948Fb751c7116809F7cdb` |
| demo pool / draw / yield | `0x223897…8F97` / `0x30E3eF…1E62` / `0x7C2dF9…2237` |
| standard pool / draw / yield | `0xCCE648…f990` / `0x31d445…d39e` / `0x41E2a4…1048` |

`packages/contracts/deployments/sepolia.json` is the canonical record. Read
addresses from there or from the generated
`packages/web/lib/contracts/addresses.ts`, never by hand-copying.

What landed:

- `SortisFaucet`: `drip()` / `dripTo(address)`, cooldown keyed on the
  *recipient*, owner-retunable `dripAmount` / `cooldown`, 1,000,000 units per
  drip on a 1h cooldown as deployed.
- `ConfidentialUSDT.mint` is no longer `onlyOwner`. Owner *or* the address set
  by `setFaucet`, else `OnlyMinter`. `setFaucet` is a deploy step; a faucet
  deployed without it reverts on first drip (test pins it).
- `scripts/deploy.ts` deploys, wires (`setDrawEngine`, `setPool`,
  `setYieldSource`), seeds each yield source (1e9 principal allocated +
  1e10 reserve minted so harvested interest has inventory), opens round 1,
  writes the deployment JSON, and regenerates the web address module.
- `scripts/verify.ts`: Sourcify v2 Standard JSON + Etherscan, idempotent,
  per-target failures logged rather than aborting the run.
- `scripts/sepolia-smoke.ts`: faucet drip to a freshly generated wallet, then a
  real relayer-encrypted deposit into the demo pool. This is the "one deposit
  against Sepolia, not just the mock" exit criterion.
- Landing page now reads real addresses: `under-the-hood` links each to
  Etherscan, `draw-live` no longer claims the contracts are undeployed. Both
  still degrade to "pending deployment" if an address is empty.

Do not "fix" these:

- `etherscan.apiKey` must be a bare string. The `{ sepolia: key }` object form
  makes hardhat-verify use the retired Etherscan V1 endpoint, which answers
  every request with a migration notice and verifies nothing. This looked like
  a working run for a while.
- `sourcify.enabled: false` in `hardhat.config.ts` is deliberate.
  hardhat-verify 2.0.13 speaks Sourcify v1 (dead since July 2026);
  `scripts/verify.ts` does v2 itself.
- `dotenv.config` is pinned to `path.resolve(__dirname, ".env")`. Bare
  `dotenv.config()` resolves against cwd, so root-level npm scripts silently
  loaded nothing and the deployer looked unfunded.
- `SEPOLIA_RPC_URL` falls back to a public endpoint and the private key is
  0x-prefixed if the user omitted it. Both are convenience, not sloppiness.
- The relayer times out fairly often. `encryptWithRetry` handles the awaited
  case; the `unhandledRejection` handler catches the case where undici rejects
  on its own timer. `SMOKE_SKIP_FAUCET=1` re-runs only the deposit leg, which
  also dodges the faucet cooldown.
- Re-running `deploy:sepolia` deploys a *new* set. It does not upgrade or reuse.
  If you run it, update the root README table too.

---

### Phase 8 — Frontend application shell (complete) — this session

The web package can now talk to Sepolia. Provider tree, wallet connection,
the encryption SDK, and the first real transactional screen all landed.

Provider tree, outermost first, all in `components/providers/index.tsx`:

`ThemeProvider` (root layout, unchanged) → `WagmiProvider` → `QueryClientProvider`
→ `FhevmProvider`. The root layout stays a Server Component and reads
`(await headers()).get("cookie")`, passing it to `Providers`, which feeds
`cookieToInitialState`. That, plus `ssr: true` and `cookieStorage`, is what
removes the disconnected-then-connected flash on first paint. `headers()` is
async in Next.js 16, so the layout is now `async`.

What landed:

- **ABI publishing**, the open question from Phase 7. Answer:
  `packages/contracts/scripts/generate-abis.ts` reads the Hardhat artifacts and
  writes one generated module, `packages/web/lib/contracts/abis.ts`, with each
  ABI `as const` so viem infers argument and return types. Run via
  `npm run contracts:abis`. It is a whitelist of five contracts, not a glob, and
  only the `abi` field crosses over. TypeChain output was rejected: it is
  ethers-v6 flavoured and the frontend is on viem.
- `lib/fhevm/sdk.ts`: memoised, browser-only loader. `await import()` of
  `@zama-fhe/relayer-sdk/web` inside an async function, a `typeof window`
  assertion, and a rejection that is deliberately *not* cached so a user who
  connects a wallet late can retry without a reload.
- `components/providers/fhevm-provider.tsx`: exposes
  `{ instance, ready, status, error, reload }`. Bootstrap is gated on
  `isConnected`, because the SDK needs an injected provider to read the public
  key. `useFhevm()` returns an inert `idle` value instead of throwing when no
  provider is mounted, which matters because `ssr: false` means the first client
  render of every page happens before the provider exists.
- `components/app/encrypted-gate.tsx`: the shared `ready`-gate for Phases 9 to
  11. Four states (idle / loading / error+retry / ready) and an exported
  `Skeleton`. Wrap only ciphertext-dependent subtrees in it.
- `components/app/network-guard.tsx`: banner plus `useNetworkMismatch()`, so a
  form can disable its submit button on the same condition the banner renders
  on. Renders nothing when disconnected: no wallet is not the wrong network.
- `components/app/connect-button.tsx`, `(app)/` route group with its own layout,
  `config/app.ts`.
- `/faucet`: live `drip()` against the generated Sepolia faucet address, reading `dripAmount` and
  `readyAt(address)`, with a ticking local countdown, mapped revert messages
  (`CooldownNotElapsed`, `OnlyMinter`, user rejection, gas), and an Etherscan
  link on success. Deliberately **not** wrapped in `EncryptedGate`: minting is
  the one public operation, and gating it behind WASM would be wrong. The page
  says so in copy.
- `/diagnostics`: the throwaway SSR page the PRD's risk mitigation asks for,
  kept rather than deleted, `noindex`. Seven rows: server render, wallet,
  WalletConnect, network, a public Sepolia read, Relayer SDK, addresses.
- `tsconfig.json` target moved ES2017 → **ES2020**. viem and wagmi require
  BigInt literals; the template's ES2017 target rejected `10n`.
- `npm run typecheck` now exists for the web workspace, and at the root.

Do not "fix" these:

- `ConnectButton` reads AppKit's `modal` export, not the `useAppKit()` hook.
  The hook *throws* "Please call createAppKit before using useAppKit" whenever
  the modal has not been created, which is true during the server pass and in
  the no-project-id fallback. A throwing hook takes the tree down. Optional
  chaining on `modal` is the fix, not a smell.
- `createAppKit` is called at module scope guarded by
  `typeof window !== "undefined" && projectId`, not inside a component. In a
  render pass it registers duplicate WalletConnect listeners.
- `NEXT_PUBLIC_REOWN_PROJECT_ID` is optional and absence is *not* fatal.
  `walletConnectReady` is false, `createAppKit` is skipped, and the connect
  button falls back to the injected connector so a fresh clone still works with
  MetaMask. See `packages/web/.env.example`.
- `FhevmProvider` derives `status` from `isConnected` in `useMemo` rather than
  calling `setState` in the disconnect branch of its effect. The
  `react-hooks/set-state-in-effect` lint rule flagged the original and was
  right: it was a cascading render.
- Two `as never` casts are load bearing and both are commented in place:
  wagmi's `createStorage` return versus AppKit's wider `Storage` key space, and
  the SDK's unexported `Eip1193Provider`. Neither is a runtime mismatch.
- `window.ethereum` is read through a local cast, not a `declare global`.
  Another dependency in the graph already declares it as
  `Record<string, unknown>`, so re-declaring is a duplicate-declaration error.
- `/faucet` appears in *both* `config/marketing.ts` and `config/app.ts`.
  `/app/draws` is intentionally absent until it exists. (`/app` landed in
  Phase 9 and is now listed.)

Verified with `tsc --noEmit` and `eslint`, both clean. `next build` was not run
locally this session at the user's request; it runs on Vercel.

Build reliability maintenance: the web app no longer uses `next/font/google`,
so production builds do not make a build-time Google Fonts request. Inter now
falls back to the system sans stack; CalSans and Noto Sans Mono remain bundled
local assets. CI installs only the dependencies for each job's workspace, and
the web job has a 20-minute timeout so a stuck build fails fast. Do not restore
a remotely fetched build-time font. This maintenance was verified without
running `next build` locally.

LAN development maintenance: `npm run dev` explicitly binds Next.js to
`0.0.0.0`. `next.config.ts` discovers the host machine's non-loopback IPv4
addresses and adds them to `allowedDevOrigins`, so phones on the same network
can load dev assets and HMR. Additional hostnames or virtual-network addresses
can be supplied through comma-separated `SORTIS_DEV_ORIGINS`; do not replace
this with a hard-coded LAN IP because the address changes between networks.

Phase 8.5 — Visual system pass (complete): the web UI now uses the Hiraki
template's compact pill navigation, neutral surfaces, CalSans display headings,
system sans body copy, consistent 1200px containers, 4/6rem section rhythm,
small card radii, and visible keyboard focus rings. Marketing copy was shortened
in the hero, feature descriptions, FAQ, and supporting sections. Shared app
routes use the same section shell and responsive stacked layouts; FAQ and
transaction feedback gained explicit relationships and live-region semantics.
Do not reintroduce page-specific max widths, oversized rounded cards, or long
paragraphs without a clear content need.

---

### Phase 9 — Pool app: deposit, withdraw, balance reveal (complete)

`/app` is now the live pool screen for both Sepolia pool configurations. It
produces real ciphertexts, submits deposits, decrypts the connected user's
private state, and withdraws individual tickets.

What landed:

- `components/app/pool-panel.tsx`: demo/standard selector, public round reads,
  public ticket ownership discovery, encrypted deposit form, private balance
  reveal, ticket status/amount reveal, and withdrawal confirmation.
- First deposit sequence is deliberately `encrypt` → ERC-7984 `setOperator`
  (only when needed) → `deposit`. Both transactions wait for successful
  receipts before the UI advances. The approval uses `uint48.max`.
- `lib/fhevm/user-decryption.ts`: one generated keypair and EIP-712 signature
  per connected account per page session. The authorisation covers the token
  plus both pools, so changing pools does not create another signature prompt.
  The module stores nothing in localStorage, cookies, or IndexedDB.
- One `userDecrypt` request reveals the selected pool balance plus every owned
  ticket's amount and encrypted active flag. Cumulative handles are never
  requested. The decrypted ticket flag is what disables a withdrawn ticket;
  the UI does not infer privacy-sensitive state from transaction failure.
- Withdrawal is unavailable until the private ticket state is revealed. It
  has an inline second confirmation that explicitly says the in-progress
  ticket will be forfeited. After confirmation the private display is masked
  until refreshed, and that refresh reuses the session signature.
- Account and pool scope are attached to revealed values, so switching either
  cannot briefly display the previous account's plaintext.
- `/app` is now present in the app navigation. The existing real
  `CiphertextReveal` animation is used once a live decrypted balance exists;
  the pre-decryption state stays masked and non-interactive.

Route placement, corrected after Phase 9: the pool screen is
`app/(app)/app/page.tsx`, so it resolves to `/app`. It must **not** be
`app/(app)/page.tsx`. Route groups in parentheses contribute no URL segment, so
a root `page.tsx` inside `(app)` resolves to `/` and collides with
`app/(marketing)/page.tsx`, which is the real landing page. Next.js reports this
as two parallel pages resolving to the same path. `(app)` therefore holds no
root `page.tsx`; every route under it owns an explicit directory segment
(`app/`, `faucet/`, `diagnostics/`).

If you delete or move a route, the generated types under `.next` keep pointing
at the old file and `tsc --noEmit` fails on a path that no longer exists. Run
`npm exec --workspace=web -- next typegen` to regenerate them; a full build is
not required. Successful typegen is also a cheap check that no two routes
collide.

Do not "fix" these:

- Ticket ownership is public and is read with `ticketAt`; ticket amount and
  active state remain encrypted and are only filled from `userDecrypt`.
- A wallet with no pool balance has an uninitialised zero handle. Reveal is
  disabled for that state rather than sending an invalid handle to the relayer.
- The session authorisation intentionally includes both pool addresses and the
  token address up front. Narrowing it to the selected pool would make a pool
  switch require another signature and break the one-signature-per-session
  Phase 9 exit criterion.
- Withdraw does not optimistically mark a ticket inactive. It masks the old
  plaintext and asks the user to reveal the new ciphertext state, which avoids
  presenting an assumed confidential result as fact.

Verified with `tsc --noEmit`, ESLint, and `git diff --check`, all clean. Per the
user's instruction, `next build` was not run locally.

---

### Phase 10 — Draws, live sweep progress & keeper (complete)

`/app/draws` reads both deployed Sepolia draw engines through viem and TanStack Query. It shows the current round countdown, explicit awaiting-oracle copy, live encrypted sweep cursor progress, prize/ticket metadata, and recent settled rounds decoded from `ErnieSettled` logs. Both pools reuse the canonical generated address module.

`/api/cron/keeper` is a Node runtime route protected by `Authorization: Bearer $CRON_SECRET`. It advances each pool by at most one state transition per invocation (open, close, public-decrypt total, draw sweep batch, or public-decrypt and settle), making retries idempotent. It holds `SORTIS_KEEPER_PRIVATE_KEY`, uses Sepolia RPC, and obtains FHEVM 0.11 public-decryption proofs with `@zama-fhe/relayer-sdk/node`. `vercel.json` schedules it every minute.

Required Vercel environment variables: `CRON_SECRET`, `SORTIS_KEEPER_PRIVATE_KEY`, `NEXT_PUBLIC_SEPOLIA_RPC_URL` (optional fallback exists), and `ZAMA_FHEVM_API_KEY` when the relayer requires authentication. Event history is bounded to the latest 100,000 blocks for public RPC reliability; current state remains live without a database or indexer.

Verified with web typecheck, ESLint, and `next typegen`. `next build` was not run locally by instruction.

Do not collapse `Awaiting oracle` into a generic loading or sweep state, and do not make the keeper perform multiple transitions in one request.

Route placement fix (post-Phase 10): the Draws page had shipped at
`app/(app)/draws/page.tsx`, which resolves to `/draws`, while `config/app.ts`
and every doc link point at `/app/draws`. The nav item was a live 404. It now
lives at `app/(app)/app/draws/page.tsx`. This is the same route-group trap
recorded under Phase 9: `(app)` contributes no URL segment, so the `/app`
prefix has to be a real directory. When adding a route under `(app)`, verify
the resolved path rather than assuming the group supplies the prefix.

This surfaced as a console error, not a broken link:
`Error checking Cross-Origin-Opener-Policy: "HTTP error! status: 404"`.
`@coinbase/wallet-sdk` (pulled in by AppKit's default connector set) fetches
`window.location.origin + window.location.pathname` with `method: "HEAD"` on
init to read the COOP header, and logs that when the response is not ok. The
message names COOP but the status code is about the URL, so on any 404 route
the SDK reports it as a COOP problem. Treat it as a route assertion: check the
current path's `HEAD` status before touching headers, `middleware.ts`, or
`enableCoinbase`. Nothing about COOP needed changing here, and no COOP header
is set anywhere in the app.

Route placement fix (post-Phase 10): the pool screen is also available at
`/pool`. The implementation lives at `app/(app)/pool/page.tsx`; the previous
`/app` location now redirects to `/pool` for compatibility, and app navigation
points to `/pool`. Keep this explicit directory when adding pool-related links:
the `(app)` route group does not contribute a URL segment.


### Phase 11 — Verification page & prizes (complete)

`/verify/[roundId]` reads the public Ernie event trail for both Sepolia pools,
including frozen ticket count, published total, random value, settlement prize,
and explicit rollover state. It requires no wallet and bounds public-RPC history
to the latest 100,000 blocks.

`/app/prizes` adds the private prize envelope: the connected user decrypts their
encrypted claimable handle with the existing in-memory EIP-712 session, then
encrypts the chosen amount and claims through `SortisPool.claim`. Rollover and
zero-prize outcomes are presented distinctly from a winning reveal.

`SortisPool.claim` was added as the encrypted claim path. It clamps an encrypted
request to the caller's encrypted claimable balance, updates the claimable slot,
and transfers the confidential token without publishing the amount.

Web typegen, typecheck, ESLint, and diff checks pass. Contract compilation was
verified successfully. On restricted Windows runners, Hardhat's compiler child
process can fail with `HH505`/`spawn EPERM`; run the compile with the workspace's
approved elevated command policy. The Solidity compiler itself is healthy.

### Next: Phase 12

Build `/verify/[roundId]` from the public draw event trail, then add `/app/prizes` with the authenticated private claim/decryption flow and distinct rollover presentation. Do not relabel landing-page illustrative draw data as live until the keeper completes at least one full real Sepolia round.

---

## Commands

```bash
# from repo root
npm run dev                     # web on :3000
npm run lint                    # web eslint
npm run typecheck               # web tsc --noEmit
npm run contracts:compile
npm run contracts:abis          # regenerate packages/web/lib/contracts/abis.ts
npm run contracts:test
npm run contracts:lint
npm run contracts:typecheck

# from packages/contracts
REPORT_GAS=true npm run test    # Phase 6 accounting
npm run coverage                # Phase 6 published number

# Sepolia (needs packages/contracts/.env)
npm run deploy:sepolia          # deploys a NEW set, rewrites addresses
npm run verify:sepolia          # idempotent, safe to re-run
npm run smoke:sepolia           # SMOKE_SKIP_FAUCET=1 to skip the drip leg
```
