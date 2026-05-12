---
sidebar_position: 9
---

# Action Processors

Action processors are the runtime layer that executes QPQ actions. When a story yields an action, the runtime looks up the matching processor and calls it to get a result. QPQ ships four processor packages, one per target environment.

## Choosing a Processor

| Package | Target environment |
|---|---|
| `quidproquo-actionprocessor-awslambda` | AWS Lambda (production cloud) |
| `quidproquo-actionprocessor-node` | Node.js servers, CLI tools, local non-Lambda |
| `quidproquo-actionprocessor-js` | Lightweight JS environments, edge runtimes |
| `quidproquo-actionprocessor-web` | Browser / React SPAs |

Processors are composable — `quidproquo-web-react` combines `actionprocessor-web` and `actionprocessor-node` to cover both browser and isomorphic actions. `quidproquo-dev-server` uses `actionprocessor-node` for all local emulation.

---

## `quidproquo-actionprocessor-awslambda` {#aws-lambda}

Implements all QPQ actions using AWS SDK v3. This is the production runtime for services deployed via `quidproquo-deploy-awscdk`.

### When to use it

Use this processor when deploying to AWS Lambda. You generally don't instantiate it directly — `quidproquo-deploy-awscdk` wires it up automatically. You may need to import it directly if you are building a custom Lambda entry point.

### Key Exports

| Export | Purpose |
|---|---|
| `getAwsActionProcessors(config)` | Returns the full set of AWS action processor implementations |
| `awsLambdaUtils` | Helpers for reading Lambda execution context and environment |
| `awsNamingUtils` | Conventions for deriving AWS resource names from QPQ config |
| `getLambdaEntries()` | Resolves Lambda handler entry points from QPQ config |
| `lambdaHandlers` | Pre-built event handler wrappers (HTTP, EventBridge, SQS, etc.) |
| `QPQAWSResourceMap` | Type describing the runtime resource name map injected into Lambda |

### AWS Service Mappings

| QPQ Action | AWS Service |
|---|---|
| Key-Value Store | DynamoDB |
| File | S3 |
| User Directory | Cognito User Pools |
| EventBus | EventBridge |
| Queue | SQS |
| Config (parameters) | SSM Parameter Store |
| Config (secrets) | Secrets Manager |
| Network | Outbound HTTPS (via fetch/axios) |
| Claude AI | Amazon Bedrock |

### Usage

```typescript
import { getAwsActionProcessors, lambdaHandlers } from 'quidproquo-actionprocessor-awslambda';
import qpqConfig from './qpq.config';

// Custom Lambda entry — use in advanced scenarios only
// Typically handled automatically by quidproquo-deploy-awscdk
export const handler = lambdaHandlers.createHttpHandler(qpqConfig, getAwsActionProcessors(qpqConfig));
```

---

## `quidproquo-actionprocessor-node` {#node}

General-purpose Node.js action processors using Node standard libraries and popular npm packages.

### When to use it

Use this processor for:
- `quidproquo-dev-server` (it uses this internally)
- Custom Node.js scripts or CLI tools
- Backend services not running on Lambda

### Key Exports

| Export | Purpose |
|---|---|
| `actionProcessor` | Object containing all Node.js processor implementations |
| `dynamicActionProcessor` | Processor loader that resolves processors at runtime |

### Implemented Actions

All core QPQ actions are implemented:

| Action Category | Implementation |
|---|---|
| Date/time | `Date.now()`, ISO formatting |
| Error | Throw and catch with structured error types |
| GUID | `uuid` / `uuidv7` |
| Logging | `console.log` with structured output |
| Math | Crypto-random numbers |
| Network | `axios` HTTP client |
| Platform | `setTimeout`-based delays |
| System | Batch execution, parallel runners |
| File | `fs` module (for local/dev scenarios) |
| Claude AI | `@anthropic-ai/sdk` |

### Usage

```typescript
import { actionProcessor } from 'quidproquo-actionprocessor-node';
import { createRuntime } from 'quidproquo-core';
import qpqConfig from './qpq.config';
import { myStory } from './src/stories/example';

const runtime = createRuntime(qpqConfig, actionProcessor);
const result = await runtime.execute(myStory, ['arg1']);
console.log(result);
```

---

## `quidproquo-actionprocessor-js` {#js}

Minimal JavaScript action processors with few dependencies. Designed for environments where bundle size is a constraint or where the full Node.js API surface is unavailable.

### When to use it

Use this processor for:
- Edge runtimes (Cloudflare Workers, Vercel Edge, Deno Deploy)
- Serverless environments that restrict native modules
- Scenarios requiring the smallest possible bundle

### Key Exports

| Export | Purpose |
|---|---|
| `actionProcessor` | Minimal action processor implementations |

### Notes

This package has the same API shape as `actionprocessor-node` but avoids Node.js-specific modules (`fs`, `crypto`, etc.), using browser-compatible alternatives instead. If a specific action requires a native module, it falls back gracefully or is omitted.

---

## `quidproquo-actionprocessor-web` {#web}

Browser-safe action processors for executing QPQ stories in the browser. Uses the Fetch API, browser-native crypto, and `localStorage`-compatible patterns.

### When to use it

Use this processor (usually indirectly via `quidproquo-web-react`) when running stories client-side in a browser. `useQpq` in `quidproquo-web-react` combines this with `actionprocessor-node` to cover both browser-only and isomorphic actions.

### Key Exports

| Export | Purpose |
|---|---|
| `actionProcessor` | Browser-safe action processor map |
| `getWebActionProcessors()` | Convenience function returning processor list |

### Implemented Processors

| Processor | Details |
|---|---|
| `DateNowActionProcessor` | `Date.now()` |
| `ErrorThrowErrorActionProcessor` | Structured error throwing |
| `GuidNewActionProcessor` | `crypto.randomUUID()` |
| `LogCreateActionProcessor` | `console.log` |
| `MathRandomNumberActionProcessor` | `Math.random()` |
| `NetworkRequestActionProcessor` | Browser `fetch` |
| `PlatformDelayActionProcessor` | `setTimeout` |
| `SystemBatchActionProcessor` | Sequential batch execution |

### Usage (direct)

```typescript
import { getWebActionProcessors } from 'quidproquo-actionprocessor-web';
import { createRuntime } from 'quidproquo-core';
import qpqConfig from './qpq.config';

const runtime = createRuntime(qpqConfig, getWebActionProcessors());
const result = await runtime.execute(myClientStory, []);
```

In most React apps you will use `useQpq` from `quidproquo-web-react` instead, which handles runtime creation automatically.

## Related

- [quidproquo-web-react](./quidproquo-web-react) — React hooks that wire up the web processor
- [quidproquo-dev-server](./quidproquo-dev-server) — uses the Node processor for local development
- [quidproquo-deploy-awscdk](./quidproquo-deploy-awscdk) — uses the AWS Lambda processor in production
- [quidproquo-testing](./quidproquo-testing) — test stories without any processor
