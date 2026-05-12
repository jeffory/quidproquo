variable "name" {
  description = "Name of the Secrets Manager secret"
  type        = string
}

variable "description" {
  description = "Description of the secret"
  type        = string
  default     = ""
}

variable "kms_key_id" {
  description = "KMS key ARN for encrypting the secret"
  type        = string
  default     = null
}

variable "secret_string" {
  description = "Initial secret string value (omit if using rotation)"
  type        = string
  sensitive   = true
  default     = null
}

variable "secret_binary" {
  description = "Initial secret binary value (base64 encoded)"
  type        = string
  sensitive   = true
  default     = null
}

variable "recovery_window_in_days" {
  description = "Number of days for recovery window (0 for immediate deletion, 7-30 for recovery)"
  type        = number
  default     = 30

  validation {
    condition     = var.recovery_window_in_days == 0 || (var.recovery_window_in_days >= 7 && var.recovery_window_in_days <= 30)
    error_message = "Recovery window must be 0 (immediate) or between 7 and 30 days."
  }
}

variable "enable_rotation" {
  description = "Enable automatic secret rotation"
  type        = bool
  default     = false
}

variable "rotation_lambda_arn" {
  description = "ARN of the Lambda function used for rotation"
  type        = string
  default     = null
}

variable "rotation_automatically_after_days" {
  description = "Number of days between automatic rotations"
  type        = number
  default     = 30
}

variable "replica_regions" {
  description = "List of regions to replicate the secret to"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to the secret"
  type        = map(string)
  default     = {}
}
