
variable "TAG" {
  default = "devel"
}

variable "DOCKER_ORGANIZATION" {
  default = "juztamau5"
}

target "ultrachess-deployer" {
  tags = ["${DOCKER_ORGANIZATION}/ultrachess-deployer:${TAG}"]
}
