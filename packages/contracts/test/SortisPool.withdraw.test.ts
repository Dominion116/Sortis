import { FhevmType } from "@fhevm/hardhat-plugin";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import type { ConfidentialUSDT, SortisPool } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Phase 4 — withdrawals.
 *
 * The load-bearing test in this file is the cumulative-gap invariant: a
 * withdrawal voids a ticket without rewriting the sums above it. That gap is
 * what Phase 5 treats as a rollover, and a regression that "helpfully" rebuilt
 * the chain would silently change the draw.
 */
describe("Phase 4 — SortisPool withdrawals", function () {
  const ROUND_DURATION = 300n;
  const MINT = 1_000_000n;

  let deployer: HardhatEthersSigner;
  let drawEngine: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;

  let token: ConfidentialUSDT;
  let pool: SortisPool;
  let tokenAddress: string;
  let poolAddress: string;

  before(function () {
    if (!fhevm.isMock) this.skip();
  });

  beforeEach(async function () {
    [deployer, drawEngine, alice, bob, carol] = await ethers.getSigners();

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

    await (await pool.connect(deployer).setDrawEngine(drawEngine.address)).wait();

    for (const account of [alice, bob, carol]) {
      await (await token.connect(deployer).mint(account.address, MINT)).wait();
      await approve(account);
    }
  });

  async function approve(account: HardhatEthersSigner) {
    const until = (await ethers.provider.getBlock("latest"))!.timestamp + 86_400;
    await (await token.connect(account).setOperator(poolAddress, until)).wait();
  }

  async function deposit(account: HardhatEthersSigner, amount: bigint) {
    const encrypted = await fhevm.createEncryptedInput(poolAddress, account.address).add64(amount).encrypt();
    const tx = await pool.connect(account).deposit(encrypted.handles[0], encrypted.inputProof);
    return await tx.wait();
  }

  async function decryptCumulative(ticketId: number) {
    const ticket = await pool.ticketAt(ticketId);
    return await fhevm.debugger.decryptEuint(FhevmType.euint64, ticket.cumulative);
  }

  async function decryptBalance(account: HardhatEthersSigner) {
    const handle = await pool.balanceHandleOf(account.address);
    return await fhevm.userDecryptEuint(FhevmType.euint64, handle, poolAddress, account);
  }

  async function decryptToken(account: HardhatEthersSigner) {
    return await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(account.address),
      tokenAddress,
      account,
    );
  }

  // -------------------------------------------------------------------
  // Access
  // -------------------------------------------------------------------

  it("reverts when the ticket does not exist", async function () {
    await expect(pool.connect(alice).withdraw(0)).to.be.revertedWithCustomError(pool, "InvalidTicket").withArgs(0n);
  });

  it("reverts when the caller does not own the ticket", async function () {
    await deposit(alice, 100_000n);

    await expect(pool.connect(bob).withdraw(0))
      .to.be.revertedWithCustomError(pool, "NotTicketOwner")
      .withArgs(0n);
  });

  // -------------------------------------------------------------------
  // Token movement and ticket flag
  // -------------------------------------------------------------------

  it("returns the principal and voids the ticket", async function () {
    await deposit(alice, 100_000n);
    await expect(pool.connect(alice).withdraw(0)).to.emit(pool, "Withdrawn").withArgs(alice.address, 0n, 1n);

    expect(await decryptToken(alice)).to.equal(MINT);
    expect(await decryptBalance(alice)).to.equal(0n);

    const ticket = await pool.ticketAt(0);
    expect(await fhevm.debugger.decryptEbool(ticket.active)).to.equal(false);
    expect(await fhevm.userDecryptEuint(FhevmType.euint64, ticket.amount, poolAddress, alice)).to.equal(100_000n);
  });

  it("lets a depositor decrypt that their own ticket is now inactive", async function () {
    await deposit(alice, 100_000n);
    await (await pool.connect(alice).withdraw(0)).wait();

    const ticket = await pool.ticketAt(0);
    expect(await fhevm.userDecryptEbool(ticket.active, poolAddress, alice)).to.equal(false);
  });

  it("does not let a second withdraw mint extra tokens", async function () {
    await deposit(alice, 100_000n);
    await (await pool.connect(alice).withdraw(0)).wait();
    await (await pool.connect(alice).withdraw(0)).wait();

    expect(await decryptToken(alice)).to.equal(MINT);
    expect(await decryptBalance(alice)).to.equal(0n);
  });

  it("is available mid-round and does not change the frozen eligible count", async function () {
    await deposit(alice, 100_000n);
    await (await pool.connect(drawEngine).openNextRound()).wait();
    expect(await pool.eligibleTicketCount()).to.equal(1n);

    await (await pool.connect(alice).withdraw(0)).wait();

    // The ticket is still in the list; it is just voided. Eligibility is a
    // prefix length, not a live count of active tickets.
    expect(await pool.eligibleTicketCount()).to.equal(1n);
    expect(await pool.ticketCount()).to.equal(1n);
    expect(await decryptToken(alice)).to.equal(MINT);
  });

  it("voids only the withdrawn ticket when the depositor holds more than one", async function () {
    await deposit(alice, 100_000n);
    await deposit(alice, 25_000n);

    await (await pool.connect(alice).withdraw(0)).wait();

    expect(await decryptBalance(alice)).to.equal(25_000n);
    expect(await decryptToken(alice)).to.equal(MINT - 25_000n);

    expect(await fhevm.debugger.decryptEbool((await pool.ticketAt(0)).active)).to.equal(false);
    expect(await fhevm.debugger.decryptEbool((await pool.ticketAt(1)).active)).to.equal(true);
  });

  it("emits Withdrawn with the ticket id and its eligible round, and no amount", async function () {
    await deposit(alice, 50_000n);
    const receipt = await (await pool.connect(alice).withdraw(0)).wait();

    const parsed = receipt!.logs
      .map((log) => {
        try {
          return pool.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log?.name === "Withdrawn");

    expect(parsed!.args.length).to.equal(3);
    expect(parsed!.args.owner).to.equal(alice.address);
    expect(parsed!.args.ticketId).to.equal(0n);
    expect(parsed!.args.roundId).to.equal(1n);
  });

  // -------------------------------------------------------------------
  // The cumulative-gap invariant — the exit criterion for this phase
  // -------------------------------------------------------------------

  describe("cumulative-gap invariant", function () {
    it("does not rewrite cumulatives of tickets appended after a withdrawal", async function () {
      await deposit(alice, 100_000n);
      await deposit(bob, 50_000n);
      await deposit(carol, 75_000n);

      expect(await decryptCumulative(0)).to.equal(100_000n);
      expect(await decryptCumulative(1)).to.equal(150_000n);
      expect(await decryptCumulative(2)).to.equal(225_000n);

      await (await pool.connect(bob).withdraw(1)).wait();

      // The gap is the documented outcome, not something to "fix". Ticket 1
      // still owns [100_000, 150_000) on the number line; it is just inactive,
      // so a random value landing there becomes a rollover in Phase 5.
      expect(await decryptCumulative(0)).to.equal(100_000n);
      expect(await decryptCumulative(1)).to.equal(150_000n);
      expect(await decryptCumulative(2)).to.equal(225_000n);

      expect(await fhevm.debugger.decryptEbool((await pool.ticketAt(1)).active)).to.equal(false);
      expect(await fhevm.debugger.decryptEbool((await pool.ticketAt(0)).active)).to.equal(true);
      expect(await fhevm.debugger.decryptEbool((await pool.ticketAt(2)).active)).to.equal(true);
    });

    it("keeps appending new tickets onto the un-rebuilt chain, gap included", async function () {
      await deposit(alice, 100_000n);
      await deposit(bob, 50_000n);
      await (await pool.connect(bob).withdraw(1)).wait();

      await deposit(carol, 10_000n);

      // If withdrawal rebuilt the chain, Carol's cumulative would be 110_000.
      // It is 160_000 because Bob's 50_000 still occupies its range.
      expect(await decryptCumulative(0)).to.equal(100_000n);
      expect(await decryptCumulative(1)).to.equal(150_000n);
      expect(await decryptCumulative(2)).to.equal(160_000n);
    });
  });

  // -------------------------------------------------------------------
  // Gas baseline
  // -------------------------------------------------------------------

  describe("gas", function () {
    it("records the gas cost of a single withdrawal", async function () {
      await deposit(alice, 100_000n);
      await deposit(bob, 50_000n);

      const receipt = await (await pool.connect(alice).withdraw(0)).wait();

      console.log(`        withdraw: ${receipt!.gasUsed.toString()} gas`);
      expect(receipt!.gasUsed).to.be.greaterThan(0n);
    });
  });
});
