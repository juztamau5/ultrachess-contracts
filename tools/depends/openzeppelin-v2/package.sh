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
# OpenZeppelin V2
#
# SPDX-License-Identifier: MIT
#
# Parameters:
#
#   * DEPENDS_DIR - Location of dependency package files
#   * REPO_DIR - Place to download the repo
#   * INSTALL_DIR - Place to install the contract files
#
# Dependencies:
#
#   * npm
#   * tar
#   * wget
#

# Enable strict mode
set -o errexit
set -o pipefail
set -o nounset

#
# Dependency name and version
#

OPENZEPPELIN_NAME="openzeppelin-v2"
OPENZEPPELIN_PACKAGE="@openzeppelin/contracts"
OPENZEPPELIN_VERSION="2.5.1"
OPENZEPPELIN_TARBALL="$(npm view ${OPENZEPPELIN_PACKAGE}@${OPENZEPPELIN_VERSION} dist.tarball)"
OPENZEPPELIN_ARCHIVE_NAME="${OPENZEPPELIN_NAME}-${OPENZEPPELIN_VERSION}.tar.gz"

#
# Environment paths and directories
#

# Package definition directory
DEPENDS_DIR_OPENZEPPELIN="${DEPENDS_DIR}/${OPENZEPPELIN_NAME}"

# Checkout directory
REPO_DIR_OPENZEPPELIN="${REPO_DIR}/${OPENZEPPELIN_NAME}"

# Install directory
INSTALL_DIR_OPENZEPPELIN="${INSTALL_DIR}/${OPENZEPPELIN_NAME}"

# Archive path
OPENZEPPELIN_ARCHIVE_PATH="${REPO_DIR}/${OPENZEPPELIN_ARCHIVE_NAME}"

#
# Checkout
#

function checkout_openzeppelin_v2() {
  echo "Downloading OpenZeppelin V2"

  if [ ! -f "${OPENZEPPELIN_ARCHIVE_PATH}" ]; then
    wget -O "${OPENZEPPELIN_ARCHIVE_PATH}" "${OPENZEPPELIN_TARBALL}"
  fi

  echo "Extracting OpenZeppelin V2"

  rm -rf "${REPO_DIR_OPENZEPPELIN}"
  mkdir -p "${REPO_DIR_OPENZEPPELIN}"
  tar -xzf "${OPENZEPPELIN_ARCHIVE_PATH}" -C "${REPO_DIR_OPENZEPPELIN}" --strip-components=1 --overwrite
}

#
# Patch
#

function patch_openzeppelin_v2() {
  : # No patch step
}

#
# Build
#

function build_openzeppelin_v2() {
  : # No build step
}

#
# Install
#

function install_openzeppelin_v2() {
  echo "Installing OpenZeppelin V2"

  rm -rf "${INSTALL_DIR_OPENZEPPELIN}"
  cp -r "${REPO_DIR_OPENZEPPELIN}" "${INSTALL_DIR_OPENZEPPELIN}"
}
