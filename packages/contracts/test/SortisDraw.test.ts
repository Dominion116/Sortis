import { FhevmType } from "@fhevm/hardhat-plugin";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import type { ConfidentialUSDT, MockYieldSource, SortisDraw, SortisPool } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Phase 5 — draw engine (SortisDraw / "ERNIE").
 *
 * Exit criteria:
 *   1. A full round (close → decrypt total → draw random → sweep in batches →
 *      settle) completes against the mock coprocessor.
 *   2. The sweep is resumable across multiple transactions.
 *   3. Voiding the ticket the random value would have hit produces a rollover,
 *      not a silent winner or a double credit.
 */
describe("Phase 5 — SortisDraw", function () {
  const DEMO_DURATION = 300n;
  const STANDARD_DURATION = 24n * 60n * 60n;
  const RATE_BPS = 2_000n;
  const MINT = 1_000_000n;
  const YIELD_PRINCIPAL = 10_000_000n;

  enum RoundState {
    Open = 0,
    Closed = 1,
    AwaitingTotal = 2,
    Sweeping = 3,
    Settled = 4,
    RolledOver = 5,
  }

  let deployer: HardhatEthersSigner;
  let keeper: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;

  let token: ConfidentialUSDT;
  let pool: SortisPool;
  let draw: SortisDraw;
  let mock: MockYieldSource;
  let tokenAddress: string;
  let poolAddress: string;
  let mockAddress: string;

  before(function () {
    if (!fhevm.isMock) this.skip();
  });

  beforeEach(async function () {
    [deployer, keeper, alice, bob, carol] = await ethers.getSigners();
    await deploySuite(DEMO_DURATION);
  });

  async function deploySuite(roundDuration: bigint) {
    token = (await ethers.deployContract("ConfidentialUSDT", [deployer.address])) as unknown as ConfidentialUSDT;
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();

    pool = (await ethers.deployContract("SortisPool", [
      tokenAddress,
      roundDuration,
      deployer.address,
    ])) as unknown as SortisPool;
    await pool.waitForDeployment();
    poolAddress = await pool.getAddress();

    draw = (await ethers.deployContract("SortisDraw", [
      poolAddress,
      keeper.address,
      deployer.address,
    ])) as unknown as SortisDraw;
    await draw.waitForDeployment();

    mock = (await ethers.deployContract("MockYieldSource", [
      tokenAddress,
      RATE_BPS,
      deployer.address,
    ])) as unknown as MockYieldSource;
    await mock.waitForDeployment();
    mockAddress = await mock.getAddress();

    await (await pool.connect(deployer).setDrawEngine(await draw.getAddress())).wait();
    await (await mock.connect(deployer).setPool(poolAddress)).wait();
    await (await pool.connect(deployer).setYieldSource(mockAddress)).wait();

    for (const account of [alice, bob, carol]) {
      await (await token.connect(deployer).mint(account.address, MINT)).wait();
      const until = (await ethers.provider.getBlock("latest"))!.timestamp + 86_400;
      await (await token.connect(account).setOperator(poolAddress, until)).wait();
    }
  }

  async function deposit(account: HardhatEthersSigner, amount: bigint) {
    const encrypted = await fhevm.createEncryptedInput(poolAddress, account.address).add64(amount).encrypt();
    return await (await pool.connect(account).deposit(encrypted.handles[0], encrypted.inputProof)).wait();
  }

  async function warp(seconds: bigint | number) {
    await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
    await ethers.provider.send("evm_mine", []);
  }

  async function decryptCumulative(ticketId: number): Promise<bigint> {
    const ticket = await pool.ticketAt(ticketId);
    return await fhevm.debugger.decryptEuint(FhevmType.euint64, ticket.cumulative);
  }

  async function decryptClaimable(account: HardhatEthersSigner): Promise<bigint> {
    const handle = await pool.claimableHandleOf(account.address);
    if (handle === ethers.ZeroHash) return 0n;
    return await fhevm.userDecryptEuint(FhevmType.euint64, handle, poolAddress, account);
  }

  async function decryptActive(ticketId: number): Promise<boolean> {
    return await fhevm.debugger.decryptEbool((await pool.ticketAt(ticketId)).active);
  }

  function clearValue(results: { clearValues: Record<string, bigint | boolean | string> }, handle: string): bigint {
    const direct = results.clearValues[handle];
    if (typeof direct === "bigint") return direct;
    const match = Object.entries(results.clearValues).find(([key]) => key.toLowerCase() === handle.toLowerCase());
    if (match && typeof match[1] === "bigint") return match[1];
    throw new Error(`no bigint clear value for handle ${handle}`);
  }

  async function revealTotal(): Promise<bigint> {
    const roundId = await draw.drawingRoundId();
    const handle = await draw.totalHandle(roundId);
    const results = await fhevm.publicDecrypt([handle]);
    const total = clearValue(results, handle);
    await (await draw.onTotalRevealed(total, results.decryptionProof)).wait();
    return total;
  }

  async function settleRound(): Promise<{ winnerCount: bigint; randomValue: bigint }> {
    const roundId = await draw.drawingRoundId();
    const countHandle = await draw.winnerCountHandle(roundId);
    const randomHandle = await draw.randomHandle(roundId);
    const results = await fhevm.publicDecrypt([countHandle, randomHandle]);
    const winnerCount = clearValue(results, countHandle);
    const randomValue = clearValue(results, randomHandle);
    await (await draw.connect(keeper).settle(winnerCount, randomValue, results.decryptionProof)).wait();
    return { winnerCount, randomValue };
  }

  async function seedYield() {
    await (await token.connect(deployer).mint(poolAddress, YIELD_PRINCIPAL)).wait();
    await (await token.connect(deployer).mint(mockAddress, YIELD_PRINCIPAL)).wait();
    await (await pool.connect(deployer).allocateToYield(YIELD_PRINCIPAL)).wait();
  }

  async function openAndClose(amounts: bigint[] = [100_000n, 50_000n, 75_000n]) {
    const depositors = [alice, bob, carol];
    for (let i = 0; i < amounts.length; i++) {
      await deposit(depositors[i], amounts[i]);
    }
    await (await draw.connect(keeper).openRound()).wait();
    await warp(DEMO_DURATION);
    await (await draw.connect(keeper).closeRound()).wait();
  }

  // -------------------------------------------------------------------
  // Access and state machine
  // -------------------------------------------------------------------

  it("lets only the keeper open, close, draw, step and settle", async function () {
    await expect(draw.connect(alice).openRound()).to.be.revertedWithCustomError(draw, "OnlyKeeper");
    await expect(draw.connect(alice).closeRound()).to.be.revertedWithCustomError(draw, "OnlyKeeper");
    await expect(draw.connect(alice).drawRandom()).to.be.revertedWithCustomError(draw, "OnlyKeeper");
    await expect(draw.connect(alice).stepDraw(1)).to.be.revertedWithCustomError(draw, "OnlyKeeper");
    await expect(draw.connect(alice).settle(1, 0, "0x")).to.be.revertedWithCustomError(draw, "OnlyKeeper");
  });

  it("rejects closeRound before the round has expired", async function () {
    await deposit(alice, 100_000n);
    await (await draw.connect(keeper).openRound()).wait();

    await expect(draw.connect(keeper).closeRound()).to.be.revertedWithCustomError(draw, "RoundNotExpired");
  });

  it("rejects a zero batch size", async function () {
    await openAndClose([100_000n]);
    await revealTotal();
    await (await draw.connect(keeper).drawRandom()).wait();

    await expect(draw.connect(keeper).stepDraw(0)).to.be.revertedWithCustomError(draw, "InvalidBatchSize");
  });

  it("opens a demo round of 300 seconds and a standard round of a day", async function () {
    expect(await pool.roundDuration()).to.equal(DEMO_DURATION);

    await deploySuite(STANDARD_DURATION);
    expect(await pool.roundDuration()).to.equal(STANDARD_DURATION);

    await deposit(alice, 100_000n);
    await (await draw.connect(keeper).openRound()).wait();
    expect(await pool.isRoundExpired()).to.equal(false);

    await warp(STANDARD_DURATION);
    expect(await pool.isRoundExpired()).to.equal(true);
  });

  // -------------------------------------------------------------------
  // Full round — the exit criterion
  // -------------------------------------------------------------------

  describe("full round", function () {
    it("closes, decrypts the total, draws, sweeps in batches and settles a single winner", async function () {
      const amounts = [100_000n, 50_000n, 75_000n];
      await seedYield();
      await openAndClose(amounts);

      const closedId = 1n;
      let record = await draw.roundAt(closedId);
      expect(record.state).to.equal(RoundState.AwaitingTotal);
      expect(record.frozenTicketCount).to.equal(3n);
      expect(record.prizeAmount).to.be.greaterThan(0n);

      const total = await revealTotal();
      expect(total).to.equal(225_000n);
      record = await draw.roundAt(closedId);
      expect(record.revealedTotal).to.equal(total);

      await (await draw.connect(keeper).drawRandom()).wait();
      record = await draw.roundAt(closedId);
      expect(record.state).to.equal(RoundState.Sweeping);

      // Resumable: three tickets, two transactions (2 + 1).
      await expect(draw.connect(keeper).stepDraw(2))
        .to.emit(draw, "ErnieSweepAdvanced")
        .withArgs(closedId, 2n, 3n);
      expect((await draw.sweepProgress(closedId)).cursor).to.equal(2n);

      await expect(draw.connect(keeper).stepDraw(2))
        .to.emit(draw, "ErnieSweepAdvanced")
        .withArgs(closedId, 3n, 3n);
      expect((await draw.sweepProgress(closedId)).cursor).to.equal(3n);

      const { winnerCount, randomValue } = await settleRound();
      expect(winnerCount).to.equal(1n);
      expect(randomValue).to.be.lt(total);

      record = await draw.roundAt(closedId);
      expect(record.state).to.equal(RoundState.Settled);
      expect(record.revealedRandom).to.equal(randomValue);
      expect(await draw.drawingRoundId()).to.equal(2n);
      expect((await draw.roundAt(2n)).state).to.equal(RoundState.Open);

      const prize = record.prizeAmount;
      const claimables = [
        await decryptClaimable(alice),
        await decryptClaimable(bob),
        await decryptClaimable(carol),
      ];
      const winners = claimables.filter((c) => c === prize);
      const losers = claimables.filter((c) => c === 0n);
      expect(winners.length, "exactly one winner").to.equal(1);
      expect(losers.length, "everyone else is zero").to.equal(2);

      // The credited winner matches the ticket whose range contains r.
      let previous = 0n;
      let expectedWinner = -1;
      for (let i = 0; i < amounts.length; i++) {
        const cumulative = await decryptCumulative(i);
        if (previous <= randomValue && randomValue < cumulative) {
          expectedWinner = i;
        }
        previous = cumulative;
      }
      expect(expectedWinner).to.be.greaterThanOrEqual(0);
      expect(claimables[expectedWinner]).to.equal(prize);
    });

    it("writes a claimable handle for every swept owner, including losers", async function () {
      await openAndClose([40_000n, 10_000n, 90_000n]);
      await revealTotal();
      await (await draw.connect(keeper).drawRandom()).wait();
      await (await draw.connect(keeper).stepDraw(3)).wait();
      await settleRound();

      // An unwritten slot is the zero handle. Uniform writes are the privacy
      // guarantee; a regression here would be silent on the winner-count check.
      expect(await pool.claimableHandleOf(alice.address)).to.not.equal(ethers.ZeroHash);
      expect(await pool.claimableHandleOf(bob.address)).to.not.equal(ethers.ZeroHash);
      expect(await pool.claimableHandleOf(carol.address)).to.not.equal(ethers.ZeroHash);
    });

    it("carries harvested yield plus a previous rollover into the next prize", async function () {
      await seedYield();
      await deposit(alice, 100_000n);
      await (await draw.connect(keeper).openRound()).wait();
      await warp(DEMO_DURATION);
      await (await draw.connect(keeper).closeRound()).wait();

      const firstPrize = (await draw.roundAt(1n)).prizeAmount;
      expect(firstPrize).to.be.greaterThan(0n);

      // No eligible tickets were... wait, Alice deposited before open, so there
      // is one ticket. Force a rollover by voiding it after the random is drawn.
      const total = await revealTotal();
      await (await draw.connect(keeper).drawRandom()).wait();
      const random = await fhevm.debugger.decryptEuint(
        FhevmType.euint64,
        await draw.randomHandle(1n),
      );
      expect(random).to.be.lt(total);

      await (await pool.connect(alice).withdraw(0)).wait();
      await (await draw.connect(keeper).stepDraw(1)).wait();
      await settleRound();

      expect((await draw.roundAt(1n)).state).to.equal(RoundState.RolledOver);
      expect(await draw.rolloverBalance()).to.equal(firstPrize);

      // Next close harvests new interest on top of the carried prize.
      await warp(DEMO_DURATION);
      await (await draw.connect(keeper).closeRound()).wait();
      const secondPrize = (await draw.roundAt(2n)).prizeAmount;
      expect(secondPrize).to.be.greaterThanOrEqual(firstPrize);
      expect(await draw.rolloverBalance()).to.equal(0n);
    });
  });

  // -------------------------------------------------------------------
  // Resumable sweep
  // -------------------------------------------------------------------

  describe("resumable sweep", function () {
    it("persists the cursor across transactions and refuses to settle early", async function () {
      await openAndClose([100_000n, 50_000n, 75_000n]);
      await revealTotal();
      await (await draw.connect(keeper).drawRandom()).wait();

      await (await draw.connect(keeper).stepDraw(1)).wait();
      let progress = await draw.sweepProgress(1n);
      expect(progress.cursor).to.equal(1n);
      expect(progress.total).to.equal(3n);
      expect((await draw.roundAt(1n)).state).to.equal(RoundState.Sweeping);

      await expect(draw.connect(keeper).settle(1, 0, "0x"))
        .to.be.revertedWithCustomError(draw, "SweepIncomplete")
        .withArgs(1n, 3n);

      await (await draw.connect(keeper).stepDraw(1)).wait();
      progress = await draw.sweepProgress(1n);
      expect(progress.cursor).to.equal(2n);

      await (await draw.connect(keeper).stepDraw(10)).wait();
      progress = await draw.sweepProgress(1n);
      expect(progress.cursor).to.equal(3n);

      const { winnerCount } = await settleRound();
      expect(winnerCount).to.equal(1n);
    });
  });

  // -------------------------------------------------------------------
  // Rollover — the other exit criterion
  // -------------------------------------------------------------------

  describe("rollover", function () {
    it("credits nobody and carries the prize when the hit ticket has been voided", async function () {
      const amounts = [100_000n, 50_000n, 75_000n];
      await seedYield();
      await openAndClose(amounts);

      const total = await revealTotal();
      await (await draw.connect(keeper).drawRandom()).wait();

      const random = await fhevm.debugger.decryptEuint(
        FhevmType.euint64,
        await draw.randomHandle(1n),
      );

      let previous = 0n;
      let hitTicket = -1;
      const owners = [alice, bob, carol];
      for (let i = 0; i < amounts.length; i++) {
        const cumulative = await decryptCumulative(i);
        if (previous <= random && random < cumulative) {
          hitTicket = i;
        }
        previous = cumulative;
      }
      expect(hitTicket).to.be.greaterThanOrEqual(0);
      expect(await decryptActive(hitTicket)).to.equal(true);

      await (await pool.connect(owners[hitTicket]).withdraw(hitTicket)).wait();
      expect(await decryptActive(hitTicket)).to.equal(false);

      const prize = (await draw.roundAt(1n)).prizeAmount;
      await (await draw.connect(keeper).stepDraw(3)).wait();

      const { winnerCount } = await settleRound();
      expect(winnerCount).to.equal(0n);
      expect((await draw.roundAt(1n)).state).to.equal(RoundState.RolledOver);
      expect(await draw.rolloverBalance()).to.equal(prize);

      expect(await decryptClaimable(alice)).to.equal(0n);
      expect(await decryptClaimable(bob)).to.equal(0n);
      expect(await decryptClaimable(carol)).to.equal(0n);
      expect(total).to.equal(225_000n);
    });

    it("rolls over immediately when a round closes with no eligible tickets", async function () {
      await (await draw.connect(keeper).openRound()).wait();
      await warp(DEMO_DURATION);

      await expect(draw.connect(keeper).closeRound())
        .to.emit(draw, "ErnieRolledOver")
        .withArgs(1n, 0n);

      expect((await draw.roundAt(1n)).state).to.equal(RoundState.RolledOver);
      expect((await draw.roundAt(2n)).state).to.equal(RoundState.Open);
    });
  });

  // -------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------

  it("emits the Ernie lifecycle events in order on a successful settle", async function () {
    await openAndClose([100_000n, 50_000n]);

    await expect(draw.onTotalRevealed(0, "0x")).to.be.reverted; // empty proof

    const handle = await draw.totalHandle(1n);
    const totalResults = await fhevm.publicDecrypt([handle]);
    const total = clearValue(totalResults, handle);

    await expect(draw.onTotalRevealed(total, totalResults.decryptionProof))
      .to.emit(draw, "ErnieTotalRevealed")
      .withArgs(1n, total);

    await (await draw.connect(keeper).drawRandom()).wait();
    await (await draw.connect(keeper).stepDraw(2)).wait();

    const countHandle = await draw.winnerCountHandle(1n);
    const randomHandle = await draw.randomHandle(1n);
    const settlement = await fhevm.publicDecrypt([countHandle, randomHandle]);
    const winnerCount = clearValue(settlement, countHandle);
    const randomValue = clearValue(settlement, randomHandle);

    await expect(draw.connect(keeper).settle(winnerCount, randomValue, settlement.decryptionProof))
      .to.emit(draw, "ErnieRandomDrawn")
      .withArgs(1n, randomValue, total)
      .and.to.emit(draw, "ErnieSettled")
      .withArgs(1n, 0n, randomValue);
  });

  // -------------------------------------------------------------------
  // Gas
  // -------------------------------------------------------------------

  describe("gas", function () {
    it("records the gas cost of a single-ticket stepDraw", async function () {
      await openAndClose([100_000n, 50_000n, 75_000n]);
      await revealTotal();
      await (await draw.connect(keeper).drawRandom()).wait();

      const first = await (await draw.connect(keeper).stepDraw(1)).wait();
      const subsequent = await (await draw.connect(keeper).stepDraw(1)).wait();

      console.log(`        stepDraw first ticket:       ${first!.gasUsed.toString()} gas`);
      console.log(`        stepDraw subsequent ticket:  ${subsequent!.gasUsed.toString()} gas`);
      expect(first!.gasUsed).to.be.greaterThan(0n);
    });
  });
});
