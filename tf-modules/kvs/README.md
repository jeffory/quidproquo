# QPQ KVS Module

Terraform module for creating AWS DynamoDB tables with PK/SK, indexes, TTL, encryption, and PITR.

## Compliance Defaults

- **PITR enabled** by default for disaster recovery.
- **Server-side encryption enabled** by default (AWS managed or customer-managed KMS).
- **TTL** can be enabled with a configurable attribute for automatic data expiry.
- **On-demand billing** (`PAY_PER_REQUEST`) is the default to avoid capacity-planning overhead.

## Usage

```hcl
module "kvs" {
  source = "./tf-modules/kvs"

  name         = "my-app-data"
  hash_key     = "PK"
  range_key    = "SK"
  hash_key_type = "S"
  range_key_type = "S"

  global_secondary_indexes = [
    {
      name     = "GSI1"
      hash_key = "GSI1PK"
      range_key = "GSI1SK"
    }
  ]

  ttl_enabled   = true
  ttl_attribute = "ttl"

  tags = {
    Environment = "production"
  }
}
```

## Inputs

| Name                     | Description                                              | Type                  | Default           | Required |
|--------------------------|----------------------------------------------------------|-----------------------|-------------------|----------|
| name                     | Name of the DynamoDB table                               | string                | n/a               | yes      |
| billing_mode             | Billing mode: PROVISIONED or PAY_PER_REQUEST             | string                | "PAY_PER_REQUEST" | no       |
| hash_key                 | Name of the hash (partition) key                         | string                | n/a               | yes      |
| hash_key_type            | Type of the hash key: S, N, or B                         | string                | "S"               | no       |
| range_key                | Name of the range (sort) key                             | string                | null              | no       |
| range_key_type           | Type of the range key: S, N, or B                        | string                | "S"               | no       |
| attributes               | Additional attributes for GSIs/LSIs                      | list(object)          | []                | no       |
| global_secondary_indexes | List of global secondary indexes                         | list(object)          | []                | no       |
| local_secondary_indexes  | List of local secondary indexes                          | list(object)          | []                | no       |
| point_in_time_recovery   | Enable point-in-time recovery                            | bool                  | true              | no       |
| server_side_encryption   | Enable server-side encryption                            | bool                  | true              | no       |
| kms_key_arn              | KMS key ARN for encryption (null = AWS managed)          | string                | null              | no       |
| ttl_attribute            | Name of the TTL attribute                                | string                | null              | no       |
| ttl_enabled              | Enable TTL on the table                                  | bool                  | false             | no       |
| read_capacity            | Read capacity units (PROVISIONED only)                   | number                | 5                 | no       |
| write_capacity           | Write capacity units (PROVISIONED only)                  | number                | 5                 | no       |
| tags                     | Tags to apply                                            | map(string)           | {}                | no       |

## Outputs

| Name        | Description                 |
|-------------|-----------------------------|
| arn         | ARN of the DynamoDB table   |
| id          | ID of the DynamoDB table    |
| name        | Name of the DynamoDB table  |
| stream_arn  | ARN of the table stream     |
| stream_label| Stream label                |
