# Phase 13 submission checklist

This final handoff checklist distinguishes reproducible repository checks from
actions requiring the production Vercel project, a funded keeper, or a human
recording.

## Reproducible from the repository

- `npm run contracts:compile`
- `npm run contracts:test`
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
`ZAMA_FHEVM_API_KEY` when the relayer requires it. Keep the keeper key and
cron secret server-only. Confirm `vercel.json` schedules
`/api/cron/keeper` and that the route returns `401` without its bearer secret.

After deployment, call the route once with the secret and inspect the JSON
action. Each invocation advances each pool by at most one transition; retries
are safe because the next call re-reads onchain state.

Fund the keeper account with enough Sepolia ETH for recurring keeper
transactions through the submission deadline. The keeper address is the
`keeper()` value on both draw contracts.

## Live walkthrough

1. Start with a wallet that has no cUSDT, visit `/faucet`, and drip test tokens.
2. Deposit into the demo pool at `/pool`.
3. Watch `/app/draws` until the round closes, the oracle is answered, the sweep
   reaches its cursor limit, and settlement appears.
4. Open `/verify/<roundId>` in a separate wallet-free browser window.
5. Open `/app/prizes`, decrypt the private claimable balance, and claim if the
   wallet won.
6. Return to `/pool`, decrypt the ticket state, and withdraw principal.

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
