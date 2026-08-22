import { FhevmType } from "@fhevm/hardhat-plugin";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import type { ConfidentialUSDT, SortisFaucet } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Phase 7 — faucet.
 *
 * A reviewer with an empty wallet has to be able to mint test cUSDT in one
 * transaction, and a second call from the same recipient has to wait out the
 * cooldown. The amount is public; the assertion that matters is that the
 * recipient can decrypt the minted balance and a stranger cannot.
 */
describe("Phase 7 — SortisFaucet", function () {
  const DRIP = 1_000_000n;
  const COOLDOWN = 3_600n;

  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  let token: ConfidentialUSDT;
  let faucet: SortisFaucet;
  let tokenAddress: string;
  let faucetAddress: string;

  before(function () {
    if (!fhevm.isMock) this.skip();
  });

  beforeEach(async function () {
    [deployer, alice, bob] = await ethers.getSigners();

    token = (await ethers.deployContract("ConfidentialUSDT", [deployer.address])) as unknown as ConfidentialUSDT;
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();

    faucet = (await ethers.deployContract("SortisFaucet", [
      tokenAddress,
      DRIP,
      COOLDOWN,
      deployer.address,
    ])) as unknown as SortisFaucet;
    await faucet.waitForDeployment();
    faucetAddress = await faucet.getAddress();

    await (await token.connect(deployer).setFaucet(faucetAddress)).wait();
  });

  async function decryptToken(account: HardhatEthersSigner) {
    return await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(account.address),
      tokenAddress,
      account,
    );
  }

  it("reverts construction with a zero token, drip amount, or cooldown", async function () {
    await expect(
      ethers.deployContract("SortisFaucet", [ethers.ZeroAddress, DRIP, COOLDOWN, deployer.address]),
    ).to.be.revertedWithCustomError(faucet, "ZeroAddress");

    await expect(
      ethers.deployContract("SortisFaucet", [tokenAddress, 0, COOLDOWN, deployer.address]),
    ).to.be.revertedWithCustomError(faucet, "InvalidDripAmount");

    await expect(
      ethers.deployContract("SortisFaucet", [tokenAddress, DRIP, 0, deployer.address]),
    ).to.be.revertedWithCustomError(faucet, "InvalidCooldown");
  });

  it("mints the drip amount to the caller", async function () {
    await expect(faucet.connect(alice).drip()).to.emit(faucet, "Dripped").withArgs(alice.address, DRIP);

    expect(await decryptToken(alice)).to.equal(DRIP);
    expect(await faucet.lastClaimAt(alice.address)).to.not.equal(0n);
  });

  it("mints to any nominated address, keyed on the recipient's cooldown", async function () {
    await expect(faucet.connect(alice).dripTo(bob.address)).to.emit(faucet, "Dripped").withArgs(bob.address, DRIP);

    expect(await decryptToken(bob)).to.equal(DRIP);
    expect(await faucet.lastClaimAt(alice.address)).to.equal(0n);
    expect(await faucet.lastClaimAt(bob.address)).to.not.equal(0n);
  });

  it("rejects a second drip to the same recipient before the cooldown elapses", async function () {
    await (await faucet.connect(alice).drip()).wait();

    const next = await faucet.readyAt(alice.address);
    await expect(faucet.connect(alice).drip())
      .to.be.revertedWithCustomError(faucet, "CooldownNotElapsed")
      .withArgs(alice.address, next);

    await expect(faucet.connect(bob).dripTo(alice.address))
      .to.be.revertedWithCustomError(faucet, "CooldownNotElapsed")
      .withArgs(alice.address, next);
  });

  it("allows another drip once the cooldown has elapsed", async function () {
    await (await faucet.connect(alice).drip()).wait();
    await time.increase(COOLDOWN);

    await (await faucet.connect(alice).drip()).wait();
    expect(await decryptToken(alice)).to.equal(DRIP * 2n);
  });

  it("rejects dripping to the zero address", async function () {
    await expect(faucet.connect(alice).dripTo(ethers.ZeroAddress)).to.be.revertedWithCustomError(faucet, "ZeroAddress");
  });

  it("leaves a non-zero balance handle the recipient can decrypt", async function () {
    await (await faucet.connect(alice).drip()).wait();
    const handle = await token.confidentialBalanceOf(alice.address);
    expect(handle).to.not.equal(ethers.ZeroHash);
    expect(await decryptToken(alice)).to.equal(DRIP);
  });

  it("lets the owner retune the drip amount and cooldown", async function () {
    await (await faucet.connect(deployer).setDripAmount(50_000n)).wait();
    await (await faucet.connect(deployer).setCooldown(60n)).wait();

    expect(await faucet.dripAmount()).to.equal(50_000n);
    expect(await faucet.cooldown()).to.equal(60n);

    await (await faucet.connect(alice).drip()).wait();
    expect(await decryptToken(alice)).to.equal(50_000n);
  });

  it("restricts setters to the owner", async function () {
    await expect(faucet.connect(alice).setDripAmount(1n)).to.be.revertedWithCustomError(
      faucet,
      "OwnableUnauthorizedAccount",
    );
    await expect(faucet.connect(alice).setCooldown(1n)).to.be.revertedWithCustomError(
      faucet,
      "OwnableUnauthorizedAccount",
    );
  });

  it("rejects a zero drip amount or cooldown on the setters", async function () {
    await expect(faucet.connect(deployer).setDripAmount(0n)).to.be.revertedWithCustomError(faucet, "InvalidDripAmount");
    await expect(faucet.connect(deployer).setCooldown(0n)).to.be.revertedWithCustomError(faucet, "InvalidCooldown");
  });

  it("cannot mint until the token has authorised this faucet", async function () {
    const orphan = (await ethers.deployContract("SortisFaucet", [
      tokenAddress,
      DRIP,
      COOLDOWN,
      deployer.address,
    ])) as unknown as SortisFaucet;
    await orphan.waitForDeployment();

    await expect(orphan.connect(alice).drip()).to.be.revertedWithCustomError(token, "OnlyMinter");
  });
});
