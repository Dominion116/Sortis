import * as dotenv from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

// The FHEVM plugin refuses to run solidity-coverage unless this is set. Doing
// it here means `npm run coverage` works on Windows and in CI without a
// platform-specific env prefix.
if (process.argv.includes("coverage")) {
  process.env.SOLIDITY_COVERAGE = "true";
}

// The FHEVM plugin registers the mock coprocessor on the in-process `hardhat`
// network, which is what lets the whole encrypted test suite run with no live
// network and no relayer. It must be imported before anything reads HRE.
import "@fhevm/hardhat-plugin";

import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL ?? "";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      // FHEVM contracts are large; the optimizer is not optional here.
      optimizer: { enabled: true, runs: 800 },
      // The coprocessor precompiles assume Cancun. Lowering this breaks FHE ops.
      evmVersion: "cancun",
    },
  },
  networks: {
    // Default target for `hardhat test`: in-process, mock coprocessor, no network.
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: { sepolia: ETHERSCAN_API_KEY },
  },
  gasReporter: {
    // Opt-in: gas accounting is Phase 6 work, not something every run should pay for.
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  paths: {
    sources: "contracts",
    tests: "test",
    cache: "cache",
    artifacts: "artifacts",
  },
  mocha: {
    // Encrypted operations under the mock coprocessor are slow by nature.
    timeout: 180_000,
  },
};

export default config;
