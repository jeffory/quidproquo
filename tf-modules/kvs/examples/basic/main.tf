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

module "kvs" {
  source = "../../"

  name           = "qpq-example-kvs"
  hash_key       = "PK"
  range_key      = "SK"
  hash_key_type  = "S"
  range_key_type = "S"

  attributes = [
    { name = "GSI1PK", type = "S" },
    { name = "GSI1SK", type = "S" },
  ]

  global_secondary_indexes = [
    {
      name      = "GSI1"
      hash_key  = "GSI1PK"
      range_key = "GSI1SK"
    }
  ]

  ttl_enabled   = true
  ttl_attribute = "ttl"

  tags = {
    Project     = "QuidProQuo"
    Environment = "example"
  }
}

output "table_arn" {
  value = module.kvs.arn
}
