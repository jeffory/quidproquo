---
sidebar_position: 3
---

# quidproquo-web

Client-side utilities for calling QPQ backends from a browser application. Handles OAuth2 token exchange, query parameter management, and typed HTTP request helpers.

## When to use it

Use `quidproquo-web` when you need low-level client-side integration — authentication flows, request wrappers, or service discovery — without a React dependency. If you are building a React app, you most likely want [`quidproquo-web-react`](./quidproquo-web-react), which re-exports many of these utilities alongside React hooks.

## Installation

```bash
npm install quidproquo-web
```

## Key Exports

### `auth`

| Export | Purpose |
|---|---|
| `exchangeOauth2TokenForAccessToken(code, redirectUri, clientId, tokenEndpoint)` | Exchange an OAuth2 authorization code for access + refresh tokens. Use this after the OAuth2 redirect returns a `code` query parameter. |

### `actions`

| Export | Purpose |
|---|---|
| `askQueryParamsGet` | Story action: read current URL query parameters |
| `askQueryParamsSet` | Story action: update URL query parameters without a page reload |

### `request`

Typed helpers for making authenticated HTTP requests to QPQ services from the browser.

### `services`

Service discovery utilities for resolving endpoint URLs at runtime based on QPQ config.

## Usage Example

### OAuth2 login flow

```typescript
import { exchangeOauth2TokenForAccessToken } from 'quidproquo-web/auth';

async function handleOAuthCallback() {
  const code = new URLSearchParams(window.location.search).get('code');
  if (!code) return;

  const tokens = await exchangeOauth2TokenForAccessToken(
    code,
    'https://myapp.example.com/callback',
    'my-client-id',
    'https://auth.example.com/oauth2/token'
  );

  localStorage.setItem('accessToken', tokens.accessToken);
  localStorage.setItem('refreshToken', tokens.refreshToken);
}
```

### Reading query params inside a story

```typescript
import { askQueryParamsGet } from 'quidproquo-web/actions';

function* myStory() {
  const params = yield* askQueryParamsGet();
  const page = parseInt(params.page ?? '1', 10);
  return page;
}
```

## Related

- [quidproquo-web-react](./quidproquo-web-react) — React hooks and Jotai state built on top of this package
- [quidproquo-actionprocessor-web](./quidproquo-actionprocessors#web) — browser-side action processor required to run stories in the browser
- [User Directory Actions](../api/actions/user-directory) — server-side auth actions
