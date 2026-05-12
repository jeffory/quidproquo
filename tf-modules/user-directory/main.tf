resource "aws_cognito_user_pool" "this" {
  name                     = var.name
  username_attributes      = var.username_attributes
  auto_verified_attributes = var.auto_verified_attributes
  mfa_configuration        = var.mfa_configuration

  password_policy {
    minimum_length                   = var.password_policy.minimum_length
    require_lowercase                = var.password_policy.require_lowercase
    require_numbers                  = var.password_policy.require_numbers
    require_symbols                  = var.password_policy.require_symbols
    require_uppercase                = var.password_policy.require_uppercase
    temporary_password_validity_days = var.password_policy.temporary_password_validity_days
  }

  account_recovery_setting {
    recovery_mechanism {
      priority = var.account_recovery_setting.priority
      name     = var.account_recovery_setting.name
    }
  }

  lambda_config {
    pre_sign_up                    = var.lambda_config.pre_sign_up
    post_confirmation              = var.lambda_config.post_confirmation
    pre_authentication             = var.lambda_config.pre_authentication
    post_authentication            = var.lambda_config.post_authentication
    define_auth_challenge          = var.lambda_config.define_auth_challenge
    create_auth_challenge          = var.lambda_config.create_auth_challenge
    verify_auth_challenge_response = var.lambda_config.verify_auth_challenge_response
    custom_message                 = var.lambda_config.custom_message
    user_migration                 = var.lambda_config.user_migration
  }

  user_pool_add_ons {
    advanced_security_mode = var.advanced_security_mode
  }

  tags = var.tags
}

resource "aws_cognito_user_pool_client" "this" {
  for_each = var.clients

  name         = each.key
  user_pool_id = aws_cognito_user_pool.this.id

  callback_urls                        = each.value.callback_urls
  logout_urls                          = each.value.logout_urls
  allowed_oauth_flows                  = each.value.allowed_oauth_flows
  allowed_oauth_scopes                 = each.value.allowed_oauth_scopes
  allowed_oauth_flows_user_pool_client = each.value.allowed_oauth_flows_user_pool_client
  explicit_auth_flows                  = each.value.explicit_auth_flows
  generate_secret                      = each.value.generate_secret
  refresh_token_validity               = each.value.refresh_token_validity
  access_token_validity                = each.value.access_token_validity
  id_token_validity                    = each.value.id_token_validity
  supported_identity_providers         = each.value.supported_identity_providers
  prevent_user_existence_errors        = each.value.prevent_user_existence_errors
}

resource "aws_cognito_user_group" "this" {
  for_each = var.groups

  name         = each.key
  user_pool_id = aws_cognito_user_pool.this.id
  description  = each.value.description
  precedence   = each.value.precedence
  role_arn     = each.value.role_arn
}
