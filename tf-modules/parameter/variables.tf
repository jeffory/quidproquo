variable "name" {
  description = "Name of the SSM parameter"
  type        = string
}

variable "description" {
  description = "Description of the parameter"
  type        = string
  default     = ""
}

variable "type" {
  description = "Type of parameter: String, StringList, or SecureString"
  type        = string
  default     = "SecureString"

  validation {
    condition     = contains(["String", "StringList", "SecureString"], var.type)
    error_message = "Type must be one of: String, StringList, SecureString."
  }
}

variable "value" {
  description = "Value of the parameter (omit if using kms_key_id for SecureString rotation)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "kms_key_id" {
  description = "KMS key ID for SecureString parameters"
  type        = string
  default     = null
}

variable "tier" {
  description = "Parameter tier: Standard, Advanced, or Intelligent-Tiering"
  type        = string
  default     = "Standard"

  validation {
    condition     = contains(["Standard", "Advanced", "Intelligent-Tiering"], var.tier)
    error_message = "Tier must be one of: Standard, Advanced, Intelligent-Tiering."
  }
}

variable "tags" {
  description = "Tags to apply to the parameter"
  type        = map(string)
  default     = {}
}

variable "overwrite" {
  description = "Overwrite an existing parameter"
  type        = bool
  default     = false
}
