/*
 * Copyright (C) 2022 Ultrachess team
 * This file is part of Ultrachess - https://github.com/Ultrachess/contracts
 *
 * SPDX-License-Identifier: Apache-2.0
 * See the file LICENSE for more information.
 */

/* eslint no-empty: "off" */

import "hardhat-deploy";

import fs from "fs";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// TODO: Fully qualified contract names
const BASE_TOKEN_CONTRACT = "CHESS";
const USDC_TOKEN_CONTRACT = "USDC";
const UNI_V3_POOLER_CONTRACT = "UniV3Pooler";

//
// Address book
//

interface AddressBook {
  uniV3Pooler: string;
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

const getContractAddress = async (
  contractSymbol: string,
  contractName: string,
  hardhat_re: HardhatRuntimeEnvironment,
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

//
// Mint the deployer an LP NFT
//

const func: DeployFunction = async (hardhat_re: HardhatRuntimeEnvironment) => {
  const { deployments, ethers, getNamedAccounts } = hardhat_re;

  const { execute } = deployments;
  const { deployer } = await getNamedAccounts();

  // Get the network name
  const network = hardhat_re.network.name;

  // Load the contract addresses
  loadAddresses(network);

  // Get contract addresses
  const uniV3PoolerAddress = await getContractAddress(
    "uniV3Pooler",
    UNI_V3_POOLER_CONTRACT,
    hardhat_re,
    network
  );

  //////////////////////////////////////////////////////////////////////////////
  //
  // Mint the deployer an LP NFT to initialize the Uniswap V3 liquidity pool
  //
  //////////////////////////////////////////////////////////////////////////////

  // Amount to mint
  const USDC_AMOUNT = ethers.utils.parseUnits("1", 6); // 1 USDC
  const BASE_TOKEN_AMOUNT = ethers.utils.parseUnits("1", 18); // 1 token

  // Calculate the fee consumed by the Curve Aave pool
  const CURVE_AAVE_FEE_BIPS = 3; // 0.03%
  const CURVE_AAVE_FEE_USDC = USDC_AMOUNT.mul(CURVE_AAVE_FEE_BIPS).div(10_000);

  //
  // Approve deployer's USDC
  //

  console.log("Approving deployer's USDC");

  await execute(
    USDC_TOKEN_CONTRACT,
    {
      from: deployer,
      log: true,
    },
    "approve",
    uniV3PoolerAddress,
    USDC_AMOUNT.add(CURVE_AAVE_FEE_USDC)
  );

  //
  // Approve deployer's base token
  //

  console.log("Approving deployer's base token");

  await execute(
    BASE_TOKEN_CONTRACT,
    {
      from: deployer,
      log: true,
    },
    "approve",
    uniV3PoolerAddress,
    BASE_TOKEN_AMOUNT
  );

  //
  // Mint LP NFT
  //

  console.log("Minting LP NFT to deployer");

  await execute(
    UNI_V3_POOLER_CONTRACT,
    {
      from: deployer,
      log: true,
    },
    "mintNFTImbalance",
    [0, USDC_AMOUNT.add(CURVE_AAVE_FEE_USDC), 0], // DAI, USDC, USDT
    BASE_TOKEN_AMOUNT,
    deployer
  );
};

module.exports = func;
module.exports.tags = ["MintLpNft"];
