---
sidebar_position: 10
---

# quidproquo-config-aws

AWS-specific configuration builders for QPQ. Extends the core QPQ config with declarations that tell `quidproquo-deploy-awscdk` which AWS services to provision and how to name them.

## When to use it

Use this package when your QPQ service targets AWS. It provides builders that add AWS-specific settings to your `QPQConfig`, which are then consumed by `quidproquo-deploy-awscdk` to generate the correct CDK stacks.

## Installation

```bash
npm install quidproquo-config-aws
```

This package has **no runtime dependencies** — it only adds types and config builders used at deploy time.

## Key Exports

### `config` — Configuration builders

| Builder | Purpose |
|---|---|
| `defineAwsCdkDeployment(options)` | Set the target AWS region and account, and enable AWS CDK deployment for this service |
| `defineAwsCognitoUserDirectory(name, options)` | Use Cognito as the user directory backend for a `defineUserDirectory` entry |
| `defineAwsDynamoKeyValueStore(name, options)` | Map a QPQ key-value store to a specific DynamoDB table |
| `defineAwsS3FileStorage(name, options)` | Map a QPQ file store to a specific S3 bucket |
| `defineAwsEventBridge(name, options)` | Map a QPQ event bus to an EventBridge event bus |
| `defineAwsSqsQueue(name, options)` | Map a QPQ queue to an SQS queue |
| `defineAwsActionProcessorSources(sources)` | Register additional custom action processor modules for Lambda bundling |
| `defineAwsEmailTemplates(templates)` | Register Cognito email templates (verification, invitation, etc.) |
| `defineAwsCacheInvalidation(options)` | Configure CloudFront cache invalidation behaviour for web entries |
| `defineAwsDomainProxy(options)` | Set a custom domain with Route53 + CloudFront |

### `qpqConfigAwsUtils`

Runtime helper utilities for resolving AWS resource identifiers from a QPQ config. Used internally by `quidproquo-actionprocessor-awslambda` and `quidproquo-deploy-awscdk`.

### `types`

TypeScript types for all AWS config shapes.

## Usage Example

### Typical AWS QPQ config

```typescript
// qpq.config.ts
import { createQpqConfig, defineKeyValueStore, defineUserDirectory, defineParameter } from 'quidproquo-core';
import { defineRoute, defineWebEntry } from 'quidproquo-webserver';
import {
  defineAwsCdkDeployment,
  defineAwsCognitoUserDirectory,
  defineAwsDynamoKeyValueStore,
  defineAwsS3FileStorage,
} from 'quidproquo-config-aws';

export default createQpqConfig([
  // Core resources
  defineParameter('appName', 'my-app'),
  defineParameter('env', 'prod'),

  defineKeyValueStore('users', { partitionKey: 'userId' }),
  defineKeyValueStore('orders', { partitionKey: 'orderId', sortKey: 'createdAt' }),
  defineUserDirectory('auth'),

  // Routes
  defineRoute('GET', '/users/:id', getUserStory),
  defineRoute('POST', '/orders', placeOrderStory),

  // SPA
  defineWebEntry('frontend', './dist'),

  // AWS-specific: tell CDK which services to use
  defineAwsCdkDeployment({
    region: 'us-east-1',
    account: '123456789012',
  }),

  defineAwsCognitoUserDirectory('auth', {
    selfSignUpEnabled: true,
    passwordPolicy: { minLength: 8, requireSymbols: true },
  }),

  defineAwsDynamoKeyValueStore('users', {
    billingMode: 'PAY_PER_REQUEST',
  }),

  defineAwsS3FileStorage('uploads', {
    bucketName: 'my-app-prod-uploads',
    versioned: true,
  }),
]);
```

### Custom domain

```typescript
import { defineAwsDomainProxy } from 'quidproquo-config-aws';

defineAwsDomainProxy({
  domainName: 'api.myapp.example.com',
  hostedZoneId: 'Z1234567890ABC',
  certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/...',
});
```

### Cache invalidation for web entries

```typescript
import { defineAwsCacheInvalidation } from 'quidproquo-config-aws';

defineAwsCacheInvalidation({
  webEntryName: 'frontend',
  paths: ['/*'],               // invalidate everything on deploy
});
```

### Cognito email templates

```typescript
import { defineAwsEmailTemplates } from 'quidproquo-config-aws';

defineAwsEmailTemplates({
  verification: {
    subject: 'Verify your email for My App',
    htmlBody: '<p>Your code: {####}</p>',
    textBody: 'Your code: {####}',
  },
  invitation: {
    subject: 'Welcome to My App',
    htmlBody: '<p>Temporary password: {####}</p>',
    textBody: 'Temporary password: {####}',
  },
});
```

## Relationship to Core Config

`quidproquo-config-aws` augments but does not replace the core config builders from `quidproquo-core`. A typical service uses both:

- `quidproquo-core` — define resources (stores, queues, user directories, routes)
- `quidproquo-config-aws` — specify which AWS services back those resources

This separation means the same QPQ stories and config can be tested locally with `quidproquo-dev-server` (which ignores the AWS-specific settings) and deployed to AWS (which uses them).

## Related

- [quidproquo-deploy-awscdk](./quidproquo-deploy-awscdk) — consumes this config to generate CDK stacks
- [quidproquo-actionprocessor-awslambda](./quidproquo-actionprocessors#aws-lambda) — reads resource mappings at Lambda runtime
- [quidproquo-dev-server](./quidproquo-dev-server) — ignores AWS config; uses local emulation instead
- [Key-Value Store Actions](../api/actions/key-value-store) — actions backed by DynamoDB in AWS
- [User Directory Actions](../api/actions/user-directory) — actions backed by Cognito in AWS
