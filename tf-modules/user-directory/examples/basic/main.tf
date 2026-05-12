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

module "user_directory" {
  source = "../../"

  name = "qpq-example-users"

  clients = {
    web = {
      callback_urls        = ["https://example.com/callback"]
      logout_urls          = ["https://example.com/logout"]
      allowed_oauth_flows  = ["code"]
      allowed_oauth_scopes = ["openid", "email", "profile"]
    }
  }

  groups = {
    admins = { description = "Admin users", precedence = 1 }
    users  = { description = "Standard users", precedence = 10 }
  }

  tags = {
    Project     = "QuidProQuo"
    Environment = "example"
  }
}

output "user_pool_id" {
  value = module.user_directory.id
}
