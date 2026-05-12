variable "bucket_name" {
  description = "Name of the S3 bucket (must be globally unique)"
  type        = string
}

variable "force_destroy" {
  description = "Force destroy the bucket (removes all objects)"
  type        = bool
  default     = false
}

variable "versioning_enabled" {
  description = "Enable S3 versioning"
  type        = bool
  default     = true
}

variable "versioning_mfa_delete" {
  description = "Enable MFA delete for versioning"
  type        = bool
  default     = false
}

variable "sse_algorithm" {
  description = "Server-side encryption algorithm: AES256 or aws:kms"
  type        = string
  default     = "AES256"

  validation {
    condition     = contains(["AES256", "aws:kms"], var.sse_algorithm)
    error_message = "SSE algorithm must be AES256 or aws:kms."
  }
}

variable "kms_key_id" {
  description = "KMS key ID for aws:kms encryption"
  type        = string
  default     = null
}

variable "block_public_acls" {
  description = "Block public ACLs"
  type        = bool
  default     = true
}

variable "block_public_policy" {
  description = "Block public policy"
  type        = bool
  default     = true
}

variable "ignore_public_acls" {
  description = "Ignore public ACLs"
  type        = bool
  default     = true
}

variable "restrict_public_buckets" {
  description = "Restrict public buckets"
  type        = bool
  default     = true
}

variable "lifecycle_rules" {
  description = "List of lifecycle rules"
  type = list(object({
    id                                         = string
    enabled                                    = optional(bool, true)
    prefix                                     = optional(string, "")
    tags                                       = optional(map(string), {})
    transition_standard_ia_days                = optional(number)
    transition_glacier_days                    = optional(number)
    transition_deep_archive_days               = optional(number)
    expiration_days                            = optional(number)
    noncurrent_version_transition_ia_days      = optional(number)
    noncurrent_version_transition_glacier_days = optional(number)
    noncurrent_version_expiration_days         = optional(number)
    abort_incomplete_multipart_upload_days     = optional(number)
  }))
  default = []
}

variable "tags" {
  description = "Tags to apply to the bucket"
  type        = map(string)
  default     = {}
}
