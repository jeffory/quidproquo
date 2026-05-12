output "arn" {
  description = "ARN of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.this.arn
}

output "id" {
  description = "ID of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.this.id
}

output "name" {
  description = "Name of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.this.name
}

output "version_id" {
  description = "Version ID of the current secret version"
  value       = try(aws_secretsmanager_secret_version.this[0].version_id, null)
}
