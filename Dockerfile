# syntax=docker.io/docker/dockerfile:1.4
# Need to use Debian-based image because solc >= 0.6 requires modern glibc instead of musl
FROM node:18.10.0-bullseye-slim as base

# this stage installs system dependencies for building the node projects
FROM base as builder

# install build dependencies
RUN <<EOF
apt update
apt install -y bash git make patch tar wget
rm -rf /var/lib/apt/lists/*
EOF

# this stage copies the univ3-lp-nft project and build it
FROM builder as lp-nft-builder

# build
COPY . /app/univ3-lp-nft
WORKDIR /app/univ3-lp-nft
RUN yarn install --non-interactive
RUN yarn package

# this stage is runtime image for rollups (hardhat)
FROM base as lp-nft-deployer

# copy yarn build
COPY --from=lp-nft-builder /app /app
WORKDIR /app/univ3-lp-nft

ENTRYPOINT ["npx", "hardhat"]
CMD ["deploy"]
