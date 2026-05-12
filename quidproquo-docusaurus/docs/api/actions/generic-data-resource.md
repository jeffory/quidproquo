---
sidebar_position: 24
---

# Generic Data Resource Actions

Put and scan items in platform-managed data tables using a low-level generic interface.

## Overview

Generic data resource actions provide a simple, schema-free interface for storing and retrieving objects in named data tables. They are a lower-level primitive compared to the structured Key-Value Store actions, suitable for cases where you need to persist arbitrary objects without defining a schema upfront.

## Available Actions

### askPutGenericDataResource

Insert or replace an item in a named table.

#### Signature

```typescript
function* askPutGenericDataResource(
  tableName: string,
  item: object
): GenericDataResourcePutActionRequester
```

#### Parameters

- **tableName** (`string`): Name of the table to write to
- **item** (`object`): The item to store (arbitrary object)

#### Returns

Returns the stored `object`.

#### Example

```typescript
import { askPutGenericDataResource } from 'quidproquo-webserver';

function* storeEvent(event: Record<string, unknown>) {
  const stored = yield* askPutGenericDataResource('events', event);
  return stored;
}
```

---

### askScanGenericDataResource

Scan all items from a named table, up to a maximum count.

#### Signature

```typescript
function* askScanGenericDataResource(
  tableName: string,
  maxItems: number
): GenericDataResourceScanActionRequester
```

#### Parameters

- **tableName** (`string`): Name of the table to scan
- **maxItems** (`number`): Maximum number of items to return

#### Returns

Returns `Array<object>` — an array of stored items.

#### Example

```typescript
import { askScanGenericDataResource } from 'quidproquo-webserver';

function* getLatestEvents(limit: number) {
  const events = yield* askScanGenericDataResource('events', limit);
  return events;
}
```

## Usage Patterns

### Recording Arbitrary Platform Events

```typescript
function* recordPlatformEvent(
  eventType: string,
  payload: Record<string, unknown>
) {
  yield* askPutGenericDataResource('platform-events', {
    id: yield* askNewGuid(),
    eventType,
    payload,
    recordedAt: yield* askDateNow(),
  });
}
```

### Snapshot and Review Pattern

```typescript
function* snapshotAndReview(tableName: string) {
  const items = yield* askScanGenericDataResource(tableName, 500);

  yield* askLogCreate(LogLevelEnum.INFO, `Scanned ${tableName}`, {
    itemCount: items.length,
  });

  return items;
}
```

## Best Practices

- Prefer **Key-Value Store actions** when you need querying, indexing, or typed schemas. Use `askPutGenericDataResource` and `askScanGenericDataResource` for quick, unstructured writes or lightweight internal tables.
- Always include an `id` field (use `askNewGuid`) so items can be referenced later.
- Keep `maxItems` in `askScanGenericDataResource` bounded — scanning large tables without a limit can be slow and expensive.

## Related Actions

- **Key-Value Store Actions** — For structured, queryable NoSQL storage
- **GUID Actions** — For generating unique item identifiers
