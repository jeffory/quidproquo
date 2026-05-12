# QPQ Service-Function Module

Terraform module for creating AWS Lambda functions with code zip, layers, IAM role, log group, and environment variables.

## Compliance Defaults

- **IAM role auto-created** with least-privilege `AWSLambdaBasicExecutionRole`.
- **VPC access policy** auto-attached if VPC config is provided.
- **CloudWatch log group** created with configurable retention (default 14 days).
- **X-Ray tracing** defaults to `PassThrough`; set to `Active` for full tracing.
- Environment variables can be encrypted with a KMS key.

## Usage

```hcl
module "service_function" {
  source = "./tf-modules/service-function"

  function_name = "my-app-processor"
  handler       = "index.handler"
  runtime       = "nodejs20.x"

  source_code_path = "./dist/function.zip"
  source_code_hash = filebase64sha256("./dist/function.zip")

  memory_size = 256
  timeout     = 30

  environment_variables = {
    NODE_ENV = "production"
    LOG_LEVEL = "info"
  }

  layers = [
    "arn:aws:lambda:us-east-1:123456789012:layer:my-layer:1"
  ]

  tags = {
    Environment = "production"
  }
}
```

## Inputs

| Name                         | Description                                              | Type         | Default         | Required |
|------------------------------|----------------------------------------------------------|--------------|-----------------|----------|
| function_name                | Name of the Lambda function                              | string       | n/a             | yes      |
| description                  | Description of the function                              | string       | ""              | no       |
| handler                      | Lambda handler                                           | string       | "index.handler" | no       |
| runtime                      | Lambda runtime                                           | string       | "nodejs20.x"    | no       |
| source_code_path             | Path to deployment package zip                           | string       | null            | no       |
| source_code_hash             | Base64-encoded SHA256 hash                               | string       | null            | no       |
| s3_bucket                    | S3 bucket containing package                             | string       | null            | no       |
| s3_key                       | S3 key of the package                                    | string       | null            | no       |
| s3_object_version            | S3 object version                                        | string       | null            | no       |
| layers                       | List of Lambda layer ARNs                                | list(string) | []              | no       |
| memory_size                  | Memory in MB (128-10240)                                 | number       | 128             | no       |
| timeout                      | Timeout in seconds (1-900)                               | number       | 3               | no       |
| environment_variables        | Environment variables                                    | map(string)  | {}              | no       |
| reserved_concurrent_executions | Reserved concurrent executions                           | number       | -1              | no       |
| publish                      | Publish a new version                                    | bool         | false           | no       |
| tracing_config_mode          | X-Ray tracing mode                                       | string       | "PassThrough"   | no       |
| vpc_subnet_ids               | VPC subnet IDs                                           | list(string) | []              | no       |
| vpc_security_group_ids       | VPC security group IDs                                   | list(string) | []              | no       |
| iam_role_name                | Existing IAM role name (auto-created if omitted)         | string       | null            | no       |
| iam_role_policy_arns         | Additional IAM policy ARNs                               | list(string) | []              | no       |
| log_retention_in_days        | CloudWatch log retention in days                         | number       | 14              | no       |
| kms_key_arn                  | KMS key ARN for env var encryption                       | string       | null            | no       |
| tags                         | Tags to apply                                            | map(string)  | {}              | no       |

## Outputs

| Name         | Description                           |
|--------------|---------------------------------------|
| arn          | ARN of the Lambda function            |
| function_name| Name of the Lambda function           |
| invoke_arn   | Invoke ARN                            |
| qualified_arn| Qualified ARN (versioned)             |
| version      | Published version                     |
| role_arn     | ARN of the IAM role                   |
| log_group_name| Name of the CloudWatch log group     |
