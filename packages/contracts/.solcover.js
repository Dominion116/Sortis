module.exports = {
  // MorphoYieldSource is a documented stub; every path reverts. Measuring it
  // would only dilute the figure for the contracts that actually run.
  skipFiles: ["yields/MorphoYieldSource.sol"],
  istanbulReporter: ["text", "lcov", "json-summary"],
};
