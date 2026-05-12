# QPQ Storage-Drive Module

Terraform module for creating AWS S3 buckets with versioning, encryption, public-access blocks, and lifecycle rules.

## Compliance Defaults

- **Versioning enabled** by default for data recovery.
- **Server-side encryption** enabled by default (`AES256`).
- **Public access fully blocked** by default (all four settings enabled).
- Lifecycle rules support transitions to cost-effective storage classes and object expiration.

## Usage

```hcl
module "storage_drive" {
  source = "./tf-modules/storage-drive"

  bucket_name = "my-app-assets-bucket"

  lifecycle_rules = [
    {
      id                          = "archive-old-objects"
      prefix                      = "logs/"
      transition_standard_ia_days = 30
      transition_glacier_days     = 90
      expiration_days             = 365
    }
  ]

  tags = {
    Environment = "production"
  }
}
```

## Inputs

| Name                    | Description                                         | Type         | Default   | Required |
|-------------------------|-----------------------------------------------------|--------------|-----------|----------|
| bucket_name             | Name of the S3 bucket (globally unique)             | string       | n/a       | yes      |
| force_destroy           | Force destroy the bucket (removes all objects)      | bool         | false     | no       |
| versioning_enabled      | Enable S3 versioning                                | bool         | true      | no       |
| versioning_mfa_delete   | Enable MFA delete for versioning                    | bool         | false     | no       |
| sse_algorithm           | SSE algorithm: AES256 or aws:kms                    | string       | "AES256"  | no       |
| kms_key_id              | KMS key ID for aws:kms encryption                   | string       | null      | no       |
| block_public_acls       | Block public ACLs                                   | bool         | true      | no       |
| block_public_policy     | Block public policy                                 | bool         | true      | no       |
| ignore_public_acls      | Ignore public ACLs                                  | bool         | true      | no       |
| restrict_public_buckets | Restrict public buckets                             | bool         | true      | no       |
| lifecycle_rules         | List of lifecycle rules                             | list(object) | []        | no       |
| tags                    | Tags to apply                                       | map(string)  | {}        | no       |

## Outputs

| Name                        | Description                          |
|-----------------------------|--------------------------------------|
| arn                         | ARN of the S3 bucket                 |
| id                          | ID of the S3 bucket                  |
| bucket_domain_name          | Domain name of the bucket            |
| bucket_regional_domain_name | Regional domain name of the bucket   |
