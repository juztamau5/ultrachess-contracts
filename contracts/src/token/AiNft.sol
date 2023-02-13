/*
 * Copyright (C) 2023 Ultrachess team
 * This file is part of Ultrachess - https://github.com/Ultrachess/contracts
 *
 * SPDX-License-Identifier: Apache-2.0
 * See the file LICENSE for more information.
 */

pragma solidity 0.8.18;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";

import {AiNftWallet} from "./AiNftWallet.sol";

/**
 * @dev Implementation of the https://eips.ethereum.org/EIPS/eip-721[ERC721]
 * Nonfungible Token Standard
 */
contract AiNft is AccessControl, ReentrancyGuard, ERC721Enumerable {
  using Counters for Counters.Counter;
  using SafeERC20 for IERC20;

  //////////////////////////////////////////////////////////////////////////////
  // Constants
  //////////////////////////////////////////////////////////////////////////////

  // ERC-721 token name
  string public constant NAME = "Ultrachess AI NFT";

  // ERC-721 token symbol
  string public constant SYMBOL = "AI-NFT";

  //////////////////////////////////////////////////////////////////////////////
  // Roles
  //////////////////////////////////////////////////////////////////////////////

  // Only ISSUERS can mint and destroy tokens
  bytes32 public constant ISSUER_ROLE = "ISSUER_ROLE";

  //////////////////////////////////////////////////////////////////////////////
  // State
  //////////////////////////////////////////////////////////////////////////////

  // Immutable wallet template
  AiNftWallet public immutable walletTemplate;

  // The stable asset
  IERC20 public immutable stableAsset;

  // A map of token IDs to minimal proxy address
  mapping(uint256 => address) private tokenIdToWallet;

  // A map of minimal proxy addresses to token IDs
  mapping(address => uint256) private walletToTokenId;

  // A map of token IDs to bot IDs
  mapping(uint256 => string) public botIds;

  // The token ID counter
  Counters.Counter private tokenIdCounter;

  //////////////////////////////////////////////////////////////////////////////
  // Initialization
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Initializes the ERC-721 contract
   *
   * @param contractOwner The owner of the ERC-721 contract
   * @param walletTemplate_ The AI NFT wallet template
   */
  constructor(
    address contractOwner,
    address walletTemplate_,
    address stableAsset_
  ) ERC721(NAME, SYMBOL) {
    // Validate parameters
    require(contractOwner != address(0), "Invalid owner");
    require(walletTemplate_ != address(0), "Invalid wallet");
    require(stableAsset_ != address(0), "Invalid stable");

    // Initialize {AccessControl}
    _grantRole(DEFAULT_ADMIN_ROLE, contractOwner);

    // Initialize state
    walletTemplate = AiNftWallet(walletTemplate_);
    stableAsset = IERC20(stableAsset_);

    // Increment counter to start assigning token IDs from 1
    tokenIdCounter.increment();
  }

  //////////////////////////////////////////////////////////////////////////////
  // Implementation of {IERC165} via {AccessControl} and {ERC721Enumerable}
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev See {IERC165-supportsInterface}
   */
  function supportsInterface(
    bytes4 interfaceId
  ) public view override(AccessControl, ERC721Enumerable) returns (bool) {
    return
      AccessControl.supportsInterface(interfaceId) ||
      ERC721Enumerable.supportsInterface(interfaceId);
  }

  //////////////////////////////////////////////////////////////////////////////
  // Implementation of {IERC721Metadata} via {ERC721Enumerable}
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev See {IERC721Metadata-tokenURI}.
   */
  function tokenURI(
    uint256 nftTokenId
  ) public view override returns (string memory) {
    return botIds[nftTokenId];
  }

  //////////////////////////////////////////////////////////////////////////////
  // Implementation of {ERC721} via {ERC721Enumerable}
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev See {ERC721-_beforeTokenTransfer}.
   */
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 firstTokenId,
    uint256 batchSize
  ) internal override nonReentrant {
    // Check if we are minting
    if (from == address(0)) {
      // Translate parameters
      uint256 nftTokenId = firstTokenId;

      // Create a new wallet
      address walletAddress = Clones.cloneDeterministic(
        address(walletTemplate),
        bytes32(nftTokenId)
      );
      AiNftWallet nftWallet = AiNftWallet(walletAddress);

      // Update state
      tokenIdToWallet[nftTokenId] = walletAddress;
      walletToTokenId[walletAddress] = nftTokenId;

      // Initialize wallet
      // slither-disable-next-line reentrancy-benign
      nftWallet.initialize(nftTokenId);
    }

    // Call ancestor
    super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
  }

  /**
   * @dev See {ERC721-_afterTokenTransfer}.
   */
  function _afterTokenTransfer(
    address from,
    address to,
    uint256 firstTokenId,
    uint256 batchSize
  ) internal override nonReentrant {
    // Call ancestor
    super._afterTokenTransfer(from, to, firstTokenId, batchSize);

    // Check if we are burning
    if (to == address(0)) {
      // Translate parameters
      uint256 nftTokenId = firstTokenId;

      // Load state
      address walletAddress = tokenIdToWallet[nftTokenId];

      // Validate state
      require(walletAddress != address(0), "Invalid ID");

      // Update state
      delete tokenIdToWallet[nftTokenId];
      delete walletToTokenId[walletAddress];

      // Destroy the wallet
      AiNftWallet nftWallet = AiNftWallet(walletAddress);
      nftWallet.destroy();
    }
  }

  //////////////////////////////////////////////////////////////////////////////
  // Accessors
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Returns the wallet address for a given AI NFT
   *
   * @param nftTokenId The token ID of the AI NFT
   *
   * @return The wallet address, or address(0) if the token ID is invalid
   */
  function walletOf(uint256 nftTokenId) public view returns (address) {
    return tokenIdToWallet[nftTokenId];
  }

  /**
   * @dev Returns the token ID for a given wallet address
   *
   * @param wallet The wallet address
   *
   * @return The token ID, or 0 if the wallet address is invalid
   */
  function tokenIdOf(address wallet) public view returns (uint256) {
    return walletToTokenId[wallet];
  }

  //////////////////////////////////////////////////////////////////////////////
  // ERC-20 functions
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Deposit an ERC-20 asset into the AI NFT's wallet
   *
   * @param nftTokenId The token ID of the AI NFT
   * @param token The token to deposit
   * @param assetAmount The amount of the asset to deposit
   */
  function depositErc20(
    uint256 nftTokenId,
    address token,
    uint256 assetAmount
  ) public {
    // Validate access
    require(ownerOf(nftTokenId) == _msgSender(), "Not owner");

    // Validate parameters
    require(token != address(0), "Invalid token");

    // Read state
    address nftWalletAddress = tokenIdToWallet[nftTokenId];

    // Validate state
    require(nftWalletAddress != address(0), "Invalid wallet");

    // Call external contracts
    IERC20(token).safeTransferFrom(_msgSender(), nftWalletAddress, assetAmount);
  }

  /**
   * @dev Withdraw an ERC-20 asset from the AI NFT's wallet
   *
   * @param nftTokenId The token ID of the AI NFT
   * @param token The token contract
   * @param assetAmount The amount of the asset to withdraw
   * @param recipient The recipient of the asset
   */
  function withdrawErc20(
    uint256 nftTokenId,
    address token,
    uint256 assetAmount,
    address recipient
  ) public {
    // Validate access
    require(ownerOf(nftTokenId) == _msgSender(), "Not owner");

    // Validate parameters
    require(token != address(0), "Invalid token");
    require(recipient != address(0), "Invalid recipient");

    // Read state
    address nftWalletAddress = tokenIdToWallet[nftTokenId];

    // Validate state
    require(nftWalletAddress != address(0), "Invalid wallet");

    // Call external contracts
    AiNftWallet(nftWalletAddress).withdrawErc20(token, recipient, assetAmount);
  }

  //////////////////////////////////////////////////////////////////////////////
  // ERC-1155 functions
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Deposit ERC-1155 tokens into the AI NFT's wallet
   *
   * @param nftTokenId The token ID of the AI NFT
   * @param sftToken The SFT contract
   * @param sftTokenIds The IDs of the tokens to deposit
   * @param sftTokenAmounts The amounts of the tokens to deposit
   */
  function depositBatchErc1155(
    uint256 nftTokenId,
    address sftToken,
    uint256[] memory sftTokenIds,
    uint256[] memory sftTokenAmounts
  ) public {
    // Validate access
    require(ownerOf(nftTokenId) == _msgSender(), "Not owner");

    // Validate parameters
    require(sftToken != address(0), "Invalid SFT");

    // Read state
    address nftWalletAddress = tokenIdToWallet[nftTokenId];

    // Validate state
    require(nftWalletAddress != address(0), "Invalid wallet");

    // Call external contracts
    IERC1155(sftToken).safeBatchTransferFrom(
      _msgSender(),
      nftWalletAddress,
      sftTokenIds,
      sftTokenAmounts,
      ""
    );
  }

  /**
   * @dev Withdraw a ERC-1155 tokens from the AI NFT's wallet
   *
   * @param nftTokenId The token ID of the AI NFT
   * @param sftToken The SFT contract
   * @param sftTokenIds The IDs of the tokens to withdraw
   * @param sftTokenAmounts The amounts of the tokens to withdraw
   * @param recipient The recipient of the tokens
   */
  function withdrawBatchErc1155(
    uint256 nftTokenId,
    address sftToken,
    uint256[] memory sftTokenIds,
    uint256[] memory sftTokenAmounts,
    address recipient
  ) public {
    // Validate access
    require(ownerOf(nftTokenId) == _msgSender(), "Not owner");

    // Validate parameters
    require(sftToken != address(0), "Invalid SFT");
    require(recipient != address(0), "Invalid recipient");

    // Read state
    address nftWalletAddress = tokenIdToWallet[nftTokenId];

    // Validate state
    require(nftWalletAddress != address(0), "Invalid wallet");

    // Call external contracts
    AiNftWallet(nftWalletAddress).withdrawBatchErc1155(
      sftToken,
      recipient,
      sftTokenIds,
      sftTokenAmounts
    );
  }

  //////////////////////////////////////////////////////////////////////////////
  // Issuer functions
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Mints a new AI NFT
   *
   * @param account The account to mint an AI NFT to
   * @param botId The bot ID of the AI NFT
   */
  function mint(address account, string memory botId) public {
    // Validate access
    require(hasRole(ISSUER_ROLE, _msgSender()), "Not issuer");

    // Validate parameters
    require(account != address(0), "Invalid account");

    // Read state
    uint256 nftTokenId = tokenIdCounter.current();

    // Update state
    botIds[nftTokenId] = botId;
    tokenIdCounter.increment();

    // Call ancestor
    _mint(account, nftTokenId);
  }

  /**
   * @dev Burns an existing AI NFT
   *
   * @param nftTokenId The token ID of the AI NFT to burn
   */
  function burn(uint256 nftTokenId) public {
    // Validate access
    require(hasRole(ISSUER_ROLE, _msgSender()), "Not issuer");

    // Update state
    delete botIds[nftTokenId];

    // Call ancestor
    _burn(nftTokenId);
  }
}
