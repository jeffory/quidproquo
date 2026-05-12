terraform {
  required_version = ">= 1.3.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

module "virtual_network" {
  source = "../../"

  name = "qpq-example"

  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs = ["10.0.3.0/24", "10.0.4.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true

  vpc_endpoints = [
    { service_name = "s3", service_type = "Gateway", route_table_ids = [] },
  ]

  tags = {
    Project     = "QuidProQuo"
    Environment = "example"
  }
}

output "vpc_id" {
  value = module.virtual_network.vpc_id
}

output "public_subnet_ids" {
  value = module.virtual_network.public_subnet_ids
}

output "private_subnet_ids" {
  value = module.virtual_network.private_subnet_ids
}
