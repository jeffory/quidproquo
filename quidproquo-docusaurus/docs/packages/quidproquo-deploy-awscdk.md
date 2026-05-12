---
sidebar_position: 5
---

# quidproquo-deploy-awscdk

AWS CDK constructs and pre-built stack definitions for deploying QuidProQuo applications to AWS. Turns your QPQ config into real infrastructure (Lambda, API Gateway, DynamoDB, S3, CloudFront, Cognito, and more) using infrastructure-as-code.

## When to use it

Use this package when you are ready to deploy a QPQ service to AWS. It provides the CDK entry point (`createQPQApp`) and a set of opinionated stacks that cover the most common deployment shapes. You write QPQ config; this package handles translating that into CDK constructs.

## Installation

```bash
npm install quidproquo-deploy-awscdk
```

## Key Exports

### `createQPQApp`

The entry point for a QPQ CDK application. Call this in your `cdk.ts` (or equivalent) to produce a CDK `App` with all required stacks.

```typescript
import { createQPQApp } from 'quidproquo-deploy-awscdk';

createQPQApp(qpqConfig);
```

### Pre-built Stacks

| Stack | Purpose |
|---|---|
| `ApiQpqServiceStack` | API Gateway + Lambda for HTTP routes and service functions |
| `InfQpqServiceStack` | Shared infrastructure: DynamoDB tables, S3 buckets, Cognito user pools, EventBridge buses, SQS queues |
| `WebQpqServiceStack` | CloudFront distribution + S3 bucket for serving SPAs (web entries) |
| `BootstrapQpqServiceStack` | One-time bootstrap resources (IAM roles, deployment artifacts bucket) |

### `qpqDeployAwsCdkUtils`

Utility functions for advanced scenarios — look up generated resource names, resolve ARNs, extend constructs, and add custom CDK L2/L3 resources alongside QPQ-managed ones.

### `constructs`

Individual CDK construct classes exported for use if you want to compose your own stacks rather than using the pre-built ones.

## Typical Project Layout

```
my-service/
  src/
    stories/          # QPQ generator functions
    routes/           # Route definitions
  infra/
    cdk.ts            # CDK entry — calls createQPQApp()
  qpq.config.ts       # QPQ configuration
```

## Usage Example

### Minimal CDK entry point

```typescript
// infra/cdk.ts
import { createQPQApp } from 'quidproquo-deploy-awscdk';
import qpqConfig from '../qpq.config';

createQPQApp(qpqConfig);
```

```bash
# Deploy
npx cdk deploy --all
```

### QPQ config used by the stacks

```typescript
// qpq.config.ts
import { createQpqConfig, defineKeyValueStore, defineParameter } from 'quidproquo-core';
import { defineRoute, defineWebEntry } from 'quidproquo-webserver';
import { defineAwsCdkDeployment } from 'quidproquo-config-aws';

export default createQpqConfig([
  defineParameter('appName', 'my-app'),
  defineParameter('env', 'prod'),

  defineKeyValueStore('users', { partitionKey: 'userId' }),

  defineRoute('GET', '/users/:id', getUserStory),
  defineRoute('POST', '/users', createUserStory),

  defineWebEntry('frontend', './dist'),

  defineAwsCdkDeployment({ region: 'us-east-1' }),
]);
```

### Extending with custom CDK constructs

```typescript
import { createQPQApp, qpqDeployAwsCdkUtils } from 'quidproquo-deploy-awscdk';
import * as cdk from 'aws-cdk-lib';
import qpqConfig from '../qpq.config';

const app = createQPQApp(qpqConfig);

// Add a custom SNS topic alongside QPQ-managed resources
const infStack = qpqDeployAwsCdkUtils.getInfStack(app);
new cdk.aws_sns.Topic(infStack, 'AlertTopic', {
  displayName: 'My Alert Topic',
});
```

## What Gets Deployed

The stacks together provision:

- **Lambda functions** for each route and service function (bundled via esbuild)
- **API Gateway** (HTTP API) wired to route Lambdas
- **DynamoDB tables** for each `defineKeyValueStore`
- **S3 buckets** for file storage and web entry assets
- **CloudFront distributions** for web entries with CDN caching
- **Cognito User Pools** for `defineUserDirectory` entries
- **EventBridge event buses** for `defineEventBus` entries
- **SQS queues** for `defineQueue` entries
- **IAM roles and policies** scoped to each Lambda function

## Related

- [quidproquo-config-aws](./quidproquo-config-aws) — AWS-specific config builders consumed by these stacks
- [quidproquo-deploy-webpack](./quidproquo-deploy-webpack) — webpack bundler that packages Lambda code
- [quidproquo-actionprocessor-awslambda](./quidproquo-actionprocessors#aws-lambda) — Lambda runtime action processors
- [quidproquo-webserver](./quidproquo-webserver) — route and service definitions
