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

module "secret" {
  source = "../../"

  name        = "qpq/example/secret"
  description = "Example secret created by the QPQ secret module"
  secret_string = jsonencode({
    username = "example-user"
    password = "example-password-123"
  })
  tags = {
    Project     = "QuidProQuo"
    Environment = "example"
  }
}

output "secret_arn" {
  value = module.secret.arn
}
