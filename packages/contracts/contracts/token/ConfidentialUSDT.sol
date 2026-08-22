// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ConfidentialUSDT (cUSDT)
 * @notice The test confidential token the pools denominate in. Deliberately a
 *         thin shell over OpenZeppelin's audited ERC-7984 implementation rather
 *         than a bespoke confidential token: the PRD calls for the protocol
 *         standard, not our own reading of it.
 *
 * @dev Phase 2 exists partly to prove this integration works end to end against
 *      the mock coprocessor (mint, then confidential transfer) BEFORE the pool
 *      is built on top of it. Getting the standard wrong later is expensive.
 */
contract ConfidentialUSDT is ERC7984, ZamaEthereumConfig, Ownable {
    /// @notice Thrown when a caller other than the owner or the configured faucet mints.
    error OnlyMinter();

    /// @notice The faucet contract permitted to mint test tokens. Unset is address(0).
    address public faucet;

    /// @notice Emitted on a plaintext-amount mint, for test and faucet traceability.
    event Minted(address indexed to, uint64 amount);

    /// @notice Emitted when the authorised faucet address changes.
    event FaucetUpdated(address indexed previousFaucet, address indexed newFaucet);

    constructor(
        address initialOwner
    ) ERC7984("Confidential USDT", "cUSDT", "https://sortis.app/tokens/cusdt.json") Ownable(initialOwner) {}

    /**
     * @notice Point the plaintext mint at a faucet, or at `address(0)` to revoke it.
     * @dev Owner keeps `mintConfidential` and can still mint. The faucet only needs
     *      the public-amount path, because a drip amount is a well-known constant.
     */
    function setFaucet(address newFaucet) external onlyOwner {
        emit FaucetUpdated(faucet, newFaucet);
        faucet = newFaucet;
    }

    /**
     * @notice Mint from a plaintext amount, trivially encrypted on chain.
     * @dev Used by tests, deploy seeding, and `SortisFaucet`. The amount is public
     *      here by construction, which is fine: minting test tokens to yourself
     *      reveals nothing about pool behaviour. Confidential amounts are only
     *      meaningful once value moves between users.
     */
    function mint(address to, uint64 amount) external returns (euint64) {
        if (msg.sender != owner() && msg.sender != faucet) revert OnlyMinter();

        euint64 encryptedAmount = FHE.asEuint64(amount);
        FHE.allowThis(encryptedAmount);

        emit Minted(to, amount);
        return _mint(to, encryptedAmount);
    }

    /**
     * @notice Mint from a ciphertext produced off chain by the relayer SDK.
     * @dev The path a production issuer would use, kept so the encrypted-input
     *      plumbing (`fromExternal` + input proof) is exercised in Phase 2
     *      rather than discovered in Phase 9.
     */
    function mintConfidential(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyOwner returns (euint64) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowThis(amount);

        return _mint(to, amount);
    }
}
