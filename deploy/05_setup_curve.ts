/*
 * Copyright (C) 2022 Ultrachess team
 * This file is part of Ultrachess - https://github.com/Ultrachess/contracts
 *
 * SPDX-License-Identifier: Apache-2.0
 * See the file LICENSE for more information.
 */

/* eslint @typescript-eslint/no-var-requires: "off" */

const fs = require("fs");

require("hardhat-deploy");
require("hardhat-deploy-ethers");

// TODO: Fully qualified contract names
const DAI_CONTRACT = "DAI";
const USDC_CONTRACT = "USDC";
const USDT_CONTRACT = "USDT";

// Deployed contract aliases
const CRV_CONTROLLER_CONTRACT = "CRVController";
const CRV_TOKEN_CONTRACT = "CRV";
const CURVE_AAVE_GAUGE_CONTRACT = "CurveAaveGauge";
const CURVE_AAVE_LP_TOKEN_CONTRACT = "CurveAaveLP";
const CURVE_AAVE_POOL_CONTRACT = "CurveAavePool";

// Path to generated address file
const GENERATED_ADDRESSES = `${__dirname}/../addresses.json`;

/**
 * Steps to deploy the Retro Dapp environment
 */
const func = async function (hardhat_re) {
  const { deployments, ethers, getNamedAccounts } = hardhat_re;

  const { execute, read } = deployments;
  const { deployer } = await getNamedAccounts();

  // Get chain ID
  const chainId = await hardhat_re.getChainId();

  //
  // Load contract addresses
  //
  // TODO: Load addresses from deployments folder
  //
  let generatedNetworks = {};

  try {
    generatedNetworks = JSON.parse(
      fs.readFileSync(GENERATED_ADDRESSES).toString()
    );
  } catch (err) {
    console.log(`Skipping addresses.json: ${err}`);
  }

  const generatedAddresses = generatedNetworks[chainId] || {};

  //////////////////////////////////////////////////////////////////////////////
  //
  // Set Curve Aave pool token minter
  //
  //////////////////////////////////////////////////////////////////////////////

  await execute(
    CURVE_AAVE_LP_TOKEN_CONTRACT,
    { from: deployer, log: true },
    "set_minter",
    generatedAddresses.curveAavePool
  );

  //////////////////////////////////////////////////////////////////////////////
  //
  // Setup calls for Curve DAO
  //
  //////////////////////////////////////////////////////////////////////////////

  console.log("Curve DAO setup calls");

  //
  // Set the CRV token minter
  //

  await execute(
    CRV_TOKEN_CONTRACT,
    {
      from: deployer,
      log: true,
    },
    "set_minter",
    generatedAddresses.crvMinter
  );

  //
  // Add the gauge type (i.e. "Liquidity" on mainnet, "Liquidity (Fantom)" on fantom)
  //

  await execute(
    CRV_CONTROLLER_CONTRACT,
    {
      from: deployer,
      log: true,
    },
    "add_type(string,uint256)",
    "Liquidity", // name
    0 // weight (TODO)
  );

  //
  // TODO: Add the Aave pool gauge
  //

  await execute(
    CRV_CONTROLLER_CONTRACT,
    {
      from: deployer,
      log: true,
    },
    "add_gauge(address,int128,uint256)",
    generatedAddresses.curveAaveGuage, // address
    0, // gauge type,
    0 // weight (TODO)
  );

  //////////////////////////////////////////////////////////////////////////////
  //
  // Approve Curve Aave pool spending stablecoins
  //
  //////////////////////////////////////////////////////////////////////////////

  // Initial stablecoin amounts for Aave pool
  const INITIAL_DAI = ethers.BigNumber.from("1000000000000000000000"); // 1000 DAI
  const INITIAL_USDC = ethers.BigNumber.from("1000000000"); // 1000 USDC
  const INITIAL_USDT = ethers.BigNumber.from("1000000000"); // 1000 USDT

  //
  // DAI
  //

  console.log("Approving DAI transfer");

  if (
    (await read(
      DAI_CONTRACT,
      { from: deployer, log: true },
      "allowance",
      deployer,
      generatedAddresses.curveAavePool
    )) < INITIAL_DAI
  )
    await execute(
      DAI_CONTRACT,
      {
        from: deployer,
        log: true,
      },
      "approve",
      generatedAddresses.curveAavePool,
      INITIAL_DAI
    );

  //
  // USDC
  //

  console.log("Approving USDC transfer");

  if (
    (await read(
      USDC_CONTRACT,
      { from: deployer, log: true },
      "allowance",
      deployer,
      generatedAddresses.curveAavePool
    )) < INITIAL_USDC
  )
    await execute(
      USDC_CONTRACT,
      {
        from: deployer,
        log: true,
      },
      "approve",
      generatedAddresses.curveAavePool,
      INITIAL_USDC
    );

  //
  // USDT
  //

  console.log("Approving USDT transfer");

  if (
    (await read(
      USDT_CONTRACT,
      { from: deployer, log: true },
      "allowance",
      deployer,
      generatedAddresses.curveAavePool
    )) < INITIAL_USDT
  )
    await execute(
      USDT_CONTRACT,
      {
        from: deployer,
        log: true,
      },
      "approve",
      generatedAddresses.curveAavePool,
      INITIAL_USDT
    );

  //////////////////////////////////////////////////////////////////////////////
  //
  // Seed the Curve Aave pool with some funds
  //
  //////////////////////////////////////////////////////////////////////////////

  console.log("Adding funds to Curve Aave pool");

  await execute(
    CURVE_AAVE_POOL_CONTRACT,
    {
      from: deployer,
      gasLimit: 2000000, // 2M GWei
      log: true,
    },
    "add_liquidity(uint256[3],uint256,bool)",
    [INITIAL_DAI, INITIAL_USDC, INITIAL_USDT], // amounts
    0, // min mint amount
    true // use underlying?
  );

  //////////////////////////////////////////////////////////////////////////////
  //
  // Stake the Curve Aave pool funds with the Curve Gauge
  //
  //////////////////////////////////////////////////////////////////////////////

  //
  // First check token balance
  //

  const curveAaveLpBalance = await read(
    CURVE_AAVE_LP_TOKEN_CONTRACT,
    { from: deployer, log: true },
    "balanceOf",
    deployer
  );

  if (curveAaveLpBalance.gt(0)) {
    //
    // Approve Curve gauge spending LP tokens
    //

    const curveAaveLpAllowance = await read(
      CURVE_AAVE_LP_TOKEN_CONTRACT,
      { from: deployer, log: true },
      "allowance",
      deployer,
      generatedAddresses.curveAaveGuage
    );

    if (curveAaveLpAllowance.lt(curveAaveLpBalance)) {
      console.log("Approving am3Crv spending by Curve gauge");

      await execute(
        CURVE_AAVE_LP_TOKEN_CONTRACT,
        {
          from: deployer,
          log: true,
        },
        "approve",
        generatedAddresses.curveAaveGuage,
        curveAaveLpBalance.sub(curveAaveLpAllowance)
      );
    }

    console.log("Staking funds in Curve guage");

    await execute(
      CURVE_AAVE_GAUGE_CONTRACT,
      {
        from: deployer,
        gasLimit: 2000000, // 2M GWei
        log: true,
      },
      "deposit(uint256)",
      curveAaveLpBalance
    );
  } else {
    console.log("No funds to stake in Curve Aave gauge");
  }
};

module.exports = func;
module.exports.tags = ["Deploy"];
