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
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "ethers";
import fs from "fs";
import * as hardhat from "hardhat";

chai.use(solidity);

// Contract names
const BASE_TOKEN_CONTRACT = "CHESS";
const LP_SFT_CONTRACT = "LpSft";
const UNI_V3_POOLER_CONTRACT = "UniV3Pooler";
const UNI_V3_STAKER_CONTRACT = "UniV3Staker";
const UNISWAP_V3_NFT_MANAGER_CONTRACT = "NonfungiblePositionManager";
const UNISWAP_V3_STAKER_CONTRACT = "UniswapV3Staker";
const USDC_TOKEN_CONTRACT = "USDC";

// Contract ABIs
import NonfungiblePositionManagerAbi from "../src/abi/contracts/depends/uniswap-v3-periphery/NonfungiblePositionManager.sol/NonfungiblePositionManager.json";
import UniswapV3StakerAbi from "../src/abi/contracts/depends/uniswap-v3-staker/UniswapV3Staker.sol/UniswapV3Staker.json";
import BaseTokenAbi from "../src/abi/contracts/src/token/CHESS.sol/CHESS.json";
import LpSftAbi from "../src/abi/contracts/src/token/LpSft.sol/LpSft.json";
import UniV3PoolerAbi from "../src/abi/contracts/src/token/routes/UniV3Pooler.sol/UniV3Pooler.json";
import UniV3StakerAbi from "../src/abi/contracts/src/token/routes/UniV3Staker.sol/UniV3Staker.json";
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
// Address book
//

interface AddressBook {
  baseToken: string;
  lpSft: string;
  uniswapV3NftManager: string;
  uniswapV3Staker: string;
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

    const baseTokenAddress = await getContractAddress(
      "baseToken",
      BASE_TOKEN_CONTRACT,
      network
    );
    const lpSftAddress = await getContractAddress(
      "lpSft",
      LP_SFT_CONTRACT,
      network
    );
    const uniswapV3NftManagerAddress = await getContractAddress(
      "uniswapV3NftManager",
      UNISWAP_V3_NFT_MANAGER_CONTRACT,
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
    const usdcTokenAddress = await getContractAddress(
      "usdcToken",
      USDC_TOKEN_CONTRACT,
      network
    );

    // Create contracts
    const baseTokenContract = new ethers.Contract(
      baseTokenAddress,
      BaseTokenAbi,
      beneficiary
    );
    const lpSftContract = new ethers.Contract(
      lpSftAddress,
      LpSftAbi,
      beneficiary
    );
    const uniswapV3NftManagerContract = new ethers.Contract(
      uniswapV3NftManagerAddress,
      NonfungiblePositionManagerAbi,
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
    const usdcTokenContract = new ethers.Contract(
      usdcTokenAddress,
      UsdcTokenAbi,
      beneficiary
    );

    return {
      baseTokenContract,
      lpSftContract,
      uniswapV3NftManagerContract,
      uniswapV3StakerContract,
      uniV3PoolerContract,
      uniV3StakerContract,
      usdcTokenContract,
    };
  }
);

//
// Test cases
//

describe("Staking rewards", () => {
  let deployer: SignerWithAddress | undefined;
  let beneficiaryAddress: string | undefined;
  let contracts: { [name: string]: ethers.Contract } = {};
  let incentiveId: string | undefined;
  let nftTokenId: ethers.BigNumber | undefined; // Set when the LP NFT is minted

  //////////////////////////////////////////////////////////////////////////////
  // Test parameters
  //////////////////////////////////////////////////////////////////////////////

  // We start with 1 USDC
  const INITIAL_USDC_BALANCE = ethers.utils.parseUnits("1", 6); // 1 USDC

  // Initial reward pool
  const INITIAL_REWARDS = ethers.utils.parseUnits("1000", 18); // 1,000 base tokens

  // Initial liquidity
  const INITIAL_LIQUIDITY = ethers.BigNumber.from("223610565589539361"); // About 0.224 units of liquidity

  // Duration to wait before claiming reward
  const REWARD_DELAY_HOURS = 12;

  //////////////////////////////////////////////////////////////////////////////
  // Mocha setup
  //////////////////////////////////////////////////////////////////////////////

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

  it("should obtain USDC", async function () {
    this.timeout(60 * 1000);

    const { usdcTokenContract } = contracts;

    // Mint USDC
    const tx: Promise<ethers.ContractTransaction> = usdcTokenContract.mint(
      beneficiaryAddress,
      INITIAL_USDC_BALANCE
    );
    await (await tx).wait();

    const usdcBalance = await usdcTokenContract.balanceOf(beneficiaryAddress);
    chai.expect(usdcBalance).to.equal(INITIAL_USDC_BALANCE);
  });

  //////////////////////////////////////////////////////////////////////////////
  // Test Uniswap V3 Staker
  //////////////////////////////////////////////////////////////////////////////

  it("should check the UniV3 staker incentive", async function () {
    this.timeout(60 * 1000);

    const { baseTokenContract, uniV3StakerContract } = contracts;

    // Read back the incentive information
    incentiveId = await uniV3StakerContract.incentiveId();
    const incetiveKey = await uniV3StakerContract.incentiveKey();
    const [rewardToken, pool, startTime, endTime, refundee] = incetiveKey;

    chai.expect(rewardToken).to.equal(baseTokenContract.address);
    chai.expect(refundee).to.equal(uniV3StakerContract.address);
  });

  //////////////////////////////////////////////////////////////////////////////
  // Test LP SFTs
  //////////////////////////////////////////////////////////////////////////////

  it("should approve UniV3 staker spending USDC", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract, usdcTokenContract } = contracts;

    const tx: Promise<ethers.ContractTransaction> = usdcTokenContract.approve(
      uniV3StakerContract.address, // spender
      INITIAL_USDC_BALANCE // value
    );

    await chai.expect(tx).to.emit(usdcTokenContract, "Approval").withArgs(
      beneficiaryAddress, // owner
      uniV3StakerContract.address, // spender
      INITIAL_USDC_BALANCE // value
    );
  });

  it("should stake an LP NFT with USDC", async function () {
    this.timeout(60 * 1000);

    const { lpSftContract, uniV3StakerContract } = contracts;

    // Deposit tokens and stake the NFT with half of the USDC
    const tx: Promise<ethers.ContractTransaction> =
      uniV3StakerContract.stakeNFTWithStables(
        [0, INITIAL_USDC_BALANCE.div(2), 0], // stableAmounts
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
    nftTokenId = logDescription.args[3];
    console.log("    LP NFT token ID:", nftTokenId.toNumber());

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
  });

  it("should check UniV3Staker incentive", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract } = contracts;

    // Check the incentive
    const incentive = await uniV3StakerContract.getIncentive();

    const [totalRewardUnclaimed, totalSecondsClaimedX128, numberOfStakes] =
      incentive;

    chai.expect(totalRewardUnclaimed).to.equal(INITIAL_REWARDS);
    chai.expect(totalSecondsClaimedX128).to.equal(0);
    chai.expect(numberOfStakes).to.equal(1);
  });

  it("should check UniV3Staker deposit", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract } = contracts;

    // Check the deposit
    const deposit = await uniV3StakerContract.getDeposit(nftTokenId);

    const [owner, numberOfStakes, tickLower, tickUpper] = deposit;

    chai.expect(owner).to.equal(beneficiaryAddress);
    chai.expect(numberOfStakes).to.equal(1);
    chai.expect(tickLower).to.equal(getMinTick(TICK_SPACINGS[FeeAmount.HIGH]));
    chai.expect(tickUpper).to.equal(getMaxTick(TICK_SPACINGS[FeeAmount.HIGH]));
  });

  it("should check UniV3Staker stake", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract } = contracts;

    // Check the stake
    const stake = await uniV3StakerContract.getStake(nftTokenId);

    const [secondsPerLiquidityCumulativeX128, liquidity] = stake;

    chai.expect(secondsPerLiquidityCumulativeX128).to.be.gt(0);
    chai.expect(liquidity).to.equal(INITIAL_LIQUIDITY);
  });

  it("should check UniV3Staker rewards", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract } = contracts;

    // Check the rewards
    const rewardsOwed = await uniV3StakerContract.getRewardsOwed(
      beneficiaryAddress
    );

    chai.expect(rewardsOwed).to.equal(0);
  });

  it("should check UniV3Staker reward info at t=0", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract } = contracts;

    // Check the rewards
    const rewardInfo = await uniV3StakerContract.callStatic.getRewardInfo(
      nftTokenId
    );

    const [reward, secondsInsideX128] = rewardInfo;

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

  it("should check UniV3Staker reward info after advanding time", async function () {
    this.timeout(60 * 1000);

    const { uniV3StakerContract } = contracts;

    const [reward, secondsInsideX128] =
      await uniV3StakerContract.callStatic.getRewardInfo(nftTokenId);

    const secondsInside: number = decodeX128Int(secondsInsideX128).toNumber();

    /* TODO
    console.log(reward.toString());
    console.log(secondsInside);
    chai.expect(reward).to.be.gt(0);
    chai
      .expect(secondsInside)
      .to.be.at.least((REWARD_DELAY_HOURS * 60 - 1) * 60);
    */
  });
});
