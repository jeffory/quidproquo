output "arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.this.arn
}

output "function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.this.function_name
}

output "invoke_arn" {
  description = "Invoke ARN of the Lambda function"
  value       = aws_lambda_function.this.invoke_arn
}

output "qualified_arn" {
  description = "Qualified ARN of the Lambda function (versioned)"
  value       = aws_lambda_function.this.qualified_arn
}

output "version" {
  description = "Published version of the Lambda function"
  value       = aws_lambda_function.this.version
}

output "role_arn" {
  description = "ARN of the IAM role"
  value       = local.create_iam_role ? aws_iam_role.this[0].arn : data.aws_iam_role.existing[0].arn
}

output "log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.this.name
}
