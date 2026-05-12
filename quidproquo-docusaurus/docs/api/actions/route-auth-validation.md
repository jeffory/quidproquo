---
sidebar_position: 26
---

# Route Auth Validation Actions

Decode and validate authentication tokens on incoming HTTP requests.

## Overview

Route auth validation actions decode JWT or platform-issued access tokens from incoming `HTTPEvent` objects and validate them against the route's configured `RouteAuthSettings`. They return a decoded token payload on success, or `null` if no valid token is present. These actions are the backbone of authentication checks in route handlers.

## Available Actions

### askRouteAuthValidationDecode

Decode and validate the authentication token on an HTTP event.

#### Signature

```typescript
function* askRouteAuthValidationDecode(
  event: HTTPEvent,
  routeAuthSettings: RouteAuthSettings,
  ignoreExpiration: boolean
): RouteAuthValidationDecodeActionRequester
```

#### Parameters

- **event** (`HTTPEvent`): The incoming HTTP event containing the authorization header or cookies
- **routeAuthSettings** (`RouteAuthSettings`): The authentication configuration for the route, including audience, issuer, and key settings
- **ignoreExpiration** (`boolean`): When `true`, expired tokens are still decoded successfully (useful for token refresh flows)

#### Returns

Returns `DecodedAccessToken | null`:
- A `DecodedAccessToken` containing the token claims if validation succeeds
- `null` if no token is present or the token is invalid/expired (when `ignoreExpiration` is `false`)

#### Example

```typescript
import { askRouteAuthValidationDecode } from 'quidproquo-webserver';

function* authenticatedRoute(
  event: HTTPEvent,
  routeAuthSettings: RouteAuthSettings
) {
  const token = yield* askRouteAuthValidationDecode(event, routeAuthSettings, false);

  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // Access claims from the decoded token
  const userId = token.sub;
  return { statusCode: 200, body: JSON.stringify({ userId }) };
}
```

## Usage Patterns

### Token Refresh Flow (Ignore Expiration)

```typescript
function* refreshToken(
  event: HTTPEvent,
  routeAuthSettings: RouteAuthSettings
) {
  // Allow expired tokens so we can extract the user identity
  const expiredToken = yield* askRouteAuthValidationDecode(
    event,
    routeAuthSettings,
    true // ignore expiration
  );

  if (!expiredToken) {
    yield* askThrowError('UNAUTHORIZED', 'Invalid token');
  }

  // Issue a new token for the user
  const newToken = yield* issueNewToken(expiredToken.sub);
  return newToken;
}
```

### Role-Based Access Control

```typescript
function* adminOnlyRoute(
  event: HTTPEvent,
  routeAuthSettings: RouteAuthSettings
) {
  const token = yield* askRouteAuthValidationDecode(event, routeAuthSettings, false);

  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const userRoles: string[] = token['custom:roles'] ?? [];

  if (!userRoles.includes('admin')) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // Proceed with admin logic...
}
```

### Optional Auth (Public Route with User Context)

```typescript
function* publicRoute(
  event: HTTPEvent,
  routeAuthSettings: RouteAuthSettings
) {
  // Token is optional — decode if present, but don't block if absent
  const token = yield* askRouteAuthValidationDecode(event, routeAuthSettings, false);

  const userId = token?.sub ?? null;

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: userId ? `Hello, ${userId}` : 'Hello, guest',
    }),
  };
}
```

## Related Actions

- **API Key Validation Actions** — For key-based (non-JWT) authentication
- **Context Actions** — For passing user identity through story execution
