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

module "parameter" {
  source = "../../"

  name        = "/qpq/example/parameter"
  description = "Example parameter created by the QPQ parameter module"
  type        = "SecureString"
  value       = "example-value-123"
  tags = {
    Project     = "QuidProQuo"
    Environment = "example"
  }
}

output "parameter_arn" {
  value = module.parameter.arn
}
