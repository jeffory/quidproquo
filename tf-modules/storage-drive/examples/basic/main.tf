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

module "storage_drive" {
  source = "../../"

  bucket_name = "qpq-example-storage-bucket-unique-123456"

  lifecycle_rules = [
    {
      id                          = "archive-logs"
      prefix                      = "logs/"
      transition_standard_ia_days = 30
      transition_glacier_days     = 90
      expiration_days             = 365
    }
  ]

  tags = {
    Project     = "QuidProQuo"
    Environment = "example"
  }
}

output "bucket_arn" {
  value = module.storage_drive.arn
}
