import * as fs from "node:fs";
import * as path from "node:path";

import hre from "hardhat";

/**
 * Phase 7 verification. hardhat-verify 2.0.13 still talks to Sourcify's v1 API,
 * which was turned off in July 2026. This script posts Standard JSON to
 * Sourcify v2 (`/v2/verify/{chainId}/{address}`) and, when an Etherscan key is
 * present, also runs the Etherscan verifier.
 */

type Deployed = {
  address: string;
  args: Array<string | number>;
};

type PoolRecord = {
  pool: Deployed;
  draw: Deployed;
  yieldSource: Deployed;
};

type DeploymentFile = {
  token: Deployed;
  faucet: Deployed;
  demo: PoolRecord;
  standard: PoolRecord;
};

type Target = {
  name: string;
  address: string;
  fqn: string;
  args: Array<string | number>;
};

const SOURCIFY = "https://sourcify.dev/server";
const CHAIN_ID = 11155111;

function loadBuildInfo(fqn: string): { input: unknown; compilerVersion: string } {
  const dir = path.join(__dirname, "..", "artifacts", "build-info");
  const [source] = fqn.split(":");
  for (const file of fs.readdirSync(dir)) {
    const info = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as {
      solcLongVersion: string;
      input: unknown;
      output: { contracts: Record<string, Record<string, unknown>> };
    };
    if (info.output?.contracts?.[source]) {
      return { input: info.input, compilerVersion: info.solcLongVersion.replace(/^v/, "") };
    }
  }
  throw new Error(`No build-info contains ${fqn}`);
}

async function sourcifyVerify(target: Target): Promise<void> {
  const lookup = await fetch(`${SOURCIFY}/v2/contract/${CHAIN_ID}/${target.address}?fields=all`);
  if (lookup.ok) {
    const existing = (await lookup.json()) as { match?: string };
    if (existing.match === "exact_match" || existing.match === "match") {
      console.log(`  sourcify: already verified (${existing.match})`);
      return;
    }
  }

  const { input, compilerVersion } = loadBuildInfo(target.fqn);
  const response = await fetch(`${SOURCIFY}/v2/verify/${CHAIN_ID}/${target.address}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stdJsonInput: input,
      compilerVersion,
      contractIdentifier: target.fqn,
    }),
  });

  const payload = (await response.json()) as { verificationId?: string; message?: string; error?: string };
  if (!response.ok || !payload.verificationId) {
    throw new Error(payload.message ?? payload.error ?? `HTTP ${response.status}`);
  }

  // Sourcify queues jobs; a cold queue on a large FHEVM contract has taken well
  // over a minute. Poll for three, then give up rather than fail the whole run.
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const job = await fetch(`${SOURCIFY}/v2/verify/${payload.verificationId}`);
    const status = (await job.json()) as {
      isJobCompleted?: boolean;
      jobError?: { message?: string };
      contract?: { match?: string };
    };
    if (status.isJobCompleted) {
      if (status.jobError?.message) {
        throw new Error(status.jobError.message);
      }
      console.log(`  sourcify: ${status.contract?.match ?? "verified"}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("Sourcify verification timed out");
}

async function etherscanVerify(target: Target): Promise<void> {
  if ((process.env.ETHERSCAN_API_KEY ?? "").length === 0) {
    console.log("  etherscan: skipped (no ETHERSCAN_API_KEY)");
    return;
  }
  await hre.run("verify:etherscan", {
    address: target.address,
    constructorArgsParams: target.args.map((value) => String(value)),
    contract: target.fqn,
  });
  console.log("  etherscan: ok");
}

async function verifyOne(target: Target) {
  console.log(`Verifying ${target.name} at ${target.address}`);
  try {
    await sourcifyVerify(target);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  sourcify: ${message}`);
  }
  try {
    await etherscanVerify(target);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("already verified")) {
      console.log("  etherscan: already verified");
    } else {
      console.error(`  etherscan: ${message}`);
    }
  }
}

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`No deployment file at ${file}. Run deploy first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(file, "utf8")) as DeploymentFile;
  const targets: Target[] = [
    {
      name: "ConfidentialUSDT",
      address: deployment.token.address,
      fqn: "contracts/token/ConfidentialUSDT.sol:ConfidentialUSDT",
      args: deployment.token.args,
    },
    {
      name: "SortisFaucet",
      address: deployment.faucet.address,
      fqn: "contracts/SortisFaucet.sol:SortisFaucet",
      args: deployment.faucet.args,
    },
    {
      name: "MockYieldSource (Demo)",
      address: deployment.demo.yieldSource.address,
      fqn: "contracts/yields/MockYieldSource.sol:MockYieldSource",
      args: deployment.demo.yieldSource.args,
    },
    {
      name: "SortisPool (Demo)",
      address: deployment.demo.pool.address,
      fqn: "contracts/SortisPool.sol:SortisPool",
      args: deployment.demo.pool.args,
    },
    {
      name: "SortisDraw (Demo)",
      address: deployment.demo.draw.address,
      fqn: "contracts/SortisDraw.sol:SortisDraw",
      args: deployment.demo.draw.args,
    },
    {
      name: "MockYieldSource (Standard)",
      address: deployment.standard.yieldSource.address,
      fqn: "contracts/yields/MockYieldSource.sol:MockYieldSource",
      args: deployment.standard.yieldSource.args,
    },
    {
      name: "SortisPool (Standard)",
      address: deployment.standard.pool.address,
      fqn: "contracts/SortisPool.sol:SortisPool",
      args: deployment.standard.pool.args,
    },
    {
      name: "SortisDraw (Standard)",
      address: deployment.standard.draw.address,
      fqn: "contracts/SortisDraw.sol:SortisDraw",
      args: deployment.standard.draw.args,
    },
  ];

  for (const target of targets) {
    await verifyOne(target);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
