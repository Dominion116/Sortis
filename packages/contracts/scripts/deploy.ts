import * as fs from "node:fs";
import * as path from "node:path";

import { ethers, network } from "hardhat";

/**
 * Phase 7 deployment: confidential token, faucet, both pool configurations,
 * mock yield sources, wiring, yield-reserve seeding, and address publishing.
 *
 * `MorphoYieldSource` is deliberately NOT deployed. It is the documented mainnet
 * path, and deploying a contract that reverts on every call would be noise.
 *
 * Written against plain ethers rather than hardhat-deploy: in an npm workspace
 * hardhat-deploy hoists to the repo root while hardhat itself nests inside
 * packages/contracts, and the plugin then cannot resolve `hardhat/types/runtime`.
 */

/// Continuous demo pool: a round every five minutes, so a reviewer arriving at
/// a random moment is never far from watching a complete draw resolve.
const DEMO_ROUND_DURATION = 5 * 60;

/// Standard pool: a round length that resembles a real savings product.
const STANDARD_ROUND_DURATION = 24 * 60 * 60;

/// 20% APR in basis points. Generous on purpose so a demo round pays a visible
/// prize within minutes. Labelled "simulated testnet yield" everywhere it shows.
const MOCK_RATE_BPS = 2_000;

/// One drip of test cUSDT. Matches the amount used in the unit tests.
const FAUCET_DRIP_AMOUNT = 1_000_000;

/// One hour. A reviewer claims once; a second claim from the same address waits.
const FAUCET_COOLDOWN = 60 * 60;

/// Public principal pushed into each mock yield source so interest starts
/// accruing immediately, before any user has deposited.
const YIELD_PRINCIPAL = 1_000_000_000n;

/// Extra confidential tokens minted straight to each yield source so harvested
/// interest has inventory to pay from. Interest is computed in accounting, but
/// `confidentialTransfer` still needs the tokens to exist.
const YIELD_RESERVE = 10_000_000_000n;

type Deployed = {
  address: string;
  args: Array<string | number>;
};

type PoolRecord = {
  pool: Deployed;
  draw: Deployed;
  yieldSource: Deployed;
  roundDuration: number;
};

type DeploymentFile = {
  network: string;
  chainId: number;
  deployer: string;
  keeper: string;
  deployedAt: string;
  token: Deployed;
  faucet: Deployed;
  demo: PoolRecord;
  standard: PoolRecord;
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const keeper = process.env.KEEPER_ADDRESS && process.env.KEEPER_ADDRESS.length > 0
    ? process.env.KEEPER_ADDRESS
    : deployerAddress;

  const balance = await ethers.provider.getBalance(deployerAddress);
  console.log(`Network:  ${network.name} (${network.config.chainId ?? "?"})`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Keeper:   ${keeper}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);

  if (network.name === "sepolia" && balance === 0n) {
    throw new Error(
      `Deployer ${deployerAddress} has 0 Sepolia ETH. Fund it from a public faucet and re-run.`,
    );
  }

  const token = await ethers.deployContract("ConfidentialUSDT", [deployerAddress]);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`ConfidentialUSDT: ${tokenAddress}`);

  const faucet = await ethers.deployContract("SortisFaucet", [
    tokenAddress,
    FAUCET_DRIP_AMOUNT,
    FAUCET_COOLDOWN,
    deployerAddress,
  ]);
  await faucet.waitForDeployment();
  const faucetAddress = await faucet.getAddress();
  await (await token.setFaucet(faucetAddress)).wait();
  console.log(`SortisFaucet:     ${faucetAddress}`);

  const demo = await deployPool("Demo", DEMO_ROUND_DURATION, tokenAddress, deployerAddress, keeper);
  const standard = await deployPool(
    "Standard",
    STANDARD_ROUND_DURATION,
    tokenAddress,
    deployerAddress,
    keeper,
  );

  const deployment: DeploymentFile = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployerAddress,
    keeper,
    deployedAt: new Date().toISOString(),
    token: { address: tokenAddress, args: [deployerAddress] },
    faucet: {
      address: faucetAddress,
      args: [tokenAddress, FAUCET_DRIP_AMOUNT, FAUCET_COOLDOWN, deployerAddress],
    },
    demo,
    standard,
  };

  writeDeployment(deployment);
  if (network.name === "sepolia") {
    writeWebAddresses(deployment);
  }

  console.log("Phase 7 deployment complete.");
  if (network.name === "sepolia") {
    console.log("Next: npm run verify:sepolia, then npm run smoke:sepolia");
  }
}

async function deployPool(
  label: string,
  duration: number,
  tokenAddress: string,
  deployerAddress: string,
  keeper: string,
): Promise<PoolRecord> {
  const mockYield = await ethers.deployContract("MockYieldSource", [
    tokenAddress,
    MOCK_RATE_BPS,
    deployerAddress,
  ]);
  await mockYield.waitForDeployment();
  const mockYieldAddress = await mockYield.getAddress();

  const pool = await ethers.deployContract("SortisPool", [tokenAddress, duration, deployerAddress]);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();

  const draw = await ethers.deployContract("SortisDraw", [poolAddress, keeper, deployerAddress]);
  await draw.waitForDeployment();
  const drawAddress = await draw.getAddress();

  await (await pool.setDrawEngine(drawAddress)).wait();
  await (await mockYield.setPool(poolAddress)).wait();
  await (await pool.setYieldSource(mockYieldAddress)).wait();

  // Seed: principal sits in the yield source and starts accruing; a separate
  // reserve covers the interest the mock will later transfer out as prizes.
  const token = await ethers.getContractAt("ConfidentialUSDT", tokenAddress);
  await (await token.mint(poolAddress, YIELD_PRINCIPAL)).wait();
  await (await token.mint(mockYieldAddress, YIELD_RESERVE)).wait();
  await (await pool.allocateToYield(YIELD_PRINCIPAL)).wait();

  const drawContract = await ethers.getContractAt("SortisDraw", drawAddress);
  await (await drawContract.openRound()).wait();

  console.log(`MockYieldSource (${label}): ${mockYieldAddress}`);
  console.log(`SortisPool (${label}):      ${poolAddress}`);
  console.log(`SortisDraw (${label}):      ${drawAddress}`);

  return {
    roundDuration: duration,
    yieldSource: { address: mockYieldAddress, args: [tokenAddress, MOCK_RATE_BPS, deployerAddress] },
    pool: { address: poolAddress, args: [tokenAddress, duration, deployerAddress] },
    draw: { address: drawAddress, args: [poolAddress, keeper, deployerAddress] },
  };
}

function writeDeployment(deployment: DeploymentFile) {
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${deployment.network}.json`);
  fs.writeFileSync(file, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");
  console.log(`Wrote ${file}`);
}

function writeWebAddresses(deployment: DeploymentFile) {
  const file = path.join(__dirname, "..", "..", "web", "lib", "contracts", "addresses.ts");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = `// Generated by packages/contracts/scripts/deploy.ts. Do not edit by hand.

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

export type Address = \`0x\${string}\`;

export const sepolia = {
  chainId: SEPOLIA_CHAIN_ID,
  explorer: SEPOLIA_EXPLORER,
  token: "${deployment.token.address}" as Address,
  faucet: "${deployment.faucet.address}" as Address,
  demo: {
    pool: "${deployment.demo.pool.address}" as Address,
    draw: "${deployment.demo.draw.address}" as Address,
    yieldSource: "${deployment.demo.yieldSource.address}" as Address,
    roundDuration: ${deployment.demo.roundDuration},
  },
  standard: {
    pool: "${deployment.standard.pool.address}" as Address,
    draw: "${deployment.standard.draw.address}" as Address,
    yieldSource: "${deployment.standard.yieldSource.address}" as Address,
    roundDuration: ${deployment.standard.roundDuration},
  },
} as const;
`;
  fs.writeFileSync(file, body, "utf8");
  console.log(`Wrote ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
