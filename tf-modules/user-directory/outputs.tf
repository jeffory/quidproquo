output "id" {
  description = "ID of the Cognito user pool"
  value       = aws_cognito_user_pool.this.id
}

output "arn" {
  description = "ARN of the Cognito user pool"
  value       = aws_cognito_user_pool.this.arn
}

output "name" {
  description = "Name of the Cognito user pool"
  value       = aws_cognito_user_pool.this.name
}

output "endpoint" {
  description = "Endpoint of the Cognito user pool"
  value       = aws_cognito_user_pool.this.endpoint
}

output "client_ids" {
  description = "Map of client names to client IDs"
  value       = { for k, v in aws_cognito_user_pool_client.this : k => v.id }
}

output "client_secrets" {
  description = "Map of client names to client secrets"
  value       = { for k, v in aws_cognito_user_pool_client.this : k => v.client_secret }
  sensitive   = true
}
