/*
 * Copyright (C) 2022 Ultrachess team
 * This file is part of Ultrachess - https://github.com/Ultrachess/contracts
 *
 * SPDX-License-Identifier: Apache-2.0
 * See the file LICENSE for more information.
 */

/* eslint @typescript-eslint/no-unused-vars: "off" */
/* eslint no-empty: "off" */

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import bn from "bignumber.js"; // TODO: Move to utils
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "ethers";
import fs from "fs";
import * as hardhat from "hardhat";

chai.use(solidity);

// Contract names
const ASSET_TOKEN_CONTRACT = "Ultra3CRV";
const AUSDC_TOKEN_PROXY_CONTRACT = "AUSDCProxy";
const BASE_TOKEN_CONTRACT = "CHESS";
const CURVE_AAVE_POOLER_CONTRACT = "CurveAavePooler";
const CURVE_AAVE_STAKER_CONTRACT = "CurveAaveStaker";
const LP_SFT_CONTRACT = "LpSft";
const UNI_V3_POOLER_CONTRACT = "UniV3Pooler";
const UNI_V3_STAKER_CONTRACT = "UniV3Staker";
const UNI_V3_SWAPPER_CONTRACT = "UniV3Swapper";
const UNISWAP_V3_FACTORY_CONTRACT = "UniswapV3Factory";
const UNISWAP_V3_NFT_MANAGER_CONTRACT = "NonfungiblePositionManager";
const UNISWAP_V3_POOL_CONTRACT = "UniswapV3Pool";
const UNISWAP_V3_STAKER_CONTRACT = "UniswapV3Staker";
const USDC_TOKEN_CONTRACT = "USDC";

// Deployed contract aliases
const CURVE_AAVE_GAUGE_CONTRACT = "CurveAaveGauge";
const CURVE_AAVE_LP_TOKEN_CONTRACT = "CurveAaveLP";
const CURVE_AAVE_POOL_CONTRACT = "CurveAavePool";

// Contract ABIs
import { abi as CurveTokenV3Abi } from "../contracts/bytecode/curve/CurveTokenV3.json";
import { abi as StableSwapAaveAbi } from "../contracts/bytecode/curve/StableSwapAave.json";
import { abi as LiquidityGaugeAbi } from "../contracts/bytecode/curve-dao/LiquidityGauge.json";
import ATokenAbi from "../src/abi/contracts/depends/aave-v2/protocol/tokenization/AToken.sol/AToken.json";
import UniswapV3FactoryAbi from "../src/abi/contracts/depends/uniswap-v3-core/UniswapV3Factory.sol/UniswapV3Factory.json";
import UniswapV3PoolAbi from "../src/abi/contracts/depends/uniswap-v3-core/UniswapV3Pool.sol/UniswapV3Pool.json";
import NonfungiblePositionManagerAbi from "../src/abi/contracts/depends/uniswap-v3-periphery/NonfungiblePositionManager.sol/NonfungiblePositionManager.json";
import UniswapV3StakerAbi from "../src/abi/contracts/depends/uniswap-v3-staker/UniswapV3Staker.sol/UniswapV3Staker.json";
import BaseTokenAbi from "../src/abi/contracts/src/token/CHESS.sol/CHESS.json";
import LpSftAbi from "../src/abi/contracts/src/token/LpSft.sol/LpSft.json";
import CurveAavePoolerAbi from "../src/abi/contracts/src/token/routes/CurveAavePooler.sol/CurveAavePooler.json";
import CurveAaveStakerAbi from "../src/abi/contracts/src/token/routes/CurveAaveStaker.sol/CurveAaveStaker.json";
import UniV3PoolerAbi from "../src/abi/contracts/src/token/routes/UniV3Pooler.sol/UniV3Pooler.json";
import UniV3StakerAbi from "../src/abi/contracts/src/token/routes/UniV3Staker.sol/UniV3Staker.json";
import UniV3SwapperAbi from "../src/abi/contracts/src/token/routes/UniV3Swapper.sol/UniV3Swapper.json";
import AssetTokenAbi from "../src/abi/contracts/src/token/Ultra3CRV.sol/Ultra3CRV.json";
import UsdcTokenAbi from "../src/abi/contracts/test/token/USDC.sol/USDC.json";

//
// Constants
//
// TODO: Move to utils
//

const enum FeeAmount {
  LOW = 500, // 0.05%
  MEDIUM = 3_000, // 0.3%
  HIGH = 10_000, // 1%
}

const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
};

//
// Configuration
//
// TODO: Move to utils
//

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

//
// Address book
//

interface AddressBook {
  assetToken: string;
  baseToken: string;
  uniswapV3NftManager: string;
  uniswapV3Pool: string;
  uniV3Pooler: string;
  uniV3Staker: string;
  usdcToken: string;
}
let addressBook: AddressBook | undefined;

//
// Utility functions
//
// TODO: Move to utils
//

function loadAddresses(network: string): void {
  try {
    addressBook = JSON.parse(
      fs
        .readFileSync(`${__dirname}/../src/addresses/${network}.json`)
        .toString()
    );
  } catch (e) {}
}

function loadDeployment(network: string, contract: string): string | undefined {
  try {
    const deployment = JSON.parse(
      fs
        .readFileSync(`${__dirname}/../deployments/${network}/${contract}.json`)
        .toString()
    );
    if (deployment.address) return deployment.address;
  } catch (e) {}

  return; // undefined
}

const getContractAddress = async (
  contractSymbol: string,
  contractName: string,
  network: string
): Promise<string | undefined> => {
  // Look up address in address book
  if (addressBook && addressBook[contractSymbol])
    return addressBook[contractSymbol];

  // Look up address if the contract has a known deployment
  const deploymentAddress = loadDeployment(network, contractName);
  if (deploymentAddress) return deploymentAddress;

  // Look up address in deployments system
  const contractDeployment = await hardhat.deployments.get(contractName);
  if (contractDeployment && contractDeployment.address)
    return contractDeployment.address;

  return; // undefined
};

function getMinTick(tickSpacing: number): number {
  return Math.ceil(-887272 / tickSpacing) * tickSpacing;
}

function getMaxTick(tickSpacing: number): number {
  return Math.floor(887272 / tickSpacing) * tickSpacing;
}

function extractJSONFromURI(uri: string): {
  name: string;
  description: string;
  image: string;
} {
  const encodedJSON = uri.substr("data:application/json;base64,".length);
  const decodedJSON = Buffer.from(encodedJSON, "base64").toString("utf8");
  return JSON.parse(decodedJSON);
}

function decodeX128Int(x128Int: ethers.BigNumber): ethers.BigNumber {
  return ethers.BigNumber.from(x128Int).div(ethers.BigNumber.from(2).pow(128));
}

//
// Fixture setup
//

const setupTest = hardhat.deployments.createFixture(
  async ({ deployments, ethers }) => {
    // Ensure we start from a fresh deployment
    await deployments.fixture();

    // Get the Signers
    const [, beneficiary] = await hardhat.ethers.getSigners();

    // Get network name
    const network: string = hardhat.network.name;

    // Load contract addresses
    loadAddresses(network);
    const assetTokenAddress = await getContractAddress(
      "assetToken",
      ASSET_TOKEN_CONTRACT,
      network
    );
    const ausdcTokenProxyAddress = await getContractAddress(
      "ausdcTokenProxy",
      AUSDC_TOKEN_PROXY_CONTRACT,
      network
    );
    const baseTokenAddress = await getContractAddress(
      "baseToken",
      BASE_TOKEN_CONTRACT,
      network
    );
    const curveAaveGaugeAddress = await getContractAddress(
      "curveAaveGauge",
      CURVE_AAVE_GAUGE_CONTRACT,
      network
    );
    const curveAaveLpTokenAddress = await getContractAddress(
      "curveAaveLpToken",
      CURVE_AAVE_LP_TOKEN_CONTRACT,
      network
    );
    const curveAavePoolAddress = await getContractAddress(
      "curveAavePool",
      CURVE_AAVE_POOL_CONTRACT,
      network
    );
    const curveAavePoolerAddress = await getContractAddress(
      "curveAavePooler",
      CURVE_AAVE_POOLER_CONTRACT,
      network
    );
    const curveAaveStakerAddress = await getContractAddress(
      "curveAaveStaker",
      CURVE_AAVE_STAKER_CONTRACT,
      network
    );
    const lpSftAddress = await getContractAddress(
      "lpSft",
      LP_SFT_CONTRACT,
      network
    );
    const uniswapV3FactoryAddress = await getContractAddress(
      "uniswapV3Factory",
      UNISWAP_V3_FACTORY_CONTRACT,
      network
    );
    const uniswapV3NftManagerAddress = await getContractAddress(
      "uniswapV3NftManager",
      UNISWAP_V3_NFT_MANAGER_CONTRACT,
      network
    );
    const uniswapV3PoolAddress = await getContractAddress(
      "uniswapV3Pool",
      UNISWAP_V3_POOL_CONTRACT,
      network
    );
    const uniswapV3StakerAddress = await getContractAddress(
      "uniswapV3Staker",
      UNISWAP_V3_STAKER_CONTRACT,
      network
    );
    const uniV3PoolerAddress = await getContractAddress(
      "uniV3Pooler",
      UNI_V3_POOLER_CONTRACT,
      network
    );
    const uniV3StakerAddress = await getContractAddress(
      "uniV3Staker",
      UNI_V3_STAKER_CONTRACT,
      network
    );
    const uniV3SwapperAddress = await getContractAddress(
      "uniVSwapper",
      UNI_V3_SWAPPER_CONTRACT,
      network
    );
    const usdcTokenAddress = await getContractAddress(
      "usdcToken",
      USDC_TOKEN_CONTRACT,
      network
    );

    // Create contracts
    const assetTokenContract = new ethers.Contract(
      assetTokenAddress,
      AssetTokenAbi,
      beneficiary
    );
    const ausdcTokenProxyContract = new ethers.Contract(
      ausdcTokenProxyAddress,
      ATokenAbi,
      beneficiary
    );
    const baseTokenContract = new ethers.Contract(
      baseTokenAddress,
      BaseTokenAbi,
      beneficiary
    );
    const curveAaveGaugeContract = new ethers.Contract(
      curveAaveGaugeAddress,
      JSON.stringify(LiquidityGaugeAbi), // Work around TypeScript problem
      beneficiary
    );
    const curveAaveLpTokenContract = new ethers.Contract(
      curveAaveLpTokenAddress,
      JSON.stringify(CurveTokenV3Abi), // Work around TypeScript problem
      beneficiary
    );
    const curveAavePoolContract = new ethers.Contract(
      curveAavePoolAddress,
      JSON.stringify(StableSwapAaveAbi), // Work around TypeScript problem
      beneficiary
    );
    const curveAavePoolerContract = new ethers.Contract(
      curveAavePoolerAddress,
      CurveAavePoolerAbi,
      beneficiary
    );
    const curveAaveStakerContract = new ethers.Contract(
      curveAaveStakerAddress,
      CurveAaveStakerAbi,
      beneficiary
    );
    const lpSftContract = new ethers.Contract(
      lpSftAddress,
      LpSftAbi,
      beneficiary
    );
    const uniswapV3FactoryContract = new ethers.Contract(
      uniswapV3FactoryAddress,
      UniswapV3FactoryAbi,
      beneficiary
    );
    const uniswapV3NftManagerContract = new ethers.Contract(
      uniswapV3NftManagerAddress,
      NonfungiblePositionManagerAbi,
      beneficiary
    );
    const uniswapV3PoolContract = new ethers.Contract(
      uniswapV3PoolAddress,
      UniswapV3PoolAbi,
      beneficiary
    );
    const uniswapV3StakerContract = new ethers.Contract(
      uniswapV3StakerAddress,
      UniswapV3StakerAbi,
      beneficiary
    );
    const uniV3PoolerContract = new ethers.Contract(
      uniV3PoolerAddress,
      UniV3PoolerAbi,
      beneficiary
    );
    const uniV3StakerContract = new ethers.Contract(
      uniV3StakerAddress,
      UniV3StakerAbi,
      beneficiary
    );
    const uniV3SwapperContract = new ethers.Contract(
      uniV3SwapperAddress,
      UniV3SwapperAbi,
      beneficiary
    );
    const usdcTokenContract = new ethers.Contract(
      usdcTokenAddress,
      UsdcTokenAbi,
      beneficiary
    );

    return {
      assetTokenContract,
      ausdcTokenProxyContract,
      baseTokenContract,
      curveAaveGaugeContract,
      curveAaveLpTokenContract,
      curveAavePoolContract,
      curveAavePoolerContract,
      curveAaveStakerContract,
      lpSftContract,
      uniswapV3FactoryContract,
      uniswapV3NftManagerContract,
      uniswapV3PoolContract,
      uniswapV3StakerContract,
      uniV3PoolerContract,
      uniV3StakerContract,
      uniV3SwapperContract,
      usdcTokenContract,
    };
  }
);

//
// Test cases
//

describe("Uniswap V3 Staker", () => {
  let deployer: SignerWithAddress | undefined;
  let beneficiaryAddress: string | undefined;
  let contracts: { [name: string]: ethers.Contract } = {};
  let baseIsToken0: boolean | undefined;
  let incentiveId: string | undefined;
  let nftTokenId: number | undefined; // Set when first LP NFT is minted
  let nftTokenId2: number | undefined; // Set when second LP NFT is minted

  // Parameters for staking base token with USDC
  const REWARD_AMOUNT = ethers.utils.parseUnits("1000", 18); // 1,000 base tokens
  const REWARD_DELAY_HOURS = 12; // Duration to wait before claiming reward
  const BASE_TOKEN_AMOUNT = ethers.utils.parseUnits("1000", 18); // 1,000 base tokens
  const USDC_AMOUNT = ethers.utils.parseUnits("1000", 6); // 1,000 USDC
  const BASE_TOKENS_POOLED = ethers.BigNumber.from("999698427320457569546"); // About 1,000 base tokens
  const ASSET_TOKENS_POOLED = ethers.BigNumber.from("999719561164459961015"); // About 1,000 asset tokens
  const CURVE_AAVE_LP_AMOUNT = ASSET_TOKENS_POOLED; // About 1,000 Curve Aave LP tokens
  const CURVE_AAVE_GAUGE_SHARES = CURVE_AAVE_LP_AMOUNT; // About 1,000 Curve Aave gauge shares
  const ASSET_TOKEN_AMOUNT = CURVE_AAVE_GAUGE_SHARES; // About 1,000 asset tokens
  const UNISWAP_LP_AMOUNT = ethers.BigNumber.from("999708994186612593486"); // About 1,000 units of liquidity

  // Parameters for staking with only USDC
  const USDC_AMOUNT_2 = USDC_AMOUNT; // 1,000 USDC
  const CURVE_AAVE_LP_AMOUNT_2 = ethers.BigNumber.from("999719527862979598055"); // About 1,000 Curve Aave LP tokens
  const CURVE_AAVE_GAUGE_SHARES_2 = CURVE_AAVE_LP_AMOUNT_2; // About 1,000 Curve Aave gauge shares
  const BASE_TOKENS_BOUGHT = ethers.BigNumber.from("291925506063266129184"); // About 292 base tokens
  const ASSET_TOKENS_SPENT = ethers.BigNumber.from("416334239074713979427"); // About 416 asset tokens
  const BASE_DUST_BOUGHT = ethers.BigNumber.from("720441271635113392"); // About 0.721 base tokens
  const ASSET_DUST_SPENT = ethers.BigNumber.from("1451702247103771910"); // About 1.451 asset tokens
  const BASE_TOKEN_SHARE = ethers.BigNumber.from("291925506063266129184"); // About 292 base tokens
  const ASSET_TOKEN_SHARE = ethers.BigNumber.from("581933586541161846718"); // About 582 asset tokens
  const LIQUIDITY_AMOUNT = ethers.BigNumber.from("412166540061466109560"); // About 412 units of liquidity
  const ASSET_TOKENS_RECEIVED = ethers.BigNumber.from("411838906035571754158"); // About 412 asset tokens

  // Parameters for unstaking and claiming rewards
  const CURVE_AAVE_LP_REMOVED = ethers.BigNumber.from("1828503844261893925423"); // About 1,829 Curve Aave LP tokens
  const CURVE_AAVE_GAUGE_SHARES_UNSTAKED = CURVE_AAVE_LP_REMOVED; // About 1,829 Curve Aave gauge shares
  const BASE_TOKENS_UNPOOLED = ethers.BigNumber.from("707554880037530330300"); // About 708 base tokens
  const ASSET_TOKENS_UNPOOLED = ethers.BigNumber.from("1412495484455703549162"); // About 1,412 asset tokens
  const BASE_TOKENS_COLLECTED = BASE_TOKENS_UNPOOLED; // About 708 base tokens
  const ASSET_TOKENS_COLLECTED = ethers.BigNumber.from(
    "1416664938226322171265"
  ); // About 1,417 asset tokens
  const USDC_RETURNED = ethers.BigNumber.from("1828265236"); // About 1,828 USDC
  const BASE_TOKEN_FEES = ethers.BigNumber.from("0");
  const ASSET_TOKEN_FEES = ethers.BigNumber.from("4170");

  before(async function () {
    this.timeout(60 * 1000);

    // Get the Signers
    [deployer] = await hardhat.ethers.getSigners();

    // Get the beneficiary wallet
    const namedAccounts: {
      [name: string]: string;
    } = await hardhat.getNamedAccounts();
    beneficiaryAddress = namedAccounts.beneficiary;

    // A single fixture is used for the test suite
    contracts = await setupTest();
  });

  //////////////////////////////////////////////////////////////////////////////
  // Setup: Obtain tokens
  //////////////////////////////////////////////////////////////////////////////

  it("should obtain base token", async function () {
    this.timeout(60 * 1000);

    const { baseTokenContract } = contracts;

    // Transfer base tokens to beneficiary
    const tx: Promise<ethers.ContractTransaction> = baseTokenContract
      .connect(deployer)
      .transfer(beneficiaryAddress, BASE_TOKEN_AMOUNT);
    await (await tx).wait();

    const baseTokenBalance: ethers.BigNumber =
      await baseTokenContract.balanceOf(beneficiaryAddress);
    chai.expect(baseTokenBalance).to.equal(BASE_TOKEN_AMOUNT);
  });

  it("should obtain USDC", async function () {
    this.timeout(60 * 1000);

    const { usdcTokenContract } = contracts;

    // Mint USDC
    const tx: Promise<ethers.ContractTransaction> = usdcTokenContract.mint(
      beneficiaryAddress,
      USDC_AMOUNT.add(USDC_AMOUNT_2)
    );
    await (await tx).wait();

    const usdcBalance = await usdcTokenContract.balanceOf(beneficiaryAddress);
    chai.expect(usdcBalance).to.equal(USDC_AMOUNT.add(USDC_AMOUNT_2));
  });

  //////////////////////////////////////////////////////////////////////////////
  // Test Uniswap V3 Pool
  //////////////////////////////////////////////////////////////////////////////

  it("should read token addresses from UniV3 pool", async function () {
    this.timeout(60 * 1000);

    const { assetTokenContract, baseTokenContract, uniswapV3PoolContract } =
      contracts;

    const token0Address: string = await uniswapV3PoolContract.token0();
    const token1Address: string = await uniswapV3PoolContract.token1();

    if (
      ethers.BigNumber.from(baseTokenContract.address).lt(
        ethers.BigNumber.from(assetTokenContract.address)
      )
    ) {
      // Base token is token0
      // Asset token is token1
      console.log("    Token pair: CHESS/ultra3CRV");
      baseIsToken0 = true;
      chai.expect(token0Address).to.hexEqual(baseTokenContract.address);
      chai.expect(token1Address).to.hexEqual(assetTokenContract.address);
    } else {
      // Asset token is token0
      // Base token is token1
      console.log("    Token pair: ultra3CRV/CHESS");
      baseIsToken0 = false;
      chai.expect(token0Address).to.hexEqual(assetTokenContract.address);
      chai.expect(token1Address).to.hexEqual(baseTokenContract.address);
    }
  });

  //////////////////////////////////////////////////////////////////////////////
  // Test Uniswap V3 Staker
  //////////////////////////////////////////////////////////////////////////////

  it("should check UniswapV3Staker", async function () {
    this.timeout(60 * 1000);

    const {
      uniswapV3FactoryContract,
      uniswapV3NftManagerContract,
      uniswapV3StakerContract,
    } = contracts;

    // Test UniswapV3Staker
    const uniswapV3FactoryAddress = await uniswapV3StakerContract.factory();
    const uniswapV3NftManagerAddress =
      await uniswapV3StakerContract.nonfungiblePositionManager();
    const maxIncentiveStartLeadTime =
      await uniswapV3StakerContract.maxIncentiveStartLeadTime();
    const maxIncentiveDuration =
      await uniswapV3StakerContract.maxIncentiveDuration();

    chai
      .expect(uniswapV3FactoryAddress)
      .to.equal(uniswapV3FactoryContract.address);
    chai
      .expect(uniswapV3NftManagerAddress)
      .to.equal(uniswapV3NftManagerContract.address);
    chai.expect(maxIncentiveStartLeadTime).to.equal(0);
    chai.expect(maxIncentiveDuration).to.equal(ethers.constants.MaxUint256); // TODO: Maybe (86400 * 365)?
  });

  it("should check UniV3Staker", async function () {
    this.timeout(60 * 1000);

    const { uniswapV3StakerContract, uniV3StakerContract } = contracts;

    // Test UniV3Staker
    const uniswapV3StakerAddress = await uniV3StakerContract.uniswapV3Staker();

    chai
      .expect(uniswapV3StakerAddress)
      .to.equal(uniswapV3StakerContract.address);
  });

  it("should check the UniV3 staker incentive", async function () {
    this.timeout(60 * 1000);

    const { baseTokenContract, uniV3StakerContract, uniswapV3PoolContract } =
      contracts;

    // Read back the incentive information
    incentiveId = await uniV3StakerContract.incentiveId();
    const incetiveKey = await uniV3StakerContract.incentiveKey();
    const [rewardToken, pool, startTime, endTime, refundee] = incetiveKey;

    chai.expect(rewardToken).to.equal(baseTokenContract.address);
    chai.expect(pool).to.equal(uniswapV3PoolContract.address);
    chai.expect(refundee).to.equal(uniV3StakerContract.address);
  });

  it("should check incentive", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract } = contracts;

    const [totalRewardUnclaimed, totalSecondsClaimedX128, numberOfStakes] =
      await uniV3StakerContract.getIncentive();

    chai.expect(totalRewardUnclaimed).to.equal(REWARD_AMOUNT);
    chai.expect(totalSecondsClaimedX128).to.equal(0);
    chai.expect(numberOfStakes).to.equal(0);
  });

  //////////////////////////////////////////////////////////////////////////////
  // Test Uniswap V3 LP NFTs
  //////////////////////////////////////////////////////////////////////////////

  it("should approve UniV3 staker spending base token", async function () {
    this.timeout(60 * 1000);

    const { baseTokenContract, uniV3StakerContract } = contracts;

    const tx: Promise<ethers.ContractTransaction> = baseTokenContract.approve(
      uniV3StakerContract.address, // spender
      BASE_TOKEN_AMOUNT // amount
    );
    await chai.expect(tx).to.emit(baseTokenContract, "Approval").withArgs(
      beneficiaryAddress, // owner
      uniV3StakerContract.address, // spender
      BASE_TOKEN_AMOUNT // value
    );
  });

  it("should approve UniV3 staker spending USDC", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract, usdcTokenContract } = contracts;

    const tx: Promise<ethers.ContractTransaction> = usdcTokenContract.approve(
      uniV3StakerContract.address, // spender
      USDC_AMOUNT // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Approval").withArgs(
      beneficiaryAddress, // owner
      uniV3StakerContract.address, // spender
      USDC_AMOUNT // value
    );
  });

  it("should stake an LP NFT with base token and USDC", async function () {
    this.timeout(60 * 1000);

    const {
      assetTokenContract,
      ausdcTokenProxyContract,
      baseTokenContract,
      curveAaveGaugeContract,
      curveAaveLpTokenContract,
      curveAavePoolContract,
      curveAavePoolerContract,
      curveAaveStakerContract,
      lpSftContract,
      uniswapV3NftManagerContract,
      uniswapV3PoolContract,
      uniswapV3StakerContract,
      uniV3PoolerContract,
      uniV3StakerContract,
      usdcTokenContract,
    } = contracts;

    // Deposit tokens and stake the NFT
    const tx: Promise<ethers.ContractTransaction> =
      uniV3StakerContract.stakeNFTImbalance(
        [0, USDC_AMOUNT, 0], // stableAmounts
        BASE_TOKEN_AMOUNT, // baseTokenAmount
        beneficiaryAddress // recipient
      );

    // Get NFT token ID
    const receipt: ethers.ContractReceipt = await (await tx).wait();
    const iface: ethers.utils.Interface = new ethers.utils.Interface(
      UniV3StakerAbi
    );
    const log = receipt.logs.find((log) => {
      try {
        return iface.parseLog(log).name === "NFTStaked";
      } catch (e) {
        return false;
      }
    });
    const logDescription: ethers.utils.LogDescription = iface.parseLog(log);
    nftTokenId = logDescription.args[3].toNumber();
    console.log("    LP NFT token ID:", nftTokenId);

    //
    // Check routing events
    //

    await chai
      .expect(tx)
      .to.emit(curveAavePoolerContract, "LiquidityAdded")
      .withArgs(
        curveAaveStakerContract.address, // sender
        curveAaveStakerContract.address, // recipient
        [0, USDC_AMOUNT, 0], // stableAmounts
        CURVE_AAVE_LP_AMOUNT // lpTokenAmount
      );
    await chai
      .expect(tx)
      .to.emit(curveAaveStakerContract, "GaugeStaked")
      .withArgs(
        uniV3PoolerContract.address, // sender
        uniV3PoolerContract.address, // recipient
        [0, USDC_AMOUNT, 0], // stableAmounts
        CURVE_AAVE_GAUGE_SHARES // gaugeShares
      );
    await chai.expect(tx).to.emit(uniV3PoolerContract, "NFTMinted").withArgs(
      uniV3StakerContract.address, // sender
      uniV3StakerContract.address, // recipient
      uniswapV3NftManagerContract.address, // nftAddress
      nftTokenId, // nftTokenId
      [0, USDC_AMOUNT, 0], // stableAmounts
      BASE_TOKEN_AMOUNT, // baseTokenAmount
      BASE_TOKENS_POOLED, // baseTokenShare
      ASSET_TOKENS_POOLED, // assetTokenShare
      UNISWAP_LP_AMOUNT // liquidityAmount
    );
    await chai.expect(tx).to.emit(uniV3StakerContract, "NFTStaked").withArgs(
      beneficiaryAddress, // sender
      beneficiaryAddress, // recipient
      uniswapV3NftManagerContract.address, // nftAddress
      nftTokenId, // nftTokenId
      [0, USDC_AMOUNT, 0], // stableAmounts
      BASE_TOKEN_AMOUNT // baseTokenAmount
    );

    //
    // Check Uniswap NFT manager events
    //

    await chai
      .expect(tx)
      .to.emit(uniswapV3NftManagerContract, "IncreaseLiquidity")
      .withArgs(
        nftTokenId, // tokenId
        UNISWAP_LP_AMOUNT, // liquidity
        baseIsToken0 ? BASE_TOKENS_POOLED : ASSET_TOKENS_POOLED, // amount0
        baseIsToken0 ? ASSET_TOKENS_POOLED : BASE_TOKENS_POOLED // amount1
      );

    //
    // Check Uniswap staker events
    //

    await chai
      .expect(tx)
      .to.emit(uniswapV3StakerContract, "DepositTransferred")
      .withArgs(
        nftTokenId, // tokenId
        ethers.constants.AddressZero, // oldOwner
        uniV3StakerContract.address // newOwner
      );
    await chai
      .expect(tx)
      .to.emit(uniswapV3StakerContract, "TokenStaked")
      .withArgs(
        nftTokenId, // tokenId
        incentiveId, // incentiveId
        UNISWAP_LP_AMOUNT // liquidity
      );

    //
    // Check LP NFT path
    //

    await chai
      .expect(tx)
      .to.emit(uniswapV3NftManagerContract, "Transfer")
      .withArgs(
        ethers.constants.AddressZero, // from
        uniV3StakerContract.address, // to
        nftTokenId // tokenId
      );
    await chai
      .expect(tx)
      .to.emit(uniswapV3NftManagerContract, "Transfer")
      .withArgs(
        uniV3StakerContract.address, // from
        uniswapV3StakerContract.address, // to
        nftTokenId // tokenId
      );

    //
    // Check LP SFT path
    //

    await chai.expect(tx).to.emit(lpSftContract, "TransferSingle").withArgs(
      uniV3StakerContract.address, // operator
      ethers.constants.AddressZero, // from
      beneficiaryAddress, // to
      nftTokenId, // id
      1 // value
    );

    //
    // Check USDC path
    //

    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      beneficiaryAddress, // from
      uniV3StakerContract.address, // to
      USDC_AMOUNT // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      uniV3StakerContract.address, // from
      uniV3PoolerContract.address, // to
      USDC_AMOUNT // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      uniV3PoolerContract.address, // from
      curveAaveStakerContract.address, // to
      USDC_AMOUNT // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      curveAaveStakerContract.address, // from
      curveAavePoolerContract.address, // to
      USDC_AMOUNT // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      curveAaveStakerContract.address, // from
      curveAavePoolerContract.address, // to
      USDC_AMOUNT // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      curveAavePoolerContract.address, // from
      curveAavePoolContract.address, // to
      USDC_AMOUNT // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      curveAavePoolContract.address, // from
      ausdcTokenProxyContract.address, // to
      USDC_AMOUNT // value
    );

    //
    // Check Curve Aave LP path
    //

    await chai
      .expect(tx)
      .to.emit(curveAaveLpTokenContract, "Transfer")
      .withArgs(
        ethers.constants.AddressZero, // from
        curveAavePoolerContract.address, // to
        CURVE_AAVE_LP_AMOUNT // value
      );
    await chai
      .expect(tx)
      .to.emit(curveAaveLpTokenContract, "Transfer")
      .withArgs(
        curveAavePoolerContract.address, // from
        curveAaveStakerContract.address, // to
        CURVE_AAVE_LP_AMOUNT // value
      );
    await chai
      .expect(tx)
      .to.emit(curveAaveLpTokenContract, "Approval")
      .withArgs(
        curveAaveStakerContract.address, // owner
        curveAaveGaugeContract.address, // spender
        CURVE_AAVE_LP_AMOUNT // value
      );
    await chai
      .expect(tx)
      .to.emit(curveAaveLpTokenContract, "Transfer")
      .withArgs(
        curveAaveStakerContract.address, // from
        curveAaveGaugeContract.address, // to
        CURVE_AAVE_LP_AMOUNT // value
      );

    //
    // Check asset token path
    //

    await chai.expect(tx).to.emit(assetTokenContract, "Transfer").withArgs(
      ethers.constants.AddressZero, // from
      uniV3PoolerContract.address, // to
      ASSET_TOKEN_AMOUNT // value
    );
    await chai.expect(tx).to.emit(assetTokenContract, "Transfer").withArgs(
      uniV3PoolerContract.address, // from
      uniswapV3PoolContract.address, // to
      ASSET_TOKEN_AMOUNT // value
    );

    //
    // Check base token path
    //

    await chai.expect(tx).to.emit(baseTokenContract, "Transfer").withArgs(
      beneficiaryAddress, // from
      uniV3StakerContract.address, // to
      BASE_TOKEN_AMOUNT // value
    );
    await chai.expect(tx).to.emit(baseTokenContract, "Transfer").withArgs(
      uniV3StakerContract.address, // from
      uniV3PoolerContract.address, // to
      BASE_TOKEN_AMOUNT // value
    );
    await chai.expect(tx).to.emit(baseTokenContract, "Transfer").withArgs(
      uniV3PoolerContract.address, // from
      uniswapV3PoolContract.address, // to
      BASE_TOKENS_POOLED // value
    );
  });

  it("should check total LP NFT balance", async function () {
    this.timeout(60 * 1000);

    const { uniswapV3NftManagerContract, uniswapV3StakerContract } = contracts;

    const nftBalance = await uniswapV3NftManagerContract.balanceOf(
      uniswapV3StakerContract.address
    );
    chai.expect(nftBalance.toNumber()).to.equal(1);
  });

  it("should check LP NFT position after minting", async function () {
    this.timeout(60 * 1000);

    const {
      assetTokenContract,
      baseTokenContract,
      uniswapV3NftManagerContract,
    } = contracts;

    const position = await uniswapV3NftManagerContract.positions(nftTokenId);
    const [
      nonce,
      operator,
      token0,
      token1,
      fee,
      tickLower,
      tickUpper,
      liquidity,
      feeGrowthInside0LastX128,
      feeGrowthInside1LastX128,
      tokensOwed0,
      tokensOwed1,
    ] = position;

    chai.expect(nonce).to.eq(0);
    chai.expect(operator).to.eq(ethers.constants.AddressZero); // TODO: Why is this address(0)?
    if (baseIsToken0) {
      chai.expect(token0).to.eq(baseTokenContract.address);
      chai.expect(token1).to.eq(assetTokenContract.address);
    } else {
      chai.expect(token0).to.eq(assetTokenContract.address);
      chai.expect(token1).to.eq(baseTokenContract.address);
    }
    chai.expect(fee).to.eq(FeeAmount.HIGH);
    chai.expect(tickLower).to.eq(getMinTick(TICK_SPACINGS[FeeAmount.HIGH]));
    chai.expect(tickUpper).to.eq(getMaxTick(TICK_SPACINGS[FeeAmount.HIGH]));
    chai.expect(liquidity).to.eq(UNISWAP_LP_AMOUNT);
    chai.expect(feeGrowthInside0LastX128).to.be.gt(0);
    chai.expect(feeGrowthInside1LastX128).to.eq(0);
    chai.expect(tokensOwed0).to.eq(0);
    chai.expect(tokensOwed1).to.eq(0);
  });

  it("should check LP NFT URI", async function () {
    this.timeout(60 * 1000);

    const { uniswapV3NftManagerContract } = contracts;

    const nftTokenUri = await uniswapV3NftManagerContract.tokenURI(nftTokenId);

    // Check that data URI has correct mime type
    chai.expect(nftTokenUri).to.match(/data:application\/json;base64,.+/);

    // Content should be valid JSON and structure
    const nftContent = extractJSONFromURI(nftTokenUri);
    chai.expect(nftContent).to.haveOwnProperty("name").is.a("string");
    chai.expect(nftContent).to.haveOwnProperty("description").is.a("string");
    chai.expect(nftContent).to.haveOwnProperty("image").is.a("string");
  });

  it("should check LP SFT URI", async function () {
    this.timeout(60 * 1000);

    const { lpSftContract } = contracts;

    const sftTokenUri = await lpSftContract.uri(nftTokenId);

    // Check that data URI has correct mime type
    chai.expect(sftTokenUri).to.match(/data:application\/json;base64,.+/);

    // Content should be valid JSON and structure
    const sftContent = extractJSONFromURI(sftTokenUri);
    chai.expect(sftContent).to.haveOwnProperty("name").is.a("string");
    chai.expect(sftContent).to.haveOwnProperty("description").is.a("string");
    chai.expect(sftContent).to.haveOwnProperty("image").is.a("string");

    console.log(`    LP SFT token name: ${sftContent.name}`);
    // console.log(`    LP SFT token image: ${content.image}`);
  });

  it("should check incentive", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract } = contracts;

    const [totalRewardUnclaimed, totalSecondsClaimedX128, numberOfStakes] =
      await uniV3StakerContract.getIncentive();

    chai.expect(totalRewardUnclaimed).to.equal(REWARD_AMOUNT);
    chai.expect(totalSecondsClaimedX128).to.equal(0);
    chai.expect(numberOfStakes).to.equal(1);
  });

  it("should check stake", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract } = contracts;

    const [secondsPerLiquidityInsideInitialX128, liquidity] =
      await uniV3StakerContract.getStake(nftTokenId);

    chai.expect(secondsPerLiquidityInsideInitialX128).to.be.gt(0);
    chai.expect(liquidity).to.equal(UNISWAP_LP_AMOUNT);
  });

  it("should check deposit", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract } = contracts;

    const [owner, numberOfStakes, tickLower, tickUpper] =
      await uniV3StakerContract.getDeposit(nftTokenId);

    chai.expect(owner).to.equal(beneficiaryAddress);
    chai.expect(numberOfStakes).to.equal(1);
    chai.expect(tickLower).to.equal(getMinTick(TICK_SPACINGS[FeeAmount.HIGH]));
    chai.expect(tickUpper).to.equal(getMaxTick(TICK_SPACINGS[FeeAmount.HIGH]));
  });

  it("should check rewards", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract } = contracts;

    // TODO
    const rewardsOwed = await uniV3StakerContract.getRewardsOwed(
      beneficiaryAddress
    );

    chai.expect(rewardsOwed).to.equal(0);
  });

  it("should check reward info for LP NFT", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract } = contracts;

    const [reward, secondsInsideX128] =
      await uniV3StakerContract.callStatic.getRewardInfo(nftTokenId);

    chai.expect(reward).to.equal(0);
    chai.expect(secondsInsideX128).to.equal(0);
  });

  it(`should advance time ${REWARD_DELAY_HOURS} hours`, async function () {
    this.timeout(60 * 1000);

    // Add 12 hours and mine the next block
    await hardhat.network.provider.send("evm_increaseTime", [
      REWARD_DELAY_HOURS * 60 * 60,
    ]);
    await hardhat.network.provider.send("evm_mine");
  });

  it("should check reward info for LP NFT", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract } = contracts;

    const [reward, secondsInsideX128] =
      await uniV3StakerContract.callStatic.getRewardInfo(nftTokenId);

    const secondsInside: number = decodeX128Int(secondsInsideX128).toNumber();

    chai.expect(reward).to.not.equal(0);
    chai
      .expect(secondsInside)
      .to.be.at.least((REWARD_DELAY_HOURS * 60 - 1) * 60);
  });

  it("should approve UniV3 staker spending USDC", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract, usdcTokenContract } = contracts;

    const tx: Promise<ethers.ContractTransaction> = usdcTokenContract.approve(
      uniV3StakerContract.address, // spender
      USDC_AMOUNT // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Approval").withArgs(
      beneficiaryAddress, // owner
      uniV3StakerContract.address, // spender
      USDC_AMOUNT // value
    );
  });

  it("should stake an LP NFT with only USDC", async function () {
    this.timeout(60 * 1000);

    const {
      assetTokenContract,
      ausdcTokenProxyContract,
      baseTokenContract,
      curveAaveGaugeContract,
      curveAaveLpTokenContract,
      curveAavePoolContract,
      curveAavePoolerContract,
      curveAaveStakerContract,
      lpSftContract,
      uniswapV3NftManagerContract,
      uniswapV3PoolContract,
      uniswapV3StakerContract,
      uniV3PoolerContract,
      uniV3StakerContract,
      uniV3SwapperContract,
      usdcTokenContract,
    } = contracts;

    // Deposit tokens and stake the NFT
    const tx: Promise<ethers.ContractTransaction> =
      uniV3StakerContract.stakeNFTWithStables(
        [0, USDC_AMOUNT_2, 0], // stableAmounts
        beneficiaryAddress // recipient
      );

    // Get NFT token ID
    const receipt: ethers.ContractReceipt = await (await tx).wait();
    const iface: ethers.utils.Interface = new ethers.utils.Interface(
      UniV3StakerAbi
    );
    const log = receipt.logs.find((log) => {
      try {
        return iface.parseLog(log).name === "NFTStaked";
      } catch (e) {
        return false;
      }
    });
    const logDescription: ethers.utils.LogDescription = iface.parseLog(log);
    nftTokenId2 = logDescription.args[3].toNumber();
    console.log("    LP NFT 2 token ID:", nftTokenId2);

    //
    // Check routing events
    //

    await chai
      .expect(tx)
      .to.emit(curveAavePoolerContract, "LiquidityAdded")
      .withArgs(
        curveAaveStakerContract.address, // sender
        curveAaveStakerContract.address, // recipient
        [0, USDC_AMOUNT_2, 0], // stableAmounts
        CURVE_AAVE_LP_AMOUNT_2 // lpTokenAmount
      );
    await chai
      .expect(tx)
      .to.emit(curveAaveStakerContract, "GaugeStaked")
      .withArgs(
        uniV3PoolerContract.address, // sender
        uniV3PoolerContract.address, // recipient
        [0, USDC_AMOUNT_2, 0], // stableAmounts
        CURVE_AAVE_GAUGE_SHARES_2 // gaugeShares
      );
    await chai
      .expect(tx)
      .to.emit(uniV3SwapperContract, "TokensBought")
      .withArgs(
        uniV3PoolerContract.address, // sender
        uniV3PoolerContract.address, // recipient
        [0, 0, 0], // stableAmounts
        ASSET_TOKENS_SPENT, // assetTokenAmount
        BASE_TOKENS_BOUGHT // baseTokenReturned
      );
    await chai.expect(tx).to.emit(uniV3PoolerContract, "NFTMinted").withArgs(
      uniV3StakerContract.address, // sender
      uniV3StakerContract.address, // recipient
      uniswapV3NftManagerContract.address, // nftAddress
      nftTokenId2, // nftTokenId
      [0, USDC_AMOUNT_2, 0], // stableAmounts
      0, // baseTokenAmount
      BASE_TOKEN_SHARE, // baseTokenShare
      ASSET_TOKEN_SHARE, // assetTokenShare
      LIQUIDITY_AMOUNT // liquidityAmount
    );
    await chai.expect(tx).to.emit(uniV3StakerContract, "NFTStaked").withArgs(
      beneficiaryAddress, // sender
      beneficiaryAddress, // recipient
      uniswapV3NftManagerContract.address, // nftAddress
      nftTokenId2, // nftTokenId
      [0, USDC_AMOUNT_2, 0], // stableAmounts
      0 // baseTokenAmount
    );
    await chai
      .expect(tx)
      .to.emit(uniV3SwapperContract, "TokensBought")
      .withArgs(
        uniV3PoolerContract.address, // sender
        uniV3PoolerContract.address, // recipient
        [0, 0, 0], // stableAmounts
        ASSET_DUST_SPENT, // assetTokenAmount
        BASE_DUST_BOUGHT // baseTokenReturned
      );

    //
    // Check Uniswap NFT manager events
    //

    await chai
      .expect(tx)
      .to.emit(uniswapV3NftManagerContract, "IncreaseLiquidity")
      .withArgs(
        nftTokenId2, // tokenId
        LIQUIDITY_AMOUNT, // liquidity
        baseIsToken0 ? BASE_TOKEN_SHARE : ASSET_TOKEN_SHARE, // amount0
        baseIsToken0 ? ASSET_TOKEN_SHARE : BASE_TOKEN_SHARE // amount1
      );

    //
    // Check Uniswap staker events
    //

    await chai
      .expect(tx)
      .to.emit(uniswapV3StakerContract, "DepositTransferred")
      .withArgs(
        nftTokenId2, // tokenId
        ethers.constants.AddressZero, // oldOwner
        uniV3StakerContract.address // newOwner
      );
    await chai
      .expect(tx)
      .to.emit(uniswapV3StakerContract, "TokenStaked")
      .withArgs(
        nftTokenId2, // tokenId
        incentiveId, // incentiveId
        LIQUIDITY_AMOUNT // liquidity
      );

    //
    // Check LP NFT path
    //

    await chai
      .expect(tx)
      .to.emit(uniswapV3NftManagerContract, "Transfer")
      .withArgs(
        ethers.constants.AddressZero, // from
        uniV3StakerContract.address, // to
        nftTokenId2 // tokenId
      );
    await chai
      .expect(tx)
      .to.emit(uniswapV3NftManagerContract, "Transfer")
      .withArgs(
        uniV3StakerContract.address, // from
        uniswapV3StakerContract.address, // to
        nftTokenId2 // tokenId
      );

    //
    // Check LP SFT path
    //

    await chai.expect(tx).to.emit(lpSftContract, "TransferSingle").withArgs(
      uniV3StakerContract.address, // operator
      ethers.constants.AddressZero, // from
      beneficiaryAddress, // to
      nftTokenId2, // id
      1 // value
    );

    //
    // Check USDC path
    //

    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      beneficiaryAddress, // from
      uniV3StakerContract.address, // to
      USDC_AMOUNT_2 // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      uniV3StakerContract.address, // from
      uniV3PoolerContract.address, // to
      USDC_AMOUNT_2 // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      uniV3PoolerContract.address, // from
      curveAaveStakerContract.address, // to
      USDC_AMOUNT_2 // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      curveAaveStakerContract.address, // from
      curveAavePoolerContract.address, // to
      USDC_AMOUNT_2 // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      curveAaveStakerContract.address, // from
      curveAavePoolerContract.address, // to
      USDC_AMOUNT_2 // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      curveAavePoolerContract.address, // from
      curveAavePoolContract.address, // to
      USDC_AMOUNT_2 // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      curveAavePoolContract.address, // from
      ausdcTokenProxyContract.address, // to
      USDC_AMOUNT_2 // value
    );

    //
    // Check Curve Aave LP path
    //

    await chai
      .expect(tx)
      .to.emit(curveAaveLpTokenContract, "Transfer")
      .withArgs(
        ethers.constants.AddressZero, // from
        curveAavePoolerContract.address, // to
        CURVE_AAVE_LP_AMOUNT_2 // value
      );
    await chai
      .expect(tx)
      .to.emit(curveAaveLpTokenContract, "Transfer")
      .withArgs(
        curveAavePoolerContract.address, // from
        curveAaveStakerContract.address, // to
        CURVE_AAVE_LP_AMOUNT_2 // value
      );
    await chai
      .expect(tx)
      .to.emit(curveAaveLpTokenContract, "Approval")
      .withArgs(
        curveAaveStakerContract.address, // owner
        curveAaveGaugeContract.address, // spender
        CURVE_AAVE_LP_AMOUNT_2 // value
      );
    await chai
      .expect(tx)
      .to.emit(curveAaveLpTokenContract, "Transfer")
      .withArgs(
        curveAaveStakerContract.address, // from
        curveAaveGaugeContract.address, // to
        CURVE_AAVE_LP_AMOUNT_2 // value
      );

    //
    // Check asset token path
    //

    /*
    await chai.expect(tx).to.emit(assetTokenContract, "Transfer").withArgs(
      ethers.constants.AddressZero, // from
      uniV3PoolerContract.address, // to
      CURVE_AAVE_LP_AMOUNT_2 // value
    );
    await chai.expect(tx).to.emit(assetTokenContract, "Transfer").withArgs(
      uniV3PoolerContract.address, // from
      uniV3SwapperContract.address, // to
      ASSET_TOKEN_AMOUNT_2 // value
    );
    await chai.expect(tx).to.emit(assetTokenContract, "Transfer").withArgs(
      uniV3SwapperContract.address, // from
      uniswapV3PoolContract.address, // to
      ASSET_TOKEN_AMOUNT_2 // value
    );
    await chai.expect(tx).to.emit(assetTokenContract, "Transfer").withArgs(
      uniV3PoolerContract.address, // from
      uniswapV3PoolContract.address, // to
      ASSET_TOKEN_AMOUNT_2 // value
    );

    //
    // Check base token path
    //

    await chai.expect(tx).to.emit(baseTokenContract, "Transfer").withArgs(
      uniswapV3PoolContract.address, // from
      uniV3SwapperContract.address, // to
      BASE_TOKEN_AMOUNT_2 // value
    );
    await chai.expect(tx).to.emit(baseTokenContract, "Transfer").withArgs(
      uniV3SwapperContract.address, // from
      uniV3PoolerContract.address, // to
      BASE_TOKEN_AMOUNT_2 // value
    );
    await chai.expect(tx).to.emit(baseTokenContract, "Transfer").withArgs(
      uniV3PoolerContract.address, // from
      uniswapV3PoolContract.address, // to
      BASE_TOKEN_AMOUNT_3 // value
    );
    */
  });

  it("should check total LP NFT balance", async function () {
    this.timeout(60 * 1000);

    const { uniswapV3NftManagerContract, uniswapV3StakerContract } = contracts;

    const nftBalance = await uniswapV3NftManagerContract.balanceOf(
      uniswapV3StakerContract.address
    );
    chai.expect(nftBalance).to.equal(2);
  });

  it("should check LP NFT position after swapping", async function () {
    this.timeout(60 * 1000);

    const {
      assetTokenContract,
      baseTokenContract,
      uniswapV3NftManagerContract,
    } = contracts;

    const position = await uniswapV3NftManagerContract.positions(nftTokenId);
    const [
      nonce,
      operator,
      token0,
      token1,
      fee,
      tickLower,
      tickUpper,
      liquidity,
      feeGrowthInside0LastX128,
      feeGrowthInside1LastX128,
      tokensOwed0,
      tokensOwed1,
    ] = position;

    chai.expect(nonce).to.eq(0);
    chai.expect(operator).to.eq(ethers.constants.AddressZero); // TODO: Why is this address(0)?
    if (baseIsToken0) {
      chai.expect(token0).to.eq(baseTokenContract.address);
      chai.expect(token1).to.eq(assetTokenContract.address);
    } else {
      chai.expect(token0).to.eq(assetTokenContract.address);
      chai.expect(token1).to.eq(baseTokenContract.address);
    }
    chai.expect(fee).to.eq(FeeAmount.HIGH);
    chai.expect(tickLower).to.eq(getMinTick(TICK_SPACINGS[FeeAmount.HIGH]));
    chai.expect(tickUpper).to.eq(getMaxTick(TICK_SPACINGS[FeeAmount.HIGH]));
    chai.expect(liquidity).to.eq(UNISWAP_LP_AMOUNT);
    chai.expect(feeGrowthInside0LastX128).to.be.gt(0);
    chai.expect(feeGrowthInside1LastX128).to.eq(0);
    chai.expect(tokensOwed0).to.eq(0);
    chai.expect(tokensOwed1).to.eq(0);
  });

  it("should unstake the LP NFT and receive tokens", async function () {
    this.timeout(60 * 1000);

    const {
      assetTokenContract,
      ausdcTokenProxyContract,
      baseTokenContract,
      curveAavePoolerContract,
      curveAaveStakerContract,
      lpSftContract,
      uniswapV3NftManagerContract,
      uniswapV3PoolContract,
      uniswapV3StakerContract,
      uniV3PoolerContract,
      uniV3StakerContract,
      uniV3SwapperContract,
      usdcTokenContract,
    } = contracts;

    // Unstake the NFT and receive tokens
    const tx: Promise<ethers.ContractTransaction> =
      uniV3StakerContract.unstakeNFT(
        nftTokenId, // tokenId
        1, // USDC
        beneficiaryAddress // recipient
      );

    // Get reward amount
    const receipt: ethers.ContractReceipt = await (await tx).wait();
    const iface: ethers.utils.Interface = new ethers.utils.Interface(
      UniV3StakerAbi
    );
    const log = receipt.logs.find((log) => {
      try {
        return iface.parseLog(log).name === "NFTUnstaked";
      } catch (e) {
        return false;
      }
    });
    const logDescription: ethers.utils.LogDescription = iface.parseLog(log);
    const rewardClaimed: ethers.BigNumber = logDescription.args[4];
    console.log(
      "    Token rewards:",
      rewardClaimed.div(ethers.BigNumber.from(10).pow(18)).toNumber(),
      "tokens in",
      REWARD_DELAY_HOURS,
      "hours"
    );

    //
    // Check routing events
    //

    await chai.expect(tx).to.emit(uniV3StakerContract, "NFTUnstaked").withArgs(
      beneficiaryAddress, // sender
      beneficiaryAddress, // recipient
      uniswapV3NftManagerContract.address, // nftAddress
      nftTokenId, // nftTokenId
      rewardClaimed, // rewardClaimed
      1, // stableIndex
      USDC_RETURNED // stablesReturned
    );
    await chai.expect(tx).to.emit(uniV3PoolerContract, "NFTCollected").withArgs(
      uniV3StakerContract.address, // sender
      uniV3StakerContract.address, // recipient
      uniswapV3NftManagerContract.address, // nftAddress
      nftTokenId, // nftTokenId
      UNISWAP_LP_AMOUNT, // liquidityAmount
      BASE_TOKENS_COLLECTED, // baseTokensCollected
      ASSET_TOKENS_COLLECTED, // assetTokensCollected
      1, // stableIndex (USDC)
      USDC_RETURNED // stablesReturned
    );
    await chai
      .expect(tx)
      .to.emit(uniV3SwapperContract, "TokensSoldForAsset")
      .withArgs(
        uniV3PoolerContract.address, // sender
        uniV3PoolerContract.address, // recipient
        BASE_TOKENS_COLLECTED, // baseTokenSpent
        ASSET_TOKENS_RECEIVED // assetTokensReturned
      );
    await chai
      .expect(tx)
      .to.emit(curveAaveStakerContract, "GaugeUnstakedOneStable")
      .withArgs(
        uniV3PoolerContract.address, // sender
        uniV3PoolerContract.address, // recipient
        CURVE_AAVE_GAUGE_SHARES_UNSTAKED, // gaugeShares
        1, // stableIndex (USDC)
        USDC_RETURNED // stablesReturned
      );
    await chai
      .expect(tx)
      .to.emit(curveAavePoolerContract, "LiquidityRemovedOneStable")
      .withArgs(
        curveAaveStakerContract.address, // sender
        curveAaveStakerContract.address, // recipient
        CURVE_AAVE_LP_REMOVED, // lpTokenAmount
        1, // stableIndex (USDC)
        USDC_RETURNED // stablesReturned
      );

    //
    // Check Uniswap V3 staker events
    //

    await chai
      .expect(tx)
      .to.emit(uniswapV3StakerContract, "TokenUnstaked")
      .withArgs(
        nftTokenId, // tokenId
        incentiveId // incentiveId
      );
    await chai
      .expect(tx)
      .to.emit(uniswapV3StakerContract, "DepositTransferred")
      .withArgs(
        nftTokenId, // tokenId
        uniV3StakerContract.address, // oldOwner
        ethers.constants.AddressZero // newOwner
      );

    //
    // Check Uniswap V3 NFT manager events
    //

    await chai
      .expect(tx)
      .to.emit(uniswapV3NftManagerContract, "DecreaseLiquidity")
      .withArgs(
        nftTokenId, // tokenId
        UNISWAP_LP_AMOUNT, // liquidity
        baseIsToken0 ? BASE_TOKENS_UNPOOLED : ASSET_TOKENS_UNPOOLED, // amount0
        baseIsToken0 ? ASSET_TOKENS_UNPOOLED : BASE_TOKENS_UNPOOLED // amount1
      );
    await chai
      .expect(tx)
      .to.emit(uniswapV3NftManagerContract, "Collect")
      .withArgs(
        nftTokenId, // tokenId
        uniV3PoolerContract.address, // recipient
        baseIsToken0 ? BASE_TOKENS_COLLECTED : ASSET_TOKENS_COLLECTED, // amount0
        baseIsToken0 ? ASSET_TOKENS_COLLECTED : BASE_TOKENS_COLLECTED // amount1
      );

    //
    // Check Uniswap V3 pool events
    //

    await chai
      .expect(tx)
      .to.emit(uniswapV3PoolContract, "Burn")
      .withArgs(
        uniswapV3NftManagerContract.address, // owner
        getMinTick(TICK_SPACINGS[FeeAmount.HIGH]), // tickLower
        getMaxTick(TICK_SPACINGS[FeeAmount.HIGH]), // tickUpper
        UNISWAP_LP_AMOUNT, // amount
        baseIsToken0 ? BASE_TOKENS_UNPOOLED : ASSET_TOKENS_UNPOOLED, // amount0
        baseIsToken0 ? ASSET_TOKENS_UNPOOLED : BASE_TOKENS_UNPOOLED // amount1
      );

    //
    // Check LP SFT path
    //

    await chai.expect(tx).to.emit(lpSftContract, "TransferSingle").withArgs(
      uniV3StakerContract.address, // operator
      beneficiaryAddress, // from
      ethers.constants.AddressZero, // to
      nftTokenId, // tokenId
      1 // value
    );

    //
    // Check LP NFT path
    //

    await chai
      .expect(tx)
      .to.emit(uniswapV3NftManagerContract, "Transfer")
      .withArgs(
        uniswapV3StakerContract.address, // from
        uniV3PoolerContract.address, // to
        nftTokenId // tokenId
      );
    await chai
      .expect(tx)
      .to.emit(uniswapV3NftManagerContract, "Transfer")
      .withArgs(
        uniV3PoolerContract.address, // from
        uniV3StakerContract.address, // to
        nftTokenId // tokenId
      );
    await chai
      .expect(tx)
      .to.emit(uniswapV3NftManagerContract, "Transfer")
      .withArgs(
        uniV3StakerContract.address, // from
        beneficiaryAddress, // to
        nftTokenId // tokenId
      );

    //
    // Check base token path
    //

    /*
    await chai.expect(tx).to.emit(baseTokenContract, "Transfer").withArgs(
      uniswapV3StakerContract.address, // from
      uniV3StakerContract.address, // to
      rewardClaimed // value
    );
    await chai.expect(tx).to.emit(baseTokenContract, "Transfer").withArgs(
      uniswapV3PoolContract.address, // from
      uniV3PoolerContract.address, // to
      BASE_TOKENS_RETURNED // value
    );
    await chai.expect(tx).to.emit(baseTokenContract, "Transfer").withArgs(
      uniV3PoolerContract.address, // from
      uniV3StakerContract.address, // to
      BASE_TOKENS_RETURNED // value
    );
    await chai.expect(tx).to.emit(baseTokenContract, "Transfer").withArgs(
      uniV3StakerContract.address, // from
      beneficiaryAddress, // to
      BASE_TOKENS_RETURNED.add(rewardClaimed) // value
    );

    //
    // Check asset token path
    //

    await chai.expect(tx).to.emit(assetTokenContract, "Transfer").withArgs(
      uniswapV3PoolContract.address, // from
      uniV3PoolerContract.address, // to
      ASSET_TOKENS_RETURNED // value
    );
    await chai.expect(tx).to.emit(assetTokenContract, "Transfer").withArgs(
      uniV3PoolerContract.address, // from
      ethers.constants.AddressZero, // to
      ASSET_TOKENS_RETURNED // value
    );
    */

    //
    // Check USDC path
    //

    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      ausdcTokenProxyContract.address, // from
      curveAavePoolerContract.address, // to
      USDC_RETURNED // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      curveAavePoolerContract.address, // from
      curveAaveStakerContract.address, // to
      USDC_RETURNED // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      curveAaveStakerContract.address, // from
      uniV3PoolerContract.address, // to
      USDC_RETURNED // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      uniV3PoolerContract.address, // from
      uniV3StakerContract.address, // to
      USDC_RETURNED // value
    );
    await chai.expect(tx).to.emit(usdcTokenContract, "Transfer").withArgs(
      uniV3StakerContract.address, // from
      beneficiaryAddress, // to
      USDC_RETURNED // value
    );
  });

  it("should check NFT position after collecting tokens", async function () {
    this.timeout(60 * 1000);

    const {
      assetTokenContract,
      baseTokenContract,
      uniswapV3NftManagerContract,
    } = contracts;

    const position = await uniswapV3NftManagerContract.positions(nftTokenId);
    const [
      nonce,
      operator,
      token0,
      token1,
      fee,
      tickLower,
      tickUpper,
      liquidity,
      feeGrowthInside0LastX128,
      feeGrowthInside1LastX128,
      tokensOwed0,
      tokensOwed1,
    ] = position;

    chai.expect(nonce).to.eq(0);
    chai.expect(operator).to.eq(ethers.constants.AddressZero); // TODO: Why is this address(0)?
    if (baseIsToken0) {
      chai.expect(token0).to.eq(baseTokenContract.address);
      chai.expect(token1).to.eq(assetTokenContract.address);
    } else {
      chai.expect(token0).to.eq(assetTokenContract.address);
      chai.expect(token1).to.eq(baseTokenContract.address);
    }
    chai.expect(fee).to.eq(FeeAmount.HIGH);
    chai.expect(tickLower).to.eq(getMinTick(TICK_SPACINGS[FeeAmount.HIGH]));
    chai.expect(tickUpper).to.eq(getMaxTick(TICK_SPACINGS[FeeAmount.HIGH]));
    chai.expect(liquidity).to.eq(0);
    chai
      .expect(decodeX128Int(feeGrowthInside0LastX128.mul(1_000_000)))
      .to.eq(baseIsToken0 ? BASE_TOKEN_FEES : ASSET_TOKEN_FEES);
    chai
      .expect(decodeX128Int(feeGrowthInside1LastX128.mul(1_000_000)))
      .to.eq(baseIsToken0 ? ASSET_TOKEN_FEES : BASE_TOKEN_FEES);
    chai.expect(tokensOwed0).to.eq(0);
    chai.expect(tokensOwed1).to.eq(0);
  });

  it("should burn the NFT", async function () {
    this.timeout(60 * 1000);

    const { uniswapV3NftManagerContract } = contracts;

    const tx: Promise<ethers.ContractTransaction> =
      uniswapV3NftManagerContract.burn(nftTokenId);
    await chai
      .expect(tx)
      .to.emit(uniswapV3NftManagerContract, "Transfer")
      .withArgs(beneficiaryAddress, ethers.constants.AddressZero, nftTokenId);
  });
});
