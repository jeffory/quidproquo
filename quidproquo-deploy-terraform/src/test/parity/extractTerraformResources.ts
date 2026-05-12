import { NormalizedResource } from './types.js';

interface TerraformPlanResource {
  address: string;
  mode: string;
  type: string;
  name: string;
  provider_name: string;
  schema_version: number;
  values?: Record<string, unknown>;
}

interface TerraformPlanModule {
  resources?: TerraformPlanResource[];
  child_modules?: TerraformPlanModule[];
}

interface TerraformPlanJson {
  planned_values?: {
    root_module?: TerraformPlanModule;
  };
}

function walkModule(module: TerraformPlanModule, results: NormalizedResource[]): void {
  for (const resource of module.resources || []) {
    // Skip data sources and Terraform meta resources
    if (resource.mode === 'data') continue;
    if (resource.type.startsWith('terraform_')) continue;

    const awsType = resource.type;
    // Terraform uses lowercase provider prefixes, e.g. aws_dynamodb_table
    // Map to CloudFormation-style names for comparison
    const normalizedAwsType = normalizeTerraformType(awsType);

    const qpqLogicalName = guessQpqLogicalNameFromTfAddress(resource.address, resource.name);
    const keyProperties = extractKeyPropertiesFromTfValues(resource.type, resource.values || {});

    results.push({
      awsType: normalizedAwsType,
      qpqLogicalName,
      keyProperties,
    });
  }

  for (const child of module.child_modules || []) {
    walkModule(child, results);
  }
}

function normalizeTerraformType(tfType: string): string {
  const mappings: Record<string, string> = {
    aws_ssm_parameter: 'AWS::SSM::Parameter',
    aws_secretsmanager_secret: 'AWS::SecretsManager::Secret',
    aws_dynamodb_table: 'AWS::DynamoDB::Table',
    aws_s3_bucket: 'AWS::S3::Bucket',
    aws_s3_bucket_policy: 'AWS::S3::BucketPolicy',
    aws_sqs_queue: 'AWS::SQS::Queue',
    aws_sqs_queue_policy: 'AWS::SQS::QueuePolicy',
    aws_lambda_function: 'AWS::Lambda::Function',
    aws_iam_role: 'AWS::IAM::Role',
    aws_iam_policy: 'AWS::IAM::Policy',
    aws_iam_role_policy: 'AWS::IAM::Policy',
    aws_iam_role_policy_attachment: 'AWS::IAM::Policy',
    aws_apigateway_rest_api: 'AWS::ApiGateway::RestApi',
    aws_apigateway_domain_name: 'AWS::ApiGateway::DomainName',
    aws_apigateway_base_path_mapping: 'AWS::ApiGateway::BasePathMapping',
    aws_acm_certificate: 'AWS::CertificateManager::Certificate',
    aws_route53_record: 'AWS::Route53::RecordSet',
    aws_cloudwatch_log_group: 'AWS::Logs::LogGroup',
    aws_lambda_event_source_mapping: 'AWS::Lambda::EventSourceMapping',
    aws_lambda_permission: 'AWS::Lambda::Permission',
    aws_apigateway_resource: 'AWS::ApiGateway::Resource',
    aws_apigateway_method: 'AWS::ApiGateway::Method',
    aws_apigateway_deployment: 'AWS::ApiGateway::Deployment',
    aws_apigateway_stage: 'AWS::ApiGateway::Stage',
    aws_cloudwatch_event_rule: 'AWS::Events::Rule',
    aws_sns_topic: 'AWS::SNS::Topic',
    aws_sns_topic_policy: 'AWS::SNS::TopicPolicy',
  };

  return mappings[tfType] || tfType;
}

function guessQpqLogicalNameFromTfAddress(address: string, name: string): string {
  // Terraform addresses look like:
  //   module.kvs_items.aws_dynamodb_table.this
  //   module.service_function_sample.aws_lambda_function.this
  // Extract the module label to get the QPQ logical name.

  const moduleMatch = address.match(/module\.([^.]+)\./);
  if (moduleMatch) {
    const moduleLabel = moduleMatch[1];
    // Labels are snake_case: kvs_items, service_function_sample, parameter_sample_param
    // Convert back to kebab-case for consistency with CDK side
    return moduleLabel
      .replace(/^kvs_/, '')
      .replace(/^parameter_/, '')
      .replace(/^secret_/, '')
      .replace(/^storage_drive_/, '')
      .replace(/^queue_/, '')
      .replace(/^service_function_/, '')
      .replace(/_/g, '-');
  }

  // Fallback to the resource name
  return name.replace(/_/g, '-');
}

function extractKeyPropertiesFromTfValues(tfType: string, values: Record<string, unknown>): Record<string, unknown> {
  const extractors: Record<string, string[]> = {
    aws_dynamodb_table: ['name', 'billing_mode', 'attribute', 'hash_key', 'range_key', 'global_secondary_index', 'point_in_time_recovery'],
    aws_s3_bucket: ['bucket', 'force_destroy'],
    aws_sqs_queue: ['name', 'visibility_timeout_seconds', 'redrive_policy'],
    aws_ssm_parameter: ['name', 'type', 'value'],
    aws_secretsmanager_secret: ['name'],
    aws_lambda_function: ['function_name', 'runtime', 'memory_size', 'timeout', 'handler', 'environment'],
    aws_iam_role: ['name', 'assume_role_policy'],
    aws_iam_policy: ['name', 'policy'],
    aws_apigateway_rest_api: ['name', 'binary_media_types'],
    aws_cloudwatch_log_group: ['name', 'retention_in_days'],
  };

  const keys = extractors[tfType] || [];
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in values) {
      result[key] = values[key];
    }
  }
  return result;
}

export function extractTerraformResources(planJson: TerraformPlanJson): NormalizedResource[] {
  const resources: NormalizedResource[] = [];
  const rootModule = planJson.planned_values?.root_module;
  if (rootModule) {
    walkModule(rootModule, resources);
  }
  return resources;
}
