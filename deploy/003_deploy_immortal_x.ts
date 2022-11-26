/*
 * Copyright (C) 2022 Ultrachess team
 * This file is part of Ultrachess - https://github.com/Ultrachess/contracts
 *
 * SPDX-License-Identifier: Apache-2.0
 * See the file LICENSE for more information.
 */

/* eslint no-empty: "off" */

import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";

import fs from "fs";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction, DeployOptions } from "hardhat-deploy/types";

// Artifacts for Vyper contracts
import CurveTokenV3Artifact from "../contracts/bytecode/curve/CurveTokenV3.json";
import StableSwapAaveArtifact from "../contracts/bytecode/curve/StableSwapAave.json";
import Erc20CrvArtifact from "../contracts/bytecode/curve-dao/ERC20CRV.json";
import GaugeControllerArtifact from "../contracts/bytecode/curve-dao/GaugeController.json";
import LiquidityGaugeArtifact from "../contracts/bytecode/curve-dao/LiquidityGauge.json";
import MinterArtifact from "../contracts/bytecode/curve-dao/Minter.json";
import VotingEscrowArtifact from "../contracts/bytecode/curve-dao/VotingEscrow.json";

// TODO: Fully qualified contract names
const IMMORTAL_X_ASSET_CONTRACT = "Asset";
const IMMORTAL_X_REGISTRATION_CONTRACT = "Registration";

//
// Address book
//

interface AddressBook {
  immortalXAssetAddress: string;
  immortalXRegistrationAddress: string;
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

  return; // undefined
};

//
// Deploy the Immortal X contracts
//

const func: DeployFunction = async (hardhat_re: HardhatRuntimeEnvironment) => {
  const { deployments, ethers, getNamedAccounts } = hardhat_re;

  const { deploy, execute, read } = deployments;
  const { deployer } = await getNamedAccounts();

  const opts: DeployOptions = {
    deterministicDeployment: true,
    from: deployer,
    log: true,
  };

  // Get the network name
  const network = hardhat_re.network.name;

  // Get the contract addresses
  loadAddresses(network);
  let immortalXAssetAddress = await getContractAddress(
    "immortalXAsset",
    IMMORTAL_X_ASSET_CONTRACT,
    network
  );
  let immortalXRegistrationAddress = await getContractAddress(
    "immortalXRegistration",
    IMMORTAL_X_REGISTRATION_CONTRACT,
    network
  );

  //////////////////////////////////////////////////////////////////////////////
  //
  // Deploy Immortal X contracts
  //
  //////////////////////////////////////////////////////////////////////////////

  // Deploy Asset contract
  if (immortalXAssetAddress) {
    console.log(
      `Using existing ${IMMORTAL_X_ASSET_CONTRACT} contract at ${immortalXAssetAddress}`
    );
  } else {
    console.log(`Deploying ${IMMORTAL_X_ASSET_CONTRACT}`);
    const tx = await deploy(IMMORTAL_X_ASSET_CONTRACT, {
      ...opts,
      args: [deployer, "CONTRACT_NAME", "CONTRACT_SYMBOL", deployer],
    });
    immortalXAssetAddress = tx.address;
  }

  // Deploy Registration contract
  if (immortalXRegistrationAddress) {
    console.log(
      `Using existing ${IMMORTAL_X_REGISTRATION_CONTRACT} contract at ${immortalXRegistrationAddress}`
    );
  } else {
    console.log(`Deploying ${IMMORTAL_X_REGISTRATION_CONTRACT}`);
    const tx = await deploy(IMMORTAL_X_REGISTRATION_CONTRACT, {
      ...opts,
      args: [/*imxAddress*/ "0x"],
    });
    immortalXRegistrationAddress = tx.address;
  }
};

module.exports = func;
module.exports.tags = ["Curve"];
