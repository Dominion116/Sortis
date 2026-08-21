import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

/**
 * Phase 2 toolchain smoke test.
 *
 * The point of this file is not the assertions, it is proving that the mock
 * coprocessor is wired up and that `hardhat test` runs the encrypted toolchain
 * with no live network and no relayer. If this file fails, nothing in Phases
 * 3 to 6 is worth debugging yet.
 */
describe("Phase 2 — toolchain", function () {
  it("runs the suite against the in-process network", async function () {
    const network = await ethers.provider.getNetwork();
    expect(network.chainId).to.equal(31337n);
  });

  it("exposes the FHEVM mock coprocessor to tests", async function () {
    // `isMock` is true only when the plugin's mock environment is active. A
    // false here means the suite would silently try to reach a real relayer.
    expect(fhevm.isMock).to.equal(true);
  });
});

describe("Phase 2 — contract skeletons compile and deploy", function () {
  async function deployFixture() {
    const [deployer, keeper] = await ethers.getSigners();

    const token = await ethers.deployContract("ConfidentialUSDT", [deployer.address]);
    await token.waitForDeployment();

    // 300s rounds: the continuous demo pool, so a reviewer arriving at a random
    // moment is never far from watching a full draw resolve.
    const pool = await ethers.deployContract("SortisPool", [await token.getAddress(), 300, deployer.address]);
    await pool.waitForDeployment();

    const draw = await ethers.deployContract("SortisDraw", [
      await pool.getAddress(),
      keeper.address,
      deployer.address,
    ]);
    await draw.waitForDeployment();

    const mockYield = await ethers.deployContract("MockYieldSource", [
      await token.getAddress(),
      2_000, // 20% APR in bps, deliberately generous so demo prizes are visible
      deployer.address,
    ]);
    await mockYield.waitForDeployment();

    return { deployer, keeper, token, pool, draw, mockYield };
  }

  it("deploys the pool with its asset and round duration set", async function () {
    const { token, pool } = await deployFixture();

    expect(await pool.asset()).to.equal(await token.getAddress());
    expect(await pool.roundDuration()).to.equal(300n);
    expect(await pool.ticketCount()).to.equal(0n);
  });

  it("wires the pool, draw engine and yield source together", async function () {
    const { deployer, pool, draw, mockYield } = await deployFixture();

    await (await pool.connect(deployer).setDrawEngine(await draw.getAddress())).wait();
    await (await pool.connect(deployer).setYieldSource(await mockYield.getAddress())).wait();

    expect(await pool.drawEngine()).to.equal(await draw.getAddress());
    expect(await pool.yieldSource()).to.equal(await mockYield.getAddress());
    expect(await draw.pool()).to.equal(await pool.getAddress());
  });

  it("reverts unimplemented Phase 5 paths explicitly rather than silently succeeding", async function () {
    const { keeper, draw } = await deployFixture();

    // A skeleton that quietly returns would be far more dangerous than one that
    // reverts, because later phases could be built on top of a no-op.
    await expect(draw.connect(keeper).closeRound()).to.be.revertedWithCustomError(draw, "NotImplemented");
    await expect(draw.connect(keeper).stepDraw(10)).to.be.revertedWithCustomError(draw, "NotImplemented");
    await expect(draw.connect(keeper).settle()).to.be.revertedWithCustomError(draw, "NotImplemented");
  });

  it("restricts keeper-only paths to the configured keeper", async function () {
    const { deployer, draw } = await deployFixture();

    // The deployer is the owner but deliberately not the keeper, so this proves
    // the access check is on keeper identity rather than on ownership.
    await expect(draw.connect(deployer).closeRound()).to.be.revertedWithCustomError(draw, "OnlyKeeper");
  });

  it("keeps MorphoYieldSource a documented stub rather than a half-live path", async function () {
    const { token } = await deployFixture();

    const morpho = await ethers.deployContract("MorphoYieldSource", [
      await token.getAddress(),
      // Steakhouse Confidential Prime USDC vault, mainnet. Recorded, not called.
      "0xBEeFFF209270748ddd194831b3fa287a5386f5bC",
    ]);
    await morpho.waitForDeployment();

    await expect(morpho.accrued()).to.be.revertedWithCustomError(morpho, "NotDeployed");
  });
});
