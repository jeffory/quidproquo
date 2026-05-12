locals {
  create_parameter = var.value != ""
}

resource "aws_ssm_parameter" "this" {
  count = local.create_parameter ? 1 : 0

  name        = var.name
  description = var.description
  type        = var.type
  value       = var.value
  tier        = var.tier
  overwrite   = var.overwrite
  key_id      = var.type == "SecureString" ? var.kms_key_id : null
  tags        = var.tags
}
