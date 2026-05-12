output "arn" {
  description = "ARN of the DynamoDB table"
  value       = aws_dynamodb_table.this.arn
}

output "id" {
  description = "ID of the DynamoDB table"
  value       = aws_dynamodb_table.this.id
}

output "name" {
  description = "Name of the DynamoDB table"
  value       = aws_dynamodb_table.this.name
}

output "stream_arn" {
  description = "ARN of the table stream"
  value       = aws_dynamodb_table.this.stream_arn
}

output "stream_label" {
  description = "Stream label of the table"
  value       = aws_dynamodb_table.this.stream_label
}
