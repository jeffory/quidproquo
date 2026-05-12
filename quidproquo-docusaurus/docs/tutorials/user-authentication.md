---
sidebar_position: 3
---

# User Authentication

This tutorial covers user registration, login, token refresh, and protecting routes with Quidproquo's User Directory actions.

## Overview

QPQ abstracts user identity providers (AWS Cognito, Auth0, etc.) behind a consistent `askUserDirectory*` API. You define a **user directory** in your config and the same code runs on every platform.

## Step 1: Define a User Directory

```typescript
// src/config.ts
import { defineUserDirectory } from 'quidproquo-core';

export const auth = [
  defineUserDirectory('main', {
    selfSignUp: true,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireNumbers: true,
    },
  }),
];
```

## Step 2: Registration Story

```typescript
// src/stories/auth.ts
import {
  askUserDirectoryCreateUser,
  askUserDirectoryAuthenticateUser,
  askUserDirectoryRefreshToken,
  askUserDirectoryGetUser,
  askUserDirectoryChangePassword,
  askLogCreate,
  LogLevelEnum,
} from 'quidproquo-core';

const USER_DIRECTORY = 'main';

export function* registerUserStory(email: string, password: string, name: string) {
  yield* askLogCreate(LogLevelEnum.INFO, 'Registering user', { email });

  const user = yield* askUserDirectoryCreateUser(USER_DIRECTORY, email, password, {
    name,
  });

  return user;
}
```

## Step 3: Login Story

```typescript
export function* loginStory(email: string, password: string) {
  const response = yield* askUserDirectoryAuthenticateUser(
    USER_DIRECTORY,
    false, // isCustom
    email,
    password,
  );

  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    idToken: response.idToken,
    expiresIn: response.expiresIn,
  };
}
```

## Step 4: Token Refresh Story

```typescript
export function* refreshTokenStory(refreshToken: string) {
  const response = yield* askUserDirectoryRefreshToken(USER_DIRECTORY, refreshToken);

  return {
    accessToken: response.accessToken,
    idToken: response.idToken,
    expiresIn: response.expiresIn,
  };
}
```

## Step 5: Get Authenticated User

```typescript
export function* getCurrentUserStory(accessToken: string) {
  const user = yield* askUserDirectoryGetUser(USER_DIRECTORY, accessToken);
  return user;
}
```

## Step 6: Change Password

```typescript
export function* changePasswordStory(
  accessToken: string,
  oldPassword: string,
  newPassword: string,
) {
  yield* askUserDirectoryChangePassword(
    USER_DIRECTORY,
    accessToken,
    oldPassword,
    newPassword,
  );
}
```

## Step 7: Build Auth Routes

```typescript
// src/api/auth.ts
import { askCatch } from 'quidproquo-core';
import { HTTPMethod, HTTPResponse, RouteRequest } from 'quidproquo-webserver';
import {
  registerUserStory,
  loginStory,
  refreshTokenStory,
  getCurrentUserStory,
  changePasswordStory,
} from '../stories/auth';

function jsonResponse(statusCode: number, body: unknown): HTTPResponse {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function getBearerToken(request: RouteRequest): string | null {
  const auth = request.headers?.Authorization ?? request.headers?.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// POST /auth/register
export function* handleRegister(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const { email, password, name } = JSON.parse(request.body ?? '{}');

  if (!email || !password || !name) {
    return jsonResponse(400, { error: 'email, password, and name are required' });
  }

  const result = yield* askCatch(registerUserStory(email, password, name));

  if (!result.success) {
    return jsonResponse(409, { error: result.error.errorText });
  }

  return jsonResponse(201, { message: 'Registration successful' });
}

// POST /auth/login
export function* handleLogin(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const { email, password } = JSON.parse(request.body ?? '{}');

  if (!email || !password) {
    return jsonResponse(400, { error: 'email and password are required' });
  }

  const result = yield* askCatch(loginStory(email, password));

  if (!result.success) {
    return jsonResponse(401, { error: 'Invalid credentials' });
  }

  return jsonResponse(200, result.result);
}

// POST /auth/refresh
export function* handleRefreshToken(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const { refreshToken } = JSON.parse(request.body ?? '{}');

  if (!refreshToken) {
    return jsonResponse(400, { error: 'refreshToken is required' });
  }

  const result = yield* askCatch(refreshTokenStory(refreshToken));

  if (!result.success) {
    return jsonResponse(401, { error: 'Invalid or expired refresh token' });
  }

  return jsonResponse(200, result.result);
}

// GET /auth/me — protected route example
export function* handleGetMe(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const token = getBearerToken(request);

  if (!token) {
    return jsonResponse(401, { error: 'Authorization header required' });
  }

  const result = yield* askCatch(getCurrentUserStory(token));

  if (!result.success) {
    return jsonResponse(401, { error: 'Invalid or expired token' });
  }

  return jsonResponse(200, result.result);
}

// POST /auth/change-password
export function* handleChangePassword(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const token = getBearerToken(request);

  if (!token) {
    return jsonResponse(401, { error: 'Authorization header required' });
  }

  const { oldPassword, newPassword } = JSON.parse(request.body ?? '{}');

  if (!oldPassword || !newPassword) {
    return jsonResponse(400, { error: 'oldPassword and newPassword are required' });
  }

  const result = yield* askCatch(changePasswordStory(token, oldPassword, newPassword));

  if (!result.success) {
    return jsonResponse(400, { error: result.error.errorText });
  }

  return jsonResponse(204, null);
}
```

## Step 8: Register Routes

```typescript
// src/config.ts
import { defineUserDirectory } from 'quidproquo-core';
import { defineRoute, defineApi, defineService, HTTPMethod } from 'quidproquo-webserver';
import {
  handleRegister,
  handleLogin,
  handleRefreshToken,
  handleGetMe,
  handleChangePassword,
} from './api/auth';

export default [
  defineUserDirectory('main', {
    selfSignUp: true,
  }),

  defineApi('main', {
    routes: [
      defineRoute(HTTPMethod.POST, '/auth/register',        handleRegister),
      defineRoute(HTTPMethod.POST, '/auth/login',           handleLogin),
      defineRoute(HTTPMethod.POST, '/auth/refresh',         handleRefreshToken),
      defineRoute(HTTPMethod.GET,  '/auth/me',              handleGetMe),
      defineRoute(HTTPMethod.POST, '/auth/change-password', handleChangePassword),
    ],
  }),

  defineService('auth-service', { apis: ['main'] }),
];
```

## Protecting Other Routes

Reuse the token validation in any route handler:

```typescript
// src/middleware/requireAuth.ts
import { askCatch } from 'quidproquo-core';
import { HTTPResponse, RouteRequest } from 'quidproquo-webserver';
import { getCurrentUserStory } from '../stories/auth';

export function* requireAuth(request: RouteRequest) {
  const auth = request.headers?.Authorization ?? request.headers?.authorization ?? '';

  if (!auth.startsWith('Bearer ')) {
    return { user: null, unauthorized: true };
  }

  const token = auth.slice(7);
  const result = yield* askCatch(getCurrentUserStory(token));

  if (!result.success) {
    return { user: null, unauthorized: true };
  }

  return { user: result.result, unauthorized: false };
}
```

Use it in any route:

```typescript
import { requireAuth } from '../middleware/requireAuth';

export function* handleCreatePost(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const { user, unauthorized } = yield* requireAuth(request);

  if (unauthorized || !user) {
    return jsonResponse(401, { error: 'Authentication required' });
  }

  const { title, content } = JSON.parse(request.body ?? '{}');
  const post = yield* createPostStory(title, content, user.id);
  return jsonResponse(201, post);
}
```

## Test Your Auth API

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Secret123","name":"Alice"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Secret123"}'

# Get current user (replace TOKEN with the accessToken from login)
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer TOKEN"
```

## Next Steps

- [WebSocket Connections](./websockets) — push real-time updates to authenticated users
- [Queue Processing](./queue-processing) — send welcome emails after registration
