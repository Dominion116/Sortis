import { FhevmType } from "@fhevm/hardhat-plugin";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import type { ConfidentialUSDT } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Phase 2 — ConfidentialUSDT (ERC-7984)", function () {
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let token: ConfidentialUSDT;
  let tokenAddress: string;

  before(function () {
    if (!fhevm.isMock) this.skip();
  });

  beforeEach(async function () {
    [deployer, alice, bob] = await ethers.getSigners();

    token = (await ethers.deployContract("ConfidentialUSDT", [deployer.address])) as unknown as ConfidentialUSDT;
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();
  });

  it("exposes standard ERC-7984 metadata", async function () {
    expect(await token.name()).to.equal("Confidential USDT");
    expect(await token.symbol()).to.equal("cUSDT");
  });

  it("mints a plaintext amount and lets the holder decrypt their own balance", async function () {
    await (await token.connect(deployer).mint(alice.address, 1_000_000n)).wait();

    const handle = await token.confidentialBalanceOf(alice.address);
    expect(handle).to.not.equal(ethers.ZeroHash);

    const clear = await fhevm.userDecryptEuint(FhevmType.euint64, handle, tokenAddress, alice);
    expect(clear).to.equal(1_000_000n);
  });

  it("mints from a ciphertext produced off chain, exercising the input-proof path", async function () {
    // The same encrypt-then-prove plumbing the browser will use in Phase 9.
    const encrypted = await fhevm
      .createEncryptedInput(tokenAddress, deployer.address)
      .add64(250_000n)
      .encrypt();

    await (
      await token.connect(deployer).mintConfidential(alice.address, encrypted.handles[0], encrypted.inputProof)
    ).wait();

    const handle = await token.confidentialBalanceOf(alice.address);
    const clear = await fhevm.userDecryptEuint(FhevmType.euint64, handle, tokenAddress, alice);
    expect(clear).to.equal(250_000n);
  });

  it("transfers confidentially between holders and keeps both balances correct", async function () {
    await (await token.connect(deployer).mint(alice.address, 1_000_000n)).wait();

    const encrypted = await fhevm.createEncryptedInput(tokenAddress, alice.address).add64(400_000n).encrypt();

    await (
      await token
        .connect(alice)
        ["confidentialTransfer(address,bytes32,bytes)"](bob.address, encrypted.handles[0], encrypted.inputProof)
    ).wait();

    const aliceClear = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(alice.address),
      tokenAddress,
      alice,
    );
    const bobClear = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(bob.address),
      tokenAddress,
      bob,
    );

    expect(aliceClear).to.equal(600_000n);
    expect(bobClear).to.equal(400_000n);
  });

  it("does not let a third party decrypt someone else's balance", async function () {
    await (await token.connect(deployer).mint(alice.address, 1_000_000n)).wait();
    const handle = await token.confidentialBalanceOf(alice.address);

    // The confidentiality claim on the landing page rests on exactly this.
    await expect(fhevm.userDecryptEuint(FhevmType.euint64, handle, tokenAddress, bob)).to.be.rejected;
  });

  it("restricts minting to the owner until a faucet is authorised", async function () {
    await expect(token.connect(alice).mint(alice.address, 1n)).to.be.revertedWithCustomError(token, "OnlyMinter");
  });

  it("lets the configured faucet mint while the owner still can", async function () {
    await (await token.connect(deployer).setFaucet(bob.address)).wait();

    await (await token.connect(bob).mint(alice.address, 10n)).wait();
    await (await token.connect(deployer).mint(alice.address, 5n)).wait();

    const handle = await token.confidentialBalanceOf(alice.address);
    const clear = await fhevm.userDecryptEuint(FhevmType.euint64, handle, tokenAddress, alice);
    expect(clear).to.equal(15n);
  });

  it("stops a revoked faucet from minting", async function () {
    await (await token.connect(deployer).setFaucet(bob.address)).wait();
    await (await token.connect(deployer).setFaucet(ethers.ZeroAddress)).wait();

    await expect(token.connect(bob).mint(alice.address, 1n)).to.be.revertedWithCustomError(token, "OnlyMinter");
  });
});
