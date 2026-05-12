---
sidebar_position: 21
---

# API Key Validation Actions

Validate API keys against a list of configured references.

## Overview

API key validation actions allow you to check whether an incoming API key value matches any of a set of configured `ApiKeyReference` entries. This is typically used in route authentication logic to gate access to endpoints that require a static API key.

## Available Actions

### askApiKeyValidationValidate

Validate an API key value against a list of configured API key references.

#### Signature

```typescript
function* askApiKeyValidationValidate(
  apiKeyValue: string,
  apiKeyReferences: ApiKeyReference[]
): ApiKeyValidationValidateActionRequester
```

#### Parameters

- **apiKeyValue** (`string`): The raw API key value to validate (e.g. extracted from an `Authorization` or `x-api-key` header)
- **apiKeyReferences** (`ApiKeyReference[]`): The list of configured API key references to validate against

#### Returns

Returns `true` if the key matches any reference, `false` otherwise.

#### Example

```typescript
import {
  askApiKeyValidationValidate,
} from 'quidproquo-webserver';

function* validateIncomingKey(
  rawKey: string,
  configuredKeys: ApiKeyReference[]
) {
  const isValid = yield* askApiKeyValidationValidate(rawKey, configuredKeys);

  if (!isValid) {
    yield* askThrowError('UNAUTHORIZED', 'Invalid API key');
  }

  return true;
}
```

## Usage Patterns

### Route-Level API Key Guard

```typescript
import {
  askApiKeyValidationValidate,
} from 'quidproquo-webserver';

function* guardedRoute(event: HTTPEvent, apiKeyRefs: ApiKeyReference[]) {
  const apiKey = event.headers['x-api-key'] ?? '';

  const isValid = yield* askApiKeyValidationValidate(apiKey, apiKeyRefs);

  if (!isValid) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // Proceed with the authenticated request...
}
```

### Combining with Route Auth Settings

```typescript
function* authenticateRequest(
  event: HTTPEvent,
  routeConfig: RouteAuthSettings,
  apiKeyRefs: ApiKeyReference[]
) {
  // First decode the auth token (if present)
  const decoded = yield* askRouteAuthValidationDecode(event, routeConfig, false);

  if (!decoded) {
    // Fall back to API key validation
    const apiKey = event.headers['x-api-key'] ?? '';
    const keyValid = yield* askApiKeyValidationValidate(apiKey, apiKeyRefs);

    if (!keyValid) {
      yield* askThrowError('UNAUTHORIZED', 'Authentication required');
    }
  }
}
```

## Related Actions

- **Route Auth Validation Actions** — For JWT/token-based route authentication
- **Network Actions** — For making authenticated outbound requests
