# Phase 13 submission checklist

This final handoff checklist distinguishes reproducible repository checks from
actions requiring the production Vercel project, a funded keeper, or a human
recording.

## Reproducible from the repository

- `npm run contracts:compile`
- `npm run contracts:test` (includes `ClaimableHistory`, which pins the handle-history assumption the round-history feature depends on)
- `npm run contracts:lint`
- `npm run contracts:typecheck`
- `npm run typecheck`
- `npm run lint`
- `npm exec --workspace=web -- next typegen`
- `git diff --check`
- Confirm generated addresses match `packages/contracts/deployments/sepolia.json`.

## Production Vercel checks

Set `CRON_SECRET`, `SORTIS_KEEPER_PRIVATE_KEY`,
`NEXT_PUBLIC_SEPOLIA_RPC_URL` (or use the documented public fallback), and
`ZAMA_FHEVM_API_KEY` when the relayer requires it. `DATABASE_URL` is optional:
without it the app runs exactly as it did before the backend existed. Keep the
keeper key, the cron secret, and the database URL server-only.

Confirm `/api/cron/keeper` and `/api/cron/indexer` both return `401` without
their bearer secret.

### Scheduling, which is not optional

`vercel.json` registers a daily cron for both routes because that is Vercel
Hobby's limit. A daily tick cannot settle a 300-second demo round: a round needs
several sequential keeper invocations. Register an external scheduler
(cron-job.org, Upstash QStash, or Vercel Pro cron) hitting both routes once a
minute with `Authorization: Bearer $CRON_SECRET`. Verify by watching
`/app/draws` advance through Open, Awaiting oracle, Sweeping, and Settled
without manual intervention.

Both routes are idempotent, so overlapping or retried calls are safe.

### Database checks, if `DATABASE_URL` is set

- Call `/api/cron/indexer` repeatedly until it reports `caughtUp: true` for both
  pools. The backfill walks 9,000 blocks per call from the deployment block.
- `/api/rounds/<id>` should return `indexed: true` with an event trail.
- `/api/prizes/<address>` should list rounds for a participating address, each
  with `determinable` and a handle pair.
- Confirm `/verify/<roundId>` still renders when the database is unreachable: it
  falls back to a bounded `getLogs` scan.

Fund the keeper account with enough Sepolia ETH for recurring keeper
transactions through the submission deadline. A per-minute schedule spends
considerably more gas than the previous daily cron, so budget accordingly. The
keeper address is the `keeper()` value on both draw contracts.

## Live walkthrough

1. Start with a wallet that has no cUSDT, visit `/faucet`, and drip test tokens.
2. Deposit into the demo pool at `/pool`.
3. Watch `/app/draws` until the round closes, the oracle is answered, the sweep
   reaches its cursor limit, and settlement appears.
4. Open `/verify/<roundId>` in a separate wallet-free browser window.
5. Open `/app/prizes`, decrypt the private claimable balance, and claim if the
   wallet won.
6. On the same screen, use Past rounds to check an individual settled round and
   confirm the three outcomes read correctly (won, not this round, and the
   indeterminate case if a claim interleaved).
7. Return to `/pool`, decrypt the ticket state, and withdraw principal.

The Sepolia smoke script covers the faucet and encrypted deposit legs. A
complete winner-path walkthrough cannot be honestly automated without waiting
for a live round and controlling the random outcome, so do not describe it as
completed unless the production run was observed.

## Human submission actions

- Record a three-minute screen capture with a real person and live voice.
- Publish the project introduction, tagging `@zama` and
  `#ZamaDeveloperProgram` before the deadline.
- Submit the production URL, repository URL, video URL, and post/article URL.
- Re-read the README limitations: yield is simulated on Sepolia and the
  keeper is centralized testnet infrastructure.
