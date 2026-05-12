variable "name" {
  description = "Name of the Cognito user pool"
  type        = string
}

variable "username_attributes" {
  description = "Whether email or phone_number can be used as username"
  type        = list(string)
  default     = ["email"]
}

variable "auto_verified_attributes" {
  description = "Attributes to auto-verify"
  type        = list(string)
  default     = ["email"]
}

variable "mfa_configuration" {
  description = "MFA configuration: OFF, ON, or OPTIONAL"
  type        = string
  default     = "OPTIONAL"

  validation {
    condition     = contains(["OFF", "ON", "OPTIONAL"], var.mfa_configuration)
    error_message = "MFA configuration must be OFF, ON, or OPTIONAL."
  }
}

variable "password_policy" {
  description = "Password policy settings"
  type = object({
    minimum_length                   = optional(number, 12)
    require_lowercase                = optional(bool, true)
    require_numbers                  = optional(bool, true)
    require_symbols                  = optional(bool, true)
    require_uppercase                = optional(bool, true)
    temporary_password_validity_days = optional(number, 7)
  })
  default = {}
}

variable "account_recovery_setting" {
  description = "Account recovery setting"
  type = object({
    priority = optional(number, 1)
    name     = optional(string, "verified_email")
  })
  default = {}
}

variable "clients" {
  description = "Map of user pool clients"
  type = map(object({
    callback_urls                        = optional(list(string), [])
    logout_urls                          = optional(list(string), [])
    allowed_oauth_flows                  = optional(list(string), [])
    allowed_oauth_scopes                 = optional(list(string), [])
    allowed_oauth_flows_user_pool_client = optional(bool, false)
    explicit_auth_flows                  = optional(list(string), ["ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_SRP_AUTH"])
    generate_secret                      = optional(bool, false)
    refresh_token_validity               = optional(number, 30)
    access_token_validity                = optional(number, 1)
    id_token_validity                    = optional(number, 1)
    supported_identity_providers         = optional(list(string), [])
    prevent_user_existence_errors        = optional(string, "ENABLED")
  }))
  default = {}
}

variable "groups" {
  description = "Map of Cognito groups"
  type = map(object({
    description = optional(string, "")
    precedence  = optional(number, 0)
    role_arn    = optional(string, null)
  }))
  default = {}
}

variable "lambda_config" {
  description = "Lambda trigger configurations"
  type = object({
    pre_sign_up                    = optional(string)
    post_confirmation              = optional(string)
    pre_authentication             = optional(string)
    post_authentication            = optional(string)
    define_auth_challenge          = optional(string)
    create_auth_challenge          = optional(string)
    verify_auth_challenge_response = optional(string)
    custom_message                 = optional(string)
    user_migration                 = optional(string)
  })
  default = {}
}

variable "advanced_security_mode" {
  description = "Advanced security mode: OFF, AUDIT, or ENFORCED"
  type        = string
  default     = "AUDIT"

  validation {
    condition     = contains(["OFF", "AUDIT", "ENFORCED"], var.advanced_security_mode)
    error_message = "Advanced security mode must be OFF, AUDIT, or ENFORCED."
  }
}

variable "tags" {
  description = "Tags to apply to the user pool"
  type        = map(string)
  default     = {}
}
