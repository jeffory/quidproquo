variable "name" {
  description = "Name of the DynamoDB table"
  type        = string
}

variable "billing_mode" {
  description = "Billing mode: PROVISIONED or PAY_PER_REQUEST"
  type        = string
  default     = "PAY_PER_REQUEST"

  validation {
    condition     = contains(["PROVISIONED", "PAY_PER_REQUEST"], var.billing_mode)
    error_message = "Billing mode must be PROVISIONED or PAY_PER_REQUEST."
  }
}

variable "hash_key" {
  description = "Name of the hash (partition) key"
  type        = string
}

variable "hash_key_type" {
  description = "Type of the hash key: S, N, or B"
  type        = string
  default     = "S"

  validation {
    condition     = contains(["S", "N", "B"], var.hash_key_type)
    error_message = "Hash key type must be one of: S, N, B."
  }
}

variable "range_key" {
  description = "Name of the range (sort) key"
  type        = string
  default     = null
}

variable "range_key_type" {
  description = "Type of the range key: S, N, or B"
  type        = string
  default     = "S"

  validation {
    condition     = contains(["S", "N", "B"], var.range_key_type)
    error_message = "Range key type must be one of: S, N, B."
  }
}

variable "attributes" {
  description = "Additional attributes for GSIs/LSIs"
  type = list(object({
    name = string
    type = string
  }))
  default = []
}

variable "global_secondary_indexes" {
  description = "List of global secondary indexes"
  type = list(object({
    name               = string
    hash_key           = string
    range_key          = optional(string)
    projection_type    = optional(string, "ALL")
    non_key_attributes = optional(list(string))
    read_capacity      = optional(number)
    write_capacity     = optional(number)
  }))
  default = []
}

variable "local_secondary_indexes" {
  description = "List of local secondary indexes"
  type = list(object({
    name               = string
    range_key          = string
    projection_type    = optional(string, "ALL")
    non_key_attributes = optional(list(string))
  }))
  default = []
}

variable "point_in_time_recovery" {
  description = "Enable point-in-time recovery"
  type        = bool
  default     = true
}

variable "server_side_encryption" {
  description = "Enable server-side encryption with KMS"
  type        = bool
  default     = true
}

variable "kms_key_arn" {
  description = "KMS key ARN for server-side encryption (null for AWS managed)"
  type        = string
  default     = null
}

variable "ttl_attribute" {
  description = "Name of the TTL attribute"
  type        = string
  default     = null
}

variable "ttl_enabled" {
  description = "Enable TTL on the table"
  type        = bool
  default     = false
}

variable "read_capacity" {
  description = "Read capacity units (PROVISIONED mode only)"
  type        = number
  default     = 5
}

variable "write_capacity" {
  description = "Write capacity units (PROVISIONED mode only)"
  type        = number
  default     = 5
}

variable "tags" {
  description = "Tags to apply to the table"
  type        = map(string)
  default     = {}
}
