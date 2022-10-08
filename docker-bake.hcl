
target "docker-metadata-action" {}

group "default" {
  targets = ["lp-nft-deployer"]
}

target "lp-nft-deployer" {
  inherits = ["docker-metadata-action"]
  context  = "."
  target   = "lp-nft-deployer"
}
