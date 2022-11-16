/*
 * Copyright (C) 2022 Ultrachess team
 * This file is part of Ultrachess - https://github.com/Ultrachess/contracts
 *
 * SPDX-License-Identifier: Apache-2.0
 * See the file LICENSE for more information.
 */

pragma solidity 0.8.16;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import {INonfungiblePositionManager} from "../../interfaces/uniswap-v3-periphery/INonfungiblePositionManager.sol";

/**
 * @dev Implementation of the https://eips.ethereum.org/EIPS/eip-1155[ERC1155]
 * Semi-fungible Token Standard
 */
contract LpSft is Ownable, ERC1155 {
  //////////////////////////////////////////////////////////////////////////////
  // State
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev The Uniswap V3 NFT manager
   */
  INonfungiblePositionManager public immutable uniswapV3NftManager;

  /**
   * @dev Mapping from token ID to owner
   */
  mapping(uint256 => address) private _tokenOwner;

  //////////////////////////////////////////////////////////////////////////////
  // Initialization
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Initializes the ERC-1155 contract
   *
   * @param owner_ The owner of the ERC-1155 contract
   * @param uniswapV3NftManager_ The Uniswap V3 NFT manager
   */
  constructor(address owner_, address uniswapV3NftManager_) ERC1155("") {
    // Validate paremeters
    require(owner_ != address(0), "Invalid owner");
    require(uniswapV3NftManager_ != address(0), "Invalid mgr");

    // Initialize {Ownable}
    transferOwnership(owner_);

    // Initialize state
    uniswapV3NftManager = INonfungiblePositionManager(uniswapV3NftManager_);
  }

  //////////////////////////////////////////////////////////////////////////////
  // Implementation of {IERC1155MetadataURI} via {ERC1155}
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev See {IERC1155MetadataURI-uri}
   */
  function uri(
    uint256 sftTokenId
  ) public view override returns (string memory) {
    return uniswapV3NftManager.tokenURI(sftTokenId);
  }

  //////////////////////////////////////////////////////////////////////////////
  // External accessors
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Returns the owner of the NFT specified by `tokenId`.
   *
   * @param stfTokenId The ID of the LP SFT token
   *
   * @return owner_ The owner of the token, or `address(0)` if the token does not exist
   */
  function ownerOf(uint256 stfTokenId) public view returns (address owner_) {
    return _tokenOwner[stfTokenId];
  }

  //////////////////////////////////////////////////////////////////////////////
  // Owner functions
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Mints a new LP SFT
   *
   * @param account The account to mint an LP SFT to
   * @param sftTokenId The token ID of the minted LP SFT
   */
  function mint(address account, uint256 sftTokenId) external onlyOwner {
    // Validate parameters
    require(account != address(0), "Invalid account");

    // Update state
    _tokenOwner[sftTokenId] = account;

    // Call ancestor
    _mint(account, sftTokenId, 1, "");
  }

  /**
   * @dev Mints a batch of LP SFTs
   *
   * @param account The account to mint SFTs to
   * @param sftTokenIds The token IDs of the minted SFTs
   *
   * Note: This function does not place a limit on the number of LP SFTs that
   * can be minted in a single transaction. The number of LP SFTs to mint can
   * exceed the block gas limit, denying the transaction from completing.
   */
  function mintBatch(
    address account,
    uint256[] memory sftTokenIds
  ) external onlyOwner {
    // Validate parameters
    require(account != address(0), "Invalid account");
    require(sftTokenIds.length > 0, "No IDs");

    // Generate parameters and update state
    uint256[] memory tokenAmounts = new uint256[](sftTokenIds.length);
    for (uint256 i = 0; i < sftTokenIds.length; i++) {
      tokenAmounts[i] = 1;
      _tokenOwner[sftTokenIds[i]] = account;
    }

    // Call ancestor
    _mintBatch(account, sftTokenIds, tokenAmounts, "");
  }

  /**
   * @dev Burns an existing LP SFT
   *
   * @param account The account to burn an LP SFT from
   * @param sftTokenId The token ID of the LP SFT to burn
   */
  function burn(address account, uint256 sftTokenId) external onlyOwner {
    // Validate parameters
    require(account != address(0), "Invalid account");

    // Update state
    _tokenOwner[sftTokenId] = address(0);

    // Call ancestor
    _burn(account, sftTokenId, 1);
  }

  /**
   * @dev Burns a batch of existing LP SFTs
   *
   * @param account The account to burn LP SFTs from
   * @param sftTokenIds The token IDs of the LP SFTs to burn
   *
   * Note: This function does not place a limit on the number of LP SFTs that
   * can be burned in a single transaction. The number of LP SFTs to burn can
   * exceed the block gas limit, denying the transaction from completing.
   */
  function burnBatch(
    address account,
    uint256[] memory sftTokenIds
  ) external onlyOwner {
    // Validate parameters
    require(account != address(0), "Invalid account");
    require(sftTokenIds.length > 0, "No IDs");

    // Generate parameters and update state
    uint256[] memory tokenAmounts = new uint256[](sftTokenIds.length);
    for (uint256 i = 0; i < sftTokenIds.length; i++) {
      tokenAmounts[i] = 1;
      _tokenOwner[sftTokenIds[i]] = address(0);
    }

    // Call ancestor
    _burnBatch(account, sftTokenIds, tokenAmounts);
  }
}
