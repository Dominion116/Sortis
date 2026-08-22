import * as fs from "node:fs";
import * as path from "node:path";

import { ethers, fhevm, network } from "hardhat";

/**
 * Phase 7 Sepolia integration: drip the faucet to a fresh address, then
 * deposit into the demo pool from the deployer. Completing this script is
 * the "one deposit against Sepolia, not just the mock" exit criterion.
 */

type Deployed = { address: string };

type DeploymentFile = {
  token: Deployed;
  faucet: Deployed;
  demo: { pool: Deployed };
};

async function main() {
  if (network.name !== "sepolia") {
    throw new Error("Run with --network sepolia");
  }

  console.log("Initializing FHEVM relayer SDK...");
  await fhevm.initializeCLIApi();
  console.log("FHEVM relayer SDK ready");

  const file = path.join(__dirname, "..", "deployments", "sepolia.json");
  if (!fs.existsSync(file)) {
    throw new Error(`No deployment file at ${file}. Run deploy:sepolia first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(file, "utf8")) as DeploymentFile;
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  let faucetChecked = false;

  const token = await ethers.getContractAt("ConfidentialUSDT", deployment.token.address);
  const faucet = await ethers.getContractAt("SortisFaucet", deployment.faucet.address);
  const pool = await ethers.getContractAt("SortisPool", deployment.demo.pool.address);

  if (process.env.SMOKE_SKIP_FAUCET === "1") {
    console.log("Skipping faucet drips (SMOKE_SKIP_FAUCET=1)");
  } else {
    const fresh = ethers.Wallet.createRandom().connect(ethers.provider);
    console.log(`Fresh recipient: ${fresh.address}`);

    const dripTx = await faucet.dripTo(fresh.address);
    const dripReceipt = await dripTx.wait();
    const freshHandle = await token.confidentialBalanceOf(fresh.address);
    if (freshHandle === ethers.ZeroHash) {
      throw new Error("Faucet drip left a zero handle on the fresh address");
    }
    console.log(`Faucet drip tx: ${dripReceipt?.hash}`);
    console.log(`Fresh balance handle: ${freshHandle}`);
    faucetChecked = true;

    try {
      const selfDrip = await faucet.drip();
      await selfDrip.wait();
      console.log("Deployer faucet drip: ok");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Deployer faucet drip skipped: ${message.split("\n")[0]}`);
    }
  }

  const latest = await ethers.provider.getBlock("latest");
  const until = BigInt(latest!.timestamp + 86_400 * 30);
  await (await token.setOperator(deployment.demo.pool.address, until)).wait();

  const amount = 100_000n;
  const encrypted = await encryptWithRetry(deployment.demo.pool.address, deployerAddress, amount);

  const beforeCount = await pool.ticketCount();
  const depositTx = await pool.deposit(encrypted.handles[0], encrypted.inputProof);
  const depositReceipt = await depositTx.wait();
  const afterCount = await pool.ticketCount();

  if (afterCount !== beforeCount + 1n) {
    throw new Error(`Expected ticketCount ${beforeCount + 1n}, got ${afterCount}`);
  }

  console.log(`Deposit tx:     ${depositReceipt?.hash}`);
  console.log(`Ticket id:      ${beforeCount}`);
  console.log(`Eligible from:  round ${await pool.nextEligibleRoundId()}`);
  console.log(
    faucetChecked
      ? "Sepolia smoke passed: faucet minted to a fresh address, demo pool accepted a deposit."
      : "Sepolia smoke passed: demo pool accepted a deposit (faucet leg skipped).",
  );
}

async function encryptWithRetry(contractAddress: string, userAddress: string, amount: bigint) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      console.log(`Encrypting deposit amount (attempt ${attempt}/3)`);
      return await fhevm.createEncryptedInput(contractAddress, userAddress).add64(amount).encrypt();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Relayer encrypt failed: ${message.split("\n")[0]}`);
      await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt));
    }
  }
  throw lastError;
}

// The relayer's HTTP client can reject on its own timer, outside the await
// chain above, which would otherwise kill the run with a bare stack trace.
process.on("unhandledRejection", (reason) => {
  console.error(`Unhandled rejection (likely a relayer timeout): ${String(reason)}`);
  console.error("Re-run with SMOKE_SKIP_FAUCET=1 to retry just the deposit leg.");
  process.exit(1);
});

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
