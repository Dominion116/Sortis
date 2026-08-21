import { FhevmType } from "@fhevm/hardhat-plugin";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import type { ConfidentialUSDT, MockYieldSource, SortisPool } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Phase 4 — yield source.
 *
 * Two things have to be true at once: the mock actually accrues in simulated
 * time (so a 5-minute demo round produces a visible prize), and the pool can
 * push a publicly known aggregate across the {IYieldSource} boundary without
 * touching per-user encrypted amounts.
 */
describe("Phase 4 — MockYieldSource", function () {
  const RATE_BPS = 2_000n; // 20% APR, the deploy default
  const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;
  const PRINCIPAL = 10_000_000n;
  const FIVE_MINUTES = 300;

  let deployer: HardhatEthersSigner;
  let actor: HardhatEthersSigner; // stands in for the pool in isolated tests
  let stranger: HardhatEthersSigner;

  let token: ConfidentialUSDT;
  let mock: MockYieldSource;
  let tokenAddress: string;
  let mockAddress: string;

  before(function () {
    if (!fhevm.isMock) this.skip();
  });

  beforeEach(async function () {
    [deployer, actor, stranger] = await ethers.getSigners();

    token = (await ethers.deployContract("ConfidentialUSDT", [deployer.address])) as unknown as ConfidentialUSDT;
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();

    mock = (await ethers.deployContract("MockYieldSource", [
      tokenAddress,
      RATE_BPS,
      deployer.address,
    ])) as unknown as MockYieldSource;
    await mock.waitForDeployment();
    mockAddress = await mock.getAddress();

    await (await mock.connect(deployer).setPool(actor.address)).wait();
    await (await token.connect(deployer).mint(actor.address, PRINCIPAL * 4n)).wait();

    const until = (await ethers.provider.getBlock("latest"))!.timestamp + 86_400;
    await (await token.connect(actor).setOperator(mockAddress, until)).wait();
  });

  async function decryptToken(account: HardhatEthersSigner) {
    return await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(account.address),
      tokenAddress,
      account,
    );
  }

  function expectedInterest(principal: bigint, rateBps: bigint, elapsed: bigint): bigint {
    return (principal * rateBps * elapsed) / (10_000n * SECONDS_PER_YEAR);
  }

  async function pendingSinceLastAccrual(principal: bigint = PRINCIPAL, rateBps: bigint = RATE_BPS) {
    const last = await mock.lastAccrualAt();
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    return expectedInterest(principal, rateBps, now - last);
  }

  // -------------------------------------------------------------------
  // Access
  // -------------------------------------------------------------------

  it("rejects deposit and withdraw from anyone but the configured pool", async function () {
    await expect(mock.connect(stranger).deposit(1n)).to.be.revertedWithCustomError(mock, "OnlyPool");
    await expect(mock.connect(stranger).withdraw(1n, stranger.address)).to.be.revertedWithCustomError(mock, "OnlyPool");
    await expect(mock.connect(deployer).deposit(1n)).to.be.revertedWithCustomError(mock, "OnlyPool");
  });

  it("rejects setPool(0)", async function () {
    await expect(mock.connect(deployer).setPool(ethers.ZeroAddress)).to.be.revertedWithCustomError(mock, "ZeroAddress");
  });

  // -------------------------------------------------------------------
  // Token movement
  // -------------------------------------------------------------------

  it("pulls a plaintext amount from the pool and records it as principal", async function () {
    await (await mock.connect(actor).deposit(PRINCIPAL)).wait();

    expect(await mock.totalDeposited()).to.equal(PRINCIPAL);
    expect(await decryptToken(actor)).to.equal(PRINCIPAL * 3n);
  });

  it("returns principal to the nominated recipient", async function () {
    await (await mock.connect(actor).deposit(PRINCIPAL)).wait();
    await (await mock.connect(actor).withdraw(PRINCIPAL, actor.address)).wait();

    expect(await mock.totalDeposited()).to.equal(0n);
    expect(await decryptToken(actor)).to.equal(PRINCIPAL * 4n);
  });

  it("reverts when a redeem exceeds principal plus unswept interest", async function () {
    await (await mock.connect(actor).deposit(PRINCIPAL)).wait();

    await expect(mock.connect(actor).withdraw(PRINCIPAL + 1n, actor.address))
      .to.be.revertedWithCustomError(mock, "InsufficientLiquidity")
      .withArgs(PRINCIPAL + 1n, PRINCIPAL);
  });

  // -------------------------------------------------------------------
  // Accrual — the exit criterion for this phase
  // -------------------------------------------------------------------

  describe("accrual", function () {
    it("is visible from the view within minutes of simulated time at the configured rate", async function () {
      await (await mock.connect(actor).deposit(PRINCIPAL)).wait();
      expect(await mock.accrued()).to.equal(0n);

      await ethers.provider.send("evm_increaseTime", [FIVE_MINUTES]);
      await ethers.provider.send("evm_mine", []);

      const pending = await pendingSinceLastAccrual();
      expect(pending).to.be.greaterThan(0n);
      expect(await mock.accrued()).to.equal(pending);
    });

    it("does not require a harvest for the view to include pending interest", async function () {
      await (await mock.connect(actor).deposit(PRINCIPAL)).wait();

      await ethers.provider.send("evm_increaseTime", [FIVE_MINUTES]);
      await ethers.provider.send("evm_mine", []);

      // Folding happens on the next mutating call. The view must not wait for it.
      const beforeHarvest = await mock.accrued();
      await (await mock.connect(deployer).setRateBps(Number(RATE_BPS))).wait();
      expect(await mock.accrued()).to.equal(beforeHarvest);
    });

    it("applies a rate change only to time after the change", async function () {
      await (await mock.connect(actor).deposit(PRINCIPAL)).wait();

      await ethers.provider.send("evm_increaseTime", [FIVE_MINUTES]);
      await ethers.provider.send("evm_mine", []);
      const firstPeriod = await mock.accrued();

      const doubled = Number(RATE_BPS) * 2;
      await (await mock.connect(deployer).setRateBps(doubled)).wait();

      await ethers.provider.send("evm_increaseTime", [FIVE_MINUTES]);
      await ethers.provider.send("evm_mine", []);

      const secondPeriod = await pendingSinceLastAccrual(PRINCIPAL, BigInt(doubled));
      expect(await mock.accrued()).to.equal(firstPeriod + secondPeriod);
      expect(secondPeriod).to.be.greaterThan(firstPeriod);
    });

    it("lets a withdraw harvest interest from the pre-funded reserve", async function () {
      // Reserve sits on the mock itself, distinct from pool principal, so a
      // prize can be paid without touching depositor funds.
      await (await token.connect(deployer).mint(mockAddress, PRINCIPAL)).wait();
      await (await mock.connect(actor).deposit(PRINCIPAL)).wait();

      await ethers.provider.send("evm_increaseTime", [FIVE_MINUTES]);
      await ethers.provider.send("evm_mine", []);

      const prize = await mock.accrued();
      expect(prize).to.be.greaterThan(0n);

      await (await mock.connect(actor).withdraw(PRINCIPAL + prize, stranger.address)).wait();

      expect(await mock.totalDeposited()).to.equal(0n);
      expect(await mock.accrued()).to.equal(0n);
      expect(await decryptToken(stranger)).to.equal(PRINCIPAL + prize);
    });
  });
});

describe("Phase 4 — SortisPool yield routing", function () {
  const ROUND_DURATION = 300n;
  const RATE_BPS = 2_000n;
  const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;
  const PRINCIPAL = 10_000_000n;
  const FIVE_MINUTES = 300;

  let deployer: HardhatEthersSigner;
  let drawEngine: HardhatEthersSigner;
  let alice: HardhatEthersSigner;

  let token: ConfidentialUSDT;
  let pool: SortisPool;
  let mock: MockYieldSource;
  let tokenAddress: string;
  let poolAddress: string;

  before(function () {
    if (!fhevm.isMock) this.skip();
  });

  beforeEach(async function () {
    [deployer, drawEngine, alice] = await ethers.getSigners();

    token = (await ethers.deployContract("ConfidentialUSDT", [deployer.address])) as unknown as ConfidentialUSDT;
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();

    pool = (await ethers.deployContract("SortisPool", [
      tokenAddress,
      ROUND_DURATION,
      deployer.address,
    ])) as unknown as SortisPool;
    await pool.waitForDeployment();
    poolAddress = await pool.getAddress();

    mock = (await ethers.deployContract("MockYieldSource", [
      tokenAddress,
      RATE_BPS,
      deployer.address,
    ])) as unknown as MockYieldSource;
    await mock.waitForDeployment();

    await (await pool.connect(deployer).setDrawEngine(drawEngine.address)).wait();
    await (await mock.connect(deployer).setPool(poolAddress)).wait();
    await (await pool.connect(deployer).setYieldSource(await mock.getAddress())).wait();

    // A known plaintext float, minted straight to the pool. Individual user
    // deposits stay encrypted in the pool and are not used as the yield
    // principal, because that would leak them at the IYieldSource boundary.
    await (await token.connect(deployer).mint(poolAddress, PRINCIPAL)).wait();
  });

  it("returns 0 from accrued() when no yield source is configured", async function () {
    const bare = (await ethers.deployContract("SortisPool", [
      tokenAddress,
      ROUND_DURATION,
      deployer.address,
    ])) as unknown as SortisPool;
    await bare.waitForDeployment();
    expect(await bare.accrued()).to.equal(0n);
  });

  it("reverts allocateToYield when no yield source is set", async function () {
    const bare = (await ethers.deployContract("SortisPool", [
      tokenAddress,
      ROUND_DURATION,
      deployer.address,
    ])) as unknown as SortisPool;
    await bare.waitForDeployment();
    await expect(bare.connect(deployer).allocateToYield(1n)).to.be.revertedWithCustomError(bare, "YieldSourceNotSet");
  });

  it("lets only the owner or the draw engine route funds into the yield source", async function () {
    await expect(pool.connect(alice).allocateToYield(PRINCIPAL)).to.be.revertedWithCustomError(
      pool,
      "UnauthorizedYieldRouter",
    );
  });

  it("routes a publicly known amount into the yield source and surfaces accrual on the pool", async function () {
    await (await pool.connect(deployer).allocateToYield(PRINCIPAL)).wait();
    expect(await mock.totalDeposited()).to.equal(PRINCIPAL);
    expect(await pool.accrued()).to.equal(0n);

    await ethers.provider.send("evm_increaseTime", [FIVE_MINUTES]);
    await ethers.provider.send("evm_mine", []);

    const last = await mock.lastAccrualAt();
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const expected = (PRINCIPAL * RATE_BPS * (now - last)) / (10_000n * SECONDS_PER_YEAR);

    expect(expected).to.be.greaterThan(0n);
    expect(await pool.accrued()).to.equal(expected);
    expect(await mock.accrued()).to.equal(expected);
  });

  it("lets the draw engine harvest accrued interest to a recipient", async function () {
    await (await token.connect(deployer).mint(await mock.getAddress(), PRINCIPAL)).wait();
    await (await pool.connect(drawEngine).allocateToYield(PRINCIPAL)).wait();

    await ethers.provider.send("evm_increaseTime", [FIVE_MINUTES]);
    await ethers.provider.send("evm_mine", []);

    const prize = await pool.accrued();
    expect(prize).to.be.greaterThan(0n);

    await (await pool.connect(drawEngine).recallFromYield(prize, alice.address)).wait();

    const aliceClear = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(alice.address),
      tokenAddress,
      alice,
    );
    expect(aliceClear).to.equal(prize);
    expect(await mock.totalDeposited()).to.equal(PRINCIPAL);
  });

  it("keeps an encrypted user deposit withdrawable after idle funds have been allocated", async function () {
    const until = (await ethers.provider.getBlock("latest"))!.timestamp + 86_400;
    await (await token.connect(deployer).mint(alice.address, 100_000n)).wait();
    await (await token.connect(alice).setOperator(poolAddress, until)).wait();

    const encrypted = await fhevm.createEncryptedInput(poolAddress, alice.address).add64(100_000n).encrypt();
    await (await pool.connect(alice).deposit(encrypted.handles[0], encrypted.inputProof)).wait();

    await (await pool.connect(deployer).allocateToYield(PRINCIPAL)).wait();
    await (await pool.connect(alice).withdraw(0)).wait();

    const aliceClear = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(alice.address),
      tokenAddress,
      alice,
    );
    expect(aliceClear).to.equal(100_000n);
  });
});
