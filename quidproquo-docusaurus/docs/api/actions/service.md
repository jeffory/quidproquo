---
sidebar_position: 27
---

# Service Actions

Make typed requests to named services within the platform.

## Overview

Service actions allow stories to call methods on other named services registered in the platform. Each call is identified by a service name and method, and carries a typed payload. The response is also typed, making cross-service communication safe and self-documenting. The `createServiceRequester` helper lets you build a reusable, typed requester for a specific service.

## Available Actions

### askServiceRequest

Send a request to a named service method.

#### Signature

```typescript
function* askServiceRequest<TPayload, TResponse>(
  serviceName: string,
  method: string,
  payload: TPayload
): ServiceRequestActionRequester<TPayload, TResponse>
```

#### Parameters

- **serviceName** (`string`): The registered name of the target service
- **method** (`string`): The method name to invoke on the service
- **payload** (`TPayload`): The typed request payload

#### Returns

Returns `TResponse` — the typed response from the service.

#### Example

```typescript
import { askServiceRequest } from 'quidproquo-webserver';

interface GetUserPayload {
  userId: string;
}

interface GetUserResponse {
  id: string;
  name: string;
  email: string;
}

function* getUserFromUserService(userId: string) {
  const user = yield* askServiceRequest<GetUserPayload, GetUserResponse>(
    'user-service',
    'getUser',
    { userId }
  );

  return user;
}
```

## createServiceRequester

`createServiceRequester` produces a reusable typed requester bound to a specific service name and method, reducing repetition across your codebase.

### Signature

```typescript
function createServiceRequester<TPayload, TResponse>(
  serviceName: string,
  method: string
): (payload: TPayload) => Generator<ServiceRequestAction, TResponse, any>
```

### Example

```typescript
import { createServiceRequester } from 'quidproquo-webserver';

// Define the requester once
const askGetUser = createServiceRequester<
  { userId: string },
  { id: string; name: string; email: string }
>('user-service', 'getUser');

// Use it anywhere in your stories
function* loadUserProfile(userId: string) {
  const user = yield* askGetUser({ userId });
  return user;
}
```

## Usage Patterns

### Typed Service Client Module

```typescript
// services/userService.ts
import { createServiceRequester } from 'quidproquo-webserver';

export const askGetUser = createServiceRequester<
  { userId: string },
  { id: string; name: string }
>('user-service', 'getUser');

export const askCreateUser = createServiceRequester<
  { name: string; email: string },
  { id: string }
>('user-service', 'createUser');

export const askDeleteUser = createServiceRequester<
  { userId: string },
  void
>('user-service', 'deleteUser');
```

```typescript
// story.ts
import { askGetUser, askCreateUser } from './services/userService';

function* createAndFetchUser(name: string, email: string) {
  const { id } = yield* askCreateUser({ name, email });
  const user = yield* askGetUser({ userId: id });
  return user;
}
```

### Fan-Out to Multiple Services

```typescript
function* buildOrderSummary(orderId: string) {
  const order = yield* askServiceRequest<{ orderId: string }, Order>(
    'order-service',
    'getOrder',
    { orderId }
  );

  const customer = yield* askServiceRequest<{ userId: string }, Customer>(
    'user-service',
    'getUser',
    { userId: order.customerId }
  );

  const inventory = yield* askServiceRequest<{ itemIds: string[] }, InventoryStatus[]>(
    'inventory-service',
    'checkItems',
    { itemIds: order.items.map((i) => i.id) }
  );

  return { order, customer, inventory };
}
```

## Related Actions

- **Service Function Actions** — For invoking named functions within a service (vs. methods)
- **Network Actions** — For direct HTTP calls to external APIs
- **Queue Actions** — For fire-and-forget async service communication
