/*
 * Copyright (C) 2022-2023 Ultrachess team
 * This file is part of Ultrachess - https://github.com/Ultrachess/contracts
 *
 * This file is derived from the VRGDAs project under the MIT license.
 * https://github.com/transmissions11/VRGDAs
 *
 * SPDX-License-Identifier: Apache-2.0 AND MIT
 * See the file LICENSE for more information.
 */

pragma solidity 0.8.16;

import {wadLn, wadMul, wadExp, unsafeWadMul, toWadUnsafe} from "solmate/src/utils/SignedWadMath.sol";

/**
 * @dev Variable Rate Gradual Dutch Auction
 */
abstract contract VRGDA {
  //////////////////////////////////////////////////////////////////////////////
  // State
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Target price for a token, to be scaled according to sales pace
   *
   * Represented as an 18 decimal fixed point number.
   */
  int256 internal immutable _targetPrice;

  /**
   * @dev Precomputed constant that allows us to rewrite pow() as an exp()
   *
   * Represented as an 18 decimal fixed point number.
   */
  int256 internal immutable _decayConstant;

  //////////////////////////////////////////////////////////////////////////////
  // Initialization
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Construct a new VRGDA
   *
   * @param targetPrice Target price for a token if sold on pace, scaled by 1e18
   * @param priceDecayConstant The percent price decays per unit of time with no sales, scaled by 1e18
   */
  constructor(int256 targetPrice, int256 priceDecayConstant) {
    // Initialize state
    _targetPrice = targetPrice;
    _decayConstant = wadLn(1e18 - priceDecayConstant);

    // Validate state
    // The decay constant must be negative for VRGDAs to work
    require(_decayConstant < 0, "Nonnegative decay constant");
  }

  //////////////////////////////////////////////////////////////////////////////
  // Pricing logic
  //////////////////////////////////////////////////////////////////////////////

  /**
   * @dev Calculate the price of a token according to the VRGDA formula.
   *
   * @param timeSinceStart Time passed since the VRGDA began, scaled by 1e18
   * @param sold The total number of tokens that have been sold so far
   *
   * @return The price of a token according to VRGDA, scaled by 1e18
   */
  function getVRGDAPrice(
    int256 timeSinceStart,
    uint256 sold
  ) public view virtual returns (uint256) {
    unchecked {
      return
        uint256(
          wadMul(
            _targetPrice,
            wadExp(
              unsafeWadMul(
                _decayConstant,
                // Theoretically calling toWadUnsafe with sold can silently
                // overflow but under any reasonable circumstance it will never
                // be large enough. We use sold + 1 as the VRGDA formula's n
                // param represents the nth token and sold is the n-1th token.
                timeSinceStart - getTargetSaleTime(toWadUnsafe(sold + 1))
              )
            )
          )
        );
    }
  }

  /**
   * @dev Given a number of tokens sold, return the target time that number of
   * tokens should be sold by
   *
   * @param sold A number of tokens sold, scaled by 1e18, to get the
   *             corresponding target sale time for
   *
   * @return The target time the tokens should be sold by, scaled by 1e18,
   *         where the time is relative, such that 0 means the tokens should be
   *         sold immediately when the VRGDA begins
   */
  function getTargetSaleTime(int256 sold) public view virtual returns (int256);
}
