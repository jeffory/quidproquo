---
sidebar_position: 20
---

# Admin Actions

Access and query execution logs and metadata for administrative monitoring and debugging.

## Overview

Admin actions provide read-only access to the runtime's story execution logs. They allow you to retrieve individual logs, list logs within a time range, and navigate log metadata hierarchies for observability and debugging. These actions are intended for administrative use cases such as dashboards, audit trails, and error investigation.

## Available Actions

### askAdminGetLog

Retrieve the full execution log for a single story run by its correlation ID.

#### Signature

```typescript
function* askAdminGetLog(
  correlationId: string
): AdminGetLogActionRequester
```

#### Parameters

- **correlationId** (`string`): The unique correlation ID of the story execution to retrieve

#### Returns

Returns the full log entry for the specified execution run.

#### Example

```typescript
import { askAdminGetLog } from 'quidproquo-webserver';

function* inspectFailedRun(correlationId: string) {
  const log = yield* askAdminGetLog(correlationId);
  return log;
}
```

---

### askAdminGetLogs

List story execution logs filtered by runtime type and time range.

#### Signature

```typescript
function* askAdminGetLogs(
  runtimeType: string,
  startIsoDateTime: string,
  endIsoDateTime: string,
  nextPageKey?: string
): AdminGetLogsActionRequester
```

#### Parameters

- **runtimeType** (`string`): The runtime type to filter logs by (e.g. `'api'`, `'queue'`)
- **startIsoDateTime** (`string`): ISO 8601 start datetime for the time range
- **endIsoDateTime** (`string`): ISO 8601 end datetime for the time range
- **nextPageKey** (`string`, optional): Pagination cursor returned from the previous call

#### Returns

Returns a `QpqLogList` containing:
- **items** (`StoryResultMetadata[]`): Array of log metadata entries
- **nextPageKey** (`string | undefined`): Cursor for the next page, or `undefined` when no more pages remain

#### Example

```typescript
import { askAdminGetLogs } from 'quidproquo-webserver';

function* getRecentApiLogs() {
  const end = new Date().toISOString();
  const start = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // last hour

  const result = yield* askAdminGetLogs('api', start, end);
  return result.items;
}

// Paginate through all logs
function* getAllLogsInRange(runtimeType: string, start: string, end: string) {
  const allItems = [];
  let nextPageKey: string | undefined;

  do {
    const result = yield* askAdminGetLogs(runtimeType, start, end, nextPageKey);
    allItems.push(...result.items);
    nextPageKey = result.nextPageKey;
  } while (nextPageKey);

  return allItems;
}
```

---

### askAdminGetLogMetadata

Retrieve metadata for a single story execution.

#### Signature

```typescript
function* askAdminGetLogMetadata(
  correlationId: string
): AdminGetLogMetadataActionRequester
```

#### Parameters

- **correlationId** (`string`): The correlation ID of the story execution

#### Returns

Returns a `StoryResultMetadata` object with summary information about the execution (status, timing, error info, etc.).

#### Example

```typescript
import { askAdminGetLogMetadata } from 'quidproquo-webserver';

function* checkRunStatus(correlationId: string) {
  const metadata = yield* askAdminGetLogMetadata(correlationId);
  return metadata;
}
```

---

### askAdminGetLogMetadataChildren

List the child executions of a parent story run (e.g. sub-tasks spawned during execution), with pagination support.

#### Signature

```typescript
function* askAdminGetLogMetadataChildren(
  correlationId: string,
  nextPageKey?: string
): AdminGetLogMetadataChildrenActionRequester
```

#### Parameters

- **correlationId** (`string`): The correlation ID of the parent story execution
- **nextPageKey** (`string`, optional): Pagination cursor from the previous call

#### Returns

Returns a `QpqLogList` with child `StoryResultMetadata` entries and an optional `nextPageKey`.

#### Example

```typescript
import { askAdminGetLogMetadataChildren } from 'quidproquo-webserver';

function* getChildRuns(parentCorrelationId: string) {
  const allChildren = [];
  let nextPageKey: string | undefined;

  do {
    const result = yield* askAdminGetLogMetadataChildren(
      parentCorrelationId,
      nextPageKey
    );
    allChildren.push(...result.items);
    nextPageKey = result.nextPageKey;
  } while (nextPageKey);

  return allChildren;
}
```

## Usage Patterns

### Error Investigation Dashboard

```typescript
function* buildErrorReport(
  runtimeType: string,
  start: string,
  end: string
) {
  const logs = yield* askAdminGetLogs(runtimeType, start, end);

  const erroredRuns = logs.items.filter(
    (entry) => entry.status === 'error'
  );

  return erroredRuns.map((entry) => ({
    correlationId: entry.correlationId,
    errorMessage: entry.error,
    startedAt: entry.startedAt,
  }));
}
```

### Tracing a Parent/Child Execution Tree

```typescript
function* traceExecution(rootCorrelationId: string) {
  const root = yield* askAdminGetLogMetadata(rootCorrelationId);
  const children = yield* askAdminGetLogMetadataChildren(rootCorrelationId);

  return {
    root,
    children: children.items,
  };
}
```

## Related Actions

- **Log Actions** — For writing logs during story execution
- **Context Actions** — For reading the current correlation ID at runtime
