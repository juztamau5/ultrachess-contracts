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

// Contract ABIs
const AavePoolAbi = require("../src/abi/contracts/depends/aave-v2/protocol/lendingpool/LendingPool.sol/LendingPool.json");

// TODO: Fully qualified contract names
const AAVE_ADDRESS_CONFIG_CONTRACT = "LendingPoolAddressesProvider";
const AAVE_LENDING_RATE_ORACLE_CONTRACT = "LendingRateOracle";
const AAVE_POOL_CONFIG_CONTRACT = "LendingPoolConfigurator";
const DAI_CONTRACT = "DAI";
const USDC_CONTRACT = "USDC";
const USDT_CONTRACT = "USDT";

// Path to generated address file
const GENERATED_ADDRESSES = `${__dirname}/../addresses.json`;

/**
 * Steps to deploy the Retro Dapp environment
 */
const func = async function (hardhat_re) {
  const { deployments, ethers, getNamedAccounts } = hardhat_re;

  const { execute, read } = deployments;
  const { deployer } = await getNamedAccounts();

  // Account to use for Aave treasury
  const aaveTreasury = deployer;

  const [deployerSigner] = await ethers.getSigners();

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
  // Configure Aave addresses
  //
  //////////////////////////////////////////////////////////////////////////////

  // Aave address IDs
  const LENDING_POOL = ethers.utils.formatBytes32String("LENDING_POOL");
  const LENDING_POOL_CONFIGURATOR = ethers.utils.formatBytes32String(
    "LENDING_POOL_CONFIGURATOR"
  );
  const POOL_ADMIN = ethers.utils.formatBytes32String("POOL_ADMIN");
  const EMERGENCY_ADMIN = ethers.utils.formatBytes32String("EMERGENCY_ADMIN");
  /*
  const LENDING_POOL_COLLATERAL_MANAGER = ethers.utils.formatBytes32String(
    "LENDING_POOL_COLLATERAL_MANAGER"
  );
  const PRICE_ORACLE = ethers.utils.formatBytes32String("PRICE_ORACLE");
  */
  const LENDING_RATE_ORACLE = ethers.utils.formatBytes32String(
    "LENDING_RATE_ORACLE"
  );

  console.log("Setting Aave pool address");

  await execute(
    AAVE_ADDRESS_CONFIG_CONTRACT,
    {
      from: deployer,
      log: true,
    },
    "setAddress",
    LENDING_POOL,
    generatedAddresses.aavePool
  );

  console.log("Setting Aave pool config address");

  await execute(
    AAVE_ADDRESS_CONFIG_CONTRACT,
    {
      from: deployer,
      log: true,
    },
    "setAddress",
    LENDING_POOL_CONFIGURATOR,
    generatedAddresses.aavePoolConfig
  );

  console.log("Setting Aave pool admin address");

  await execute(
    AAVE_ADDRESS_CONFIG_CONTRACT,
    {
      from: deployer,
      log: true,
    },
    "setAddress",
    POOL_ADMIN,
    deployer
  );

  console.log("Setting Aave pool emergency admin address");

  await execute(
    AAVE_ADDRESS_CONFIG_CONTRACT,
    {
      from: deployer,
      log: true,
    },
    "setAddress",
    EMERGENCY_ADMIN,
    deployer
  );

  console.log("Setting Aave lending rate oracle address");

  await execute(
    AAVE_ADDRESS_CONFIG_CONTRACT,
    {
      from: deployer,
      log: true,
    },
    "setAddress",
    LENDING_RATE_ORACLE,
    generatedAddresses.aaveLendingRateOracle
  );

  //////////////////////////////////////////////////////////////////////////////
  //
  // Configure Aave lending rate oracle
  //
  //////////////////////////////////////////////////////////////////////////////

  console.log("Setting Aave oracle lending rates");

  //
  // DAI lending rate
  //

  await execute(
    AAVE_LENDING_RATE_ORACLE_CONTRACT,
    { from: deployer, log: true },
    "setMarketBorrowRate",
    generatedAddresses.daiToken,
    ethers.BigNumber.from(
      "39000000000000000000000000" // Taken from Polygon
    )
  );

  //
  // USDC lending rate
  //

  await execute(
    AAVE_LENDING_RATE_ORACLE_CONTRACT,
    { from: deployer, log: true },
    "setMarketBorrowRate",
    generatedAddresses.usdcToken,
    ethers.BigNumber.from(
      "39000000000000000000000000" // Taken from Polygon
    )
  );

  //
  // USDT lending rate
  //

  await execute(
    AAVE_LENDING_RATE_ORACLE_CONTRACT,
    { from: deployer, log: true },
    "setMarketBorrowRate",
    generatedAddresses.usdtToken,
    ethers.BigNumber.from(
      "35000000000000000000000000" // Taken from Polygon
    )
  );

  //////////////////////////////////////////////////////////////////////////////
  //
  // Initialize Aave pool config
  //
  //////////////////////////////////////////////////////////////////////////////

  // Note: Aave in depends is patched to make the "lastInitializedRevision"
  // field public so that we can check if initialization has already occurred

  if (
    (await read(
      AAVE_POOL_CONFIG_CONTRACT,
      { from: deployer, log: true },
      "lastInitializedRevision"
    )) > 0
  ) {
    console.log("Aave pool config contract already initialized");
  } else {
    console.log("Initializing Aave pool config contract");

    await execute(
      AAVE_POOL_CONFIG_CONTRACT,
      {
        from: deployer,
        log: true,
        //gasLimit: 2000000, // 2M GWei
      },
      "initialize",
      generatedAddresses.aaveAddressConfig
    );
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Initialize Aave pool
  //
  //////////////////////////////////////////////////////////////////////////////

  // NOTE: ethers is used because the contract was deployed by a factory to
  // link external libraries

  console.log("Initializing Aave pool");

  // Construct the contract
  const aavePoolContract = new ethers.Contract(
    generatedAddresses.aavePool,
    AavePoolAbi,
    deployerSigner
  );

  const initTx = await aavePoolContract.initialize(
    generatedAddresses.aaveAddressConfig
  );
  await initTx.wait();

  //////////////////////////////////////////////////////////////////////////////
  //
  // Initialize Aave assets
  //
  //////////////////////////////////////////////////////////////////////////////

  // @type
  //   {
  //     aTokenImpl: string;
  //     stableDebtTokenImpl: string;
  //     variableDebtTokenImpl: string;
  //     underlyingAssetDecimals: typeof ethers.BigNumberish;
  //     interestRateStrategyAddress: string;
  //     underlyingAsset: string;
  //     treasury: string;
  //     incentivesController: string;
  //     underlyingAssetName: string;
  //     aTokenName: string;
  //     aTokenSymbol: string;
  //     variableDebtTokenName: string;
  //     variableDebtTokenSymbol: string;
  //     stableDebtTokenName: string;
  //     stableDebtTokenSymbol: string;
  //     params: Array<number>;
  //   }[]
  const initInputParams = [];

  // Get initialized reserves to check for already-initialized tokens
  const reserves = await aavePoolContract.getReservesList();

  //
  // aDAI
  //

  if (reserves.includes(generatedAddresses.daiToken)) {
    console.log("aDAI token already initialized");
  } else {
    console.log("Initializing aDAI token");

    initInputParams.push({
      aTokenImpl: generatedAddresses.adaiToken,
      stableDebtTokenImpl: generatedAddresses.adaiStableDebtToken,
      variableDebtTokenImpl: generatedAddresses.adaiVariableDebtToken,
      underlyingAssetDecimals: 18,
      interestRateStrategyAddress: generatedAddresses.aaveInterestRateStrategy,
      underlyingAsset: generatedAddresses.daiToken,
      treasury: aaveTreasury,
      incentivesController: generatedAddresses.aaveIncentivesController,
      underlyingAssetName: "DAI",
      aTokenName: `Funny Aave Matic Market DAI`,
      aTokenSymbol: `amDAI`,
      variableDebtTokenName: `VD amDAI`,
      variableDebtTokenSymbol: `variableDebtamDAI}`,
      stableDebtTokenName: `SD amDAI`,
      stableDebtTokenSymbol: `stableDebtamDAI`,
      params: [],
    });
  }

  //
  // aUSDC
  //

  if (reserves.includes(generatedAddresses.usdcToken)) {
    console.log("aUSDC token already initialized");
  } else {
    console.log("Initializing aUSDC token");

    initInputParams.push({
      aTokenImpl: generatedAddresses.ausdcToken,
      stableDebtTokenImpl: generatedAddresses.ausdcStableDebtToken,
      variableDebtTokenImpl: generatedAddresses.ausdcVariableDebtToken,
      underlyingAssetDecimals: 6,
      interestRateStrategyAddress: generatedAddresses.aaveInterestRateStrategy,
      underlyingAsset: generatedAddresses.usdcToken,
      treasury: aaveTreasury,
      incentivesController: generatedAddresses.aaveIncentivesController,
      underlyingAssetName: "USDC",
      aTokenName: `Funny Aave Matic Market USDC`,
      aTokenSymbol: `amUSDC`,
      variableDebtTokenName: `VD amUSDC`,
      variableDebtTokenSymbol: `variableDebtamUSDC}`,
      stableDebtTokenName: `SD amUSDC`,
      stableDebtTokenSymbol: `stableDebtamUSDC`,
      params: [],
    });
  }

  //
  // aUSDT
  //

  if (reserves.includes(generatedAddresses.usdtToken)) {
    console.log("aUSDT token already initialized");
  } else {
    console.log("Initializing aUSDT token");

    initInputParams.push({
      aTokenImpl: generatedAddresses.ausdtToken,
      stableDebtTokenImpl: generatedAddresses.ausdtStableDebtToken,
      variableDebtTokenImpl: generatedAddresses.ausdtVariableDebtToken,
      underlyingAssetDecimals: 6,
      interestRateStrategyAddress: generatedAddresses.aaveInterestRateStrategy,
      underlyingAsset: generatedAddresses.usdtToken,
      treasury: aaveTreasury,
      incentivesController: generatedAddresses.aaveIncentivesController,
      underlyingAssetName: "USDT",
      aTokenName: `Funny Aave Matic Market USDT`,
      aTokenSymbol: `amUSDT`,
      variableDebtTokenName: `VD amUSDT`,
      variableDebtTokenSymbol: `variableDebtamUSDT}`,
      stableDebtTokenName: `SD amUSDT`,
      stableDebtTokenSymbol: `stableDebtamUSDT`,
      params: [],
    });
  }

  //
  // Batch initialization
  //

  if (initInputParams.length > 0) {
    console.log(`Initializing ${initInputParams.length} aTokens`);

    await execute(
      AAVE_POOL_CONFIG_CONTRACT,
      {
        from: deployer,
        log: true,
        gasLimit: 7000000, // 7M GWei, enough to initialize up to 3 assets
      },
      "batchInitReserve",
      initInputParams
    );
  } else {
    console.log("All aTokens are already initialized");
  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // Get Aave asset proxy addresses
  //
  //////////////////////////////////////////////////////////////////////////////

  //
  // aDAI
  //

  const daiReserve = await aavePoolContract.getReserveData(
    generatedAddresses.daiToken
  );

  generatedAddresses.adaiTokenProxy = daiReserve[7];
  generatedAddresses.adaiStableDebtTokenProxy = daiReserve[8];
  generatedAddresses.adaiVariableDebtTokenProxy = daiReserve[9];

  //
  // aUSDC
  //

  const usdcReserve = await aavePoolContract.getReserveData(
    generatedAddresses.usdcToken
  );

  generatedAddresses.ausdcTokenProxy = usdcReserve[7];
  generatedAddresses.ausdcStableDebtTokenProxy = usdcReserve[8];
  generatedAddresses.ausdcVariableDebtTokenProxy = usdcReserve[9];

  //
  // aUSDT
  //

  const usdtReserve = await aavePoolContract.getReserveData(
    generatedAddresses.usdtToken
  );

  generatedAddresses.ausdtTokenProxy = usdtReserve[7];
  generatedAddresses.ausdtStableDebtTokenProxy = usdtReserve[8];
  generatedAddresses.ausdtVariableDebtTokenProxy = usdtReserve[9];

  //////////////////////////////////////////////////////////////////////////////
  //
  // Seed the stablecoins with some funds
  //
  //////////////////////////////////////////////////////////////////////////////

  // Initial stablecoin amounts for Aave pool
  const INITIAL_DAI = ethers.BigNumber.from("1000000000000000000000"); // 1000 DAI
  const INITIAL_USDC = ethers.BigNumber.from("1000000000"); // 1000 USDC
  const INITIAL_USDT = ethers.BigNumber.from("1000000000"); // 1000 USDT

  console.log("Minting stablecoins");

  //
  // DAI
  //

  if (
    (await read(
      DAI_CONTRACT,
      { from: deployer, log: true },
      "balanceOf",
      deployer
    )) < INITIAL_DAI
  )
    await execute(
      DAI_CONTRACT,
      {
        from: deployer,
        log: true,
      },
      "mint",
      deployer,
      INITIAL_DAI
    );

  //
  // USDC
  //

  if (
    (await read(
      USDC_CONTRACT,
      { from: deployer, log: true },
      "balanceOf",
      deployer
    )) < INITIAL_USDC
  )
    await execute(
      USDC_CONTRACT,
      {
        from: deployer,
        log: true,
      },
      "mint",
      deployer,
      INITIAL_USDC
    );

  //
  // USDT
  //

  if (
    (await read(
      USDT_CONTRACT,
      { from: deployer, log: true },
      "balanceOf",
      deployer
    )) < INITIAL_USDT
  )
    await execute(
      USDT_CONTRACT,
      {
        from: deployer,
        log: true,
      },
      "mint",
      deployer,
      INITIAL_USDT
    );

  //
  // TODO: Add liquidity
  //

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
