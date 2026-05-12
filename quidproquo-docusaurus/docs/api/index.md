---
sidebar_position: 1
---

# API Reference

Complete API documentation for the Quidproquo framework. This reference covers all available actions, pre-built stories, and the packages that make up the QPQ ecosystem.

## Actions

Actions are the building blocks of QPQ applications. Each action category maps to a domain of functionality and has one or more platform-specific processors that handle the actual execution.

### Core Actions (quidproquo-core)

| Category | Description | Key Functions |
|----------|-------------|---------------|
| [Claude AI](./actions/claude-ai) | Interact with Claude AI models | `askClaudeAiChatCompletion` |
| [Config](./actions/config) | Parameters, secrets, globals, and app metadata | `askConfigGetParameter`, `askConfigGetSecret`, `askConfigGetGlobal` |
| [Context](./actions/context) | Share data across story boundaries without parameters | `askContextProvide`, `askContextRead` |
| [Date](./actions/date) | Platform-agnostic timestamps | `askDateNow` |
| [Error](./actions/error) | Throw and catch QPQ errors | `askThrowError`, `askCatch` |
| [Event](./actions/event) | Process and dispatch platform events | `askProcessEvent` |
| [Event Bus](./actions/eventbus) | Pub/sub messaging between services | `askEventBusSendMessage`, `askEventBusSubscribe` |
| [File](./actions/file) | Read and write files (maps to S3, GCS, local FS) | `askFileReadTextContents`, `askFileWriteTextContents` |
| [Graph Database](./actions/graph-database) | Neo4j-compatible graph operations | `askGraphDatabaseQuery` |
| [GUID](./actions/guid) | Generate unique identifiers | `askGuidNew` |
| [Key-Value Store](./actions/key-value-store) | NoSQL CRUD, queries, and indexes (maps to DynamoDB, Firestore) | `askKeyValueStoreGet`, `askKeyValueStoreUpsert`, `askKeyValueStoreQuery` |
| [Log](./actions/log) | Structured application logging | `askLogCreate` |
| [Math](./actions/math) | Deterministic math utilities | `askMathRandom` |
| [Network](./actions/network) | Outbound HTTP requests | `askNetworkHttp` |
| [Platform](./actions/platform) | Platform-specific utilities and introspection | `askPlatformRuntimeType` |
| [Queue](./actions/queue) | Message queues (maps to SQS, Cloud Tasks) | `askQueueSendMessage` |
| [State](./actions/state) | Ephemeral in-memory state within a story run | `askStateGet`, `askStateSet` |
| [System](./actions/system) | Invoke stories across service boundaries | `askSystemStorySession` |
| [User Directory](./actions/user-directory) | Authentication and user management (maps to Cognito) | `askUserDirectoryAuthenticateUser`, `askUserDirectoryDecodeAccessToken` |

## Packages

The QPQ monorepo is organized as a set of npm packages with clear responsibilities. Install only what your project needs.

### Core

| Package | Purpose |
|---------|---------|
| `quidproquo-core` | Action types, `ask*` requesters, runtime engine, and type definitions. Required by every QPQ project. |
| `quidproquo-webserver` | Web-specific actions: routing, APIs, WebSockets, service functions. |

### Action Processors (Platform Runtimes)

These packages provide the concrete implementations that execute actions on a specific platform. Pick the one that matches your deployment target.

| Package | Target |
|---------|--------|
| `quidproquo-actionprocessor-awslambda` | AWS Lambda (S3, DynamoDB, SQS, Cognito, …) |
| `quidproquo-actionprocessor-node` | Node.js server (local filesystem, in-process queues) |
| `quidproquo-actionprocessor-js` | Shared JavaScript utilities used by other processors |
| `quidproquo-actionprocessor-web` | Browser environment |

### Deployment and Infrastructure

| Package | Purpose |
|---------|---------|
| `quidproquo-config-aws` | AWS-specific config helpers and CDK construct props |
| `quidproquo-deploy-awscdk` | CDK constructs that provision QPQ infrastructure on AWS |
| `quidproquo-deploy-webpack` | Webpack configuration for bundling QPQ apps |

### Development

| Package | Purpose |
|---------|---------|
| `quidproquo-dev-server` | Local development server; simulates cloud services in-process |
| `quidproquo-testing` | Test utilities for exercising stories without a live runtime |
| `quidproquo-docusaurus` | This documentation site |

### Client-Side

| Package | Purpose |
|---------|---------|
| `quidproquo-web` | Client-side utilities for talking to QPQ backends |
| `quidproquo-web-react` | React hooks and components for QPQ-backed SPAs |
| `quidproquo-web-admin` | Admin UI components |

### Integrations

| Package | Purpose |
|---------|---------|
| `quidproquo-neo4j` | Neo4j action processor for graph database operations |

### Tooling

| Package | Purpose |
|---------|---------|
| `quidproquo-tsconfig` | Shared TypeScript base configuration |
| `quidproquo-eslint-config` | Shared ESLint rules |

## Common Patterns

### Installing core packages

```bash
npm install quidproquo-core quidproquo-webserver
npm install --save-dev quidproquo-dev-server quidproquo-testing
```

### Choosing an action processor

```bash
# Local / Node.js
npm install quidproquo-actionprocessor-node

# AWS Lambda
npm install quidproquo-actionprocessor-awslambda
```

### Importing ask functions

All `ask*` functions are exported from their respective packages:

```typescript
import {
  askConfigGetParameter,
  askConfigGetSecret,
  askKeyValueStoreGet,
  askKeyValueStoreUpsert,
  askGuidNew,
  askDateNow,
  askLogCreate,
  askThrowError,
} from 'quidproquo-core';
```

## See Also

- [Getting Started](../getting-started.md) — Installation and your first story
- [Core Concepts](../core-concepts.md) — How actions, stories, processors, and the runtime fit together
- [Architecture Overview](../architecture-overview.md) — Deep dive into the internals
