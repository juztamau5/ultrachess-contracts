/*
 * Copyright (C) 2022 Ultrachess team
 * This file is part of Ultrachess - https://github.com/Ultrachess/contracts
 *
 * SPDX-License-Identifier: Apache-2.0
 * See the file LICENSE for more information.
 */

/* eslint @typescript-eslint/no-explicit-any: "off" */

import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "ethers";
import fs from "fs";

import { hardhat } from "./utils/hardhat";

chai.use(solidity);

// Contract ABIs
import { abi as CurveTokenV3Abi } from "../contracts/bytecode/curve/CurveTokenV3.json";
import { abi as StableSwapAaveAbi } from "../contracts/bytecode/curve/StableSwapAave.json";
import { abi as LiquidityGaugeAbi } from "../contracts/bytecode/curve-dao/LiquidityGauge.json";
import TestERC20MintableAbi from "../src/abi/contracts/test/token/utils/TestERC20Mintable.sol/TestERC20Mintable.json";

// Path to generated address file
const GENERATED_ADDRESSES = `${__dirname}/../addresses.json`;

//
// Fixture setup
//

const setupTest = hardhat.deployments.createFixture(async ({ deployments }) => {
  // Ensure we start from a fresh deployment
  await deployments.fixture();

  // Get the Signers
  const [, adminWallet] = await hardhat.ethers.getSigners();

  // Get chain ID
  const chainId: string = await hardhat.getChainId();

  //
  // Load contract addresses
  //
  // TODO: Load addresses from deployments folder
  //
  let generatedNetworks: any = {};

  try {
    generatedNetworks = JSON.parse(
      fs.readFileSync(GENERATED_ADDRESSES).toString()
    );
  } catch (err) {
    console.log(`Skipping addresses.json: ${err}`);
  }

  const generatedAddresses = generatedNetworks[chainId] || {};

  // Construct the contracts
  const daiContract = new ethers.Contract(
    generatedAddresses.daiToken,
    TestERC20MintableAbi,
    adminWallet
  );
  const usdcContract = new ethers.Contract(
    generatedAddresses.usdcToken,
    TestERC20MintableAbi,
    adminWallet
  );
  const usdtContract = new ethers.Contract(
    generatedAddresses.usdtToken,
    TestERC20MintableAbi,
    adminWallet
  );
  const curveAaveLpTokenContract = new ethers.Contract(
    generatedAddresses.curveAaveLpToken,
    CurveTokenV3Abi,
    adminWallet
  );
  const curveAavePoolContract = new ethers.Contract(
    generatedAddresses.curveAavePool,
    StableSwapAaveAbi,
    adminWallet
  );
  const curveAaveGaugeContract = new ethers.Contract(
    generatedAddresses.curveAaveGuage,
    LiquidityGaugeAbi,
    adminWallet
  );

  return {
    daiContract,
    usdcContract,
    usdtContract,
    curveAaveLpTokenContract,
    curveAavePoolContract,
    curveAaveGaugeContract,
  };
});

describe("Curve Aave pool", function () {
  let adminWalletAddress: string;
  let contracts: any;

  // Test parameters
  const DAI_BALANCE = ethers.constants.WeiPerEther.mul(10); // 10 DAI
  const USDC_BALANCE = ethers.BigNumber.from("10000000"); // 10 USDC
  const USDT_BALANCE = ethers.BigNumber.from("10000000"); // 10 USDT
  const CURVE_AAVE_LP_BALANCE = ethers.BigNumber.from("30000000000000000000"); // 30 * 10^18
  const DAI_FINAL_BALANCE = ethers.BigNumber.from("29995349048505105051"); // About 29.995 DAI

  before(async function () {
    this.timeout(60 * 1000);

    // Get the admin wallet
    const { adminWallet } = await hardhat.getNamedAccounts();
    [adminWalletAddress] = [adminWallet];

    // A single fixture is used for the test suite
    contracts = await setupTest();
  });

  //////////////////////////////////////////////////////////////////////////////
  // Setup: Stablecoin tokens
  //////////////////////////////////////////////////////////////////////////////

  it("should get underlying tokens", async function () {
    this.timeout(60 * 1000);

    const options = {
      gasLimit: ethers.BigNumber.from("100000"), // 100K
    };

    const { daiContract, usdcContract, usdtContract, curveAavePoolContract } =
      contracts;

    // Check valid coins
    const underlyingCoins = [
      await curveAavePoolContract.underlying_coins(0, options),
      await curveAavePoolContract.underlying_coins(1, options),
      await curveAavePoolContract.underlying_coins(2, options),
    ];
    chai.expect(underlyingCoins[0]).to.equal(daiContract.address);
    chai.expect(underlyingCoins[1]).to.equal(usdcContract.address);
    chai.expect(underlyingCoins[2]).to.equal(usdtContract.address);

    // Check invalid coins
    const tx = curveAavePoolContract.underlying_coins(3, options);
    await chai.expect(tx).to.be.reverted;
  });

  it("should mint stablecoins", async function () {
    this.timeout(60 * 1000);

    const { daiContract, usdcContract, usdtContract } = contracts;

    let tx = daiContract.mint(adminWalletAddress, DAI_BALANCE);
    await chai.expect(tx).to.not.be.reverted;

    tx = usdcContract.mint(adminWalletAddress, USDC_BALANCE);
    await chai.expect(tx).to.not.be.reverted;

    tx = usdtContract.mint(adminWalletAddress, USDT_BALANCE);
    await chai.expect(tx).to.not.be.reverted;
  });

  it("should approve Curve Aave pool to transfer stablecoins", async function () {
    this.timeout(60 * 1000);

    const { daiContract, usdcContract, usdtContract, curveAavePoolContract } =
      contracts;

    let tx = daiContract.approve(
      curveAavePoolContract.address,
      DAI_BALANCE.add(300) // Add some dust for testing
    );
    await chai.expect(tx).to.not.be.reverted;

    tx = usdcContract.approve(curveAavePoolContract.address, USDC_BALANCE);
    await chai.expect(tx).to.not.be.reverted;

    tx = usdtContract.approve(curveAavePoolContract.address, USDT_BALANCE);
    await chai.expect(tx).to.not.be.reverted;
  });

  it("should check am3CRV balance before adding liquidity", async function () {
    this.timeout(60 * 1000);

    const { curveAaveLpTokenContract } = contracts;

    const balance = await curveAaveLpTokenContract.balanceOf(
      adminWalletAddress
    );
    chai.expect(balance).to.eq(0);
  });

  it("should add liquidity to Curve Aave pool", async function () {
    this.timeout(60 * 1000);

    const { curveAavePoolContract } = contracts;

    const tx = curveAavePoolContract["add_liquidity(uint256[3],uint256,bool)"](
      [DAI_BALANCE, USDC_BALANCE, USDT_BALANCE], // amounts
      0, // min mint amount
      true // use underlying?
    );
    await chai.expect(tx).to.not.be.reverted;
  });

  it("should check am3CRV balance after adding liquidity", async function () {
    this.timeout(60 * 1000);

    const { curveAaveLpTokenContract } = contracts;

    const balance = await curveAaveLpTokenContract.balanceOf(
      adminWalletAddress
    );
    chai.expect(balance).to.eq(CURVE_AAVE_LP_BALANCE);
  });

  it("should approve Curve gauge spending am3CRV tokens", async function () {
    this.timeout(60 * 1000);

    const { curveAaveLpTokenContract, curveAaveGaugeContract } = contracts;

    const tx = curveAaveLpTokenContract.approve(
      curveAaveGaugeContract.address,
      CURVE_AAVE_LP_BALANCE
    );
    await chai.expect(tx).to.not.be.reverted;
  });

  it("should stake funds in Curve guage", async function () {
    this.timeout(60 * 1000);

    const { curveAaveGaugeContract } = contracts;

    const tx = curveAaveGaugeContract["deposit(uint256)"](
      CURVE_AAVE_LP_BALANCE
    );
    await chai.expect(tx).to.not.be.reverted;
  });

  it("should check Curve Aave guage balance after staking", async function () {
    this.timeout(60 * 1000);

    const { curveAaveGaugeContract } = contracts;

    const balance = await curveAaveGaugeContract.balanceOf(adminWalletAddress);
    chai.expect(balance).to.eq(CURVE_AAVE_LP_BALANCE);
  });

  it("should check am3CRV balance after staking", async function () {
    this.timeout(60 * 1000);

    const { curveAaveLpTokenContract } = contracts;

    const balance = await curveAaveLpTokenContract.balanceOf(
      adminWalletAddress
    );
    chai.expect(balance).to.eq(0);
  });

  it("should unstake funds from Curve guage", async function () {
    this.timeout(60 * 1000);

    const { curveAaveGaugeContract } = contracts;

    const tx = curveAaveGaugeContract.withdraw(CURVE_AAVE_LP_BALANCE);
    await chai.expect(tx).to.not.be.reverted;
  });

  it("should check Curve Aave guage balance after unstaking", async function () {
    this.timeout(60 * 1000);

    const { curveAaveGaugeContract } = contracts;

    const balance = await curveAaveGaugeContract.balanceOf(adminWalletAddress);
    chai.expect(balance).to.eq(0);
  });

  it("should check am3CRV balance after unstaking", async function () {
    this.timeout(60 * 1000);

    const { curveAaveLpTokenContract } = contracts;

    const balance = await curveAaveLpTokenContract.balanceOf(
      adminWalletAddress
    );
    chai.expect(balance).to.eq(CURVE_AAVE_LP_BALANCE);
  });

  it("should remove liquidity from Curve Aave pool", async function () {
    this.timeout(60 * 1000);

    const { curveAavePoolContract } = contracts;

    // Calculate the amount received when withdrawing a single coin
    const withdrawAmount = await curveAavePoolContract.calc_withdraw_one_coin(
      CURVE_AAVE_LP_BALANCE,
      0 // DAI index
    );
    chai.expect(withdrawAmount).to.eq(DAI_FINAL_BALANCE);

    const tx = curveAavePoolContract[
      "remove_liquidity_one_coin(uint256,int128,uint256,bool)"
    ](
      CURVE_AAVE_LP_BALANCE, // (LP?) token amount
      0, // DAI index
      0, // min amount
      true // Use underlying
    );
    await chai.expect(tx).to.not.be.reverted;
  });

  it("should check am3CRV balance after removing liquidity", async function () {
    this.timeout(60 * 1000);

    const { curveAaveLpTokenContract } = contracts;

    const balance = await curveAaveLpTokenContract.balanceOf(
      adminWalletAddress
    );
    chai.expect(balance).to.eq(0);
  });

  it("should check DAI balance after removing liquidity", async function () {
    this.timeout(60 * 1000);

    const { daiContract } = contracts;

    const balance = await daiContract.balanceOf(adminWalletAddress);
    chai.expect(balance).to.eq(DAI_FINAL_BALANCE);
  });
});
