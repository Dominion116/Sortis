# Sortis — agent notes

Living briefing for coding agents. Update this file at the end of every
implementation phase with what landed, what was decided, and what the next
phase should not re-litigate.

Source of truth for *what to build*: [`docs/implementation-plan.md`](docs/implementation-plan.md)
and [`docs/sortis-implementation.docx`](docs/sortis-implementation.docx).
Source of truth for *what is already true of the contracts*:
[`packages/contracts/README.md`](packages/contracts/README.md).

**Current status: Phase 13 implementation pass complete.** Remaining work is
external submission: production Vercel verification, keeper funding, live
walkthrough recording, and bounty-form publication.

### Post-Phase 13 maintenance

FHEVM browser bootstrap reads the host chain through a same-origin
`/api/rpc` proxy (allowlisted `eth_call` / `eth_chainId` and similar), not
`window.ethereum` and not a public RPC hostname from the browser. Injected
wallets intercept some well-known Sepolia RPC hosts and reject the Zama
InputVerifier `eip712Domain()` call, which makes every encrypted screen fail
during SDK setup even though the same call succeeds on Sepolia. The proxy
forwards to `NEXT_PUBLIC_SEPOLIA_RPC_URL` or the public Sepolia fallbacks.
Wallet signatures still go through wagmi.

`SortisPool.claim` must `FHE.allowTransient(amount, asset)` before
`confidentialTransfer`, the same grant `withdraw` already makes. Without it
the token cannot compute over the encrypted amount and the claim reverts
inside ERC-7984 `_update`. The 28 August 2026 Sepolia redeploy includes
this grant.

AppKit is initialized lazily from the connect control rather than at provider
module load. This prevents WalletConnect remote configuration requests from
running on public pages and surfacing transient relay failures as Next.js
client error overlays. Keep `getAppKit()` as the only AppKit creation path.

The web font stack now uses the Hiraki template's exact local `Inter-Regular`
and `Inter-Bold` files through `next/font/local`; do not restore the variable
`@fontsource` import or rely on a system fallback.

The Hiraki template applies `font-mono` to the root body, so Sortis does too.
The hero tagline explicitly keeps `font-mono`; its token is backed by the
bundled Geist Mono face to match the template-style mono rendering.

Navigation maintenance: the decorative sun icon and repository action were
removed from the shared navbar. Marketing navigation now uses a `Connect
wallet` link to `/app`; app navigation renders the same control and changes it
to the truncated connected address, which disconnects on click.

Current navigation polish: the marketing navbar no longer lists Faucet and its
action is `Open app`; the app navbar no longer lists Home because the Sortis
logo already links home. Faucet remains available inside the app navigation.
The faucet screen uses the same section-shell and two-column card layout as the
pool and draw screens.

The landing hero badge is product-focused: `Live on Ethereum Sepolia · Watch
the draw`, linking to `/app/draws`; it should not be relabeled as a Zama
program badge or point to the external Zama site.

Wagmi pins: keep `@wagmi/connectors@6.2.0` and `@wagmi/core@2.22.1` (root
`overrides` plus direct web deps). AppKit's optional `@wagmi/connectors: >=5.9.9`
otherwise installs 8.x, which re-exports Tempo and a missing `accounts` peer
and fails `next build --webpack` on Vercel. Do not widen those ranges.
Optional peers are dropped with webpack `IgnorePlugin` in `next.config.ts`
(`accounts`, `pino-pretty`, `@base-org/account`, `@metamask/connect-evm`).
Add to that list only packages that are absent; do not ignore WalletConnect
or other installed connectors. Do not reassign `config.resolve.alias`;
spreading or replacing it wipes Next's `@/` mapping.

Mobile navigation maintenance: the menu is a backdrop with a contained panel,
has an explicit close button, closes on backdrop clicks, and no longer repeats
the Sortis logo/icon inside the dropdown.

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
- Never run `next build`, `npm run build`, or any other production compile of
  `packages/web` on this machine. It saturates the PC and network. Production
  web builds run only on Vercel; wait for the user to paste the Vercel log if
  one fails. `npm run typecheck`, `eslint`, and `next typegen` stay allowed.

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
| cUSDT | `0xd82C37256145dd6554d9090bF679a6c18e0680d1` |
| faucet | `0x954A8e01E67B91e4E11c50DEa7Ac296B47db8d12` |
| demo pool / draw / yield | `0x80c810…8B4C` / `0x9bF662…8F23` / `0x976843…b0Fd` |
| standard pool / draw / yield | `0x536B45…F77c` / `0xDD0775…D87e` / `0x4E614f…Cd24` |

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

Hero maintenance: the four illustrative stat cards were removed. The ripple
rings are centered with `left/top: 50%` plus the keyframe's own
`translate(-50%, -50%)`; do not add Tailwind `-translate-*` utilities to the
animated rings because Tailwind v4's `translate` property stacks with the
keyframe transform and shifts the circles up and left. The hero uses an 82svh
mobile minimum height, 78svh from `sm`, and 78vh on desktop, with its content
vertically centered; keep mobile viewport sizing on `svh` to avoid browser
chrome jumps.

Visual follow-up: Features and How It Works now have an explicit responsive
gap; the old Follow the build highlights section is removed while the existing
footer remains unchanged. Inter is
self-hosted through `@fontsource-variable/inter`, with Cal Sans and Noto Sans
Mono remaining local assets, so the template font stack has no system or
network fallback. Theme switching is removed and the root is permanently dark.

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

`/api/cron/keeper` is a Node runtime route protected by `Authorization: Bearer $CRON_SECRET`. It advances each pool by at most one state transition per invocation (open, close, public-decrypt total, draw sweep batch, or public-decrypt and settle), making retries idempotent. It holds `SORTIS_KEEPER_PRIVATE_KEY`, uses Sepolia RPC, and obtains FHEVM 0.11 public-decryption proofs with `@zama-fhe/relayer-sdk/node`. `vercel.json` schedules it once per day for Vercel Hobby compatibility; minute-level progression requires an external scheduler, which the post-Phase 13 backend section covers and which is a deployment dependency rather than an optimisation.

Required Vercel environment variables: `CRON_SECRET`, `SORTIS_KEEPER_PRIVATE_KEY`, `NEXT_PUBLIC_SEPOLIA_RPC_URL` (optional fallback exists), and `ZAMA_FHEVM_API_KEY` when the relayer requires authentication. Event history was originally bounded to the latest 100,000 blocks for public RPC reliability; that bound is now a fallback behind the optional indexer.

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

### Phase 12 — How it works, FAQ polish & end-to-end QA (complete)

The public `/how-it-works` route now explains the encrypted ticket model,
yield-only prize, and public verification trail. It links the canonical
Sepolia deployment addresses from the generated contract module, the GitHub
repository, and the recorded 97.1% Solidity statement coverage. Marketing
navigation points to the route, while the landing-page under-the-hood and draw
sections now use live deployment language and link reviewers into the live draw
monitor. Next.js route types were regenerated after adding the route.

Verified with web typegen, typecheck, ESLint, and `git diff --check`.
`next build` and a live Sepolia deposit-to-withdraw walkthrough were not run
in this session; the latter requires a funded test wallet and keeper/oracle
activity.

### Phase 13 — Submission readiness (implementation pass complete)

README status and getting-started instructions now describe the finished web
app rather than the old Phase 7 scaffold. Production-only Vercel variables,
keeper behavior, and the honest boundary around the unobserved full Sepolia
winner path are documented in `docs/phase-13-checklist.md`. The keeper route
now validates that its configured key matches each draw contract's `keeper()`
and isolates per-pool failures so one broken pool does not stop the other from
advancing on the same cron tick.

Verified with web typecheck, ESLint, route type generation, and diff checks.
The remaining checklist items require access to the production Vercel project,
a funded Sepolia keeper, and a human-recorded demo, so they are not claimed as
completed in source control.

Post-Phase 13 motion maintenance: the web UI now uses the shared
`components/motion/scroll-reveal.tsx` primitives for once-per-section reveals,
staggered repeated items, the marketing scroll-progress line, and calm app-page
entrances. Hero and navigation have short first-paint sequences; feature,
protocol-step, and pool cards use restrained hover lift; the live sweep bar has
a directional glint. Keep all motion behind the existing reduced-motion
preference and avoid adding perpetual decorative animation to operational app
controls.

Route motion maintenance: both route groups now have `template.tsx` wrappers
that remount on client navigation and animate page content from a soft lift and
blur into focus. Matching `loading.tsx` files provide an immediate skeleton
while a destination streams. Keep navbar transition feedback in the shared
navigation component, and preserve the reduced-motion behavior in both the
template and loading UI.

### App shell, pending state and skeleton maintenance (post-Phase 13)

Four changes, all in `packages/web`. No contract change, no redeploy.

**One container for `/app` routes.** `globals.css` gains `.app-shell` and
`.app-stack`, applied once in `app/(app)/layout.tsx` around both the
`NetworkGuard` and `children`. App pages previously mixed `.container` (from the
layout) with per-page `.section-shell`, which resolve to different mobile
gutters, so the banner and the content below it did not line up. `section-shell`
and the page-level `max-w-3xl` are removed from every app page. Do not add
`.section-shell`, `.container`, or a page-level `max-w-*` to a route under
`(app)`; that is the drift this replaced. Marketing routes keep
`.section-shell`, and `RouteLoading` takes a `variant` prop for that reason: the
app variant renders no container because the layout already supplies one.

**Buttons disable on the click, not a beat later.** `hooks/use-async-action.ts`
owns keyed pending state and sets a key synchronously before the handler's first
`await`. Deriving a spinner from wagmi's `isPending` was the actual lag: that
flag only flips once the connector request has started. `faucet-card.tsx` and
`network-guard.tsx` therefore moved to `writeContractAsync` /
`switchChainAsync`, with the rejection caught locally because `writeError` and
`error` already render the reason. `pool-panel.tsx` and `prizes-panel.tsx` had
the opposite problem: one shared `busy` boolean, so revealing greyed out
depositing. They now key per action, and withdrawals key on
`withdraw:<ticketId>` so each ticket row has its own spinner. The ticket row's
own "Withdraw ticket" trigger previously had no loading state at all. Do not
reintroduce a single panel-wide `busy` flag.

**Real panel skeletons.** `components/app/skeletons.tsx` composes the existing
`Skeleton` primitive from `encrypted-gate.tsx` (the primitive stays there) into
`HeadingSkeleton`, `StatSkeleton`, `DrawCardSkeleton`, `TicketListSkeleton`, and
`PrizeEnvelopeSkeleton`. `loading.tsx` only covers the route-streaming wait; the
real wait on every app screen is an RPC read inside a client component, which is
why text placeholders like `"..."` and `"Loading ticket ownership..."` were what
users actually saw. `DrawCard` shows its skeleton only on first load, never on
the five-second refetch, because swapping a live card out repeatedly flickers.
`/verify/[roundId]` gained the `loading.tsx` it never had.

**Calmer entrance.** `PageTransition` runs 0.8s with a smaller lift, and
`route-loading-sweep` slowed to 1.7s. New `ContentFade` in
`components/motion/page-transition.tsx` fades a resolved subtree in where a
skeleton just was, so the swap is not a single-frame pop. All of it stays behind
`useReducedMotion`.

Verified with web typecheck, ESLint, `next typegen`, and `git diff --check`.
`next build` was not run locally, per the standing rule.

Still outstanding, deliberately not built: picking a past round on `/app/prizes`
and checking whether that specific round was won. `_claimable` is a single
running encrypted total and `sweepTicket` credits it for every participant with
no per-user event, so no current state or log answers "did I win round 7". The
three options are a per-round encrypted credit mapping (needs a redeploy, adds a
storage write and grant per ticket per sweep against the HCU budget), a
frontend-only handle delta across the round's sweep blocks (no redeploy, but
needs archive `eth_call` depth and silently misreports if a claim interleaves),
or an on-demand encrypted range check (needs a redeploy plus a transaction and a
second decrypt per check). Awaiting a decision; do not ship the delta approach
without saying out loud that an interleaved claim breaks it.

**Resolved in the backend pass below.** The delta approach shipped, but with the
archive-node dependency designed out and the interleaved-claim case detected
rather than ignored.

### Backend: indexer, keeper cadence and per-round history (post-Phase 13)

No contract change and no redeploy. Every published Sepolia address is still
valid. `packages/web` gained `@neondatabase/serverless@1.1.0` (pinned exact).

**The keeper schedule was the real bug.** `vercel.json` scheduled the keeper once
per day while the demo pool runs 300-second rounds, and a round needs several
sequential invocations (close, reveal total, draw random, sweep batches, settle).
A daily tick therefore took days to settle one round, so every reviewer opening
`/app/draws` saw a stalled round. The fix is deployment configuration, not code:
point an external scheduler at `/api/cron/keeper` and `/api/cron/indexer` once a
minute with `Authorization: Bearer $CRON_SECRET`. Both routes are idempotent. The
daily Vercel crons remain as a backstop because Hobby allows no better. This is
documented in the README and `docs/phase-13-checklist.md` as a deployment
dependency, not an optimisation.

**Handle snapshots are captured by the keeper, not reconstructed.** The keeper is
already standing at both round boundaries, so `captureSnapshots` reads every
eligible participant's `_claimable` handle at the chain head, in the same
invocation as `closeRound` and as `settle`. This is what removes the archive-node
requirement that made the frontend-only delta approach fragile. Snapshot failures
are swallowed deliberately: a missing snapshot costs one round's history, whereas
a keeper that aborts costs the whole demo.

**`ClaimableHistory.test.ts` pins the assumption the feature rests on.** A
superseded `_claimable` handle stays decryptable by its owner after the slot has
moved on, three generations deep, and the difference between two generations
equals the credited prize. A non-owner still cannot decrypt one, which is what
makes serving handles from an unauthenticated endpoint safe. Do not delete these
tests: if FHEVM ACL grants ever stop being permanent, the round-history feature
breaks silently and this is the only thing that would say so.

That test file uses `MINT = 812_345n` and `YIELD_PRINCIPAL = 9_876_543n`
deliberately. FHEVM handles are deterministic hashes of the operation and its
operands, so minting a round number here produced the *same handle* as an
identical mint in `ConfidentialUSDT.test.ts`, and this suite's grant to `bob`
then let him decrypt it there, failing that file's "a third party cannot read
someone else's balance" assertion. Keep test amounts distinct across suites.

**Interleaved claims are detected, not assumed away.** `SortisPool.claim` emits
no event, so a claim inside a sweep window cannot be found from logs. The keeper
scans the recorded sweep block range for calls carrying the `claim` selector
(derived from the generated ABI, not hardcoded) and sets `delta_unreliable`. The
UI then says the round cannot be attributed instead of showing a difference it
cannot stand behind. This is the one case the backend cannot answer, and it is
surfaced honestly in the README's limitations.

**The database is optional and that is load bearing.** `getSql()` returns null
without `DATABASE_URL`, every `lib/db/*` function no-ops or returns empty, the
indexer reports `skipped`, `readVerification` falls back to bounded `getLogs`,
and `RoundHistoryCard` returns null. A reviewer cloning the repo with no database
gets the pre-backend behaviour, not a broken app. Do not add a `lib/db` caller
that assumes a connection exists.

**Two new public endpoints, deliberately unauthenticated.**
`/api/rounds/[roundId]` and `/api/draws/[poolId]/history` serve only event data.
`/api/prizes/[address]` serves ciphertext handles, which are inert without the
owning address's EIP-712 authorisation and are already readable from pool
storage. The safety of all three rests on the no-plaintext rule in
`lib/db/client.ts`; nothing that is not already public onchain may be stored.
`/api/cron/*` keep the bearer check, which matters more now that a third-party
scheduler invokes them constantly.

Also corrected: the README tech table said "No indexer to run or pay for" and the
Phase 10 note said "without a database or indexer". Both were true and are not
any more.

Verified with 106 contract tests passing, web typecheck, ESLint, `next typegen`,
and `git diff --check`. `next build` was not run locally, per the standing rule.
The indexer's `DEPLOYMENT_BLOCK` is 11,587,000, just below the verified deployment
block 11,587,343 (found by binary-searching block timestamps against the
`deployedAt` in `deployments/sepolia.json`, then confirming `eth_getCode` on the
demo draw contract flips from empty to non-empty there). Update it if
`deploy:sepolia` is ever re-run. Nothing here has been exercised against a live
Neon database yet, only typechecked.


Build `/verify/[roundId]` from the public draw event trail, then add `/app/prizes` with the authenticated private claim/decryption flow and distinct rollover presentation. Do not relabel landing-page illustrative draw data as live until the keeper completes at least one full real Sepolia round.

---

## Commands

```bash
# from repo root
npm run dev                     # web on :3000
npm run lint                    # web eslint
npm run typecheck               # web tsc --noEmit
# do not run npm run build / next build locally; Vercel is the compile
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
