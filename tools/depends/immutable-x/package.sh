#!/bin/bash
################################################################################
#
#  Copyright (C) 2022 Ultrachess Team
#  This file is part of Ultrachess - https://github.com/Ultrachess/contracts
#
#  SPDX-License-Identifier: Apache-2.0
#  See the file LICENSE for more information.
#
################################################################################

#
# Immutable X smart contracts
#
#   https://github.com/immutable/imx-contracts
#
# SPDX-License-Identifier: MIT
#
#   * DEPENDS_DIR - Location of dependency package files
#   * REPO_DIR - Place to download the repo
#   * INSTALL_DIR - Place to install the contract files
#
# Dependencies:
#
#   * git
#   * patch
#

# Enable strict mode
set -o errexit
set -o pipefail
set -o nounset

#
# Dependency name and version
#

IMMUTABlE_X_NAME="immutable-x"
IMMUTABlE_X_VERSION="f567b260080bed5481e9de8d26d3e083a712c0a2" # master on 2022-11-01
IMMUTABlE_X_REPO="https://github.com/immutable/imx-contracts.git"

#
# Environment paths
#

# Pacakge definition directory
DEPENDS_DIR_IMMUTABlE_X="${DEPENDS_DIR}/${IMMUTABlE_X_NAME}"

# Checkout directory
REPO_DIR_IMMUTABlE_X="${REPO_DIR}/${IMMUTABlE_X_NAME}"

# Install directory
INSTALL_DIR_IMMUTABlE_X="${INSTALL_DIR}/${IMMUTABlE_X_NAME}"

#
# Checkout
#

function checkout_immutable_x() {
  echo "Checking out Immutable x"

  if [ ! -d "${REPO_DIR_IMMUTABlE_X}" ]; then
    git clone "${IMMUTABlE_X_REPO}" "${REPO_DIR_IMMUTABlE_X}"
  fi

  (
    cd "${REPO_DIR_IMMUTABlE_X}"
    git fetch --all
    git reset --hard "${IMMUTABlE_X_VERSION}"
  )
}

#
# Patch
#

function patch_immutable_x() {
  echo "Patching Immutable x"

  #patch -p1 --directory="${REPO_DIR_IMMUTABlE_X}" < \
  #  "${DEPENDS_DIR_IMMUTABlE_X}/0001-Fix-compiler-error.patch"
}

#
# Build
#

function build_immutable_x() {
  : # No build step
}

#
# Install
#

function install_immutable_x() {
  echo "Installing Immutable x"

  rm -rf "${INSTALL_DIR_IMMUTABlE_X}"
  cp -r "${REPO_DIR_IMMUTABlE_X}/contracts" "${INSTALL_DIR_IMMUTABlE_X}"
}
