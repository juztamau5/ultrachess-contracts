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

// Artifacts for Vyper contracts
const CurveTokenV3Artifact = require("../contracts/bytecode/curve/CurveTokenV3.json");
const StableSwapAaveArtifact = require("../contracts/bytecode/curve/StableSwapAave.json");
const Erc20CrvArtifact = require("../contracts/bytecode/curve-dao/ERC20CRV.json");
const GaugeControllerArtifact = require("../contracts/bytecode/curve-dao/GaugeController.json");
const LiquidityGaugeArtifact = require("../contracts/bytecode/curve-dao/LiquidityGauge.json");
const MinterArtifact = require("../contracts/bytecode/curve-dao/Minter.json");
const VotingEscrowArtifact = require("../contracts/bytecode/curve-dao/VotingEscrow.json");

// Deployed contract aliases
const CRV_CONTROLLER_CONTRACT = "CRVController";
const CRV_MINTER_CONTRACT = "CRVMinter";
const CRV_TOKEN_CONTRACT = "CRV";
const CRV_VOTING_CONTRACT = "CRVVoting";
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

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Get chain ID
  const chainId = await hardhat_re.getChainId();

  const localhost = chainId == 31337;

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
  // Deploy Curve Aave LP token contract
  //
  //////////////////////////////////////////////////////////////////////////////

  if (!localhost && generatedAddresses.curveAaveLpToken) {
    console.log(
      `Using deployed am3CRV contract: ${generatedAddresses.curveAaveLpToken}`
    );
  } else {
    console.log("Deploying am3CRV contract");

    const curveAaveLpTokenReceipt = await deploy(CURVE_AAVE_LP_TOKEN_CONTRACT, {
      from: deployer,
      contract: CurveTokenV3Artifact,
      args: [
        "Curve.fi amDAI/amUSDC/amUSDT", // name
        "am3CRV", // symbol
        deployer, // minter (will be transfered to Curve Aave pool in setup)
        deployer, // initial token holder
      ],
      log: true,
      deterministicDeployment: true,
    });

    generatedAddresses.curveAaveLpToken = curveAaveLpTokenReceipt.address;
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Deploy Curve Aave pool contract
  //
  //////////////////////////////////////////////////////////////////////////////

  if (!localhost && generatedAddresses.curveAavePool) {
    console.log(
      `Using deployed Curve Aave pool contract: ${generatedAddresses.curveAavePool}`
    );
  } else {
    console.log("Deploying Curve Aave pool contract");

    const curveAavePoolReceipt = await deploy(CURVE_AAVE_POOL_CONTRACT, {
      from: deployer,
      contract: StableSwapAaveArtifact,
      args: [
        [
          generatedAddresses.adaiTokenProxy,
          generatedAddresses.ausdcTokenProxy,
          generatedAddresses.ausdtTokenProxy,
        ], // coins
        [
          generatedAddresses.daiToken,
          generatedAddresses.usdcToken,
          generatedAddresses.usdtToken,
        ], // underlying coins
        generatedAddresses.curveAaveLpToken, // pool token
        generatedAddresses.aavePool, // Aave lending pool
        ethers.BigNumber.from("2000"), // A
        ethers.BigNumber.from("3000000"), // fee
        ethers.BigNumber.from("5000000000"), // admin fee
        ethers.BigNumber.from("20000000000"), // offpeg fee multiplier
      ],
      log: true,
      deterministicDeployment: true,
    });

    generatedAddresses.curveAavePool = curveAavePoolReceipt.address;
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Deploy Curve DAO contracts
  //
  //////////////////////////////////////////////////////////////////////////////

  //
  // CRV token
  //

  if (!localhost && generatedAddresses.crvToken) {
    console.log(
      `Using deployed CRV token contract: ${generatedAddresses.crvToken}`
    );
  } else {
    console.log("Deploying CRV token contract");

    const crvTokenReceipt = await deploy(CRV_TOKEN_CONTRACT, {
      from: deployer,
      contract: Erc20CrvArtifact,
      args: [
        "Curve DAO Token", // name
        "CRV", // symbol
        18, // decimals
        deployer, // admin
        deployer, // initial holder
      ],
      log: true,
      deterministicDeployment: true,
    });

    generatedAddresses.crvToken = crvTokenReceipt.address;
  }

  //
  // CRV voting
  //

  if (!localhost && generatedAddresses.crvVoting) {
    console.log(
      `Using deployed CRV voting contract: ${generatedAddresses.crvVoting}`
    );
  } else {
    console.log("Deploying CRV voting contract");

    const crvVotingReceipt = await deploy(CRV_VOTING_CONTRACT, {
      from: deployer,
      contract: VotingEscrowArtifact,
      args: [
        generatedAddresses.crvToken, // token
        "Vote-escrowed CRV", // name
        "veCRV", // symbol
        "veCRV_1.0.0", // version
        deployer, // admin
        deployer, // controller
      ],
      log: true,
      deterministicDeployment: true,
    });

    generatedAddresses.crvVoting = crvVotingReceipt.address;
  }

  //
  // CRV controller
  //

  if (!localhost && generatedAddresses.crvController) {
    console.log(
      `Using deployed CRV controller contract: ${generatedAddresses.crvController}`
    );
  } else {
    console.log("Deploying CRV controller contract");

    const crvControllerReceipt = await deploy(CRV_CONTROLLER_CONTRACT, {
      from: deployer,
      contract: GaugeControllerArtifact,
      args: [
        generatedAddresses.crvToken, // token
        generatedAddresses.crvVoting, // voting escrow
        deployer, // admin
      ],
      log: true,
      deterministicDeployment: true,
    });

    generatedAddresses.crvController = crvControllerReceipt.address;
  }

  //
  // CRV minter
  //

  if (!localhost && generatedAddresses.crvMinter) {
    console.log(
      `Using deployed CRV minter contract: ${generatedAddresses.crvMinter}`
    );
  } else {
    console.log("Deploying CRV minter contract");

    const crvMinterReceipt = await deploy(CRV_MINTER_CONTRACT, {
      from: deployer,
      contract: MinterArtifact,
      args: [
        generatedAddresses.crvToken, // token
        generatedAddresses.crvController, // controller
      ],
      log: true,
      deterministicDeployment: true,
    });

    generatedAddresses.crvMinter = crvMinterReceipt.address;
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Deploy Curve Aave gauge
  //
  //////////////////////////////////////////////////////////////////////////////

  if (!localhost && generatedAddresses.curveAaveGuage) {
    console.log(
      `Using deployed Curve Aave guage contract: ${generatedAddresses.curveAaveGuage}`
    );
  } else {
    console.log("Deploying Curve Aave guage contract");

    const curveAaveGuageReceipt = await deploy(CURVE_AAVE_GAUGE_CONTRACT, {
      from: deployer,
      contract: LiquidityGaugeArtifact,
      args: [
        generatedAddresses.curveAaveLpToken, // LP address
        generatedAddresses.crvMinter, // minter
        deployer, // admin
      ],
      log: true,
      deterministicDeployment: true,
    });

    generatedAddresses.curveAaveGuage = curveAaveGuageReceipt.address;
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Generate address registry file
  //
  //////////////////////////////////////////////////////////////////////////////

  generatedNetworks[chainId] = generatedAddresses;

  fs.writeFileSync(
    GENERATED_ADDRESSES,
    JSON.stringify(generatedNetworks, null, "  ")
  );
};

module.exports = func;
module.exports.tags = ["Deploy"];
