
variable "TAG" {
  default = "devel"
}

variable "DOCKER_ORGANIZATION" {
  default = "juztamau5"
}

target "lp-nft-deployer" {
  tags = ["${DOCKER_ORGANIZATION}/lp-nft-deployer:${TAG}"]
}
