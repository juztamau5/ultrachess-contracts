/*
 * Copyright (C) 2022 Ultrachess team
 * This file is part of Ultrachess - https://github.com/Ultrachess/contracts
 *
 * SPDX-License-Identifier: Apache-2.0
 * See the file LICENSE for more information.
 */

pragma solidity 0.8.16;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {IERC20Minimal} from "../../../interfaces/uniswap-v3-core/IERC20Minimal.sol";
import {IUniswapV3Pool} from "../../../interfaces/uniswap-v3-core/IUniswapV3Pool.sol";
import {INonfungiblePositionManager} from "../../../interfaces/uniswap-v3-periphery/INonfungiblePositionManager.sol";
import {IUniswapV3Staker} from "../../../interfaces/uniswap-v3-staker/IUniswapV3Staker.sol";

import {LpSft} from "../LpSft.sol";

import {UniV3Pooler} from "./UniV3Pooler.sol";

/**
 * @dev Token router to liquidity to the Uniswap V3 pool in exchange for an
 * LP NFT
 */
contract UniV3Staker is Context, Ownable, ReentrancyGuard, ERC721Holder {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  //////////////////////////////////////////////////////////////////////////////
  // State
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev The Ultrachess Uniswap V3 pooler
   */
  UniV3Pooler public immutable uniV3Pooler;

  /**
   * @dev The upstream Uniswap V3 pool for the token pair
   */
  IUniswapV3Pool public immutable uniswapV3Pool;

  /**
   * @dev The upstream Uniswap V3 NFT manager
   */
  INonfungiblePositionManager public immutable uniswapV3NftManager;

  /**
   * @dev The upstream Uniswap V3 NFT staker
   */
  IUniswapV3Staker public immutable uniswapV3Staker;

  /**
   * @dev The Ultrachess LP SFT contract
   */
  LpSft public immutable lpSft;

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

  /**
   * @dev True if the incentive has been created, false otherwise
   */
  bool public incentiveCreated = false;

  /**
   * @dev The Uniswap V3 staker incentive key, calculated when the incentive is created
   */
  IUniswapV3Staker.IncentiveKey public incentiveKey;

  /**
   * @dev The Uniswap V3 staker incentive ID, calculated when the incentive is created
   */
  bytes32 public incentiveId;

  //////////////////////////////////////////////////////////////////////////////
  // Events
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Emitted when a new incentive is created
   */
  event IncentiveCreated(
    uint256 reward,
    uint256 startTime,
    uint256 endTime,
    uint256 refundee
  );

  /**
   * @dev Emitted when a Uniswap V3 LP NFT is staked
   *
   * @param sender The sender of the underlying stablecoins
   * @param recipient The address of the recipient of the LP NFT
   * @param nftAddress The address of the NFT manager contract
   * @param nftTokenId The ID of the NFT
   * @param stableAmounts The amounts of stablecoins spent on the NFT (0 = DAI, 1 = USDC, 2 = USDT)
   * @param baseTokenAmount The amount of base tokens spent on the NFT
   */
  event NFTStaked(
    address indexed sender,
    address indexed recipient,
    address nftAddress,
    uint256 nftTokenId,
    uint256[3] stableAmounts,
    uint256 baseTokenAmount
  );

  /**
   * @dev Emitted when a Uniswap V3 LP NFT is unstaked
   *
   * @param sender The sender of the NFT
   * @param nftAddress The address of the NFT manager contract
   * @param nftTokenId The ID of the NFT
   * @param rewardClaimed The amount of the base token claimed as a reward for staking the LP NFT
   * @param stableIndex The index of the stablecoin to receive (0 = DAI, 1 = USDC, 2 = USDT)
   * @param stablesCollected The amount of stablecoins collected from the NFT
   * @param stablesReturned The amount of stablecoins returned to the recipient
   * @param baseTokensReturned The amount of base tokens returned to the recipient, if any
   */
  event NFTUnstaked(
    address indexed sender,
    address indexed recipient,
    address nftAddress,
    uint256 nftTokenId,
    uint256 rewardClaimed,
    uint256 stableIndex,
    uint256 stablesCollected,
    uint256 stablesReturned,
    uint256 baseTokensReturned
  );

  // Needed to keep mint params off the stack to avoid the stack getting too deep
  struct NFTStakedParams {
    address sender;
    address recipient;
    address nftAddress;
    uint256 nftTokenId;
    uint256[3] stableAmounts;
    uint256 baseTokenAmount;
  }

  struct NFTUnstakedParams {
    address sender;
    address recipient;
    address nftAddress;
    uint256 nftTokenId;
    uint256 rewardClaimed;
    uint256 stableIndex;
    uint256 stablesCollected;
    uint256 stablesReturned;
    uint256 baseTokensReturned;
  }

  //////////////////////////////////////////////////////////////////////////////
  // Initialization
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Initializes the contract
   *
   * @param owner_ The initial owner of the contract
   * @param uniV3Pooler_ The address of our Uniswap V3 pooler contract
   * @param uniswapV3Staker_ The address of the Uniswap V3 staker contract
   * @param lpSft_ The address of the LP SFT contract
   */
  constructor(
    address owner_,
    address uniV3Pooler_,
    address uniswapV3Staker_,
    address lpSft_
  ) {
    // Validate paremeters
    require(uniV3Pooler_ != address(0), "Invalid swapper");
    require(uniswapV3Staker_ != address(0), "Invalid staker");
    require(lpSft_ != address(0), "Invalid LP SFT");

    // Validate external contracts
    require(
      address(UniV3Pooler(uniV3Pooler_).uniswapV3Pool()) != address(0),
      "Invalid univ3 pooler pool"
    );
    require(
      address(UniV3Pooler(uniV3Pooler_).uniswapV3NftManager()) != address(0),
      "Invalid univ3 pooler mgr"
    );
    require(
      address(UniV3Pooler(uniV3Pooler_).baseToken()) != address(0),
      "Invalid univ3 pooler base"
    );
    require(
      address(UniV3Pooler(uniV3Pooler_).assetToken()) != address(0),
      "Invalid univ3 pooler asset"
    );
    require(
      address(UniV3Pooler(uniV3Pooler_).daiToken()) != address(0),
      "Invalid univ3 pooler DAI"
    );
    require(
      address(UniV3Pooler(uniV3Pooler_).usdcToken()) != address(0),
      "Invalid univ3 pooler USDC"
    );
    require(
      address(UniV3Pooler(uniV3Pooler_).usdtToken()) != address(0),
      "Invalid univ3 pooler USDT"
    );

    // Initialize {Ownable}
    transferOwnership(owner_);

    // Initialize state
    uniV3Pooler = UniV3Pooler(uniV3Pooler_);
    uniswapV3Pool = UniV3Pooler(uniV3Pooler_).uniswapV3Pool();
    uniswapV3NftManager = UniV3Pooler(uniV3Pooler_).uniswapV3NftManager();
    uniswapV3Staker = IUniswapV3Staker(uniswapV3Staker_);
    lpSft = LpSft(lpSft_);
    baseIsToken0 = UniV3Pooler(uniV3Pooler_).baseIsToken0();
    baseToken = UniV3Pooler(uniV3Pooler_).baseToken();
    assetToken = UniV3Pooler(uniV3Pooler_).assetToken();
    daiToken = UniV3Pooler(uniV3Pooler_).daiToken();
    usdcToken = UniV3Pooler(uniV3Pooler_).usdcToken();
    usdtToken = UniV3Pooler(uniV3Pooler_).usdtToken();
  }

  /**
   * @dev Initializes the staker incentive
   *
   * @param reward The reward to distribute in the incentive
   *
   * TODO: Allow creating multiple incentives?
   */
  function createIncentive(uint256 reward) public onlyOwner {
    // Validate state
    require(!incentiveCreated, "Incentive already created");

    // Update state
    incentiveCreated = true;
    incentiveKey = _createIncentiveKey();
    incentiveId = keccak256(abi.encode(incentiveKey)); // See IncentiveId.sol in the Uniswap V3 staker dependency

    // Transfer the reward to this contract
    baseToken.safeTransferFrom(_msgSender(), address(this), reward);

    // Approve the Uniswap V3 staker to spend the reward
    baseToken.safeIncreaseAllowance(address(uniswapV3Staker), reward);

    // Create the incentive
    uniswapV3Staker.createIncentive(incentiveKey, reward);
  }

  //////////////////////////////////////////////////////////////////////////////
  // External interface for staking LP NFTs
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Mints and stakes a Uniswap V3 LP NFT
   *
   * @param stableAmounts The amounts of underlying stablecoins to deposit (0 = DAI, 1 = USDC, 2 = USDT)
   * @param baseTokenAmount The amount of the base token to deposit, or 0 to
   * swap half the stable amounts into the base token
   * @param recipient The recient of the LP NFT
   *
   * @return nftTokenId The ID of the minted LP NFT
   */
  function stakeNFT(
    uint256[3] memory stableAmounts,
    uint256 baseTokenAmount,
    address recipient
  ) public nonReentrant returns (uint256 nftTokenId) {
    // Validate parameters
    require(recipient != address(0), "Invalid recipient");

    // Create struct for event parameters
    NFTStakedParams memory params = NFTStakedParams({
      sender: _msgSender(),
      recipient: recipient,
      nftAddress: address(uniswapV3NftManager),
      nftTokenId: 0,
      stableAmounts: stableAmounts,
      baseTokenAmount: baseTokenAmount
    });

    // Call external contracts
    if (stableAmounts[0] > 0) {
      daiToken.safeTransferFrom(_msgSender(), address(this), stableAmounts[0]);
      daiToken.safeIncreaseAllowance(address(uniV3Pooler), stableAmounts[0]);
    }
    if (stableAmounts[1] > 0) {
      usdcToken.safeTransferFrom(_msgSender(), address(this), stableAmounts[1]);
      usdcToken.safeIncreaseAllowance(address(uniV3Pooler), stableAmounts[1]);
    }
    if (stableAmounts[2] > 0) {
      usdtToken.safeTransferFrom(_msgSender(), address(this), stableAmounts[2]);
      usdtToken.safeIncreaseAllowance(address(uniV3Pooler), stableAmounts[2]);
    }
    if (baseTokenAmount > 0) {
      baseToken.safeTransferFrom(_msgSender(), address(this), baseTokenAmount);
      baseToken.safeIncreaseAllowance(address(uniV3Pooler), baseTokenAmount);
    }

    // Mint the LP NFT
    params.nftTokenId = uniV3Pooler.mintNFT(
      stableAmounts,
      baseTokenAmount,
      address(this)
    );

    // Mint the recipient a voucher for the LP NFT. This must be held by the
    // sender when unstaking the NFT.
    // slither-disable-next-line reentrancy-events
    lpSft.mint(recipient, params.nftTokenId);

    // Send the LP NFT to the Uniswap V3 staker contract and automatically stake it
    uniswapV3NftManager.safeTransferFrom(
      address(this),
      address(uniswapV3Staker),
      params.nftTokenId,
      abi.encode(incentiveKey)
    );

    // Dispatch event
    // slither-disable-next-line reentrancy-events
    emit NFTStaked(
      params.sender,
      params.recipient,
      params.nftAddress,
      params.nftTokenId,
      params.stableAmounts,
      params.baseTokenAmount
    );

    return params.nftTokenId;
  }

  //////////////////////////////////////////////////////////////////////////////
  // External interface for unstaking LP NFTs
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Unstakes an LP NFT and returns the underlying liquidity as a stablecoin
   *
   * Instead of burning the empty NFT, it is transfered to the recipient as a
   * keepsake.
   *
   * @param nftTokenId The ID of the LP NFT
   * @param stableIndex The index of the stablecoin to receive (0 = DAI, 1 = USDC, 2 = USDT)
   * @param recipient The recipient of the stablecoin
   */
  function unstakeNFT(
    uint256 nftTokenId,
    uint256 stableIndex,
    address recipient
  ) public nonReentrant returns (uint256 stablesReturned) {
    // Validate parameters
    require(stableIndex <= 2, "Invalid stable");
    require(recipient != address(0), "Invalid recipient");

    // Validate state
    require(lpSft.balanceOf(_msgSender(), nftTokenId) == 1, "Must own voucher");

    // Burn the voucher for the LP NFT
    lpSft.burn(_msgSender(), nftTokenId);

    // Create a struct to hold event params
    NFTUnstakedParams memory params = NFTUnstakedParams({
      sender: _msgSender(),
      recipient: recipient,
      nftAddress: address(uniswapV3NftManager),
      nftTokenId: nftTokenId,
      rewardClaimed: 0,
      stableIndex: stableIndex,
      stablesCollected: 0,
      stablesReturned: 0,
      baseTokensReturned: 0
    });

    // Read state
    uint256 rewardBefore = uniswapV3Staker.rewards(
      incentiveKey.rewardToken,
      address(this)
    );

    // Unstake the LP NFT
    uniswapV3Staker.unstakeToken(incentiveKey, nftTokenId);

    // Read state
    uint256 rewardAfter = uniswapV3Staker.rewards(
      incentiveKey.rewardToken,
      address(this)
    );

    // Claim the reward
    if (rewardAfter > rewardBefore) {
      params.rewardClaimed = uniswapV3Staker.claimReward(
        incentiveKey.rewardToken,
        address(this),
        rewardAfter.sub(rewardBefore)
      );
    }

    // Withdraw the LP NFT to the pooler so that it can collect the liquidity
    uniswapV3Staker.withdrawToken(nftTokenId, address(uniV3Pooler), "");

    // Withdraw the liquidity. This returns the LP NFT to the staker.
    (params.stablesCollected, ) = uniV3Pooler.collectFromNFT(
      nftTokenId,
      stableIndex,
      address(this)
    );

    // Transfer the empty LP NFT to the recipient as a keepsake
    uniswapV3NftManager.safeTransferFrom(address(this), recipient, nftTokenId);

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

    // If any base tokens are left over, return them to the recipient
    params.baseTokensReturned = baseToken.balanceOf(address(this));
    if (params.baseTokensReturned > 0)
      baseToken.safeTransfer(recipient, params.baseTokensReturned);

    // Dispatch event
    // slither-disable-next-line reentrancy-events
    emit NFTUnstaked(
      params.sender,
      params.recipient,
      params.nftAddress,
      params.nftTokenId,
      params.rewardClaimed,
      params.stableIndex,
      params.stablesCollected,
      params.stablesReturned,
      params.baseTokensReturned
    );

    return stablesReturned;
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

    // Unstake and transfer the LP NFT
    unstakeNFT(nftTokenId, stableIndex, _msgSender());
  }

  //////////////////////////////////////////////////////////////////////////////
  // Public accessors
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Get the staking incentive
   *
   * @return totalRewardUnclaimed The amount of reward token not yet claimed by users
   * @return totalSecondsClaimedX128 Total liquidity-seconds claimed, represented as a UQ32.128
   * @return numberOfStakes The count of deposits that are currently staked for the incentive
   */
  function getIncentive()
    public
    view
    returns (
      uint256 totalRewardUnclaimed,
      uint160 totalSecondsClaimedX128,
      uint96 numberOfStakes
    )
  {
    // Validate state
    require(incentiveCreated, "Incentive not created");

    // Call external contract
    return uniswapV3Staker.incentives(incentiveId);
  }

  /**
   * @dev Get information about a deposited NFT
   *
   * @return owner_ The owner of the deposited NFT
   * @return numberOfStakes Counter of how many incentives for which the liquidity is staked
   * @return tickLower The lower tick of the range
   * @return tickUpper The upper tick of the range
   */
  function deposits(
    uint256 tokenId
  )
    public
    view
    returns (
      address owner_,
      uint48 numberOfStakes,
      int24 tickLower,
      int24 tickUpper
    )
  {
    // Call external contract
    (owner_, numberOfStakes, tickLower, tickUpper) = uniswapV3Staker.deposits(
      tokenId
    );

    // Validate result
    require(owner_ == address(this), "Invalid owner");

    // Translate result
    owner_ = lpSft.ownerOf(tokenId);

    return (owner_, numberOfStakes, tickLower, tickUpper);
  }

  /**
   * @dev Get information about a staked liquidity NFT
   *
   * @param tokenId The ID of the staked token
   *
   * @return secondsPerLiquidityInsideInitialX128 secondsPerLiquidity represented as a UQ32.128
   * @return liquidity The amount of liquidity in the NFT as of the last time the rewards were computed
   */
  function stakes(
    uint256 tokenId
  )
    public
    view
    returns (uint160 secondsPerLiquidityInsideInitialX128, uint128 liquidity)
  {
    // Validate state
    require(incentiveCreated, "Incentive not created");

    // Call external contract
    return uniswapV3Staker.stakes(tokenId, incentiveId);
  }

  /**
   * @dev Returns amounts of reward tokens owed to a given address according
   * to the last time all stakes were updated
   *
   * @param owner_ The owner for which the rewards owed are checked
   *
   * @return rewardsOwed The amount of the reward token claimable by the owner
   */
  function rewards(address owner_) public view returns (uint256 rewardsOwed) {
    // Validate state
    require(incentiveCreated, "Incentive not created");

    // Call external contract
    return uniswapV3Staker.rewards(incentiveKey.rewardToken, owner_);
  }

  //////////////////////////////////////////////////////////////////////////////
  // Public mutators
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Calculates the reward amount that will be received for the given stake
   *
   * @param tokenId The ID of the token
   *
   * @return reward The reward accrued to the NFT for the given incentive thus far
   */
  function getRewardInfo(
    uint256 tokenId
  ) public returns (uint256 reward, uint160 secondsInsideX128) {
    // Validate state
    require(incentiveCreated, "Incentive not created");

    // Call external contract
    return uniswapV3Staker.getRewardInfo(incentiveKey, tokenId);
  }

  //////////////////////////////////////////////////////////////////////////////
  // Internal functions
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Returns the incentive key for the Uniswap V3 staker
   */
  function _createIncentiveKey()
    internal
    view
    returns (IUniswapV3Staker.IncentiveKey memory)
  {
    return
      IUniswapV3Staker.IncentiveKey({
        rewardToken: IERC20Minimal(address(baseToken)),
        pool: uniswapV3Pool,
        // slither-disable-next-line timestamp
        startTime: block.timestamp,
        // slither-disable-next-line timestamp
        endTime: block.timestamp + 1 weeks, // TODO
        refundee: address(this)
      });
  }
}
