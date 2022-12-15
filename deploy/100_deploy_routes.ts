/*
 * Copyright (C) 2022 Ultrachess team
 * This file is part of Ultrachess - https://github.com/Ultrachess/contracts
 *
 * SPDX-License-Identifier: Apache-2.0
 * See the file LICENSE for more information.
 */

/* eslint no-empty: "off" */

import bn from "bignumber.js"; // TODO: Move to utils
import { ethers } from "ethers";
import fs from "fs";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction, DeployOptions } from "hardhat-deploy/types";

// Contract names
const ASSET_TOKEN_CONTRACT = "Ultra3CRV";
const BASE_TOKEN_CONTRACT = "CHESS";
const CURVE_AAVE_GAUGE_CONTRACT = "CurveAaveGauge";
const CURVE_AAVE_POOL_CONTRACT = "CurveAavePool";
const CURVE_AAVE_POOLER_CONTRACT = "CurveAavePooler";
const CURVE_AAVE_STAKER_CONTRACT = "CurveAaveStaker";
const LP_SFT_CONTRACT = "LpSft";
const UNI_V3_POOL_FACTORY_CONTRACT = "UniV3PoolFactory";
const UNI_V3_POOLER_CONTRACT = "UniV3Pooler";
const UNI_V3_STAKER_CONTRACT = "UniV3Staker";
const UNI_V3_SWAPPER_CONTRACT = "UniV3Swapper";
const UNISWAP_V3_FACTORY_CONTRACT = "UniswapV3Factory";
const UNISWAP_V3_NFT_MANAGER_CONTRACT = "NonfungiblePositionManager";
const UNISWAP_V3_STAKER_CONTRACT = "UniswapV3Staker";
const USDC_TOKEN_CONTRACT = "USDC";

// Contract ABIs
import ERC20Abi from "../src/abi/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import UniswapV3PoolAbi from "../src/abi/contracts/depends/uniswap-v3-core/UniswapV3Pool.sol/UniswapV3Pool.json";
import CurveAaveStakerAbi from "../src/abi/contracts/src/token/routes/CurveAaveStaker.sol/CurveAaveStaker.json";

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

// Initial reward for the LP NFT staking incentive
const REWARD_AMOUNT = ethers.utils.parseUnits("1000", 18); // 1,000 base tokens

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
  curveAaveGauge: string;
  curveAavePool: string;
  curveAavePooler: string;
  curveAaveStaker: string;
  lpSft: string;
  uniswapV3Factory: string;
  uniswapV3NftManager: string;
  uniswapV3Staker: string;
  uniV3Pooler: string;
  uniV3PoolFactory: string;
  uniV3Staker: string;
  uniV3Swapper: string;
}
let addressBook: AddressBook | undefined;

//
// Utility functions
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

const getDependencyAddress = async (
  hardhat_re: HardhatRuntimeEnvironment,
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
  const contractDeployment = await hardhat_re.deployments.get(contractName);
  if (contractDeployment && contractDeployment.address)
    return contractDeployment.address;

  return; // undefined
};

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

  return; // undefined
};

function writeAddress(
  network: string,
  contract: string,
  address: string
): void {
  console.log(`Deployed ${contract} to ${address}`);
  const addressFile = `${__dirname}/../deployments/${network}/${contract}.json`;
  fs.writeFileSync(addressFile, JSON.stringify({ address }, undefined, 2));
}

// Returns the sqrt price as a 64x96
function encodePriceSqrt(
  reserve1: ethers.BigNumber,
  reserve0: ethers.BigNumber
): ethers.BigNumber {
  return ethers.BigNumber.from(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  );
}

//
// Deploy function
//

const func: DeployFunction = async (hardhat_re: HardhatRuntimeEnvironment) => {
  const { deployments, ethers, getNamedAccounts } = hardhat_re;
  const { deployer } = await getNamedAccounts();

  const [deployerSigner] = await ethers.getSigners();

  const opts: DeployOptions = {
    deterministicDeployment: true,
    from: deployer,
    log: true,
  };

  // Get the network name
  const network = hardhat_re.network.name;

  // Load the contract addresses
  loadAddresses(network);

  // Get dependency addresses
  const curveAaveGaugeAddress = await getDependencyAddress(
    hardhat_re,
    "curveAaveGauge",
    CURVE_AAVE_GAUGE_CONTRACT,
    network
  );
  const curveAavePoolAddress = await getDependencyAddress(
    hardhat_re,
    "curveAavePool",
    CURVE_AAVE_POOL_CONTRACT,
    network
  );
  const uniswapV3NftManagerAddress = await getDependencyAddress(
    hardhat_re,
    "uniswapV3NftManager",
    UNISWAP_V3_NFT_MANAGER_CONTRACT,
    network
  );
  const uniswapV3FactoryAddress = await getDependencyAddress(
    hardhat_re,
    "uniswapV3Factory",
    UNISWAP_V3_FACTORY_CONTRACT,
    network
  );
  const uniswapV3StakerAddress = await getDependencyAddress(
    hardhat_re,
    "uniswapV3Staker",
    UNISWAP_V3_STAKER_CONTRACT,
    network
  );
  const usdcTokenAddress = await getDependencyAddress(
    hardhat_re,
    "usdcToken",
    USDC_TOKEN_CONTRACT,
    network
  );

  // Get contract addresses
  let assetTokenAddress = await getContractAddress(
    "assetToken",
    ASSET_TOKEN_CONTRACT,
    network
  );
  let baseTokenAddress = await getContractAddress(
    "baseToken",
    BASE_TOKEN_CONTRACT,
    network
  );
  let curveAavePoolerAddress = await getContractAddress(
    "curveAavePooler",
    CURVE_AAVE_POOLER_CONTRACT,
    network
  );
  let curveAaveStakerAddress = await getContractAddress(
    "curveAaveStaker",
    CURVE_AAVE_STAKER_CONTRACT,
    network
  );
  let lpSftAddress = await getContractAddress(
    "lpSft",
    LP_SFT_CONTRACT,
    network
  );
  let uniV3PoolerAddress = await getContractAddress(
    "uniV3Pooler",
    UNI_V3_POOLER_CONTRACT,
    network
  );
  let uniV3PoolFactoryAddress = await getContractAddress(
    "uniV3PoolFactory",
    UNI_V3_POOL_FACTORY_CONTRACT,
    network
  );
  let uniV3StakerAddress = await getContractAddress(
    "uniV3Staker",
    UNI_V3_STAKER_CONTRACT,
    network
  );
  let uniV3SwapperAddress = await getContractAddress(
    "uniV3Swapper",
    UNI_V3_SWAPPER_CONTRACT,
    network
  );

  //////////////////////////////////////////////////////////////////////////////
  // Deploy contracts
  //////////////////////////////////////////////////////////////////////////////

  // Deploy base token
  if (baseTokenAddress) {
    console.log(`Using ${BASE_TOKEN_CONTRACT} at ${baseTokenAddress}`);
  } else {
    console.log(`Deploying ${BASE_TOKEN_CONTRACT}`);
    const tx = await deployments.deploy(BASE_TOKEN_CONTRACT, {
      ...opts,
      args: [
        deployer, // owner
      ],
    });
    baseTokenAddress = tx.address;
  }

  // Deploy asset token
  if (assetTokenAddress) {
    console.log(`Using ${ASSET_TOKEN_CONTRACT} at ${assetTokenAddress}`);
  } else {
    console.log(`Deploying ${ASSET_TOKEN_CONTRACT}`);
    const tx = await deployments.deploy(ASSET_TOKEN_CONTRACT, {
      ...opts,
      args: [
        deployer, // owner
      ],
    });
    assetTokenAddress = tx.address;
  }

  // Deploy LP SFT contract
  if (lpSftAddress) {
    console.log(`Using ${LP_SFT_CONTRACT} at ${lpSftAddress}`);
  } else {
    console.log(`Deploying ${LP_SFT_CONTRACT}`);
    const tx = await deployments.deploy(LP_SFT_CONTRACT, {
      ...opts,
      args: [
        deployer, // owner
        uniswapV3NftManagerAddress, // uniswapV3NftManager
      ],
    });
    lpSftAddress = tx.address;
  }

  // Deploy CurveAavePooler
  if (curveAavePoolerAddress) {
    console.log(
      `Using ${CURVE_AAVE_POOLER_CONTRACT} at ${curveAavePoolerAddress}`
    );
  } else {
    console.log(`Deploying ${CURVE_AAVE_POOLER_CONTRACT}`);
    const tx = await deployments.deploy(CURVE_AAVE_POOLER_CONTRACT, {
      ...opts,
      args: [
        curveAavePoolAddress, // curveAavePool
      ],
    });
    curveAavePoolerAddress = tx.address;
  }

  // Deploy CurveAaveStaker
  if (curveAaveStakerAddress) {
    console.log(
      `Using ${CURVE_AAVE_STAKER_CONTRACT} at ${curveAaveStakerAddress}`
    );
  } else {
    console.log(`Deploying ${CURVE_AAVE_STAKER_CONTRACT}`);
    const tx = await deployments.deploy(CURVE_AAVE_STAKER_CONTRACT, {
      ...opts,
      args: [
        curveAavePoolerAddress, // curveAavePooler
        curveAaveGaugeAddress, // curveAaveGauge
        assetTokenAddress, // assetToken
      ],
    });
    curveAaveStakerAddress = tx.address;
  }

  // Deploy Uniswap V3 pool factory
  if (uniV3PoolFactoryAddress) {
    console.log(
      `Using ${UNI_V3_POOL_FACTORY_CONTRACT} at ${uniV3PoolFactoryAddress}`
    );
  } else {
    console.log(`Deploying ${UNI_V3_POOL_FACTORY_CONTRACT}`);
    const tx = await deployments.deploy(UNI_V3_POOL_FACTORY_CONTRACT, {
      ...opts,
      args: [
        uniswapV3FactoryAddress, // factory
        baseTokenAddress, // baseToken
        assetTokenAddress, // assetToken
        FeeAmount.HIGH, // swapFee
      ],
    });
    uniV3PoolFactoryAddress = tx.address;
  }

  // Read Uniswap V3 pool address
  const uniswapV3PoolAddress = await deployments.read(
    UNI_V3_POOL_FACTORY_CONTRACT,
    { from: deployer },
    "uniswapV3Pool"
  );

  // Deploy UniV3Swapper
  if (uniV3SwapperAddress) {
    console.log(`Using ${UNI_V3_SWAPPER_CONTRACT} at ${uniV3SwapperAddress}`);
  } else {
    console.log(`Deploying ${UNI_V3_SWAPPER_CONTRACT}`);
    const tx = await deployments.deploy(UNI_V3_SWAPPER_CONTRACT, {
      ...opts,
      args: [
        curveAaveStakerAddress, // curveAaveStaker
        uniswapV3PoolAddress, // uniswapV3Pool
        baseTokenAddress, // baseToken
      ],
    });
    uniV3SwapperAddress = tx.address;
  }

  // Deploy UniV3Pooler
  if (uniV3PoolerAddress) {
    console.log(`Using ${UNI_V3_POOLER_CONTRACT} at ${uniV3PoolerAddress}`);
  } else {
    console.log(`Deploying ${UNI_V3_POOLER_CONTRACT}`);
    const tx = await deployments.deploy(UNI_V3_POOLER_CONTRACT, {
      ...opts,
      args: [
        uniV3SwapperAddress, // uniV3Swapper
        uniswapV3NftManagerAddress, // uniswapV3NftManager
      ],
    });
    uniV3PoolerAddress = tx.address;
  }

  // Deploy UniV3Staker
  if (uniV3StakerAddress) {
    console.log(`Using ${UNI_V3_STAKER_CONTRACT} at ${uniV3StakerAddress}`);
  } else {
    console.log(`Deploying ${UNI_V3_STAKER_CONTRACT}`);
    const tx = await deployments.deploy(UNI_V3_STAKER_CONTRACT, {
      ...opts,
      args: [
        deployer, // owner
        uniV3PoolerAddress, // uniV3Pooler
        uniswapV3StakerAddress, // uniswapV3Staker
        lpSftAddress, // lpSft
      ],
    });
    uniV3StakerAddress = tx.address;
  }

  //////////////////////////////////////////////////////////////////////////////
  // Setup contracts
  //////////////////////////////////////////////////////////////////////////////

  // Get the minter role ID
  const TOKEN_MINTER_ROLE = await deployments.read(
    LP_SFT_CONTRACT,
    { from: deployer },
    "MINTER_ROLE"
  );

  // Assign the minter role to the CurveAave 

  // Transfer ownership of the asset token to the Curve Aave staker
  console.log(
    `Transferring ownership of ${ASSET_TOKEN_CONTRACT} to ${CURVE_AAVE_STAKER_CONTRACT}`
  );
  await deployments.execute(
    ASSET_TOKEN_CONTRACT,
    opts,
    "transferOwnership",
    curveAaveStakerAddress
  );

  // Transfer ownership of the LP SFT to the Uniswap V3 staker
  console.log(
    `Transferring ownership of ${LP_SFT_CONTRACT} to ${UNI_V3_STAKER_CONTRACT}`
  );
  await deployments.execute(
    LP_SFT_CONTRACT,
    opts,
    "transferOwnership",
    uniV3StakerAddress
  );

  // Approve UniV3 staker spending USDC
  console.log(`Approving ${UNI_V3_STAKER_CONTRACT} to spend base token`);
  await deployments.execute(
    BASE_TOKEN_CONTRACT,
    opts,
    "approve",
    uniV3StakerAddress,
    REWARD_AMOUNT
  );

  // Set up the Uniswap V3 staker
  console.log(`Setting up ${UNI_V3_STAKER_CONTRACT}`);
  await deployments.execute(
    UNI_V3_STAKER_CONTRACT,
    opts,
    "createIncentive",
    REWARD_AMOUNT
  );

  //////////////////////////////////////////////////////////////////////////////
  // Initialize the Uniswap V3 pool
  //////////////////////////////////////////////////////////////////////////////

  const USDC_AMOUNT = ethers.utils.parseUnits("1", 6); // 1 USDC
  const BASE_TOKEN_AMOUNT = ethers.utils.parseUnits("1", 18); // 1 base token
  const CURVE_AAVE_FEE_BIPS = 3; // Curve Aave pool fee is 0.03% (3 bips)

  //
  // Construct the contracts
  //

  const curveAaveStakerContract = new ethers.Contract(
    curveAaveStakerAddress,
    CurveAaveStakerAbi,
    deployerSigner
  );
  const uniswapV3PoolContract = new ethers.Contract(
    uniswapV3PoolAddress,
    UniswapV3PoolAbi,
    deployerSigner
  );
  const usdcTokenContract = new ethers.Contract(
    usdcTokenAddress,
    ERC20Abi,
    deployerSigner
  );

  //
  // Allow Curve Aave staker to spend USDC if needed
  //

  const allowance = await usdcTokenContract.allowance(
    deployer,
    curveAaveStakerAddress
  );

  if (allowance.lt(USDC_AMOUNT)) {
    console.log(`Approving ${CURVE_AAVE_STAKER_CONTRACT} to spend USDC`);

    const approveTx: ethers.ContractTransaction =
      await usdcTokenContract.approve(
        curveAaveStakerAddress,
        USDC_AMOUNT.sub(allowance)
      );

    await approveTx.wait();
  }

  //
  // Get price of ultra3CRV in USDC
  //

  const gaugeTokenAmount =
    await curveAaveStakerContract.callStatic.stakeOneStable(1, USDC_AMOUNT);

  const poolFee = gaugeTokenAmount.mul(CURVE_AAVE_FEE_BIPS).div(10_000);

  const ultra3CRVPrice = gaugeTokenAmount.add(poolFee);

  //
  // Get pool token order
  //

  const baseIsToken0 = await deployments.read(
    UNI_V3_POOLER_CONTRACT,
    { from: deployer },
    "baseIsToken0"
  );

  //
  // Initialize the Uniswap V3 pool
  //

  console.log(
    `Initializing Uniswap V3 pool with ultra3CRV price ${ultra3CRVPrice}`
  );

  const initTx: ethers.ContractTransaction =
    await uniswapV3PoolContract.initialize(
      // The initial sqrt price [sqrt(amountToken1/amountToken0)] as a Q64.96 value
      encodePriceSqrt(
        baseIsToken0 ? ultra3CRVPrice : BASE_TOKEN_AMOUNT,
        baseIsToken0 ? BASE_TOKEN_AMOUNT : ultra3CRVPrice
      )
    );

  await initTx.wait();

  //////////////////////////////////////////////////////////////////////////////
  // Record addresses
  //////////////////////////////////////////////////////////////////////////////

  writeAddress(network, "UniswapV3Pool", uniswapV3PoolAddress);
};

export default func;
func.tags = ["TokenRoutes"];
