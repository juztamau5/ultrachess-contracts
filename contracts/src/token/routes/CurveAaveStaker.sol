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

import {LiquidityGauge} from "../../../interfaces/curve-dao/LiquidityGauge.sol";

import {Ultra3CRV} from "../Ultra3CRV.sol";
import {CurveAavePooler} from "./CurveAavePooler.sol";

/**
 * @dev Token router to stake stablecoins to the Curve Aave gauge in exchange
 * for asset tokens
 *
 * The point of this contract is to provide an interface for staking
 * stablecoins in the Curve Aave gauge and to unstake gauge shares as a
 * single underlying stablecoin.
 *
 * Shares are managed using the ERC-20 API.
 *
 * TODO: Staking in the gauge generates rewards in the form of CRV tokens.
 * These tokens are yet not managed by this contract.
 */
contract CurveAaveStaker is Context, ReentrancyGuard {
  using SafeERC20 for IERC20;

  //////////////////////////////////////////////////////////////////////////////
  // State
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev The Ultrachess Curve Aave pooler contract
   */
  CurveAavePooler public immutable curveAavePooler;

  /**
   * @dev The upstream Curve Aave gauge contract
   */
  LiquidityGauge public immutable curveAaveGauge;

  /**
   * @dev The Ultrachess token representing am3CRV staked in the Curve Aave gauge
   */
  Ultra3CRV public immutable assetToken;

  // Public token addresses
  IERC20 public immutable daiToken;
  IERC20 public immutable usdcToken;
  IERC20 public immutable usdtToken;
  IERC20 public immutable curveAaveLpToken;

  //////////////////////////////////////////////////////////////////////////////
  // Events
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Emitted when stablecoins are staked to the Curve Aave gauge
   *
   * @param sender The sender of the underlying stablecoins
   * @param recipient The address of the recipient of the gauge shares
   * @param stableAmounts The amounts of stablecoins staked to the gauge (0 = DAI, 1 = USDC, 2 = USDT)
   * @param gaugeShares The amount of gauge shares received
   */
  event GaugeStaked(
    address indexed sender,
    address indexed recipient,
    uint256[3] stableAmounts,
    uint256 gaugeShares
  );

  /**
   * @dev Emitted when stablecoins are unstaked from the Curve Aave gauge
   *
   * NOTE: The amount of stablecoins returned may be more than the amount of
   * stablecoins unstaked if this contract had a pre-existing balance of
   * stablecoins.
   *
   * @param sender The sender
   * @param recipient The address of the recipient of the single stablecoin
   * @param gaugeShares The amount of gauge shares unstaked from the gauge
   * @param stableIndex The index of the stablecoin to return (0 = DAI, 1 = USDC, 2 = USDT)
   * @param stablesUnpooled The amount of stablecoins removed from the liquidity pool
   * @param stablesUnstaked The amount of stablecoins unstaked from the gauge
   * @param stablesReturned The amount of stablecoins returned to the recipient
   */
  event GaugeUnstakedOneToken(
    address indexed sender,
    address indexed recipient,
    uint256 gaugeShares,
    uint256 stableIndex,
    uint256 stablesUnpooled,
    uint256 stablesUnstaked,
    uint256 stablesReturned
  );

  //////////////////////////////////////////////////////////////////////////////
  // Initialization
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Initializes the contract
   *
   * @param curveAavePooler_ The address of our Curve Aave pooler contract
   * @param curveAaveGauge_ The address of Curve's Aave gauge contract
   * @param assetToken_ The token representing staked am3CRV
   */
  constructor(
    address curveAavePooler_,
    address curveAaveGauge_,
    address assetToken_
  ) {
    // Validate paremeters
    require(curveAavePooler_ != address(0), "Invalid pooler");
    require(curveAaveGauge_ != address(0), "Invalid gauge");
    require(assetToken_ != address(0), "Invalid token");

    // Validate external contracts
    require(
      address(CurveAavePooler(curveAavePooler_).daiToken()) != address(0),
      "Invalid curve pooler DAI"
    );
    require(
      address(CurveAavePooler(curveAavePooler_).usdcToken()) != address(0),
      "Invalid curve pooler USDC"
    );
    require(
      address(CurveAavePooler(curveAavePooler_).usdtToken()) != address(0),
      "Invalid curve pooler USDT"
    );
    require(
      address(CurveAavePooler(curveAavePooler_).curveAaveLpToken()) !=
        address(0),
      "Invalid curve pooler LP"
    );

    // Initialize state
    curveAavePooler = CurveAavePooler(curveAavePooler_);
    curveAaveGauge = LiquidityGauge(curveAaveGauge_);
    assetToken = Ultra3CRV(assetToken_);
    daiToken = CurveAavePooler(curveAavePooler_).daiToken();
    usdcToken = CurveAavePooler(curveAavePooler_).usdcToken();
    usdtToken = CurveAavePooler(curveAavePooler_).usdtToken();
    curveAaveLpToken = CurveAavePooler(curveAavePooler_).curveAaveLpToken();
  }

  //////////////////////////////////////////////////////////////////////////////
  // External interface for staking
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Stake an amount of underlying stablecoins to the gauge and return
   * the asset token representing the staked amount
   *
   * @param stableAmounts The amounts of the underlying stablecoins to stake (0 = DAI, 1 = USDC, 2 = USDT)
   * @param recipient The recipient of the asset tokens
   *
   * @return assetTokenAmount The amount of gauge shares minted and returned
   * to the recipient
   */
  function stakeTokens(
    uint256[3] memory stableAmounts,
    address recipient
  ) public nonReentrant returns (uint256 assetTokenAmount) {
    // Validate parameters
    require(
      stableAmounts[0] > 0 || stableAmounts[1] > 0 || stableAmounts[2] > 0,
      "Requires nonzero amount"
    );
    require(recipient != address(0), "Invalid recipient");

    // Call external contracts
    if (stableAmounts[0] > 0) {
      daiToken.safeTransferFrom(_msgSender(), address(this), stableAmounts[0]);
      daiToken.safeIncreaseAllowance(
        address(curveAavePooler),
        stableAmounts[0]
      );
    }
    if (stableAmounts[1] > 0) {
      usdcToken.safeTransferFrom(_msgSender(), address(this), stableAmounts[1]);
      usdcToken.safeIncreaseAllowance(
        address(curveAavePooler),
        stableAmounts[1]
      );
    }
    if (stableAmounts[2] > 0) {
      usdtToken.safeTransferFrom(_msgSender(), address(this), stableAmounts[2]);
      usdtToken.safeIncreaseAllowance(
        address(curveAavePooler),
        stableAmounts[2]
      );
    }

    // Add liquidity to the Curve Aave pool
    uint256 lpTokensAdded = curveAavePooler.addLiquidity(
      stableAmounts,
      0,
      address(this)
    );

    // Validate external contracts
    require(lpTokensAdded > 0, "No LP tokens");

    // Mint the recipient asset tokens redeemable for the LP tokens
    // slither-disable-next-line reentrancy-benign
    assetToken.mint(recipient, lpTokensAdded);

    // Call external contracts
    curveAaveLpToken.safeIncreaseAllowance(
      address(curveAaveGauge),
      lpTokensAdded
    );
    curveAaveGauge.deposit(lpTokensAdded);

    // Dispatch event
    // slither-disable-next-line reentrancy-events
    emit GaugeStaked(_msgSender(), recipient, stableAmounts, lpTokensAdded);

    // Return the gauge token amount
    return lpTokensAdded;
  }

  /**
   * @dev Stake a single underlying stablecoin to the gauge and return the
   * gauge shares
   *
   * @param stableIndex The index of the stablecoin to stake (DAI = 0, USDC = 1, USDT = 2)
   * @param stableAmount The amount of the underlying stablecoin to stake
   *
   * @return gaugeTokenAmount The amount of gauge shares minted and returned
   */
  function stakeOneToken(
    uint256 stableIndex,
    uint256 stableAmount
  ) public nonReentrant returns (uint256 gaugeTokenAmount) {
    // Validate parameters
    require(stableIndex <= 2, "Invalid stable");
    require(stableAmount > 0, "Invalid amount");

    // Translate parameters
    uint256[3] memory stableAmounts;
    stableAmounts[stableIndex] = stableAmount;

    // Stake stablecoin to the gauge
    gaugeTokenAmount = stakeTokens(stableAmounts, _msgSender());

    // Return the gauge token amount
    return gaugeTokenAmount;
  }

  //////////////////////////////////////////////////////////////////////////////
  // External interface for unstaking
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Unstake an amount of gauge shares from the gauge and return the
   * amount as a single underlying stablecoin
   *
   * @param assetTokenAmount The amount of asset tokens being redeemed
   * @param stableIndex The index of the stablecoin to receive (0 = DAI, 1 = USDC, 2 = USDT)
   * @param recipient The recipient of the underlying stablecoin
   *
   * @return stablesUnstaked The amount of the underlying stablecoin unstaked (for rounding errors)
   * @return stablesReturned The amount of the underlying stablecoin returned to the recipient
   */
  function unstakeOneToken(
    uint256 assetTokenAmount,
    uint256 stableIndex,
    address recipient
  )
    public
    nonReentrant
    returns (uint256 stablesUnstaked, uint256 stablesReturned)
  {
    // Validate parameters
    require(stableIndex <= 2, "Invalid stable");
    require(recipient != address(0), "Invalid recipient");

    // Burn the asset tokens being redeemed for the LP tokens
    assetToken.burn(_msgSender(), assetTokenAmount);

    // Call external contracts
    curveAaveGauge.withdraw(assetTokenAmount);

    // Approve the Curve Aave pooler to spend the gauge shares
    curveAaveLpToken.safeIncreaseAllowance(
      address(curveAavePooler),
      assetTokenAmount
    );

    // Remove liquidity from the Curve Aave pool
    (uint256 stablesUnpooled, uint256 stablesUnstaked_) = curveAavePooler
      .removeLiquidityOneToken(assetTokenAmount, stableIndex, 0, address(this));

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
    emit GaugeUnstakedOneToken(
      _msgSender(),
      recipient,
      assetTokenAmount,
      stableIndex,
      stablesUnpooled,
      stablesUnstaked_,
      stablesReturned
    );

    return (stablesUnstaked_, stablesReturned);
  }

  /**
   * @dev Unstake everything as a single stablecoin in one function call
   *
   * @param stableIndex The index of the stablecoin to unstake (0 = DAI, 1 = USDC, 2 = USDT)
   *
   * @return stablesReturned The amount of stablecoins returned
   */
  function exitOneToken(
    uint256 stableIndex
  ) public returns (uint256 stablesReturned) {
    // Read state
    uint256 gaugeTokenAmount = assetToken.balanceOf(_msgSender());

    // Unstake everything
    (, stablesReturned) = unstakeOneToken(
      gaugeTokenAmount,
      stableIndex,
      _msgSender()
    );
  }
}
