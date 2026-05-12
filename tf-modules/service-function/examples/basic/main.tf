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

module "service_function" {
  source = "../../"

  function_name = "qpq-example-function"
  handler       = "index.handler"
  runtime       = "nodejs20.x"

  # In a real scenario you would provide a zip; this example shows the interface.
  # source_code_path = "./function.zip"
  # source_code_hash = filebase64sha256("./function.zip")

  memory_size = 128
  timeout     = 10

  environment_variables = {
    EXAMPLE_VAR = "example-value"
  }

  tags = {
    Project     = "QuidProQuo"
    Environment = "example"
  }
}

output "function_arn" {
  value = module.service_function.arn
}
