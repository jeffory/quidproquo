---
sidebar_position: 2
---

# Core Concepts

Quidproquo (QPQ) follows a Redux-like action/processor pattern where business logic is expressed as generator functions ("stories") that yield actions, which are then processed by platform-specific implementations.

There are four core concepts to understand: **Actions**, **Stories**, **Action Processors**, and the **Runtime**.

---

## Actions

An action is a plain, serializable object that describes *what* you want to do — not *how* to do it. Every action has a `type` string and an optional `payload`.

```typescript
// Action interface (from quidproquo-core)
interface Action<T> {
  type: string;      // identifies the action, e.g. "Config::GetParameter"
  payload?: T;       // data required to carry out the request
  returnErrors?: boolean; // when true, errors are returned rather than thrown
}
```

You never construct actions by hand. Instead you call **action requester** functions (prefixed with `ask`), which are thin generator-function wrappers that yield the right action object and return the typed result:

```typescript
import { askConfigGetParameter, askKeyValueStoreGet } from 'quidproquo-core';

// askConfigGetParameter yields a Config::GetParameter action
// and returns the parameter value as a string
const apiUrl: string = yield* askConfigGetParameter('api-base-url');

// askKeyValueStoreGet yields a KeyValueStore::Get action
// and returns the item (or null)
const user: User | null = yield* askKeyValueStoreGet<User>('users', userId);
```

### Action type system

Each action category has a dedicated TypeScript module that defines:

- **ActionType enum** — the string constants for that domain (e.g. `ConfigActionType.GetParameter`)
- **Payload interface** — the data the action carries
- **ActionProcessor type** — the function signature a processor must implement
- **ActionRequester type** — the generator return type of the `ask*` function

```typescript
// Simplified excerpt from ConfigGetParameterActionTypes.ts
export interface ConfigGetParameterActionPayload {
  parameterName: string;
}

export interface ConfigGetParameterAction extends Action<ConfigGetParameterActionPayload> {
  type: ConfigActionType.GetParameter;
}

export type ConfigGetParameterActionProcessor =
  ActionProcessor<ConfigGetParameterAction, string>;

export type ConfigGetParameterActionRequester =
  ActionRequester<ConfigGetParameterAction, string>;
```

This closed type loop means the compiler enforces that every action has a matching processor that returns the right type, and that your stories receive correctly-typed results.

---

## Stories

A story is a **generator function** (`function*`) that composes business logic by yielding actions and receiving their results. Stories are pure functions: they contain no platform-specific code and produce no side effects of their own.

```typescript
import {
  askGuidNew,
  askDateNow,
  askKeyValueStoreGet,
  askKeyValueStoreUpsert,
  askThrowError,
} from 'quidproquo-core';

export function* createUserStory(email: string, name: string) {
  // Check for duplicates
  const existing = yield* askKeyValueStoreGet<User>('users', email);
  if (existing) {
    yield* askThrowError('USER_EXISTS', `${email} is already registered`);
  }

  // Build the record
  const userId = yield* askGuidNew();
  const createdAt = yield* askDateNow();
  const user: User = { userId, email, name, createdAt };

  // Persist it
  yield* askKeyValueStoreUpsert('users', user);

  return user;
}
```

### How generator functions work

`function*` produces a generator. When the runtime calls `generator.next()`, execution runs until the next `yield` and pauses there, handing the yielded value (the action) back to the caller. The runtime then resolves the action and calls `generator.next(result)`, injecting the result as the return value of the `yield` expression. This continues until the generator returns.

```
story starts
  → yields KeyValueStore::Get action   (pauses)
runtime resolves action → returns null
  → story receives null, continues
  → yields Guid::New action            (pauses)
runtime resolves action → returns "abc-123"
  → story receives "abc-123", continues
  ...
story returns user object
```

Because execution is paused at each `yield`, the generator retains all local state between steps — no callbacks, no promise chains, no async/await noise.

### Story composition

Stories can call other stories with `yield*`. This delegates all the child story's yields up to the same runtime, composing them seamlessly:

```typescript
function* validateEmail(email: string) {
  if (!email.includes('@')) {
    yield* askThrowError('INVALID_EMAIL', 'Email must contain @');
  }
}

function* registerUser(email: string, password: string) {
  // Reuse the validation story
  yield* validateEmail(email);

  // Continue with registration...
  const userId = yield* askGuidNew();
  // ...
}
```

### The ask pattern

Every action category ships with `ask*` generator functions so you never write raw action objects. `yield*` delegates the generator, returning a typed result:

```typescript
// platform-agnostic: works on AWS, Node, browser
const content = yield* askFileReadTextContents('uploads', 'report.pdf');
const timestamp = yield* askDateNow();
const id = yield* askGuidNew();
```

---

## Action Processors

An action processor is a **platform-specific function** that knows *how* to execute a particular action. Processors are where the AWS SDK calls, filesystem reads, HTTP requests, and database queries actually live.

```typescript
// Processor function signature
type ActionProcessor<TAction extends Action<any>, TReturn = any> = (
  payload: TAction['payload'],
  session: StorySession,
  actionProcessors: ActionProcessorList,
  logger: QpqLogger,
  updateSession: StorySessionUpdater,
  dynamicModuleLoader: DynamicModuleLoader,
  streamRegistry: StreamRegistry,
) => Promise<[TReturn?, QPQError?]>;
```

Processors always return a `[result, error]` tuple — never throw. The runtime inspects the tuple and either injects the result into the story or propagates the error.

### Platform abstraction

The same story works unchanged across platforms because you swap the processor list, not the story code:

```typescript
// Your story (never changes)
function* readUserDocument(userId: string) {
  const content = yield* askFileReadTextContents('users', `${userId}/profile.json`);
  return JSON.parse(content);
}

// AWS: file reads hit S3
const awsProcessors = {
  'File::ReadTextContents': awsS3ReadProcessor,
};

// Local dev: file reads hit the local filesystem
const localProcessors = {
  'File::ReadTextContents': localFileSystemReadProcessor,
};
```

Each `quidproquo-actionprocessor-*` package exports a function that returns a processor list for its target platform:

```typescript
import { getActionProcessors } from 'quidproquo-actionprocessor-awslambda';
import { getActionProcessors } from 'quidproquo-actionprocessor-node';
```

### Writing a custom processor

If you need to integrate a service that QPQ doesn't support out of the box, implement the `ActionProcessor` type and add it to the processor list:

```typescript
const redisKvsGetProcessor: ActionProcessor<KeyValueStoreGetAction, any> = async (payload) => {
  const client = redis.createClient();
  const value = await client.get(`${payload.storeName}:${payload.key}`);
  return [value ? JSON.parse(value) : null, undefined];
};

const customProcessors = {
  ...getNodeActionProcessors(config),
  'KeyValueStore::Get': redisKvsGetProcessor, // override
};
```

---

## Runtime

The runtime is the orchestration layer that connects stories to processors. It drives the generator loop, matches each yielded action to its processor, logs every step, and manages session state.

### Creating a runtime

```typescript
import { createRuntime } from 'quidproquo-core';

const runtime = createRuntime(
  qpqConfig,          // QPQConfig — application configuration
  callerSession,      // StorySession — caller context (correlation, auth)
  getActionProcessors,// (config) => Promise<ActionProcessorList>
  getTimeNow,         // () => string — ISO timestamp provider
  logger,             // QpqLogger — log sink
  correlationId,      // string — trace ID for this execution
  runtimeType,        // QpqRuntimeType — Lambda, Node, Browser, etc.
  dynamicModuleLoader,// for lazy-loading processor modules
);

// Execute a story
const storyResult = await runtime(createUserStory, [email, name]);
```

### Execution loop

Inside `resolveStory`, the runtime runs a straightforward `while` loop:

```typescript
const generator = story(...args);
let step = generator.next();

while (!step.done) {
  const action = step.value;

  // Dispatch to the matching processor
  const [result, error] = await actionProcessors[action.type](
    action.payload,
    session,
    actionProcessors,
    logger,
    updateSession,
    dynamicModuleLoader,
    streamRegistry,
  );

  // Record the step in the execution history
  history.push({ act: action, res: [result, error], startedAt, finishedAt });

  // Propagate errors or feed the result back into the generator
  if (error && !action.returnErrors) {
    return { ...response, error };
  }
  step = generator.next(action.returnErrors ? { success: !error, result, error } : result);
}

return { ...response, result: step.value };
```

### What the runtime records

Every execution produces a `StoryResult` that captures the complete history:

```typescript
interface StoryResult<T> {
  input: any[];          // arguments passed to the story
  result?: T;            // return value on success
  error?: QPQError;      // error if the story failed
  history: Array<{       // every action + result, in order
    act: Action<any>;
    res: ActionProcessorResult<any>;
    startedAt: string;
    finishedAt: string;
  }>;
  correlation: string;   // unique ID for this run
  startedAt: string;
  finishedAt: string;
  logs: any[];
  tags: string[];
}
```

### Execution replay

Because the history is serializable, any past execution can be replayed exactly — or with selective overrides for testing:

```typescript
import { qpqExecuteLog } from 'quidproquo-core';

// Exact replay
const replayResult = await qpqExecuteLog(savedExecutionLog, myStory, {});

// Replay with one action overridden (e.g. to test a failure path)
const testResult = await qpqExecuteLog(savedExecutionLog, myStory, {
  'KeyValueStore::Get': async () => [null, undefined],
});
```

### Session state

The runtime maintains a `StorySession` throughout execution:

```typescript
interface StorySession {
  correlation?: string;          // trace ID shared across service calls
  depth: number;                 // story call-stack depth (max 100)
  decodedAccessToken?: DecodedAccessToken; // authenticated user info
  context: QpqContext<any>;      // key-value bag for cross-story data
}
```

Session state is threaded through every processor call automatically — your stories never need to pass auth tokens or correlation IDs as parameters.

---

## How the Four Concepts Fit Together

```
Your code writes stories (generator functions)
  │
  │  yield* askKeyValueStoreGet(...)
  ▼
Story yields an Action  ──────────────────────────────────────┐
                                                              │
                              Runtime receives the action      │
                              matches it to a processor        │
                              awaits the result                │
                              records the step                 │
                                                              │
Story receives the result ◄───────────────────────────────────┘
  (typed, platform-agnostic)

When the story returns, the runtime returns a StoryResult
containing the return value and the full execution history.
```

**Stories** declare intent. **Actions** carry that intent as data. **Processors** fulfil it on a real platform. The **Runtime** wires them together, logs everything, and makes replay possible.
