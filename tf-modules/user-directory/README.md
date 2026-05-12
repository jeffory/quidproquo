# QPQ User-Directory Module

Terraform module for creating AWS Cognito user pools, clients, and groups.

## Compliance Defaults

- **MFA set to OPTIONAL** by default (upgrade to ON for high-security environments).
- **Strong password policy** enforced: 12+ chars, mixed case, numbers, and symbols.
- **Advanced Security** defaults to `AUDIT` for threat detection.
- **Account recovery** defaults to verified email.
- User pool clients use secure defaults with refresh token auth.

## Usage

```hcl
module "user_directory" {
  source = "./tf-modules/user-directory"

  name = "my-app-users"

  clients = {
    web = {
      callback_urls        = ["https://app.example.com/callback"]
      logout_urls          = ["https://app.example.com/logout"]
      allowed_oauth_flows  = ["code"]
      allowed_oauth_scopes = ["openid", "email", "profile"]
      explicit_auth_flows  = ["ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_SRP_AUTH", "ALLOW_CUSTOM_AUTH"]
    }
  }

  groups = {
    admins = { description = "Application administrators", precedence = 1 }
    users  = { description = "Standard users", precedence = 10 }
  }

  tags = {
    Environment = "production"
  }
}
```

## Inputs

| Name                     | Description                                              | Type          | Default                           | Required |
|--------------------------|----------------------------------------------------------|---------------|-----------------------------------|----------|
| name                     | Name of the Cognito user pool                            | string        | n/a                               | yes      |
| username_attributes      | Attributes usable as username                            | list(string)  | ["email"]                         | no       |
| auto_verified_attributes | Attributes to auto-verify                                | list(string)  | ["email"]                         | no       |
| mfa_configuration        | MFA: OFF, ON, or OPTIONAL                                | string        | "OPTIONAL"                        | no       |
| password_policy          | Password policy settings                                 | object        | {}                                | no       |
| account_recovery_setting | Account recovery settings                                | object        | {}                                | no       |
| clients                  | Map of user pool clients                                 | map(object)   | {}                                | no       |
| groups                   | Map of Cognito groups                                    | map(object)   | {}                                | no       |
| lambda_config            | Lambda trigger ARNs                                      | object        | {}                                | no       |
| advanced_security_mode   | Advanced security: OFF, AUDIT, or ENFORCED               | string        | "AUDIT"                           | no       |
| tags                     | Tags to apply                                            | map(string)   | {}                                | no       |

## Outputs

| Name          | Description                      |
|---------------|----------------------------------|
| id            | ID of the user pool              |
| arn           | ARN of the user pool             |
| name          | Name of the user pool            |
| endpoint      | Endpoint of the user pool        |
| client_ids    | Map of client names to IDs       |
| client_secrets| Map of client names to secrets   |
