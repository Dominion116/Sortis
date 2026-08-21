import { FhevmType } from "@fhevm/hardhat-plugin";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";


import type { ConfidentialUSDT, SortisPool } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Phase 3 — pool custody and the ticket model.
 *
 * The load-bearing test in this file is the cumulative-sum invariant. Everything
 * about the draw being a linear sweep rather than a quadratic draw-time
 * computation rests on `cumulative` being correct at append time, and a
 * regression there would not surface until a draw paid the wrong person.
 */
describe("Phase 3 — SortisPool deposits", function () {
  const ROUND_DURATION = 300n; // the continuous demo pool
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
    // The debugger decryptions below exist only under the mock coprocessor.
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

    // A plain EOA stands in for SortisDraw so round bookkeeping is callable
    // before the Phase 5 engine exists.
    await (await pool.connect(deployer).setDrawEngine(drawEngine.address)).wait();

    for (const account of [alice, bob, carol]) {
      await (await token.connect(deployer).mint(account.address, MINT)).wait();
      await approve(account);
    }
  });

  /// ERC-7984's approval equivalent: an operator authorised until a deadline.
  async function approve(account: HardhatEthersSigner) {
    const until = (await ethers.provider.getBlock("latest"))!.timestamp + 86_400;
    await (await token.connect(account).setOperator(poolAddress, until)).wait();
  }

  async function deposit(account: HardhatEthersSigner, amount: bigint) {
    const encrypted = await fhevm.createEncryptedInput(poolAddress, account.address).add64(amount).encrypt();
    const tx = await pool.connect(account).deposit(encrypted.handles[0], encrypted.inputProof);
    return await tx.wait();
  }

  /// `cumulative` is deliberately readable by nobody but the pool, so the test
  /// reads it through the mock debugger rather than as a user.
  async function decryptCumulative(ticketId: number) {
    const ticket = await pool.ticketAt(ticketId);
    return await fhevm.debugger.decryptEuint(FhevmType.euint64, ticket.cumulative);
  }

  async function decryptBalance(account: HardhatEthersSigner) {
    const handle = await pool.balanceHandleOf(account.address);
    return await fhevm.userDecryptEuint(FhevmType.euint64, handle, poolAddress, account);
  }

  // -------------------------------------------------------------------
  // Approval gate
  // -------------------------------------------------------------------

  it("rejects a deposit from a depositor who has not approved the pool as operator", async function () {
    const [, , , , , stranger] = await ethers.getSigners();
    await (await token.connect(deployer).mint(stranger.address, MINT)).wait();

    const encrypted = await fhevm.createEncryptedInput(poolAddress, stranger.address).add64(1_000n).encrypt();

    // A specific error, not the token's generic spender revert, because
    // "approve the pool" is a recoverable user action in the Phase 9 flow.
    await expect(pool.connect(stranger).deposit(encrypted.handles[0], encrypted.inputProof))
      .to.be.revertedWithCustomError(pool, "DepositNotApproved")
      .withArgs(stranger.address);
  });

  // -------------------------------------------------------------------
  // Ticket append
  // -------------------------------------------------------------------

  it("appends a ticket owned by the depositor and moves the tokens into the pool", async function () {
    await deposit(alice, 100_000n);

    expect(await pool.ticketCount()).to.equal(1n);

    const ticket = await pool.ticketAt(0);
    expect(ticket.owner).to.equal(alice.address);

    // The depositor may read their own ticket amount.
    const amount = await fhevm.userDecryptEuint(FhevmType.euint64, ticket.amount, poolAddress, alice);
    expect(amount).to.equal(100_000n);

    // The tokens really left the depositor.
    const aliceToken = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      await token.confidentialBalanceOf(alice.address),
      tokenAddress,
      alice,
    );
    expect(aliceToken).to.equal(MINT - 100_000n);
  });

  it("emits Deposited with the ticket id and the round the ticket is eligible for, and no amount", async function () {
    // Round 0 is the pre-open state, so a first deposit is eligible for round 1.
    await expect(deposit(alice, 50_000n)).to.emit(pool, "Deposited").withArgs(alice.address, 0n, 1n);

    const receipt = await deposit(bob, 50_000n);
    const parsed = receipt!.logs
      .map((log) => {
        try {
          return pool.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log) => log?.name === "Deposited");

    // Emitting an amount, even encrypted, would invite correlation against
    // transaction ordering. The event carries no amount field at all.
    expect(parsed!.args.length).to.equal(3);
  });

  it("grants the depositor decryption rights over their own running balance", async function () {
    await deposit(alice, 100_000n);
    expect(await decryptBalance(alice)).to.equal(100_000n);

    // A second deposit accumulates rather than replacing.
    await deposit(alice, 25_000n);
    expect(await decryptBalance(alice)).to.equal(125_000n);
  });

  it("does not let one depositor decrypt another depositor's balance", async function () {
    await deposit(alice, 100_000n);
    const handle = await pool.balanceHandleOf(alice.address);

    await expect(fhevm.userDecryptEuint(FhevmType.euint64, handle, poolAddress, bob)).to.be.rejected;
  });

  it("keeps a ticket's cumulative unreadable by its own owner", async function () {
    await deposit(alice, 100_000n);
    const ticket = await pool.ticketAt(0);

    // This restriction is load bearing, not cautious. Two decryptable
    // cumulatives would reveal the sum of every deposit made in between by
    // subtraction, which is exactly what the pool exists to keep private.
    await expect(fhevm.userDecryptEuint(FhevmType.euint64, ticket.cumulative, poolAddress, alice)).to.be.rejected;
  });

  it("marks a fresh ticket active", async function () {
    await deposit(alice, 100_000n);
    const ticket = await pool.ticketAt(0);

    expect(await fhevm.debugger.decryptEbool(ticket.active)).to.equal(true);
  });

  // -------------------------------------------------------------------
  // The cumulative-sum invariant — the exit criterion for this phase
  // -------------------------------------------------------------------

  describe("cumulative-sum invariant", function () {
    it("sets the first ticket's cumulative to its own amount", async function () {
      await deposit(alice, 100_000n);
      expect(await decryptCumulative(0)).to.equal(100_000n);
    });

    it("makes the last ticket's cumulative equal the sum of every ticket amount", async function () {
      const amounts = [100_000n, 250_000n, 1n, 75_000n, 320_000n];
      const depositors = [alice, bob, carol, alice, bob];

      for (let i = 0; i < amounts.length; i++) {
        await deposit(depositors[i], amounts[i]);
      }

      const expectedTotal = amounts.reduce((a, b) => a + b, 0n);

      // The exit criterion, stated exactly as the plan states it: after N
      // deposits the last ticket's cumulative is the sum of all active amounts.
      expect(await decryptCumulative(amounts.length - 1)).to.equal(expectedTotal);
    });

    it("gives every ticket a cumulative equal to the running sum up to and including itself", async function () {
      const amounts = [100_000n, 250_000n, 1n, 75_000n];
      const depositors = [alice, bob, carol, alice];

      for (let i = 0; i < amounts.length; i++) {
        await deposit(depositors[i], amounts[i]);
      }

      let running = 0n;
      for (let i = 0; i < amounts.length; i++) {
        running += amounts[i];
        expect(await decryptCumulative(i), `ticket ${i}`).to.equal(running);
      }
    });

    it("tiles the number line into contiguous, non-overlapping ranges", async function () {
      const amounts = [40_000n, 10_000n, 90_000n];
      const depositors = [alice, bob, carol];

      for (let i = 0; i < amounts.length; i++) {
        await deposit(depositors[i], amounts[i]);
      }

      // Ticket i owns [cumulative(i-1), cumulative(i)). Each range must be
      // exactly as wide as its own amount and must start where the previous one
      // ended: any gap or overlap and a random value either selects nobody or
      // selects two people, which is the one thing the draw cannot survive.
      let previous = 0n;
      for (let i = 0; i < amounts.length; i++) {
        const cumulative = await decryptCumulative(i);
        expect(cumulative - previous, `width of ticket ${i}`).to.equal(amounts[i]);
        previous = cumulative;
      }
    });

    it("keeps the cumulative chain intact across depositors, not just per depositor", async function () {
      // Interleaving matters: the chain is global and append-ordered, so a
      // per-depositor running sum would pass the single-depositor tests above
      // and still be wrong here.
      await deposit(alice, 10_000n);
      await deposit(bob, 20_000n);
      await deposit(alice, 30_000n);

      expect(await decryptCumulative(0)).to.equal(10_000n);
      expect(await decryptCumulative(1)).to.equal(30_000n);
      expect(await decryptCumulative(2)).to.equal(60_000n);
    });

    it("credits only what actually moved when a deposit exceeds the depositor's balance", async function () {
      // ERC-7984 cannot revert on insufficient balance without leaking the
      // balance, so the transfer clamps to zero and returns what really moved.
      // Crediting the requested amount here would let anyone mint pool credit
      // from an empty wallet, so this is a solvency test rather than an edge case.
      await deposit(alice, 100_000n);
      await deposit(bob, MINT + 1n);

      expect(await decryptBalance(bob)).to.equal(0n);

      // A zero-width range, [C, C), that no random value can ever land in.
      expect(await decryptCumulative(1)).to.equal(100_000n);

      const bobToken = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await token.confidentialBalanceOf(bob.address),
        tokenAddress,
        bob,
      );
      expect(bobToken).to.equal(MINT);
    });

    it("exposes the round total as the last eligible ticket's cumulative", async function () {
      await deposit(alice, 100_000n);
      await deposit(bob, 50_000n);

      // Nothing is eligible until a round opens, so there is no total to draw over.
      expect(await pool.roundTotalHandle()).to.equal(ethers.ZeroHash);

      await (await pool.connect(drawEngine).openNextRound()).wait();

      const total = await fhevm.debugger.decryptEuint(FhevmType.euint64, await pool.roundTotalHandle());
      expect(total).to.equal(150_000n);
    });
  });

  // -------------------------------------------------------------------
  // Round eligibility
  // -------------------------------------------------------------------

  describe("round eligibility", function () {
    it("starts in the pre-open state with round 0 and nothing eligible", async function () {
      expect(await pool.currentRoundId()).to.equal(0n);
      expect(await pool.eligibleTicketCount()).to.equal(0n);
      expect(await pool.nextEligibleRoundId()).to.equal(1n);
    });

    it("tags a ticket with the next round, never the currently open one", async function () {
      await (await pool.connect(drawEngine).openNextRound()).wait();
      expect(await pool.currentRoundId()).to.equal(1n);

      await deposit(alice, 100_000n);

      // Premium Bonds convention: a ticket must exist before a round opens to
      // take part in it, so a mid-round deposit waits for round 2.
      expect((await pool.ticketAt(0)).roundId).to.equal(2n);
    });

    it("does not make a mid-round deposit eligible for the round it was made in", async function () {
      await deposit(alice, 100_000n); // eligible for round 1
      await (await pool.connect(drawEngine).openNextRound()).wait();

      await deposit(bob, 50_000n); // mid-round, so eligible for round 2

      // Only Alice's ticket counts toward round 1, and the round total proves it.
      expect(await pool.eligibleTicketCount()).to.equal(1n);
      const total = await fhevm.debugger.decryptEuint(FhevmType.euint64, await pool.roundTotalHandle());
      expect(total).to.equal(100_000n);

      // Bob's ticket joins on the next open.
      await (await pool.connect(drawEngine).openNextRound()).wait();
      expect(await pool.eligibleTicketCount()).to.equal(2n);
    });

    it("emits RoundOpened with the frozen eligible count", async function () {
      await deposit(alice, 100_000n);
      await deposit(bob, 50_000n);

      // The timestamp is whatever the miner assigned, so it is matched loosely
      // while the round id and the frozen count are matched exactly.
      await expect(pool.connect(drawEngine).openNextRound())
        .to.emit(pool, "RoundOpened")
        .withArgs(1n, anyValue, 2n);

    });

    it("lets only the draw engine open a round", async function () {
      await expect(pool.connect(alice).openNextRound()).to.be.revertedWithCustomError(pool, "OnlyDrawEngine");
      await expect(pool.connect(deployer).openNextRound()).to.be.revertedWithCustomError(pool, "OnlyDrawEngine");
    });

    it("reports round expiry against the configured duration", async function () {
      await (await pool.connect(drawEngine).openNextRound()).wait();
      expect(await pool.isRoundExpired()).to.equal(false);

      await ethers.provider.send("evm_increaseTime", [Number(ROUND_DURATION)]);
      await ethers.provider.send("evm_mine", []);

      // Expiry is a read for the keeper and the countdown. It does not close
      // anything by itself; only the draw engine closes a round.
      expect(await pool.isRoundExpired()).to.equal(true);
      expect(await pool.currentRoundId()).to.equal(1n);
    });
  });

  // -------------------------------------------------------------------
  // Gas baseline — Phase 3 exit criterion
  // -------------------------------------------------------------------

  describe("gas", function () {
    it("records the gas cost of a single deposit", async function () {
      const first = await deposit(alice, 100_000n);
      const subsequent = await deposit(bob, 50_000n);

      // Recorded rather than asserted against a threshold. Phase 6 does the full
      // accounting; this is the early baseline the plan asks for, and a bound
      // here would only encode today's coprocessor pricing as a requirement.
      console.log(`        first deposit (cold):      ${first!.gasUsed.toString()} gas`);
      console.log(`        subsequent deposit (warm): ${subsequent!.gasUsed.toString()} gas`);

      expect(first!.gasUsed).to.be.greaterThan(0n);
    });
  });
});


