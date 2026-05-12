output "arn" {
  description = "ARN of the SSM parameter"
  value       = try(aws_ssm_parameter.this[0].arn, null)
}

output "name" {
  description = "Name of the SSM parameter"
  value       = var.name
}

output "version" {
  description = "Version of the SSM parameter"
  value       = try(aws_ssm_parameter.this[0].version, null)
}
