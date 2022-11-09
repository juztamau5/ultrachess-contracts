// Copyright 2022 juztamau5

// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

// slither-disable-next-line solc-version
pragma solidity 0.8.16;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

/**
 * @dev Test contract to create a Uniswap-V3 pool using a provided Uni-V3 factory
 *
 * This is a helper contract for the deployment of dependencies on test
 * networks. The pool is created in the constructor and stored in a member
 * variable so that it can be read back without the deployment system having
 * to parse transaction receipts.
 */
contract UniswapV3PoolFactory {
    /**
     * @dev The address of the pool for this token pair
     */
    IUniswapV3Pool public immutable uniV3Pool;

    //////////////////////////////////////////////////////////////////////////////
    // Initialization
    //////////////////////////////////////////////////////////////////////////////

    /**
     * @dev Construct the test pool instance
     *
     * @param factory The contract address of the Uniswap V3 factory
     * @param token0 The first token of the pool by address sort order
     * @param token1 The second token of the pool by address sort order
     * @param fee The fee collected upon every swap in the pool, denominated in hundredths of a bip
     */
    constructor(address factory, address token0, address token1, uint24 fee) {
        // Validate parameters
        require(factory != address(0), "Invalid factory");
        require(token0 != address(0), "Invalid token0");
        require(token1 != address(0), "Invalid token1");

        // Call external contracts
        uniV3Pool = IUniswapV3Pool(
            IUniswapV3Factory(factory).createPool(token0, token1, fee)
        );
    }
}
