# QPQ Virtual-Network Module

Terraform module for creating AWS VPCs with subnets, NAT gateways, and VPC endpoints.

## Compliance Defaults

- **DNS hostnames and support enabled** by default.
- **Public subnets** auto-assign public IPs; **private subnets** do not.
- **NAT gateways** enabled by default (one per AZ) for secure outbound from private subnets.
- **Single NAT gateway** mode available for cost-sensitive dev/test environments.
- **VPC endpoints** support both Gateway (S3, DynamoDB) and Interface types.

## Usage

```hcl
module "virtual_network" {
  source = "./tf-modules/virtual-network"

  name = "my-app"
  cidr_block = "10.0.0.0/16"

  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs = ["10.0.3.0/24", "10.0.4.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false

  vpc_endpoints = [
    { service_name = "s3", service_type = "Gateway", route_table_ids = [] },
    { service_name = "dynamodb", service_type = "Gateway", route_table_ids = [] },
  ]

  tags = {
    Environment = "production"
  }
}
```

## Inputs

| Name                 | Description                                              | Type         | Default       | Required |
|----------------------|----------------------------------------------------------|--------------|---------------|----------|
| name                 | Name prefix for VPC resources                            | string       | n/a           | yes      |
| cidr_block           | CIDR block for the VPC                                   | string       | "10.0.0.0/16" | no       |
| enable_dns_hostnames | Enable DNS hostnames                                     | bool         | true          | no       |
| enable_dns_support   | Enable DNS support                                       | bool         | true          | no       |
| availability_zones   | List of AZs (auto-detected if empty)                     | list(string) | []            | no       |
| public_subnet_cidrs  | List of public subnet CIDRs                              | list(string) | []            | no       |
| private_subnet_cidrs | List of private subnet CIDRs                             | list(string) | []            | no       |
| enable_nat_gateway   | Enable NAT gateways                                      | bool         | true          | no       |
| single_nat_gateway   | Use a single NAT gateway                                 | bool         | false         | no       |
| enable_vpn_gateway   | Enable a VPN gateway                                     | bool         | false         | no       |
| vpc_endpoints        | List of VPC endpoints to create                          | list(object) | []            | no       |
| tags                 | Tags to apply                                            | map(string)  | {}            | no       |

## Outputs

| Name                    | Description                      |
|-------------------------|----------------------------------|
| vpc_id                  | ID of the VPC                    |
| vpc_arn                 | ARN of the VPC                   |
| vpc_cidr_block          | CIDR block of the VPC            |
| internet_gateway_id     | ID of the Internet Gateway       |
| public_subnet_ids       | List of public subnet IDs        |
| public_subnet_cidrs     | List of public subnet CIDRs      |
| private_subnet_ids      | List of private subnet IDs       |
| private_subnet_cidrs    | List of private subnet CIDRs     |
| nat_gateway_ids         | List of NAT gateway IDs          |
| nat_gateway_public_ips  | List of NAT gateway public IPs   |
| public_route_table_id   | ID of the public route table     |
| private_route_table_ids | List of private route table IDs  |
| vpn_gateway_id          | ID of the VPN gateway            |
