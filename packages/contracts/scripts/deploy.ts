import { ethers, network } from "hardhat";

/**
 * Deployment skeleton (Phases 2-4).
 *
 * Deploys the confidential token, both pool configurations, the draw engine and
 * a mock yield source per pool, then wires them together. Real Sepolia deployment,
 * Etherscan verification and address publishing are Phase 7; this exists now so
 * the sequence is exercised on the local mock coprocessor from the start rather
 * than written for the first time under deadline pressure.
 *
 * Written against plain ethers rather than hardhat-deploy: in an npm workspace
 * hardhat-deploy hoists to the repo root while hardhat itself nests inside
 * packages/contracts, and the plugin then cannot resolve `hardhat/types/runtime`.
 * A ~60 line script is a better trade than fighting npm's hoisting.
 *
 * `MorphoYieldSource` is deliberately NOT deployed. It is the documented mainnet
 * path, and deploying a contract that reverts on every call would be noise.
 */

/// Continuous demo pool: a round every five minutes, so a reviewer arriving at
/// a random moment is never far from watching a complete draw resolve.
const DEMO_ROUND_DURATION = 5 * 60;

/// Standard pool: a round length that resembles a real savings product.
const STANDARD_ROUND_DURATION = 24 * 60 * 60;

/// 20% APR in basis points. Generous on purpose so a demo round pays a visible
/// prize within minutes. Labelled "simulated testnet yield" everywhere it shows.
const MOCK_RATE_BPS = 2_000;

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  // The keeper is a separate hot key in production (Vercel Cron). On local and
  // for the initial Sepolia bring-up it defaults to the deployer.
  const keeper = process.env.KEEPER_ADDRESS ?? deployerAddress;

  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployerAddress}`);

  const token = await ethers.deployContract("ConfidentialUSDT", [deployerAddress]);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`ConfidentialUSDT: ${tokenAddress}`);

  for (const [label, duration] of [
    ["Demo", DEMO_ROUND_DURATION],
    ["Standard", STANDARD_ROUND_DURATION],
  ] as const) {
    // One mock per pool: accrual and the prize reserve are independent, and
    // MockYieldSource.onlyPool is a single address.
    const mockYield = await ethers.deployContract("MockYieldSource", [
      tokenAddress,
      MOCK_RATE_BPS,
      deployerAddress,
    ]);
    await mockYield.waitForDeployment();
    const mockYieldAddress = await mockYield.getAddress();

    const pool = await ethers.deployContract("SortisPool", [
      tokenAddress,
      duration,
      deployerAddress,
    ]);
    await pool.waitForDeployment();
    const poolAddress = await pool.getAddress();

    const draw = await ethers.deployContract("SortisDraw", [poolAddress, keeper, deployerAddress]);
    await draw.waitForDeployment();
    const drawAddress = await draw.getAddress();

    await (await pool.setDrawEngine(drawAddress)).wait();
    await (await mockYield.setPool(poolAddress)).wait();
    await (await pool.setYieldSource(mockYieldAddress)).wait();

    console.log(`MockYieldSource (${label}): ${mockYieldAddress}`);
    console.log(`SortisPool (${label}):      ${poolAddress}`);
    console.log(`SortisDraw (${label}):      ${drawAddress}`);
  }

  console.log("Phase 4 core deployment complete. The draw engine lands in Phase 5.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
