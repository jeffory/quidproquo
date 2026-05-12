# QPQ Secret Module

Terraform module for creating AWS Secrets Manager secrets with optional rotation.

## Compliance Defaults

- Recovery window defaults to **30 days** to prevent accidental data loss.
- KMS encryption is strongly recommended and can be explicitly configured.
- Rotation hooks are supported via a dedicated Lambda ARN.

## Usage

```hcl
module "secret" {
  source = "./tf-modules/secret"

  name        = "my-app/db-password"
  description = "Database password"
  secret_string = jsonencode({
    username = "admin"
    password = "changeme"
  })
  kms_key_id = aws_kms_key.app_key.arn
  tags = {
    Environment = "production"
  }
}
```

## Inputs

| Name                              | Description                                                | Type         | Default | Required |
|-----------------------------------|------------------------------------------------------------|--------------|---------|----------|
| name                              | Name of the Secrets Manager secret                         | string       | n/a     | yes      |
| description                       | Description of the secret                                  | string       | ""      | no       |
| kms_key_id                        | KMS key ARN for encrypting the secret                      | string       | null    | no       |
| secret_string                     | Initial secret string value                                | string       | null    | no       |
| secret_binary                     | Initial secret binary value (base64)                       | string       | null    | no       |
| recovery_window_in_days           | Recovery window (0 or 7-30)                                | number       | 30      | no       |
| enable_rotation                   | Enable automatic secret rotation                           | bool         | false   | no       |
| rotation_lambda_arn               | ARN of the rotation Lambda                                 | string       | null    | no       |
| rotation_automatically_after_days | Days between rotations                                     | number       | 30      | no       |
| replica_regions                   | List of regions to replicate to                            | list(string) | []      | no       |
| tags                              | Tags to apply                                              | map(string)  | {}      | no       |

## Outputs

| Name      | Description                           |
|-----------|---------------------------------------|
| arn       | ARN of the secret                     |
| id        | ID of the secret                      |
| name      | Name of the secret                    |
| version_id| Version ID of the current version     |
