---
sidebar_position: 2
---

# quidproquo-webserver

Adds web server concepts to the QPQ action model: HTTP routing, authenticated services, API keys, WebSocket connections, and web entry points (SPAs served via CDN).

## When to use it

Use `quidproquo-webserver` whenever you are building a backend that handles HTTP or WebSocket traffic. It defines the configuration builders, action types, and story helpers that turn your generator functions into routable endpoints.

## Installation

```bash
npm install quidproquo-webserver
```

## Key Exports

### `config`

Configuration builders for declaring web server resources in your QPQ config.

| Builder | Purpose |
|---|---|
| `defineRoute` | Register an HTTP route (method + path → story) |
| `defineService` | Declare an internal service callable by other QPQ services |
| `defineServiceFunction` | Register a named callable function within a service |
| `defineWebEntry` | Serve a React/SPA build from a CDN-backed S3 bucket |
| `defineApiKeyValidation` | Protect routes with API key checks |
| `defineRouteAuthValidation` | Protect routes with JWT/Cognito auth |
| `defineResponseSecurityHeaders` | Set security response headers (CSP, HSTS, etc.) |
| `defineDomainProxy` | Configure custom domain and CloudFront proxy settings |
| `defineSeoSettings` | Configure SEO metadata (robots, sitemap) |
| `defineSeedSettings` | Seed initial data on deploy |

### `actions`

Yieldable action requesters for use inside stories.

| Action | Purpose |
|---|---|
| `askWebEntryInvalidateCache` | Invalidate CloudFront cache for a web entry |
| `askServiceRequest` | Call another QPQ service and get back a typed result |
| `askWebSocketSendMessage` | Push a message to a connected WebSocket client |
| `askApiKeyValidation` | Validate an API key inside a route story |
| `askRouteAuthValidation` | Validate auth tokens inside a route story |

### `types`

TypeScript interfaces for platform events passed into stories.

| Type | Description |
|---|---|
| `HTTPEvent` | Incoming HTTP request (method, path, headers, body, query params) |
| `WebsocketEvent` | WebSocket lifecycle event (connect / disconnect / message) |
| `EmailSendEvent` | Email send trigger event |
| `ExecuteServiceFunctionEvent` | Service-to-service call payload |
| `StorageDriveEvent` | File/storage event trigger |
| `SEOEvent` | SSR/SEO rendering trigger |
| `CloudflareDnsDeployEvent` | DNS deployment event |

### `services`

Runtime helpers used by the action processors.

| Export | Purpose |
|---|---|
| `getServiceEntryQpqFunctionRuntime` | Resolve the runtime entry for a service function |
| `webSocketQueueUtils` | Helpers for WebSocket connection queue management |

## Usage Example

### Defining a route

```typescript
// qpq.config.ts
import { defineRoute } from 'quidproquo-webserver';
import { createQpqConfig } from 'quidproquo-core';

export default createQpqConfig([
  defineRoute('GET', '/users/:userId', getUserStory),
  defineRoute('POST', '/users', createUserStory),
]);
```

### A route story

```typescript
import { HTTPEvent } from 'quidproquo-webserver';
import { askKeyValueStoreGet } from 'quidproquo-core';

function* getUserStory(event: HTTPEvent) {
  const { userId } = event.pathParameters;
  const user = yield* askKeyValueStoreGet('users', userId);

  if (!user) {
    return { statusCode: 404, body: { error: 'Not found' } };
  }

  return { statusCode: 200, body: user };
}
```

### Calling another service

```typescript
import { askServiceRequest } from 'quidproquo-webserver';

function* enrichOrder(orderId: string) {
  const orderDetail = yield* askServiceRequest('inventory-service', 'getStock', { orderId });
  return orderDetail;
}
```

### Protecting a route with auth

```typescript
// qpq.config.ts
import { defineRouteAuthValidation, defineRoute } from 'quidproquo-webserver';

export default createQpqConfig([
  defineRouteAuthValidation('cognito'),      // validate JWT on every authenticated route
  defineRoute('GET', '/me', getMeStory, { requiresAuth: true }),
]);
```

## Related

- [Action Processors](./quidproquo-actionprocessors) — the runtime implementations for these actions
- [quidproquo-deploy-awscdk](./quidproquo-deploy-awscdk) — deploys routes and services to AWS
- [quidproquo-dev-server](./quidproquo-dev-server) — local HTTP server for development
- [Network Actions](../api/actions/network) — outbound HTTP requests from stories
- [Queue Actions](../api/actions/queue) — async processing triggered by routes
