---
sidebar_position: 21
---

# Inline Function Actions

Execute named functions defined within the same application without leaving the current execution context.

## Overview

Inline function actions let you invoke a named function — registered with the QPQ runtime — by name and pass it a typed payload. Unlike queue or event actions, the call is synchronous within the story: the result is returned directly to the caller. This is useful for dispatching work to functions that are co-located in the same service but need to be loosely coupled (e.g. resolved at runtime by name rather than imported directly).

## Available Actions

### askInlineFunctionExecute

Execute a named inline function and return its result.

#### Signature

```typescript
function* askInlineFunctionExecute<R, T>(
  functionName: string,
  payload: T,
): Generator<InlineFunctionExecuteAction<T>, R, any>
```

#### Type Parameters

- **R**: The expected return type of the function
- **T**: The type of the payload passed to the function

#### Parameters

- **functionName** (`string`): The registered name of the function to invoke
- **payload** (`T`): The input data to pass to the function

#### Returns

Returns `R`, the value produced by the named function.

#### Example

```typescript
import { askInlineFunctionExecute } from 'quidproquo-core';

interface ProcessOrderPayload {
  orderId: string;
  userId: string;
}

interface ProcessOrderResult {
  success: boolean;
  trackingNumber?: string;
}

function* handleCheckout(orderId: string, userId: string) {
  const result = yield* askInlineFunctionExecute<ProcessOrderResult, ProcessOrderPayload>(
    'processOrder',
    { orderId, userId },
  );

  if (!result.success) {
    yield* askLogCreate('ERROR', `Order ${orderId} processing failed`);
  }

  return result;
}
```

## Usage Patterns

### Dynamic Dispatch by Name

Route to different handlers based on runtime data without hard-coding imports:

```typescript
function* dispatchByType(eventType: string, eventData: unknown) {
  return yield* askInlineFunctionExecute<void, unknown>(
    `handle${eventType}`,
    eventData,
  );
}

// Calls 'handleUserCreated', 'handleOrderPlaced', etc.
function* onEvent(event: { type: string; data: unknown }) {
  yield* dispatchByType(event.type, event.data);
}
```

### Plugin / Extension Points

Provide an extension point where implementations are registered by name at startup:

```typescript
interface ValidationPayload {
  value: unknown;
  rules: string[];
}

function* validateWithPlugin(field: string, value: unknown, rules: string[]) {
  const isValid = yield* askInlineFunctionExecute<boolean, ValidationPayload>(
    `validate_${field}`,
    { value, rules },
  );

  if (!isValid) {
    yield* askThrowError('VALIDATION_ERROR', `Field ${field} failed validation`);
  }
}
```

### Wrapping Legacy or External Logic

Isolate side-effectful or platform-specific code behind a named function so stories stay pure and testable:

```typescript
function* sendNotification(userId: string, message: string) {
  yield* askInlineFunctionExecute<void, { userId: string; message: string }>(
    'sendPushNotification',
    { userId, message },
  );

  yield* askLogCreate('INFO', `Notification sent to user ${userId}`);
}
```

## Error Handling

```typescript
function* safeExecute<R, T>(functionName: string, payload: T): Generator<any, R | null, any> {
  const result = yield* askCatch(
    askInlineFunctionExecute<R, T>(functionName, payload),
  );

  if (!result.success) {
    yield* askLogCreate('ERROR', `Inline function '${functionName}' failed: ${result.error.errorType}`);
    return null;
  }

  return result.result;
}
```

## Best Practices

### 1. Keep Function Names in Constants

Avoid magic strings — define function names as constants to prevent typos:

```typescript
export const INLINE_FN = {
  processOrder: 'processOrder',
  sendNotification: 'sendNotification',
  validateUser: 'validateUser',
} as const;

function* run(orderId: string) {
  return yield* askInlineFunctionExecute(INLINE_FN.processOrder, { orderId });
}
```

### 2. Type Your Generics Explicitly

Always supply `<R, T>` when the return type matters — TypeScript cannot infer `R` from the function name:

```typescript
// Good: type is checked at compile time
const result = yield* askInlineFunctionExecute<OrderResult, OrderPayload>('processOrder', payload);

// Avoid: result is typed as unknown
const result = yield* askInlineFunctionExecute('processOrder', payload);
```

### 3. Prefer Direct Imports for Performance-Critical Hot Paths

`askInlineFunctionExecute` adds a runtime indirection. For tight loops or latency-sensitive code, import and `yield*` the target function directly.

## Testing

### Unit Testing

```typescript
test('handleCheckout yields an inline function execute action', () => {
  const story = handleCheckout('order-123', 'user-456');

  const { value: action } = story.next();

  expect(action.type).toBe('@quidproquo-core/InlineFunction/Execute');
  expect(action.payload.functionName).toBe('processOrder');
  expect(action.payload.payload).toEqual({ orderId: 'order-123', userId: 'user-456' });

  const { value: result } = story.next({ success: true, trackingNumber: 'TRK-789' });
  expect(result.trackingNumber).toBe('TRK-789');
});
```

### Integration Testing

```typescript
test('dispatches to the correct handler', async () => {
  const runtime = createTestRuntime({
    inlineFunctions: {
      processOrder: async ({ orderId }) => ({ success: true, trackingNumber: `TRK-${orderId}` }),
    },
  });

  const result = await runtime.execute(function* () {
    return yield* askInlineFunctionExecute<{ success: boolean; trackingNumber: string }, { orderId: string }>(
      'processOrder',
      { orderId: 'order-001' },
    );
  });

  expect(result.trackingNumber).toBe('TRK-order-001');
});
```

## Related Actions

- **Queue Actions** - For fire-and-forget or deferred function execution
- **Event Actions** - For broadcast-style function invocation across services
- **Log Actions** - For tracing inline function calls
