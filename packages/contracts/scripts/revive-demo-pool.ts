import * as fs from "node:fs";
import * as path from "node:path";

import { ethers, fhevm, network } from "hardhat";

/**
 * Revive a pool whose only ticket has been withdrawn.
 *
 * WHY THIS SCRIPT EXISTS
 *
 * Cumulative sums are computed at append time and are never rebuilt on
 * withdrawal, which is a deliberate design decision (rebuilding is linear and
 * would run on every withdraw). The consequence is that a withdrawn ticket keeps
 * its slice of the number line forever, and any random value landing in that
 * slice produces a rollover rather than a winner.
 *
 * That is harmless in a pool with many tickets. In a pool with ONE withdrawn
 * ticket it is fatal to the demo: the dead ticket owns the entire range, so every
 * subsequent round rolls over and no winner is ever drawn.
 *
 * Depositing again does not fully fix it either. A new ticket is appended ABOVE
 * the dead range, so the dead range's share of the total is what decides how
 * often rounds still roll over. To make a winner likely the new deposit has to be
 * large relative to the dead ranges, which is why this script defaults to a
 * deposit far larger than the 1 cUSDT already stranded.
 *
 * Usage (from packages/contracts, needs .env with the owner/keeper key):
 *
 *   npx hardhat run scripts/revive-demo-pool.ts --network sepolia
 *
 * Override the amount (in whole cUSDT) with REVIVE_AMOUNT.
 */

type Deployed = { address: string };

type DeploymentFile = {
  token: Deployed;
  demo: { pool: Deployed };
};

/** cUSDT carries 6 decimals, matching the USDT it stands in for. */
const DECIMALS = 6n;
const UNIT = 10n ** DECIMALS;

async function main() {
  if (network.name !== "sepolia") {
    throw new Error("Run with --network sepolia");
  }

  const whole = BigInt(process.env.REVIVE_AMOUNT ?? "25");
  if (whole <= 0n) throw new Error("REVIVE_AMOUNT must be greater than zero");
  const amount = whole * UNIT;

  console.log("Initializing FHEVM relayer SDK...");
  await fhevm.initializeCLIApi();

  const file = path.join(__dirname, "..", "deployments", "sepolia.json");
  if (!fs.existsSync(file)) {
    throw new Error(`No deployment file at ${file}. Run deploy:sepolia first.`);
  }
  const deployment = JSON.parse(fs.readFileSync(file, "utf8")) as DeploymentFile;

  const [owner] = await ethers.getSigners();
  const ownerAddress = await owner.getAddress();
  const poolAddress = deployment.demo.pool.address;

  const token = await ethers.getContractAt("ConfidentialUSDT", deployment.token.address);
  const pool = await ethers.getContractAt("SortisPool", poolAddress);

  console.log(`Owner:  ${ownerAddress}`);
  console.log(`Pool:   ${poolAddress}`);
  console.log(`Amount: ${whole} cUSDT (${amount} units)`);

  // `ConfidentialUSDT.mint` accepts the owner as well as the configured faucet,
  // so this does not need to wait out the faucet's hourly cooldown.
  console.log("Minting...");
  await (await token.mint(ownerAddress, amount)).wait();

  const latest = await ethers.provider.getBlock("latest");
  const until = BigInt(latest!.timestamp + 86_400 * 30);
  console.log("Approving the pool as ERC-7984 operator...");
  await (await token.setOperator(poolAddress, until)).wait();

  console.log("Encrypting the deposit in the relayer...");
  const encrypted = await encryptWithRetry(poolAddress, ownerAddress, amount);

  const before = await pool.ticketCount();
  console.log("Depositing...");
  const receipt = await (await pool.deposit(encrypted.handles[0], encrypted.inputProof)).wait();
  const after = await pool.ticketCount();

  if (after !== before + 1n) {
    throw new Error(`Expected ticketCount ${before + 1n}, got ${after}`);
  }

  console.log("");
  console.log(`Deposit tx:    ${receipt?.hash}`);
  console.log(`New ticket id: ${before}`);
  console.log(`Eligible from: round ${await pool.nextEligibleRoundId()}`);
  console.log("");
  console.log("The new ticket joins the NEXT round, not the one currently open.");
  console.log("Wait for the keeper to settle the open round, then the round after");
  console.log("it should draw a winner rather than rolling over.");
}

async function encryptWithRetry(contractAddress: string, userAddress: string, amount: bigint) {
  // The relayer times out fairly often; this mirrors the retry in sepolia-smoke.
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fhevm.createEncryptedInput(contractAddress, userAddress).add64(amount).encrypt();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Relayer encrypt failed (attempt ${attempt}/3): ${message.split("\n")[0]}`);
      await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt));
    }
  }
  throw lastError;
}

// The relayer's HTTP client can reject on its own timer, outside the await chain.
process.on("unhandledRejection", (reason) => {
  console.error(`Unhandled rejection (likely a relayer timeout): ${String(reason)}`);
  process.exit(1);
});

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

