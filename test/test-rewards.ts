/*
 * Copyright (C) 2022 Ultrachess team
 * This file is part of Ultrachess - https://github.com/Ultrachess/contracts
 *
 * SPDX-License-Identifier: Apache-2.0
 * See the file LICENSE for more information.
 */

/* eslint @typescript-eslint/no-unused-vars: "off" */

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "ethers";
import * as hardhat from "hardhat";

import { FEE_AMOUNT, TICK_SPACINGS } from "../src/constants";
import { uniV3StakerAbi } from "../src/contracts/dapp";
import { ContractLibrary } from "../src/interfaces";
import { decodeX128Int } from "../src/utils/fixedMath";
import { setupFixture } from "../src/utils/setupFixture";
import { getMaxTick, getMinTick } from "../src/utils/tickMath";

// Setup Mocha
chai.use(solidity);

// Setup Hardhat
const setupTest = hardhat.deployments.createFixture(setupFixture);

//
// Test cases
//

describe("Staking rewards", () => {
  let deployer: SignerWithAddress;
  let beneficiaryAddress: string;
  let contracts: ContractLibrary;
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
      uniV3StakerAbi
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
    chai.expect(tickLower).to.equal(getMinTick(TICK_SPACINGS[FEE_AMOUNT.HIGH]));
    chai.expect(tickUpper).to.equal(getMaxTick(TICK_SPACINGS[FEE_AMOUNT.HIGH]));
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
