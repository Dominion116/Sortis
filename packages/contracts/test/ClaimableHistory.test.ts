import { FhevmType } from "@fhevm/hardhat-plugin";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import type { ConfidentialUSDT, MockYieldSource, SortisDraw, SortisPool } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Claimable handle history.
 *
 * These tests exist to answer one question the backend design depends on:
 * after `_creditClaimable` replaces a participant's `_claimable` handle, is the
 * PREVIOUS handle still decryptable by that participant?
 *
 * Why it matters: `_claimable` is a single running encrypted total, and
 * `sweepTicket` credits it for every participant on every draw with no per-user
 * event. So "did I win round 7" cannot be read from current state or logs. The
 * keeper can, however, record the handle at each round boundary, and the browser
 * can then decrypt the pair and subtract. That only works if a superseded
 * handle remains readable.
 *
 * The expectation is that it does: `_creditClaimable` calls
 * `FHE.allow(newClaimable, account)` on every credit, and FHEVM ACL grants are
 * permanent rather than scoped to the slot's current value. These tests pin
 * that, so a change in ACL or handle-derivation behaviour cannot silently break
 * the round-history feature.
 */
describe("Claimable handle history", function () {
  const DEMO_DURATION = 300n;
  const RATE_BPS = 2_000n;
  // Deliberately unusual amounts. FHEVM handles are deterministic hashes of the
  // operation and its operands, so minting a round number here would produce the
  // SAME handle as an identical mint in another test file, and the grant this
  // suite makes to `bob` would then let him decrypt that handle in the other
  // suite. `ConfidentialUSDT.test.ts` asserts a third party CANNOT read someone
  // else's balance, and it failed for exactly that reason when this file used
  // 1_000_000n. Keep these values distinct from the other suites'.
  const MINT = 812_345n;
  const YIELD_PRINCIPAL = 9_876_543n;

  let deployer: HardhatEthersSigner;
  let keeper: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  let token: ConfidentialUSDT;
  let pool: SortisPool;
  let draw: SortisDraw;
  let mock: MockYieldSource;
  let poolAddress: string;

  before(function () {
    if (!fhevm.isMock) this.skip();
  });

  beforeEach(async function () {
    [deployer, keeper, alice, bob] = await ethers.getSigners();

    token = (await ethers.deployContract("ConfidentialUSDT", [deployer.address])) as unknown as ConfidentialUSDT;
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    pool = (await ethers.deployContract("SortisPool", [
      tokenAddress,
      DEMO_DURATION,
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
    const mockAddress = await mock.getAddress();

    await (await pool.connect(deployer).setDrawEngine(await draw.getAddress())).wait();
    await (await mock.connect(deployer).setPool(poolAddress)).wait();
    await (await pool.connect(deployer).setYieldSource(mockAddress)).wait();

    for (const account of [alice, bob]) {
      await (await token.connect(deployer).mint(account.address, MINT)).wait();
      const until = (await ethers.provider.getBlock("latest"))!.timestamp + 86_400;
      await (await token.connect(account).setOperator(poolAddress, until)).wait();
    }

    await (await token.connect(deployer).mint(poolAddress, YIELD_PRINCIPAL)).wait();
    await (await token.connect(deployer).mint(mockAddress, YIELD_PRINCIPAL)).wait();
    await (await pool.connect(deployer).allocateToYield(YIELD_PRINCIPAL)).wait();
  });

  async function deposit(account: HardhatEthersSigner, amount: bigint) {
    const encrypted = await fhevm.createEncryptedInput(poolAddress, account.address).add64(amount).encrypt();
    await (await pool.connect(account).deposit(encrypted.handles[0], encrypted.inputProof)).wait();
  }

  async function warp(seconds: bigint | number) {
    await ethers.provider.send("evm_increaseTime", [Number(seconds)]);
    await ethers.provider.send("evm_mine", []);
  }

  function clearValue(
    results: { clearValues: Record<string, bigint | boolean | string> },
    handle: string,
  ): bigint {
    const direct = results.clearValues[handle];
    if (typeof direct === "bigint") return direct;
    const match = Object.entries(results.clearValues).find(
      ([key]) => key.toLowerCase() === handle.toLowerCase(),
    );
    if (match && typeof match[1] === "bigint") return match[1];
    throw new Error(`no bigint clear value for handle ${handle}`);
  }

  /** Decrypt a specific handle as `account`, not whatever the slot holds now. */
  async function decryptHandleAs(handle: string, account: HardhatEthersSigner): Promise<bigint> {
    if (handle === ethers.ZeroHash) return 0n;
    return await fhevm.userDecryptEuint(FhevmType.euint64, handle, poolAddress, account);
  }

  /** Run one full round to settlement or rollover, returning the winner count. */
  async function runRound(): Promise<bigint> {
    await warp(DEMO_DURATION);
    await (await draw.connect(keeper).closeRound()).wait();

    const roundId = await draw.drawingRoundId();
    const totalHandle = await draw.totalHandle(roundId);
    const totalResults = await fhevm.publicDecrypt([totalHandle]);
    await (
      await draw.onTotalRevealed(clearValue(totalResults, totalHandle), totalResults.decryptionProof)
    ).wait();

    await (await draw.connect(keeper).drawRandom()).wait();

    const frozen = (await draw.roundAt(roundId)).frozenTicketCount;
    await (await draw.connect(keeper).stepDraw(frozen)).wait();

    const countHandle = await draw.winnerCountHandle(roundId);
    const randomHandle = await draw.randomHandle(roundId);
    const results = await fhevm.publicDecrypt([countHandle, randomHandle]);
    const winnerCount = clearValue(results, countHandle);
    await (
      await draw
        .connect(keeper)
        .settle(winnerCount, clearValue(results, randomHandle), results.decryptionProof)
    ).wait();

    return winnerCount;
  }

  it("keeps a superseded claimable handle decryptable by its owner", async function () {
    await deposit(alice, 100_000n);
    await deposit(bob, 50_000n);
    await (await draw.connect(keeper).openRound()).wait();

    // Boundary 1: what the keeper would record at closeRound.
    const beforeHandles = {
      alice: await pool.claimableHandleOf(alice.address),
      bob: await pool.claimableHandleOf(bob.address),
    };

    const winnerCount = await runRound();
    expect(winnerCount).to.equal(1n);

    // Boundary 2: what the keeper would record at settle.
    const afterHandles = {
      alice: await pool.claimableHandleOf(alice.address),
      bob: await pool.claimableHandleOf(bob.address),
    };

    // The sweep writes every participant's slot, winners and losers alike, so
    // both handles must have moved. If they had not, the delta would be
    // meaningless and the privacy guarantee would also be broken.
    expect(afterHandles.alice).to.not.equal(beforeHandles.alice);
    expect(afterHandles.bob).to.not.equal(beforeHandles.bob);

    // The load-bearing assertion: the OLD handle is still readable after the
    // slot has moved on.
    const aliceBefore = await decryptHandleAs(beforeHandles.alice, alice);
    const aliceAfter = await decryptHandleAs(afterHandles.alice, alice);
    const bobBefore = await decryptHandleAs(beforeHandles.bob, bob);
    const bobAfter = await decryptHandleAs(afterHandles.bob, bob);

    const prize = (await draw.roundAt(await draw.drawingRoundId() - 1n)).prizeAmount;

    // Exactly one participant gained the prize; the other gained nothing.
    const aliceDelta = aliceAfter - aliceBefore;
    const bobDelta = bobAfter - bobBefore;
    expect(aliceDelta + bobDelta).to.equal(prize);
    expect([aliceDelta, bobDelta]).to.include(0n);
    expect([aliceDelta, bobDelta]).to.include(prize);
  });

  it("keeps handles from two rounds back decryptable and attributable", async function () {
    await deposit(alice, 100_000n);
    await (await draw.connect(keeper).openRound()).wait();

    const round1Before = await pool.claimableHandleOf(alice.address);
    expect(await runRound()).to.equal(1n);
    const round1After = await pool.claimableHandleOf(alice.address);

    // Round 2 opens automatically on settle, with the same ticket still live.
    const round2Before = await pool.claimableHandleOf(alice.address);
    expect(await runRound()).to.equal(1n);
    const round2After = await pool.claimableHandleOf(alice.address);

    // Three generations of the same slot, all still readable by the owner.
    const v0 = await decryptHandleAs(round1Before, alice);
    const v1 = await decryptHandleAs(round1After, alice);
    const v2 = await decryptHandleAs(round2After, alice);

    expect(round2Before).to.equal(round1After);
    expect(v0).to.equal(0n);
    expect(v1).to.be.greaterThan(0n);
    expect(v2).to.be.greaterThan(v1);

    // Per-round attribution by subtraction, which is what the UI will show.
    const round1Prize = v1 - v0;
    const round2Prize = v2 - v1;
    expect(round1Prize).to.be.greaterThan(0n);
    expect(round2Prize).to.be.greaterThan(0n);
  });

  it("does not let a non-owner decrypt a historical claimable handle", async function () {
    await deposit(alice, 100_000n);
    await deposit(bob, 50_000n);
    await (await draw.connect(keeper).openRound()).wait();
    await runRound();

    const aliceHandle = await pool.claimableHandleOf(alice.address);

    // The handles the backend stores are public. They are only useful to the
    // address the pool granted, which is what makes serving them safe.
    await expect(decryptHandleAs(aliceHandle, bob)).to.be.rejected;
  });
});
