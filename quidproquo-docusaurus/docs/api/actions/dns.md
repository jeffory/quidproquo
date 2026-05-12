---
sidebar_position: 22
---

# DNS Actions

List DNS entries registered in the current webserver environment.

## Overview

DNS actions provide a simple way to query the DNS entries that are configured for the running webserver instance. This is useful for service discovery, debugging infrastructure routing, or dynamically resolving endpoint addresses within your platform.

## Available Actions

### askDnsList

Retrieve the list of DNS entries for the current webserver environment.

#### Signature

```typescript
function* askDnsList(): DnsListActionRequester
```

#### Parameters

None.

#### Returns

Returns `string[]` — an array of DNS entry strings configured for the current environment.

#### Example

```typescript
import { askDnsList } from 'quidproquo-webserver';

function* getDnsEntries() {
  const entries = yield* askDnsList();
  return entries;
}
```

## Usage Patterns

### Service Discovery

```typescript
function* discoverServiceEndpoint(serviceName: string) {
  const dnsEntries = yield* askDnsList();

  const match = dnsEntries.find((entry) =>
    entry.includes(serviceName)
  );

  if (!match) {
    yield* askThrowError('NOT_FOUND', `No DNS entry found for service: ${serviceName}`);
  }

  return match;
}
```

### Logging Infrastructure DNS State

```typescript
function* logDnsSnapshot() {
  const entries = yield* askDnsList();

  yield* askLogCreate(LogLevelEnum.INFO, 'DNS snapshot', {
    count: entries.length,
    entries,
  });
}
```

## Related Actions

- **Network Actions** — For making HTTP requests to discovered endpoints
- **Platform Actions** — For environment and infrastructure configuration
