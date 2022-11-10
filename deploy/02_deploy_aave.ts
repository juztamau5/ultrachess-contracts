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
const AAVE_ADDESS_CONFIG_CONTRACT = "LendingPoolAddressesProvider";
const AAVE_INCENTIVES_CONTROLLER_CONTRACT = "MockIncentivesController";
const AAVE_INTEREST_RATE_STRATEGY = "DefaultReserveInterestRateStrategy";
const AAVE_LENDING_RATE_ORACLE_CONTRACT = "LendingRateOracle";
const AAVE_POOL_CONFIG_CONTRACT = "LendingPoolConfigurator";
const AAVE_POOL_CONTRACT = "LendingPool";
const AAVE_STABLE_DEBT_TOKEN_CONTRACT = "StableDebtToken";
const AAVE_TOKEN_CONTRACT = "AToken";
const AAVE_VARIABLE_DEBT_TOKEN_CONTRACT = "VariableDebtToken";
const DAI_CONTRACT = "DAI";
const USDC_CONTRACT = "USDC";
const USDT_CONTRACT = "USDT";

// Deployed contract aliases
const ADAI_STABLE_DEBT_TOKEN_CONTRACT = "ADAIStableDebt";
const ADAI_TOKEN_CONTRACT = "ADAI";
const ADAI_VARIABLE_DEBT_TOKEN_CONTRACT = "ADAIVariableDebt";
const AUSDC_STABLE_DEBT_TOKEN_CONTRACT = "AUSDCStableDebt";
const AUSDC_TOKEN_CONTRACT = "AUSDC";
const AUSDC_VARIABLE_DEBT_TOKEN_CONTRACT = "AUSDCVariableDebt";
const AUSDT_STABLE_DEBT_TOKEN_CONTRACT = "AUSDTStableDebt";
const AUSDT_TOKEN_CONTRACT = "AUSDT";
const AUSDT_VARIABLE_DEBT_TOKEN_CONTRACT = "AUSDTVariableDebt";

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
  // Deploy Stablecoins
  //
  //////////////////////////////////////////////////////////////////////////////

  //
  // DAI
  //

  if (!localhost && generatedAddresses.daiToken) {
    console.log(`Using deployed DAI contract: ${generatedAddresses.daiToken}`);
  } else {
    console.log("Deploying DAI contract");

    const daiReceipt = await deploy(DAI_CONTRACT, {
      from: deployer,
      log: true,
      deterministicDeployment: true,
    });

    generatedAddresses.daiToken = daiReceipt.address;
  }

  //
  // USDC
  //

  if (!localhost && generatedAddresses.usdcToken) {
    console.log(
      `Using deployed USDC contract: ${generatedAddresses.usdcToken}`
    );
  } else {
    console.log("Deploying USDC contract");

    const usdcReceipt = await deploy(USDC_CONTRACT, {
      from: deployer,
      log: true,
      deterministicDeployment: true,
    });

    generatedAddresses.usdcToken = usdcReceipt.address;
  }

  //
  // USDT
  //

  if (!localhost && generatedAddresses.usdtToken) {
    console.log(
      `Using deployed USDT contract: ${generatedAddresses.usdtToken}`
    );
  } else {
    console.log("Deploying USDT contract");

    const usdtReceipt = await deploy(USDT_CONTRACT, {
      from: deployer,
      log: true,
      deterministicDeployment: true,
    });

    generatedAddresses.usdtToken = usdtReceipt.address;
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Deploy Aave address config
  //
  //////////////////////////////////////////////////////////////////////////////

  if (!localhost && generatedAddresses.aaveAddressConfig) {
    console.log(
      `Using deployed Aave address config contract: ${generatedAddresses.aaveAddressConfig}`
    );
  } else {
    console.log("Deploying Aave address config contract");

    const aaveAddressConfigReceipt = await deploy(AAVE_ADDESS_CONFIG_CONTRACT, {
      from: deployer,
      args: ["", deployer],
      log: true,
      deterministicDeployment: true,
    });

    generatedAddresses.aaveAddressConfig = aaveAddressConfigReceipt.address;
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Deploy Aave pool config
  //
  //////////////////////////////////////////////////////////////////////////////

  if (!localhost && generatedAddresses.aavePoolConfig) {
    console.log(
      `Using deployed Aave pool config contract: ${generatedAddresses.aavePoolConfig}`
    );
  } else {
    console.log("Deploying Aave pool config contract");

    const aavePoolConfigReceipt = await deploy(AAVE_POOL_CONFIG_CONTRACT, {
      from: deployer,
      log: true,
      deterministicDeployment: true,
    });

    generatedAddresses.aavePoolConfig = aavePoolConfigReceipt.address;
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Deploy Aave pool
  //
  //////////////////////////////////////////////////////////////////////////////

  //
  // Deploy libraries
  //

  // GenericLogic
  const GenericLogic = await ethers.getContractFactory("GenericLogic");
  const genericLogic = await GenericLogic.deploy();

  // ReserveLogic
  const ReserveLogic = await ethers.getContractFactory("ReserveLogic");
  const reserveLogic = await ReserveLogic.deploy();

  // ValidationLogic
  const ValidationLogic = await ethers.getContractFactory("ValidationLogic", {
    libraries: {
      GenericLogic: genericLogic.address,
    },
  });
  const validationLogic = await ValidationLogic.deploy();

  //
  // Aave pool
  //

  if (!localhost && generatedAddresses.aavePool) {
    console.log(
      `Using deployed Aave pool contract: ${generatedAddresses.aavePool}`
    );
  } else {
    console.log("Deploying Aave pool contract");

    // Deploy pool contract
    const AavePool = await ethers.getContractFactory(AAVE_POOL_CONTRACT, {
      libraries: {
        ReserveLogic: reserveLogic.address,
        ValidationLogic: validationLogic.address,
      },
    });
    const aavePool = await AavePool.deploy();

    generatedAddresses.aavePool = aavePool.address;
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Deploy Aave tokens
  //
  //////////////////////////////////////////////////////////////////////////////

  // NOTE: Can't use deterministic deployment because Aave V2 ATokens don't use
  // construction parameters, and all tokens use the same bytecode

  //
  // aDAI token
  //

  if (!localhost && generatedAddresses.adaiToken) {
    console.log(
      `Using deployed aDAI token contract: ${generatedAddresses.adaiToken}`
    );
  } else {
    console.log("Deploying aDAI token contract");

    const adaiTokenReceipt = await deploy(ADAI_TOKEN_CONTRACT, {
      from: deployer,
      contract: AAVE_TOKEN_CONTRACT,
      log: true,
      deterministicDeployment: false,
    });

    generatedAddresses.adaiToken = adaiTokenReceipt.address;
  }

  //
  // aUSDC token
  //

  if (!localhost && generatedAddresses.ausdcToken) {
    console.log(
      `Using deployed aUSDC token contract: ${generatedAddresses.ausdcToken}`
    );
  } else {
    console.log("Deploying aUSDC token contract");

    const ausdcTokenReceipt = await deploy(AUSDC_TOKEN_CONTRACT, {
      from: deployer,
      contract: AAVE_TOKEN_CONTRACT,
      log: true,
      deterministicDeployment: false,
    });

    generatedAddresses.ausdcToken = ausdcTokenReceipt.address;
  }

  //
  // aUSDT token
  //

  if (!localhost && generatedAddresses.ausdtToken) {
    console.log(
      `Using deployed aUSDT token contract: ${generatedAddresses.ausdtToken}`
    );
  } else {
    console.log("Deploying aUSDT token contract");

    const ausdtTokenReceipt = await deploy(AUSDT_TOKEN_CONTRACT, {
      from: deployer,
      contract: AAVE_TOKEN_CONTRACT,
      log: true,
      deterministicDeployment: false,
    });

    generatedAddresses.ausdtToken = ausdtTokenReceipt.address;
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Deploy Aave stable debt tokens
  //
  //////////////////////////////////////////////////////////////////////////////

  //
  // aDAI stable debt token
  //

  if (!localhost && generatedAddresses.adaiStableDebtToken) {
    console.log(
      `Using deployed aDAI stable debt token contract: ${generatedAddresses.adaiStableDebtToken}`
    );
  } else {
    console.log("Deploying aDAI stable debt token contract");

    const adaiStableDebtTokenReceipt = await deploy(
      ADAI_STABLE_DEBT_TOKEN_CONTRACT,
      {
        from: deployer,
        contract: AAVE_STABLE_DEBT_TOKEN_CONTRACT,
        log: true,
        deterministicDeployment: false,
      }
    );

    generatedAddresses.adaiStableDebtToken = adaiStableDebtTokenReceipt.address;
  }

  //
  // aUSDC stable debt token
  //

  if (!localhost && generatedAddresses.ausdcStableDebtToken) {
    console.log(
      `Using deployed aUSDC token contract: ${generatedAddresses.ausdcStableDebtToken}`
    );
  } else {
    console.log("Deploying aUSDC stable debt token contract");

    const ausdcStableDebtTokenReceipt = await deploy(
      AUSDC_STABLE_DEBT_TOKEN_CONTRACT,
      {
        from: deployer,
        contract: AAVE_STABLE_DEBT_TOKEN_CONTRACT,
        log: true,
        deterministicDeployment: false,
      }
    );

    generatedAddresses.ausdcStableDebtToken =
      ausdcStableDebtTokenReceipt.address;
  }

  //
  // aUSDT stable debt token
  //

  if (!localhost && generatedAddresses.ausdtStableDebtToken) {
    console.log(
      `Using deployed aUSDT token contract: ${generatedAddresses.ausdtStableDebtToken}`
    );
  } else {
    console.log("Deploying aUSDT stable debt token contract");

    const ausdtStableDebtTokenReceipt = await deploy(
      AUSDT_STABLE_DEBT_TOKEN_CONTRACT,
      {
        from: deployer,
        contract: AAVE_STABLE_DEBT_TOKEN_CONTRACT,
        log: true,
        deterministicDeployment: false,
      }
    );

    generatedAddresses.ausdtStableDebtToken =
      ausdtStableDebtTokenReceipt.address;
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Deploy Aave variable debt tokens
  //
  //////////////////////////////////////////////////////////////////////////////

  //
  // aDAI variable debt token
  //

  if (!localhost && generatedAddresses.adaiVariableDebtToken) {
    console.log(
      `Using deployed aDAI variable debt token contract: ${generatedAddresses.adaiVariableDebtToken}`
    );
  } else {
    console.log("Deploying aDAI variable debt token contract");

    const adaiVariableDebtTokenReceipt = await deploy(
      ADAI_VARIABLE_DEBT_TOKEN_CONTRACT,
      {
        from: deployer,
        contract: AAVE_VARIABLE_DEBT_TOKEN_CONTRACT,
        log: true,
        deterministicDeployment: false,
      }
    );

    generatedAddresses.adaiVariableDebtToken =
      adaiVariableDebtTokenReceipt.address;
  }

  //
  // aUSDC variable debt token
  //

  if (!localhost && generatedAddresses.ausdcVariableDebtToken) {
    console.log(
      `Using deployed aUSDC token contract: ${generatedAddresses.ausdcVariableDebtToken}`
    );
  } else {
    console.log("Deploying aUSDC variable debt token contract");

    const ausdcVariableDebtTokenReceipt = await deploy(
      AUSDC_VARIABLE_DEBT_TOKEN_CONTRACT,
      {
        from: deployer,
        contract: AAVE_VARIABLE_DEBT_TOKEN_CONTRACT,
        log: true,
        deterministicDeployment: false,
      }
    );

    generatedAddresses.ausdcVariableDebtToken =
      ausdcVariableDebtTokenReceipt.address;
  }

  //
  // aUSDT variable debt token
  //

  if (!localhost && generatedAddresses.ausdtVariableDebtToken) {
    console.log(
      `Using deployed aUSDT token contract: ${generatedAddresses.ausdtVariableDebtToken}`
    );
  } else {
    console.log("Deploying aUSDT variable debt token contract");

    const ausdtVariableDebtTokenReceipt = await deploy(
      AUSDT_VARIABLE_DEBT_TOKEN_CONTRACT,
      {
        from: deployer,
        contract: AAVE_VARIABLE_DEBT_TOKEN_CONTRACT,
        log: true,
        deterministicDeployment: false,
      }
    );

    generatedAddresses.ausdtVariableDebtToken =
      ausdtVariableDebtTokenReceipt.address;
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Deploy Aave interest rate strategy
  //
  //////////////////////////////////////////////////////////////////////////////

  // TODO: Move to constants
  const RAY = ethers.BigNumber.from(10).pow(27);

  if (!localhost && generatedAddresses.aaveInterestRateStrategy) {
    console.log(
      `Using deployed Aave interest rate strategy contract: ${generatedAddresses.aaveInterestRateStrategy}`
    );
  } else {
    console.log("Deploying Aave interest rate strategy contract");

    const aaveInterestRateStrategyReceipt = await deploy(
      AAVE_INTEREST_RATE_STRATEGY,
      {
        from: deployer,
        args: [
          generatedAddresses.aaveAddressConfig, // provider
          RAY.div(2), // optimal usage ratio
          0, // base variable borrow rate
          0, // variable rate slope 1
          0, // variable rate slope 2
          0, // stable rate slope 1
          0, // stable rate slope 2
        ],
        log: true,
        deterministicDeployment: true,
      }
    );

    generatedAddresses.aaveInterestRateStrategy =
      aaveInterestRateStrategyReceipt.address;
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Deploy mock Aave incentives controller
  //
  //////////////////////////////////////////////////////////////////////////////

  if (!localhost && generatedAddresses.aaveIncentivesController) {
    console.log(
      `Using deployed Aave incentives controller contract: ${generatedAddresses.aaveIncentivesController}`
    );
  } else {
    console.log("Deploying Aave incentives controller contract");

    const aaveIncentivesControllerReceipt = await deploy(
      AAVE_INCENTIVES_CONTROLLER_CONTRACT,
      {
        from: deployer,
        log: true,
        deterministicDeployment: true,
      }
    );

    generatedAddresses.aaveIncentivesController =
      aaveIncentivesControllerReceipt.address;
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Deploy mock Aave lending rate oracle
  //
  //////////////////////////////////////////////////////////////////////////////

  if (!localhost && generatedAddresses.aaveLendingRateOracle) {
    console.log(
      `Using deployed Aave lending rate oracle contract: ${generatedAddresses.aaveLendingRateOracle}`
    );
  } else {
    console.log("Deploying Aave lending rate oracle contract");

    const aaveLendingRateOracleReceipt = await deploy(
      AAVE_LENDING_RATE_ORACLE_CONTRACT,
      {
        from: deployer,
        args: [deployer],
        log: true,
        deterministicDeployment: true,
      }
    );

    generatedAddresses.aaveLendingRateOracle =
      aaveLendingRateOracleReceipt.address;
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
