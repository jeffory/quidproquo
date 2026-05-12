---
sidebar_position: 28
---

# Service Function Actions

Execute named functions within a service, with support for async execution.

## Overview

Service function actions allow you to invoke a specific named function within a service, passing a typed payload and receiving a typed return value. Unlike the general service request (which targets a service method), service function actions target individual named functions and support an `isAsync` flag for fire-and-forget execution.

## Available Actions

### askServiceFunctionExecute

Execute a named function in a service.

#### Signature

```typescript
function* askServiceFunctionExecute<R, T>(
  service: string,
  functionName: string,
  payload: T,
  isAsync?: boolean
): ServiceFunctionExecuteActionRequester<R, T>
```

#### Parameters

- **service** (`string`): The registered name of the target service
- **functionName** (`string`): The name of the function to execute within the service
- **payload** (`T`): The typed input payload for the function
- **isAsync** (`boolean`, optional): When `true`, the call is fire-and-forget — the action returns immediately without waiting for the function to complete. Defaults to `false`.

#### Returns

Returns `R` — the typed return value from the function (or `void` when `isAsync` is `true`).

#### Example

```typescript
import { askServiceFunctionExecute } from 'quidproquo-webserver';

interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
}

interface SendEmailResult {
  messageId: string;
}

function* sendWelcomeEmail(userEmail: string) {
  const result = yield* askServiceFunctionExecute<SendEmailResult, SendEmailPayload>(
    'email-service',
    'sendEmail',
    {
      to: userEmail,
      subject: 'Welcome!',
      body: 'Thanks for signing up.',
    }
  );

  return result.messageId;
}
```

## Usage Patterns

### Async Fire-and-Forget

Use `isAsync: true` for background tasks where you don't need to wait for the result:

```typescript
function* triggerReportGeneration(reportId: string) {
  // Start report generation in the background
  yield* askServiceFunctionExecute<void, { reportId: string }>(
    'reporting-service',
    'generateReport',
    { reportId },
    true // async — don't block
  );

  return { status: 'Report generation started', reportId };
}
```

### Chaining Service Function Calls

```typescript
function* onboardNewUser(userData: { name: string; email: string }) {
  // Create user account
  const { userId } = yield* askServiceFunctionExecute<
    { userId: string },
    { name: string; email: string }
  >('user-service', 'createUser', userData);

  // Create default workspace (sync)
  yield* askServiceFunctionExecute<void, { userId: string }>(
    'workspace-service',
    'createDefaultWorkspace',
    { userId }
  );

  // Send welcome email (async — don't block)
  yield* askServiceFunctionExecute<void, { userId: string; email: string }>(
    'email-service',
    'sendWelcomeEmail',
    { userId, email: userData.email },
    true
  );

  return { userId };
}
```

### Service Function vs. Service Request

- Use **`askServiceFunctionExecute`** when you need to call a specific named function within a service, especially when `isAsync` matters.
- Use **`askServiceRequest`** (or `createServiceRequester`) when you're calling a service method and want a reusable, pre-bound requester.

## Related Actions

- **Service Actions** — For method-based cross-service calls with reusable requesters
- **Queue Actions** — For decoupled async communication via message queues
- **Event Bus Actions** — For broadcast-style async messaging
