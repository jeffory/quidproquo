# QPQ Parameter Module

Terraform module for creating AWS Systems Manager (SSM) Parameter Store entries.

## Compliance Defaults

- Default type is `SecureString` to enforce encryption at rest.
- KMS key can be explicitly provided for fine-grained key control.
- Parameter tier defaults to `Standard` for cost efficiency; use `Advanced` for > 4 KB values or parameter policies.

## Usage

```hcl
module "parameter" {
  source = "./tf-modules/parameter"

  name        = "/my-app/database/password"
  description = "Database password"
  type        = "SecureString"
  value       = "supersecret"
  kms_key_id  = aws_kms_key.app_key.arn
  tags = {
    Environment = "production"
  }
}
```

## Inputs

| Name        | Description                                                | Type        | Default         | Required |
|-------------|------------------------------------------------------------|-------------|-----------------|----------|
| name        | Name of the SSM parameter                                  | string      | n/a             | yes      |
| description | Description of the parameter                               | string      | ""              | no       |
| type        | Type: String, StringList, or SecureString                  | string      | "SecureString"  | no       |
| value       | Value of the parameter                                     | string      | ""              | no       |
| kms_key_id  | KMS key ID for SecureString parameters                     | string      | null            | no       |
| tier        | Parameter tier: Standard, Advanced, Intelligent-Tiering    | string      | "Standard"      | no       |
| tags        | Tags to apply                                              | map(string) | {}              | no       |
| overwrite   | Overwrite an existing parameter                            | bool        | false           | no       |

## Outputs

| Name    | Description                     |
|---------|---------------------------------|
| arn     | ARN of the SSM parameter        |
| name    | Name of the SSM parameter       |
| version | Version of the SSM parameter    |
