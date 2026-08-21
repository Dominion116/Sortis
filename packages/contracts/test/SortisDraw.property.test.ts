import { FhevmType } from "@fhevm/hardhat-plugin";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import type { ConfidentialUSDT, SortisDraw, SortisPool } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

function clearValue(
  results: { clearValues: Record<string, bigint | boolean | string> },
  handle: string,
): bigint {
  const direct = results.clearValues[handle];
  if (typeof direct === "bigint") return direct;
  const match = Object.entries(results.clearValues).find(([key]) => key.toLowerCase() === handle.toLowerCase());
  if (match && typeof match[1] === "bigint") return match[1];
  throw new Error(`no bigint clear value for handle ${handle}`);
}

/**
 * Phase 6 — property tests over the ticket number line.
 *
 * The encrypted sweep is a linear scan of half-open ranges. If those ranges
 * ever overlap or leave a hole among active tickets, a random value selects
 * two winners or none, and the winner-count invariant is the only thing
 * standing between that and a wrong payout. These tests pin the geometry
 * itself, in plaintext, across many seeded ticket lists, so a regression
 * cannot hide behind a handful of happy-path draws.
 */
describe("Phase 6 — range-selection property", function () {
  const ROUND_DURATION = 300n;
  const MINT = 1_000_000n;
  const SEEDS = 20;

  let deployer: HardhatEthersSigner;
  let drawEngine: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;
  let dave: HardhatEthersSigner;
  let eve: HardhatEthersSigner;

  let token: ConfidentialUSDT;
  let pool: SortisPool;
  let poolAddress: string;

  const depositors = () => [alice, bob, carol, dave, eve];

  before(function () {
    if (!fhevm.isMock) this.skip();
  });

  beforeEach(async function () {
    [deployer, drawEngine, alice, bob, carol, dave, eve] = await ethers.getSigners();

    token = (await ethers.deployContract("ConfidentialUSDT", [deployer.address])) as unknown as ConfidentialUSDT;
    await token.waitForDeployment();

    pool = (await ethers.deployContract("SortisPool", [
      await token.getAddress(),
      ROUND_DURATION,
      deployer.address,
    ])) as unknown as SortisPool;
    await pool.waitForDeployment();
    poolAddress = await pool.getAddress();

    await (await pool.connect(deployer).setDrawEngine(drawEngine.address)).wait();

    for (const account of depositors()) {
      await (await token.connect(deployer).mint(account.address, MINT)).wait();
      const until = (await ethers.provider.getBlock("latest"))!.timestamp + 86_400;
      await (await token.connect(account).setOperator(poolAddress, until)).wait();
    }
  });

  function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return function rand() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  async function deposit(account: HardhatEthersSigner, amount: bigint) {
    const encrypted = await fhevm.createEncryptedInput(poolAddress, account.address).add64(amount).encrypt();
    await (await pool.connect(account).deposit(encrypted.handles[0], encrypted.inputProof)).wait();
  }

  async function ticketGeometry(count: number): Promise<{ lo: bigint; hi: bigint; active: boolean }[]> {
    const ranges = [];
    let previous = 0n;
    for (let i = 0; i < count; i++) {
      const ticket = await pool.ticketAt(i);
      const hi = await fhevm.debugger.decryptEuint(FhevmType.euint64, ticket.cumulative);
      const active = await fhevm.debugger.decryptEbool(ticket.active);
      ranges.push({ lo: previous, hi, active });
      previous = hi;
    }
    return ranges;
  }

  function hitsAt(ranges: { lo: bigint; hi: bigint; active: boolean }[], r: bigint): number {
    let hits = 0;
    for (const range of ranges) {
      if (range.active && range.lo <= r && r < range.hi) hits += 1;
    }
    return hits;
  }

  it("selects exactly one active ticket for every r in the range, across many seeded lists", async function () {
    const people = depositors();

    for (let seed = 1; seed <= SEEDS; seed++) {
      // Fresh pool per seed so leftover tickets cannot leak between lists.
      if (seed > 1) {
        pool = (await ethers.deployContract("SortisPool", [
          await token.getAddress(),
          ROUND_DURATION,
          deployer.address,
        ])) as unknown as SortisPool;
        await pool.waitForDeployment();
        poolAddress = await pool.getAddress();
        await (await pool.connect(deployer).setDrawEngine(drawEngine.address)).wait();
        for (const account of people) {
          const until = (await ethers.provider.getBlock("latest"))!.timestamp + 86_400;
          await (await token.connect(account).setOperator(poolAddress, until)).wait();
        }
      }

      const rand = mulberry32(seed * 97_331);
      const n = 2 + Math.floor(rand() * 4); // 2..5 tickets
      const amounts: bigint[] = [];
      for (let i = 0; i < n; i++) {
        amounts.push(1n + BigInt(Math.floor(rand() * 8))); // 1..8
      }

      for (let i = 0; i < n; i++) {
        await deposit(people[i % people.length], amounts[i]);
      }

      const voidIndex = rand() < 0.45 ? Math.floor(rand() * n) : -1;
      if (voidIndex >= 0) {
        await (await pool.connect(people[voidIndex % people.length]).withdraw(voidIndex)).wait();
      }

      const ranges = await ticketGeometry(n);
      const total = ranges[ranges.length - 1].hi;
      expect(total, `seed ${seed} total`).to.equal(amounts.reduce((a, b) => a + b, 0n));

      let activeHits = 0;
      let voidHits = 0;
      for (let r = 0n; r < total; r++) {
        const hits = hitsAt(ranges, r);
        expect(hits, `seed ${seed} r=${r}`).to.be.at.most(1);
        if (hits === 1) activeHits += 1;
        else voidHits += 1;
      }

      if (voidIndex < 0) {
        // No gaps: every r lands in exactly one live range.
        expect(activeHits, `seed ${seed} full coverage`).to.equal(Number(total));
        expect(voidHits).to.equal(0);
      } else {
        const voided = ranges[voidIndex];
        const gap = Number(voided.hi - voided.lo);
        expect(voidHits, `seed ${seed} gap width`).to.equal(gap);
        expect(activeHits).to.equal(Number(total) - gap);
      }
    }
  });

  it("an on-chain draw's random value selects the same unique ticket the geometry predicts", async function () {
    const draw = (await ethers.deployContract("SortisDraw", [
      poolAddress,
      drawEngine.address,
      deployer.address,
    ])) as unknown as SortisDraw;
    await draw.waitForDeployment();
    await (await pool.connect(deployer).setDrawEngine(await draw.getAddress())).wait();

    const amounts = [4n, 7n, 1n, 6n];
    const people = [alice, bob, carol, dave];
    for (let i = 0; i < amounts.length; i++) {
      await deposit(people[i], amounts[i]);
    }

    await (await draw.connect(drawEngine).openRound()).wait();
    await ethers.provider.send("evm_increaseTime", [Number(ROUND_DURATION)]);
    await ethers.provider.send("evm_mine", []);
    await (await draw.connect(drawEngine).closeRound()).wait();

    const totalHandle = await draw.totalHandle(1n);
    const totalProof = await fhevm.publicDecrypt([totalHandle]);
    const total = clearValue(totalProof, totalHandle);
    await (await draw.onTotalRevealed(total, totalProof.decryptionProof)).wait();
    await (await draw.connect(drawEngine).drawRandom()).wait();
    await (await draw.connect(drawEngine).stepDraw(amounts.length)).wait();

    const countHandle = await draw.winnerCountHandle(1n);
    const randomHandle = await draw.randomHandle(1n);
    const settlement = await fhevm.publicDecrypt([countHandle, randomHandle]);
    const winnerCount = clearValue(settlement, countHandle);
    const randomValue = clearValue(settlement, randomHandle);

    expect(winnerCount).to.equal(1n);
    expect(randomValue).to.be.lt(total);

    const ranges = await ticketGeometry(amounts.length);
    expect(hitsAt(ranges, randomValue)).to.equal(1);

    await (await draw.connect(drawEngine).settle(winnerCount, randomValue, settlement.decryptionProof)).wait();
  });
});

describe("Phase 6 — losers' storage slots are written", function () {
  const ROUND_DURATION = 300n;
  const MINT = 1_000_000n;

  let deployer: HardhatEthersSigner;
  let keeper: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;

  let token: ConfidentialUSDT;
  let pool: SortisPool;
  let draw: SortisDraw;
  let poolAddress: string;

  before(function () {
    if (!fhevm.isMock) this.skip();
  });

  beforeEach(async function () {
    [deployer, keeper, alice, bob, carol] = await ethers.getSigners();

    token = (await ethers.deployContract("ConfidentialUSDT", [deployer.address])) as unknown as ConfidentialUSDT;
    await token.waitForDeployment();

    pool = (await ethers.deployContract("SortisPool", [
      await token.getAddress(),
      ROUND_DURATION,
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

    await (await pool.connect(deployer).setDrawEngine(await draw.getAddress())).wait();

    for (const account of [alice, bob, carol]) {
      await (await token.connect(deployer).mint(account.address, MINT)).wait();
      const until = (await ethers.provider.getBlock("latest"))!.timestamp + 86_400;
      await (await token.connect(account).setOperator(poolAddress, until)).wait();
    }
  });

  async function deposit(account: HardhatEthersSigner, amount: bigint) {
    const encrypted = await fhevm.createEncryptedInput(poolAddress, account.address).add64(amount).encrypt();
    await (await pool.connect(account).deposit(encrypted.handles[0], encrypted.inputProof)).wait();
  }

  async function warp() {
    await ethers.provider.send("evm_increaseTime", [Number(ROUND_DURATION)]);
    await ethers.provider.send("evm_mine", []);
  }

  async function runSweep(amounts: bigint[]) {
    const people = [alice, bob, carol];
    for (let i = 0; i < amounts.length; i++) {
      await deposit(people[i], amounts[i]);
    }
    const roundId = await draw.drawingRoundId();
    if (roundId === 0n) {
      await (await draw.connect(keeper).openRound()).wait();
    }
    await warp();
    await (await draw.connect(keeper).closeRound()).wait();

    const closedId = await draw.drawingRoundId();
    const totalHandle = await draw.totalHandle(closedId);
    const totalProof = await fhevm.publicDecrypt([totalHandle]);
    await (await draw.onTotalRevealed(clearValue(totalProof, totalHandle), totalProof.decryptionProof)).wait();
    await (await draw.connect(keeper).drawRandom()).wait();
    await (await draw.connect(keeper).stepDraw(amounts.length)).wait();
    return closedId;
  }

  async function settleCurrent() {
    const roundId = await draw.drawingRoundId();
    const countHandle = await draw.winnerCountHandle(roundId);
    const randomHandle = await draw.randomHandle(roundId);
    const results = await fhevm.publicDecrypt([countHandle, randomHandle]);
    await (
      await draw
        .connect(keeper)
        .settle(clearValue(results, countHandle), clearValue(results, randomHandle), results.decryptionProof)
    ).wait();
  }

  async function mappingSlot(account: string, handle: string): Promise<bigint> {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    for (let slot = 0n; slot < 32n; slot++) {
      const loc = ethers.keccak256(coder.encode(["address", "uint256"], [account, slot]));
      const value = await ethers.provider.getStorage(poolAddress, loc);
      if (BigInt(value) === BigInt(handle)) return slot;
    }
    throw new Error(`claimable mapping slot not found for ${account}`);
  }

  it("changes the claimable storage word for every participant on every draw", async function () {
    // A skip-the-losers "optimisation" would leave their slot untouched. The
    // first draw would then show a zero handle for losers, and a later draw
    // would reuse the previous ciphertext. Either leak identifies the winner
    // from the state diff alone.
    const first = await runSweep([40_000n, 10_000n, 90_000n]);

    const afterFirst = {
      alice: await pool.claimableHandleOf(alice.address),
      bob: await pool.claimableHandleOf(bob.address),
      carol: await pool.claimableHandleOf(carol.address),
    };
    expect(afterFirst.alice).to.not.equal(ethers.ZeroHash);
    expect(afterFirst.bob).to.not.equal(ethers.ZeroHash);
    expect(afterFirst.carol).to.not.equal(ethers.ZeroHash);

    const aliceSlot = await mappingSlot(alice.address, afterFirst.alice);
    const bobSlot = await mappingSlot(bob.address, afterFirst.bob);
    const carolSlot = await mappingSlot(carol.address, afterFirst.carol);
    expect(aliceSlot).to.equal(bobSlot);
    expect(bobSlot).to.equal(carolSlot);

    const coder = ethers.AbiCoder.defaultAbiCoder();
    const loc = (account: string) => ethers.keccak256(coder.encode(["address", "uint256"], [account, aliceSlot]));
    expect(BigInt(await ethers.provider.getStorage(poolAddress, loc(alice.address)))).to.equal(BigInt(afterFirst.alice));
    expect(BigInt(await ethers.provider.getStorage(poolAddress, loc(bob.address)))).to.equal(BigInt(afterFirst.bob));
    expect(BigInt(await ethers.provider.getStorage(poolAddress, loc(carol.address)))).to.equal(BigInt(afterFirst.carol));

    await settleCurrent();
    expect((await draw.roundAt(first)).state).to.equal(4n); // Settled

    // Second draw: every slot must move again, including whoever lost twice.
    await runSweep([15_000n, 25_000n, 5_000n]);
    const afterSecond = {
      alice: await pool.claimableHandleOf(alice.address),
      bob: await pool.claimableHandleOf(bob.address),
      carol: await pool.claimableHandleOf(carol.address),
    };

    expect(afterSecond.alice).to.not.equal(afterFirst.alice);
    expect(afterSecond.bob).to.not.equal(afterFirst.bob);
    expect(afterSecond.carol).to.not.equal(afterFirst.carol);

    expect(BigInt(await ethers.provider.getStorage(poolAddress, loc(alice.address)))).to.equal(
      BigInt(afterSecond.alice),
    );
    expect(BigInt(await ethers.provider.getStorage(poolAddress, loc(bob.address)))).to.equal(BigInt(afterSecond.bob));
    expect(BigInt(await ethers.provider.getStorage(poolAddress, loc(carol.address)))).to.equal(
      BigInt(afterSecond.carol),
    );
  });
});
