import fs from 'fs';
import path from 'path';
import { NormalizedResource } from './types.js';

interface CfnTemplate {
  Resources?: Record<
    string,
    {
      Type: string;
      Properties?: Record<string, unknown>;
      Metadata?: Record<string, unknown>;
    }
  >;
}

function guessQpqLogicalName(resourceId: string, resourceType: string, props?: Record<string, unknown>): string {
  // CDK logical IDs encode the construct path. We try to recover the QPQ
  // logical name from common patterns used by the QPQ CDK constructs.
  //
  // Examples:
  //   parametersampleparamA0B560E3 -> sample-param
  //   storageDriveassetsbucket609AC3CF -> assets
  //   QueueprocessqueueMainQueue96046E73 -> process-queue
  //   KeyValueStoreitemstable78F437B2 -> items
  //   Apiapiapifunction042D467B -> api
  //   ServiceFunctionsampleservicefunctionapifunction69BA07E6 -> sample-service-function

  const id = resourceId;

  // Parameter: parametersampleparamXXXX -> sample-param
  if (resourceType === 'AWS::SSM::Parameter' && id.startsWith('parameter')) {
    const match = id.replace(/^parameter/, '').replace(/[A-Z0-9]{8}$/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    return match;
  }

  // Secret: secretsamplesecretXXXX -> sample-secret
  if (resourceType === 'AWS::SecretsManager::Secret' && id.startsWith('secret')) {
    const match = id.replace(/^secret/, '').replace(/[A-Z0-9]{8}$/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    return match;
  }

  // S3 Bucket: storageDrive<name>bucketXXXX -> <name>
  if (resourceType === 'AWS::S3::Bucket' && id.startsWith('storageDrive')) {
    return id.replace(/^storageDrive/, '').replace(/bucket[A-Z0-9]{8}$/, '');
  }

  // DynamoDB Table: KeyValueStore<name>tableXXXX -> <name>
  if (resourceType === 'AWS::DynamoDB::Table' && id.startsWith('KeyValueStore')) {
    return id.replace(/^KeyValueStore/, '').replace(/table[A-Z0-9]{8}$/, '');
  }

  // SQS Queue: Queue<name>MainQueueXXXX -> <name>
  if (resourceType === 'AWS::SQS::Queue' && id.startsWith('Queue')) {
    const withoutSuffix = id.replace(/^Queue/, '').replace(/[A-Z0-9]{8}$/, '');
    // Remove DeadLetterQueue suffix if present
    if (withoutSuffix.endsWith('DeadLetterQueue')) {
      return withoutSuffix.replace(/DeadLetterQueue$/, '');
    }
    if (withoutSuffix.endsWith('MainQueue')) {
      return withoutSuffix.replace(/MainQueue$/, '');
    }
    return withoutSuffix;
  }

  // SQS Queue Policy: Queue<name>MainQueuePolicyXXXX -> <name>
  if (resourceType === 'AWS::SQS::QueuePolicy' && id.startsWith('Queue')) {
    const withoutSuffix = id.replace(/^Queue/, '').replace(/[A-Z0-9]{8}$/, '');
    if (withoutSuffix.endsWith('MainQueuePolicy')) {
      return withoutSuffix.replace(/MainQueuePolicy$/, '');
    }
    return withoutSuffix;
  }

  // Lambda Function: Api<name>apifunctionXXXX -> <name>
  if (resourceType === 'AWS::Lambda::Function') {
    if (id.startsWith('Api') && id.includes('apifunction')) {
      return id.replace(/^Api/, '').replace(/apifunction[A-Z0-9]{8}$/, '');
    }
    if (id.startsWith('Queue') && id.includes('function')) {
      return id.replace(/^Queue/, '').replace(/function[A-Z0-9]{8}$/, '');
    }
    if (id.startsWith('ServiceFunction') && id.includes('apifunction')) {
      return id.replace(/^ServiceFunction/, '').replace(/apifunction[A-Z0-9]{8}$/, '');
    }
  }

  // API Gateway RestApi: Api<name>lambdarestapiXXXX -> <name>
  if (resourceType === 'AWS::ApiGateway::RestApi' && id.startsWith('Api')) {
    return id.replace(/^Api/, '').replace(/lambdarestapi[A-Z0-9]{8}$/, '');
  }

  // CloudWatch LogGroup: Api<name>apifunctionLogGroupXXXX -> <name>
  if (resourceType === 'AWS::Logs::LogGroup') {
    if (id.startsWith('Api') && id.includes('apifunctionLogGroup')) {
      return id.replace(/^Api/, '').replace(/apifunctionLogGroup[A-Z0-9]{8}$/, '');
    }
    if (id.startsWith('Queue') && id.includes('LogGroup')) {
      return id.replace(/^Queue/, '').replace(/LogGroup[A-Z0-9]{8}$/, '');
    }
    if (id.startsWith('ServiceFunction') && id.includes('apifunctionLogGroup')) {
      return id.replace(/^ServiceFunction/, '').replace(/apifunctionLogGroup[A-Z0-9]{8}$/, '');
    }
  }

  // Fallback: strip trailing 8-char CDK hash and convert camelCase to kebab-case
  const stripped = id.replace(/[A-Z0-9]{8}$/, '');
  return stripped.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function extractKeyProperties(resourceType: string, props?: Record<string, unknown>): Record<string, unknown> {
  if (!props) return {};

  const extractors: Record<string, string[]> = {
    'AWS::DynamoDB::Table': ['TableName', 'BillingMode', 'AttributeDefinitions', 'KeySchema', 'GlobalSecondaryIndexes', 'PointInTimeRecoverySpecification'],
    'AWS::S3::Bucket': ['BucketName', 'PublicAccessBlockConfiguration', 'CorsConfiguration', 'LifecycleConfiguration'],
    'AWS::SQS::Queue': ['QueueName', 'VisibilityTimeout', 'RedrivePolicy'],
    'AWS::SSM::Parameter': ['Name', 'Type', 'Value'],
    'AWS::SecretsManager::Secret': ['Name'],
    'AWS::Lambda::Function': ['FunctionName', 'Runtime', 'MemorySize', 'Timeout', 'Handler', 'Environment'],
    'AWS::IAM::Role': ['RoleName', 'AssumeRolePolicyDocument'],
    'AWS::IAM::Policy': ['PolicyName', 'PolicyDocument'],
    'AWS::ApiGateway::RestApi': ['Name', 'BinaryMediaTypes'],
    'AWS::ApiGateway::DomainName': ['DomainName'],
    'AWS::CertificateManager::Certificate': ['DomainName', 'SubjectAlternativeNames'],
    'AWS::Route53::RecordSet': ['Name', 'Type', 'AliasTarget'],
  };

  const keys = extractors[resourceType] || [];
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in props) {
      result[key] = props[key];
    }
  }
  return result;
}

export function extractCdkResources(cdkOutDir: string): NormalizedResource[] {
  const resources: NormalizedResource[] = [];

  const files = fs.readdirSync(cdkOutDir).filter((f) => f.endsWith('.template.json'));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(cdkOutDir, file), 'utf-8');
    const template: CfnTemplate = JSON.parse(raw);

    for (const [resourceId, resource] of Object.entries(template.Resources || {})) {
      const awsType = resource.Type;
      // Skip CDK metadata and asset-related resources that don't represent app infra
      if (awsType.startsWith('AWS::CDK::')) continue;
      if (awsType === 'AWS::CloudFormation::WaitConditionHandle') continue;

      const qpqLogicalName = guessQpqLogicalName(resourceId, awsType, resource.Properties);
      const keyProperties = extractKeyProperties(awsType, resource.Properties);

      resources.push({
        awsType,
        qpqLogicalName,
        keyProperties,
      });
    }
  }

  return resources;
}
