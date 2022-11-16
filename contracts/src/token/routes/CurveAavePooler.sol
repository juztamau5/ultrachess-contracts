/*
 * Copyright (C) 2022 Ultrachess team
 * This file is part of Ultrachess - https://github.com/Ultrachess/contracts
 *
 * SPDX-License-Identifier: Apache-2.0
 * See the file LICENSE for more information.
 */

pragma solidity 0.8.16;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {StableSwapAave} from "../../../interfaces/curve/StableSwapAave.sol";

/**
 * @dev Token router to add liquidity to the Curve Aave pool in exchange for
 * LP tokens
 *
 * The point of this contract is to provide an interface for adding liquidity to
 * the Curve Aave pool and to remove liquidity as a single token.
 */
contract CurveAavePooler is Context, ReentrancyGuard {
  using SafeERC20 for IERC20;

  //////////////////////////////////////////////////////////////////////////////
  // State
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev The upstream Curve Aave pool contract
   */
  StableSwapAave public immutable curveAavePool;

  // Public token addresses
  IERC20 public immutable daiToken;
  IERC20 public immutable usdcToken;
  IERC20 public immutable usdtToken;
  IERC20 public immutable curveAaveLpToken;

  //////////////////////////////////////////////////////////////////////////////
  // Events
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Emitted when liquidity is added to the Curve Aave pool
   *
   * @param sender The sender of the underlying stablecoins
   * @param recipient The address of the recipient of the LP tokens
   * @param stableAmounts The amounts of stablecoins added to the pool (0 = DAI, 1 = USDC, 2 = USDT)
   * @param lpTokenAmount The amount of LP tokens received
   */
  event LiquidityAdded(
    address indexed sender,
    address indexed recipient,
    uint256[3] stableAmounts,
    uint256 lpTokenAmount
  );

  /**
   * @dev Emitted when liquidity is removed from the Curve Aave pool
   *
   * @param sender The sender
   * @param recipient The recipient of the underlying stablecoin
   * @param lpTokenAmount The amount of LP tokens burned
   * @param stableIndex The index of the stablecoin returned (0 = DAI, 1 = USDC, 2 = USDT)
   * @param stablesRemoved Tthe amount of stablecoins removed from the pool
   * @param stablesReturned Tthe amount of stablecoins returned to the recipient
   */
  event LiquidityRemovedOneToken(
    address indexed sender,
    address indexed recipient,
    uint256 lpTokenAmount,
    uint256 stableIndex,
    uint256 stablesRemoved,
    uint256 stablesReturned
  );

  //////////////////////////////////////////////////////////////////////////////
  // Initialization
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Initializes the contract
   *
   * @param curveAavePool_ The address of Curve's Aave stable swap contract
   */
  constructor(address curveAavePool_) {
    // Validate paremeters
    require(curveAavePool_ != address(0), "Invalid pool");

    // Read external contracts
    address diaToken_ = StableSwapAave(curveAavePool_).underlying_coins(0);
    address usdcToken_ = StableSwapAave(curveAavePool_).underlying_coins(1);
    address usdtToken_ = StableSwapAave(curveAavePool_).underlying_coins(2);
    address curveAaveLpToken_ = StableSwapAave(curveAavePool_).lp_token();

    // Validate external contracts
    require(diaToken_ != address(0), "Invalid curve DAI");
    require(usdcToken_ != address(0), "Invalid curve USDC");
    require(usdtToken_ != address(0), "Invalid curve USDT");
    require(curveAaveLpToken_ != address(0), "Invalid curve LP");

    // Initialize state
    curveAavePool = StableSwapAave(curveAavePool_);
    daiToken = IERC20(diaToken_);
    usdcToken = IERC20(usdcToken_);
    usdtToken = IERC20(usdtToken_);
    curveAaveLpToken = IERC20(curveAaveLpToken_);
  }

  //////////////////////////////////////////////////////////////////////////////
  // External interface for adding liquidity
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Add an amount of underlying stablecoins to the pool and return the LP tokens
   *
   * @param stableAmounts The amounts of the underlying stablecoins to add (0 = DAI, 1 = USDC, 2 = USDT)
   * @param minMintAmount The minimum amount of the LP token to mint
   * @param recipient The recipient of the CurveLP tokens
   *
   * @return lpTokenAmount The amount of LP tokens minted and returned to the recipient
   */
  // slither-disable-next-line reentrancy-events
  function addLiquidity(
    uint256[3] memory stableAmounts,
    uint256 minMintAmount,
    address recipient
  ) public nonReentrant returns (uint256 lpTokenAmount) {
    // Validate parameters
    require(recipient != address(0), "Invalid recipient");

    // Call external contracts
    if (stableAmounts[0] > 0) {
      daiToken.safeTransferFrom(_msgSender(), address(this), stableAmounts[0]);
      daiToken.safeIncreaseAllowance(address(curveAavePool), stableAmounts[0]);
    }
    if (stableAmounts[1] > 0) {
      usdcToken.safeTransferFrom(_msgSender(), address(this), stableAmounts[1]);
      usdcToken.safeIncreaseAllowance(address(curveAavePool), stableAmounts[1]);
    }
    if (stableAmounts[2] > 0) {
      usdtToken.safeTransferFrom(_msgSender(), address(this), stableAmounts[2]);
      usdtToken.safeIncreaseAllowance(address(curveAavePool), stableAmounts[2]);
    }

    // Add liquidity to the pool
    uint256 mintAmount = curveAavePool.add_liquidity(
      stableAmounts,
      minMintAmount,
      true
    );

    // Transfer LP tokens to the recipient
    curveAaveLpToken.safeTransfer(recipient, mintAmount);

    // Dispatch event
    // slither-disable-next-line reentrancy-events
    emit LiquidityAdded(_msgSender(), recipient, stableAmounts, mintAmount);

    return mintAmount;
  }

  /**
   * @dev Add an amount of a single underlying stablecoin to the pool and return the LP tokens
   *
   * @param stableIndex The index of the stablecoin to add (0 = DAI, 1 = USDC, 2 = USDT)
   * @param stableAmount The amount of the underlying stablecoin to add
   *
   * @return lpTokenAmount The amount of LP tokens minted and returned to the recipient
   */
  function addLiquidityOneToken(
    uint256 stableIndex,
    uint256 stableAmount
  ) public nonReentrant returns (uint256 lpTokenAmount) {
    // Validate parameters
    require(stableIndex <= 2, "Invalid token");

    // Translate parameters
    uint256[3] memory stableAmounts;
    stableAmounts[stableIndex] = stableAmount;

    // Add liquidity to the pool
    lpTokenAmount = addLiquidity(stableAmounts, 0, _msgSender());

    return lpTokenAmount;
  }

  //////////////////////////////////////////////////////////////////////////////
  // External interface for removing liquidity
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Remove an amount of LP tokens from the pool and return the amount as
   * a single token
   *
   * @param lpTokenAmount The amount of the LP token to remove
   * @param stableIndex The index of the stablecoin to receive (0 = DAI, 1 = USDC, 2 = USDT)
   * @param minTokenAmount The minimum amount of the token to receive
   * @param recipient The recipient of the underlying stablecoin
   *
   * @return stablesRemoved The amount of the underlying stablecoin removed from the pool (for rounding errors)
   * @return stablesReturned The amount of the underlying stablecoin returned to the recipient
   */
  // slither-disable-next-line reentrancy-events
  function removeLiquidityOneToken(
    uint256 lpTokenAmount,
    uint256 stableIndex,
    uint256 minTokenAmount,
    address recipient
  )
    public
    nonReentrant
    returns (uint256 stablesRemoved, uint256 stablesReturned)
  {
    // Validate parameters
    require(lpTokenAmount > 0, "Invalid amount");
    require(stableIndex <= 2, "Invalid token");
    require(recipient != address(0), "Invalid recipient");

    // Call external contracts
    curveAaveLpToken.safeTransferFrom(
      _msgSender(),
      address(this),
      lpTokenAmount
    );

    curveAaveLpToken.safeIncreaseAllowance(
      address(curveAavePool),
      lpTokenAmount
    );

    // Remove the LP tokens from the pool
    uint256 removedAmount = curveAavePool.remove_liquidity_one_coin(
      lpTokenAmount,
      SafeCast.toInt128(SafeCast.toInt256(stableIndex)),
      minTokenAmount,
      true
    );

    // Call external contracts
    if (stableIndex == 0) {
      stablesReturned = daiToken.balanceOf(address(this));
      if (stablesReturned > 0)
        daiToken.safeTransfer(recipient, stablesReturned);
    } else if (stableIndex == 1) {
      stablesReturned = usdcToken.balanceOf(address(this));
      if (stablesReturned > 0)
        usdcToken.safeTransfer(recipient, stablesReturned);
    } else if (stableIndex == 2) {
      stablesReturned = usdtToken.balanceOf(address(this));
      if (stablesReturned > 0)
        usdtToken.safeTransfer(recipient, stablesReturned);
    }

    // Dispatch event
    // slither-disable-next-line reentrancy-events
    emit LiquidityRemovedOneToken(
      _msgSender(),
      recipient,
      lpTokenAmount,
      stableIndex,
      removedAmount,
      stablesReturned
    );

    return (removedAmount, stablesReturned);
  }

  /**
   * @dev Remove all liquidity as a single token in one function call
   *
   * @param stableIndex The index of the stablecoin to withdraw (0 = DAI, 1 = USDC, 2 = USDT)
   *
   * @return stablesRemoved Tthe amount of stablecoins withdrawn
   */
  function exitOneToken(
    uint256 stableIndex
  ) public returns (uint256 stablesRemoved, uint256 stablesReturned) {
    // Read state
    uint256 lpTokenAmount = curveAaveLpToken.balanceOf(_msgSender());

    // Remove all liquidity
    (stablesRemoved, stablesReturned) = removeLiquidityOneToken(
      lpTokenAmount,
      stableIndex,
      0,
      _msgSender()
    );
  }

  //////////////////////////////////////////////////////////////////////////////
  // External interface for reading state
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Get the amount of LP tokens that would be minted or burned for a
   * given amount of underlying stablecoins
   *
   * @param stableAmounts The amount of each underlying stablecoin to add or remove
   * @param isDeposit True if the amounts are being added to the pool, false if they are being removed
   *
   * @return mintAmount The amount of LP tokens that would be minted
   */
  function getLpAmount(
    uint256[3] memory stableAmounts,
    bool isDeposit
  ) public view returns (uint256 mintAmount) {
    return curveAavePool.calc_token_amount(stableAmounts, isDeposit);
  }

  /**
   * @dev Calculate the amount of underlying stablecoins that would be returned
   * for a given amount of LP tokens
   *
   * @param lpTokenAmount The amount of LP tokens to remove
   * @param stableIndex The index of the stablecoin to receive (0 = DAI, 1 = USDC, 2 = USDT)
   *
   * @return stableAmount The amount of the underlying stablecoin that would be returned
   */
  function getStableAmount(
    uint256 lpTokenAmount,
    uint256 stableIndex
  ) public view returns (uint256 stableAmount) {
    return
      curveAavePool.calc_withdraw_one_coin(
        lpTokenAmount,
        SafeCast.toInt128(SafeCast.toInt256(stableIndex))
      );
  }
}
