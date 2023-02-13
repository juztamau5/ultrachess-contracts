/*
 * Copyright (C) 2023 Ultrachess team
 * This file is part of Ultrachess - https://github.com/Ultrachess/contracts
 *
 * SPDX-License-Identifier: Apache-2.0
 * See the file LICENSE for more information.
 */

pragma solidity 0.8.18;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {ERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {AiNft} from "./AiNft.sol";

/**
 * @dev Minimal wallet for AI NFTs
 */
contract AiNftWallet is AccessControl, ERC1155Holder {
  using SafeERC20 for IERC20;

  //////////////////////////////////////////////////////////////////////////////
  // ROLES
  //////////////////////////////////////////////////////////////////////////////

  // The role that grants permission to destroy the contract
  bytes32 public constant DESTROYER_ROLE = "DESTROYER_ROLE";

  // The role that grants permission to withdraw tokens
  bytes32 public constant WITHDRAW_ROLE = "WITHDRAW_ROLE";

  //////////////////////////////////////////////////////////////////////////////
  // State
  //////////////////////////////////////////////////////////////////////////////

  // The token ID of the AI NFT that owns this wallet
  uint256 public nftTokenId;

  //////////////////////////////////////////////////////////////////////////////
  // Initialization
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Construct the wallet
   *
   * @param contractOwner The owner being granted the default admin role
   */
  constructor(address contractOwner) {
    // Validate parameters
    require(contractOwner != address(0), "Invalid owner");

    // Initialize {AccessControl}
    _setupRole(DEFAULT_ADMIN_ROLE, contractOwner);
  }

  /**
   * @dev Initialize the wallet
   *
   * @param tokenId The token ID of the AI NFT that owns this wallet
   */
  function initialize(uint256 tokenId) public {
    // Validate access
    require(hasRole(WITHDRAW_ROLE, _msgSender()), "Not withdrawer");

    // Initialize state
    nftTokenId = tokenId;

    // TODO: Emit event
  }

  //////////////////////////////////////////////////////////////////////////////
  // Deinitialization
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Destroy the wallet
   */
  // Disable high-impact Slither detector "suicidal" here. Slither explains
  // that "AiNftWallet.destroy() allows anyone to destruct the contract",
  // which is not the case due to the access validation.
  //
  // slither-disable-next-line suicidal
  function destroy() public {
    // Validate access
    require(hasRole(DESTROYER_ROLE, _msgSender()), "Not destroyer");

    // TODO: Emit event

    // Destroy the contract
    selfdestruct(payable(_msgSender()));
  }

  //////////////////////////////////////////////////////////////////////////////
  // Implementation of {IERC165} via {AccessControl} and {ERC1155Holder}
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev See {IERC165-supportsInterface}
   */
  function supportsInterface(
    bytes4 interfaceId
  ) public view override(AccessControl, ERC1155Receiver) returns (bool) {
    return
      AccessControl.supportsInterface(interfaceId) ||
      ERC1155Receiver.supportsInterface(interfaceId);
  }

  //////////////////////////////////////////////////////////////////////////////
  // Withdrawal
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Withdraw ERC-20 tokens from the wallet
   *
   * @param token The token contract
   * @param spender The address to receive the tokens
   * @param amount The amount of funds to withdraw
   */
  function withdrawErc20(
    address token,
    address spender,
    uint256 amount
  ) public {
    // Validate access
    require(hasRole(WITHDRAW_ROLE, _msgSender()), "Not withdrawer");

    // Validate parameters
    require(token != address(0), "Invalid token");
    require(spender != address(0), "Invalid spender");

    // TODO: Emit event

    // Call external contract
    IERC20(token).safeTransfer(spender, amount);
  }

  /**
   * @dev Withdraw ERC-1155 tokens from the wallet
   *
   * @param sftToken The SFT contract
   * @param recipient The address to receive the tokens
   * @param sftTokenIds The token IDs to withdraw
   * @param sftAmounts The amounts of tokens to withdraw
   */
  function withdrawBatchErc1155(
    address sftToken,
    address recipient,
    uint256[] memory sftTokenIds,
    uint256[] memory sftAmounts
  ) public {
    // Validate access
    require(hasRole(WITHDRAW_ROLE, _msgSender()), "Not withdrawer");

    // Validate parameters
    require(sftToken != address(0), "Invalid SFT");
    require(recipient != address(0), "Invalid recipient");

    // TODO: Emit event

    // Call external contract
    IERC1155(sftToken).safeBatchTransferFrom(
      address(this),
      recipient,
      sftTokenIds,
      sftAmounts,
      ""
    );
  }
}
