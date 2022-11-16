/*
 * Copyright (C) 2022 Ultrachess team
 * This file is part of Ultrachess - https://github.com/Ultrachess/contracts
 *
 * SPDX-License-Identifier: Apache-2.0
 * See the file LICENSE for more information.
 */

pragma solidity 0.8.16;

import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {IUniswapV3Pool} from "../../../interfaces/uniswap-v3-core/IUniswapV3Pool.sol";
import {INonfungiblePositionManager} from "../../../interfaces/uniswap-v3-periphery/INonfungiblePositionManager.sol";

import {CurveAaveStaker} from "./CurveAaveStaker.sol";
import {UniV3Swapper} from "./UniV3Swapper.sol";

/**
 * @dev Token router to liquidity to the Uniswap V3 pool in exchange for an
 * LP NFT
 */
contract UniV3Pooler is Context, ReentrancyGuard, ERC721Holder {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  //////////////////////////////////////////////////////////////////////////////
  // Constants
  //////////////////////////////////////////////////////////////////////////////

  uint24 public constant FEE_HIGH = 10_000; // 1%

  int24 public constant TICK_LOWER = -887200;

  int24 public constant TICK_UPPER = 887200;

  //////////////////////////////////////////////////////////////////////////////
  // State
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev The Ultrachess Curve Aave staker contract
   */
  CurveAaveStaker public immutable curveAaveStaker;

  /**
   * @dev The Ultrachess Uniswap V3 swapper
   */
  UniV3Swapper public immutable uniV3Swapper;

  /**
   * @dev The upstream Uniswap V3 pool for the token pair
   */
  IUniswapV3Pool public immutable uniswapV3Pool;

  /**
   * @dev The upstream Uniswap V3 NFT manager
   */
  INonfungiblePositionManager public immutable uniswapV3NftManager;

  /**
   * @dev If true, the base token is token0 and the asset token is token1, otherwise the reverse
   */
  bool public immutable baseIsToken0;

  /**
   * @dev The Ultrachess base token
   */
  IERC20 public immutable baseToken;

  /**
   * @dev The Ultrachess asset token
   */
  IERC20 public immutable assetToken;

  // Public token addresses
  IERC20 public immutable daiToken;
  IERC20 public immutable usdcToken;
  IERC20 public immutable usdtToken;

  //////////////////////////////////////////////////////////////////////////////
  // Events
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Emitted when a Uniswap V3 LP NFT is minted
   *
   * @param sender The sender of the underlying stablecoins
   * @param recipient The address of the recipient of the LP NFT
   * @param nftAddress The address of the NFT manager contract
   * @param nftTokenId The ID of the NFT
   * @param stableAmounts The amounts of stablecoins spent on the NFT (0 = DAI, 1 = USDC, 2 = USDT)
   * @param baseTokenAmount The amount of base tokens spent on the NFT
   * @param assetTokenAmount The amount of asset tokens spent on the NFT
   * @param liquidityAmount The amount of liquidity created
   */
  event NFTMinted(
    address indexed sender,
    address indexed recipient,
    address nftAddress,
    uint256 nftTokenId,
    uint256[3] stableAmounts,
    uint256 baseTokenAmount,
    uint256 assetTokenAmount,
    uint256 liquidityAmount
  );

  /**
   * @dev Emitted when fees are collected from a Uniswap V3 LP NFT
   *
   * @param sender The sender of the collection requiest
   * @param recipient The address of the recipient of the LP NFT
   * @param nftAddress The address of the NFT manager contract
   * @param nftTokenId The ID of the NFT
   * @param liquidityAmount The amount of liquidity in the NFT before collection
   * @param baseTokensCollected The amount of base tokens collected
   * @param assetTokensCollected The amount of asset tokens collected
   * @param stableIndex The index of the stablecoin to collect fees into (0 = DAI, 1 = USDC, 2 = USDT)
   * @param stablesReturned The amount of stablecoins returned to the recipient
   */
  event NFTCollected(
    address indexed sender,
    address indexed recipient,
    address nftAddress,
    uint256 nftTokenId,
    uint256 liquidityAmount,
    uint256 baseTokensCollected,
    uint256 assetTokensCollected,
    uint256 stableIndex,
    uint256 stablesReturned
  );

  // Needed to keep mint params off the stack to avoid the stack getting too deep
  struct NFTMintedParams {
    address sender;
    address recipient;
    address nftAddress;
    uint256 nftTokenId;
    uint256[3] stableAmounts;
    uint256 baseTokenAmount;
    uint256 assetTokenAmount;
    uint256 liquidityAmount;
  }

  struct NFTCollectedParams {
    address sender;
    address recipient;
    address nftAddress;
    uint256 nftTokenId;
    uint256 liquidityAmount;
    uint256 baseTokensCollected;
    uint256 assetTokensCollected;
    uint256 stableIndex;
    uint256 stablesReturned;
  }

  /**
   * @dev Emitted when a Uniswap V3 LP NFT is burned
   *
   * Note: All fees much be collected first. Uniswap V3 will fail to burn the
   * NFT otherwise.
   *
   * @param sender The sender of the NFT
   * @param nftTokenId The ID of the NFT
   */
  event NFTBurned(address indexed sender, uint256 nftTokenId);

  //////////////////////////////////////////////////////////////////////////////
  // Initialization
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Initializes the contract
   *
   * @param uniV3Swapper_ The address of our Uniswap V3 swapper contract
   * @param uniswapV3NftManager_ The address of the Uniswap V3 NFT manager
   */
  constructor(address uniV3Swapper_, address uniswapV3NftManager_) {
    // Validate paremeters
    require(uniV3Swapper_ != address(0), "Invalid swapper");
    require(uniswapV3NftManager_ != address(0), "Invalid NFT manager");

    // Validate external contracts
    require(
      address(UniV3Swapper(uniV3Swapper_).curveAaveStaker()) != address(0),
      "Invalid univ3 swapper staker"
    );
    require(
      address(UniV3Swapper(uniV3Swapper_).uniswapV3Pool()) != address(0),
      "Invalid univ3 swapper pool"
    );
    require(
      address(UniV3Swapper(uniV3Swapper_).baseToken()) != address(0),
      "Invalid univ3 swapper base"
    );
    require(
      address(UniV3Swapper(uniV3Swapper_).assetToken()) != address(0),
      "Invalid univ3 swapper asset"
    );
    require(
      address(UniV3Swapper(uniV3Swapper_).daiToken()) != address(0),
      "Invalid univ3 swapper DAI"
    );
    require(
      address(UniV3Swapper(uniV3Swapper_).usdcToken()) != address(0),
      "Invalid univ3 swapper USDC"
    );
    require(
      address(UniV3Swapper(uniV3Swapper_).usdtToken()) != address(0),
      "Invalid univ3 swapper USDT"
    );

    // Initialize state
    curveAaveStaker = UniV3Swapper(uniV3Swapper_).curveAaveStaker();
    uniV3Swapper = UniV3Swapper(uniV3Swapper_);
    uniswapV3Pool = UniV3Swapper(uniV3Swapper_).uniswapV3Pool();
    uniswapV3NftManager = INonfungiblePositionManager(uniswapV3NftManager_);
    baseIsToken0 = UniV3Swapper(uniV3Swapper_).baseIsToken0();
    baseToken = UniV3Swapper(uniV3Swapper_).baseToken();
    assetToken = IERC20(UniV3Swapper(uniV3Swapper_).assetToken());
    daiToken = UniV3Swapper(uniV3Swapper_).daiToken();
    usdcToken = UniV3Swapper(uniV3Swapper_).usdcToken();
    usdtToken = UniV3Swapper(uniV3Swapper_).usdtToken();
  }

  //////////////////////////////////////////////////////////////////////////////
  // External interface for adding liquidity
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Mints a Uniswap V3 LP NFT and deposits liquidity into the pool
   *
   * @param stableAmounts The amounts of underlying stablecoins to deposit (0 = DAI, 1 = USDC, 2 = USDT)
   * @param baseTokenAmount The amount of the base token to deposit, or 0 to
   * swap half the stable amounts into the base token
   * @param recipient The recient of the LP NFT
   *
   * @return nftTokenId The ID of the minted NFT
   */
  function mintNFT(
    uint256[3] memory stableAmounts,
    uint256 baseTokenAmount,
    address recipient
  ) public nonReentrant returns (uint256 nftTokenId) {
    // Validate parameters
    require(recipient != address(0), "Invalid recipient");

    // Create struct for event parameters
    NFTMintedParams memory mintParams = NFTMintedParams({
      sender: _msgSender(),
      recipient: recipient,
      nftAddress: address(uniswapV3NftManager),
      nftTokenId: 0,
      stableAmounts: stableAmounts,
      baseTokenAmount: baseTokenAmount,
      assetTokenAmount: 0,
      liquidityAmount: 0
    });

    // Call external contracts
    if (stableAmounts[0] > 0) {
      daiToken.safeTransferFrom(_msgSender(), address(this), stableAmounts[0]);
      daiToken.safeIncreaseAllowance(
        address(curveAaveStaker),
        stableAmounts[0]
      );
    }
    if (stableAmounts[1] > 0) {
      usdcToken.safeTransferFrom(_msgSender(), address(this), stableAmounts[1]);
      usdcToken.safeIncreaseAllowance(
        address(curveAaveStaker),
        stableAmounts[1]
      );
    }
    if (stableAmounts[2] > 0) {
      usdtToken.safeTransferFrom(_msgSender(), address(this), stableAmounts[2]);
      usdtToken.safeIncreaseAllowance(
        address(curveAaveStaker),
        stableAmounts[2]
      );
    }
    if (baseTokenAmount > 0) {
      baseToken.safeTransferFrom(_msgSender(), address(this), baseTokenAmount);
      baseToken.safeIncreaseAllowance(address(uniV3Swapper), baseTokenAmount);
    }

    // Stake the stablecoins into the Curve Aave pool
    uint256 assetTokenAmount = curveAaveStaker.stakeTokens(
      stableAmounts,
      address(this)
    );

    // If no base token was provided, swap half the asset tokens into base tokens
    if (baseTokenAmount == 0) {
      // Approve the swapper to spend the asset tokens
      assetToken.safeIncreaseAllowance(
        address(uniV3Swapper),
        assetTokenAmount.div(2)
      );

      baseTokenAmount = uniV3Swapper.buyTokens(
        [uint256(0), uint256(0), uint256(0)],
        assetTokenAmount.div(2),
        address(this)
      );
    }

    // TODO: If no stablecoins were provided, swap half the base tokens into the asset token

    // Read state
    uint256 assetTokenBalance = assetToken.balanceOf(address(this));

    // Approve the NFT manager to spend the base and asset tokens
    baseToken.safeIncreaseAllowance(
      address(uniswapV3NftManager),
      baseTokenAmount
    );
    assetToken.safeIncreaseAllowance(
      address(uniswapV3NftManager),
      assetTokenBalance
    );

    // Mint the LP NFT
    uint256 amount0;
    uint256 amount1;
    (
      mintParams.nftTokenId,
      mintParams.liquidityAmount,
      amount0,
      amount1
    ) = uniswapV3NftManager.mint(
      INonfungiblePositionManager.MintParams({
        token0: baseIsToken0 ? address(baseToken) : address(assetToken),
        token1: baseIsToken0 ? address(assetToken) : address(baseToken),
        fee: FEE_HIGH,
        tickLower: TICK_LOWER,
        tickUpper: TICK_UPPER,
        amount0Desired: baseIsToken0 ? baseTokenAmount : assetTokenBalance,
        amount1Desired: baseIsToken0 ? assetTokenBalance : baseTokenAmount,
        amount0Min: 0,
        amount1Min: 0,
        recipient: recipient,
        // slither-disable-next-line timestamp
        deadline: block.timestamp
      })
    );

    // Calculate results
    mintParams.baseTokenAmount = baseIsToken0 ? amount0 : amount1;
    mintParams.assetTokenAmount = baseIsToken0 ? amount1 : amount0;

    // Dispatch event
    // slither-disable-next-line reentrancy-events
    emit NFTMinted(
      mintParams.sender,
      mintParams.recipient,
      mintParams.nftAddress,
      mintParams.nftTokenId,
      mintParams.stableAmounts,
      mintParams.baseTokenAmount,
      mintParams.assetTokenAmount,
      mintParams.liquidityAmount
    );

    return mintParams.nftTokenId;
  }

  /**
   * @dev Mints an LP NFT and deposits liquidity into the pool using a single
   * stablecoin
   *
   * @param stableIndex The index of the stablecoin to use (0 = DAI, 1 = USDC, 2 = USDT)
   * @param stableAmount The amount of the stablecoin to use
   */
  function mintNFTOneToken(
    uint256 stableIndex,
    uint256 stableAmount
  ) public nonReentrant returns (uint256 nftTokenId) {
    // Validate parameters
    require(stableIndex < 3, "Invalid stable");
    require(stableAmount > 0, "Invalid amount");

    // Create stablecoin amounts array
    uint256[3] memory stableAmounts;
    stableAmounts[stableIndex] = stableAmount;

    // Mint the NFT
    nftTokenId = mintNFT(stableAmounts, 0, _msgSender());

    return nftTokenId;
  }

  //////////////////////////////////////////////////////////////////////////////
  // External interface for removing liquidity
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Collects the fees from an LP NFT and returns the underlying
   * stablecoins and LP NFT to the recipient
   *
   * @param nftTokenId The ID of the LP NFT
   * @param stableIndex The index of the stablecoin to receive (0 = DAI, 1 = USDC, 2 = USDT)
   * @param recipient The recipient of the fees and the LP NFT
   *
   * @return stablesReturned The amount of stablecoins returned to the recipient
   * @return baseTokensReturned The amount of base tokens returned to the recipient (TODO: Swap these for stables)
   */
  function collectFromNFT(
    uint256 nftTokenId,
    uint256 stableIndex,
    address recipient
  )
    public
    nonReentrant
    returns (uint256 stablesReturned, uint256 baseTokensReturned)
  {
    // Validate parameters
    require(stableIndex <= 2, "Invalid stable");
    require(recipient != address(0), "Invalid recipient");

    // Create a struct to hold event params
    NFTCollectedParams memory params = NFTCollectedParams({
      sender: _msgSender(),
      recipient: recipient,
      nftAddress: address(uniswapV3NftManager),
      nftTokenId: nftTokenId,
      liquidityAmount: 0,
      baseTokensCollected: 0,
      assetTokensCollected: 0,
      stableIndex: stableIndex,
      stablesReturned: 0
    });

    // Read state
    (, , , , , , , uint128 liquidityAmount, , , , ) = uniswapV3NftManager
      .positions(nftTokenId);

    // Update params
    params.liquidityAmount = SafeCast.toUint256(
      SafeCast.toInt256(liquidityAmount)
    );

    // Withdraw tokens from the pool
    // slither-disable-next-line unused-return
    uniswapV3NftManager.decreaseLiquidity(
      INonfungiblePositionManager.DecreaseLiquidityParams({
        tokenId: nftTokenId,
        liquidity: liquidityAmount,
        amount0Min: 0,
        amount1Min: 0,
        deadline: block.timestamp
      })
    );

    // Collect the fees
    // slither-disable-next-line unused-return
    uniswapV3NftManager.collect(
      INonfungiblePositionManager.CollectParams({
        tokenId: nftTokenId,
        recipient: address(this),
        amount0Max: type(uint128).max,
        amount1Max: type(uint128).max
      })
    );

    // Read state
    params.baseTokensCollected = baseToken.balanceOf(address(this));
    params.assetTokensCollected = assetToken.balanceOf(address(this));

    // Swap the base token for the asset token
    if (params.baseTokensCollected > 0) {
      baseToken.safeIncreaseAllowance(
        address(uniV3Swapper),
        params.baseTokensCollected
      );

      // slither-disable-next-line unused-return
      uniV3Swapper.sellOneToken(
        params.baseTokensCollected,
        stableIndex,
        address(this)
      );
    }

    // Sell the asset token for stables
    if (params.assetTokensCollected > 0) {
      // Approve the swapper to spend the base and asset tokens
      assetToken.safeIncreaseAllowance(
        address(curveAaveStaker),
        params.assetTokensCollected
      );

      // Unstake the asset token for stables
      // slither-disable-next-line unused-return
      curveAaveStaker.unstakeOneToken(
        params.assetTokensCollected,
        stableIndex,
        address(this)
      );
    }

    // Call external contracts
    if (stableIndex == 0) {
      params.stablesReturned = daiToken.balanceOf(address(this));
      if (params.stablesReturned > 0)
        daiToken.safeTransfer(recipient, params.stablesReturned);
    } else if (stableIndex == 1) {
      params.stablesReturned = usdcToken.balanceOf(address(this));
      if (params.stablesReturned > 0)
        usdcToken.safeTransfer(recipient, params.stablesReturned);
    } else if (stableIndex == 2) {
      params.stablesReturned = usdtToken.balanceOf(address(this));
      if (params.stablesReturned > 0)
        usdtToken.safeTransfer(recipient, params.stablesReturned);
    }

    // Return the LP NFT to the recipient
    uniswapV3NftManager.safeTransferFrom(address(this), recipient, nftTokenId);

    // Dispatch event
    // slither-disable-next-line reentrancy-events
    emit NFTCollected(
      params.sender,
      params.recipient,
      params.nftAddress,
      params.nftTokenId,
      params.liquidityAmount,
      params.baseTokensCollected,
      params.assetTokensCollected,
      params.stableIndex,
      params.stablesReturned
    );

    return (params.stablesReturned, params.baseTokensCollected);
  }

  /**
   * @dev Collects everything and returns the LP NFT in one transaction
   *
   * @param nftTokenId The ID of the LP NFT
   * @param stableIndex The index of the stablecoin to receive (0 = DAI, 1 = USDC, 2 = USDT)
   */
  function exitOneToken(
    uint256 nftTokenId,
    uint256 stableIndex
  ) external nonReentrant {
    // Validate parameters
    require(stableIndex <= 2, "Invalid stable");

    // Collect and transfer the NFT back to the sender
    collectFromNFT(nftTokenId, stableIndex, _msgSender());
  }
}
