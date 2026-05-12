---
sidebar_position: 8
---

# quidproquo-testing

Fluent test utilities for QPQ generator stories. Provides a step-by-step assertion API (`expectGenerator`) and optional Vitest matchers so you can verify story execution without a real runtime.

## When to use it

Use `quidproquo-testing` to unit test any generator function (story). Instead of wiring up action processors and running a full runtime, you drive the generator manually — asserting which actions it yields and providing mock responses to each step.

## Installation

```bash
npm install --save-dev quidproquo-testing
```

## Core API — `expectGenerator`

`expectGenerator(generator)` returns a fluent chain. Call assertion methods in the same order the story yields actions.

```typescript
import { expectGenerator } from 'quidproquo-testing';
```

### Chain methods

| Method | Purpose |
|---|---|
| `.toYield(expected)` | Assert the next yielded action matches `expected` |
| `.toYieldAction(expected)` | Alias for `.toYield` |
| `.whenGiven(value)` | Provide the response to inject back into the generator for the last yield |
| `.andReceive(value)` | Alias for `.whenGiven` |
| `.withResponse(value)` | Alias for `.whenGiven` |
| `.thenYield(expected)` | Provide a response AND assert the next yield in one call |
| `.thenReturn(expected)` | Assert the generator's final return value |
| `.thenComplete()` | Assert the generator finishes (without checking the return value) |
| `.toMatchSnapshot()` | Snapshot the full execution history (Vitest/Jest snapshots) |
| `.getSteps()` | Return the raw array of recorded steps for custom assertions |

## Usage Examples

### Basic story test

```typescript
import { expectGenerator } from 'quidproquo-testing';
import { askGuidNew, askKeyValueStoreUpsert } from 'quidproquo-core';
import { createUser } from '../stories/user';

test('createUser yields expected actions', () => {
  expectGenerator(createUser('alice@example.com', 'Alice'))
    .toYield(askGuidNew())                    // story asks for a new GUID
    .whenGiven('mock-uuid-1234')              // we give it back a mock ID
    .thenYield(askKeyValueStoreUpsert('users', {
      userId: 'mock-uuid-1234',
      email: 'alice@example.com',
      name: 'Alice',
    }))
    .whenGiven(undefined)                     // upsert returns void
    .thenReturn({ userId: 'mock-uuid-1234', email: 'alice@example.com', name: 'Alice' });
});
```

### Testing a conditional branch

```typescript
import { expectGenerator } from 'quidproquo-testing';
import { askKeyValueStoreGet, askThrowError } from 'quidproquo-core';
import { getUser } from '../stories/user';

test('getUser throws when user not found', () => {
  expectGenerator(getUser('missing-id'))
    .toYield(askKeyValueStoreGet('users', 'missing-id'))
    .whenGiven(null)                                    // simulate "not found"
    .thenYield(askThrowError('NOT_FOUND', 'User not found'))
    .thenComplete();
});
```

### Snapshot test

```typescript
test('story execution matches snapshot', () => {
  expectGenerator(myComplexStory('arg1'))
    .whenGiven(mockResponse1)
    .whenGiven(mockResponse2)
    .thenComplete()
    .toMatchSnapshot();
});
```

## Vitest Matchers

For a more idiomatic Vitest style, import and extend the matchers:

```typescript
// vitest.setup.ts
import { expect } from 'vitest';
import { qpqMatchers } from 'quidproquo-testing/vitest';

expect.extend(qpqMatchers);
```

```typescript
// vitest.config.ts
export default {
  test: {
    setupFiles: ['./vitest.setup.ts'],
  },
};
```

Then in your tests:

```typescript
import { expect, test } from 'vitest';
import { createUser } from '../stories/user';

test('story yields and returns correctly', () => {
  const gen = createUser('alice@example.com');

  expect(gen).toYieldValue(askGuidNew());

  gen.next('mock-uuid');

  expect(gen).toCompleteWith({
    userId: 'mock-uuid',
    email: 'alice@example.com',
  });
});
```

### Matcher reference

| Matcher | Purpose |
|---|---|
| `.toYieldValue(expected)` | Assert the generator's next yield value |
| `.toCompleteWith(expected)` | Assert the generator's final `return` value |
| `.toYieldSequence(steps)` | Provide inputs and assert a full execution sequence at once |

## Mock helpers

```typescript
import { mockGeneratorReturn, mockGeneratorYieldReturn } from 'quidproquo-testing';

// A generator that immediately returns a value
const mockGet = mockGeneratorReturn<User>({ userId: '1', name: 'Alice' });

// A generator that yields once then returns
const mockFetch = mockGeneratorYieldReturn<FetchAction, string>(
  askNetworkRequest('/api/data'),
  '{"ok":true}'
);
```

Use mock generators when your story delegates to a sub-story and you want to stub out the sub-story without running it.

## Related

- [quidproquo-dev-server](./quidproquo-dev-server) — integration testing with a real local runtime
- [Key-Value Store Actions](../api/actions/key-value-store) — commonly tested action type
- [Error Actions](../api/actions/error) — test error-path branches
- [System Actions](../api/actions/system) — `askBatch` and other system-level actions
