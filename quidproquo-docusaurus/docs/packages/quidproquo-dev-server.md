---
sidebar_position: 7
---

# quidproquo-dev-server

Local development server for QPQ applications. Emulates AWS services (DynamoDB, S3, EventBridge, SQS, WebSocket, Cognito) entirely in-process using SQLite and the local filesystem, so you can develop and test without an AWS account or internet connection.

## When to use it

Use `quidproquo-dev-server` during local development to:
- Run your HTTP routes as a local Express/Node server
- Test service-to-service calls without deploying
- Inspect and manipulate local state stored in SQLite
- Iterate fast with hot-reload via file watching

## Installation

```bash
npm install quidproquo-dev-server
```

## Key Exports

### `startDevServer(config, overrides?)`

Starts the full development environment. Launches all sub-services in parallel:

- HTTP server (routes + service function handler)
- Queue processor
- EventBus subscriber
- WebSocket server
- Local file storage (filesystem-backed S3 emulation)
- File watcher for live reload

```typescript
function startDevServer(
  devServerConfig: DevServerConfig,
  overrides?: Partial<DevServerConfigOverrides>
): Promise<void>
```

### `startTinker(config, overrides?, options?)`

Lightweight interactive environment for testing individual stories without the full server. Optionally starts an HTTP listener but focuses on direct story invocation.

```typescript
function startTinker(
  devServerConfig: DevServerConfig,
  overrides?: Partial<DevServerConfigOverrides>,
  tinkerOptions?: TinkerOptions
): Promise<TinkerInterface>
```

`TinkerInterface` lets you call stories programmatically, inspect runtime state, and write integration test scripts against a running dev environment.

## Configuration

```typescript
interface DevServerConfig {
  qpqConfig: QPQConfig;            // your QPQ configuration
  runtimePath?: string;            // where to store local state (default: .qpq-runtime)
  fileStorageConfig?: {
    path: string;                  // local directory for file/S3 storage
    secureUrlHost?: string;        // host for presigned-URL emulation
    secureUrlPort?: number;
    secureUrlSecret?: string;
  };
  serviceName?: string;            // label for log output
}
```

## Usage Example

### Starting the dev server

```typescript
// dev.ts
import { startDevServer } from 'quidproquo-dev-server';
import qpqConfig from './qpq.config';

startDevServer({
  qpqConfig,
  runtimePath: '.qpq-runtime',
  fileStorageConfig: {
    path: '.qpq-files',
    secureUrlHost: 'localhost',
    secureUrlPort: 3001,
  },
  serviceName: 'my-service',
});
```

```bash
ts-node dev.ts
# → HTTP server on http://localhost:3000
# → WebSocket server on ws://localhost:3002
# → Watching for file changes…
```

### Using Tinker for interactive testing

```typescript
// tinker.ts
import { startTinker } from 'quidproquo-dev-server';
import qpqConfig from './qpq.config';
import { createUser } from './src/stories/user';

async function main() {
  const tinker = await startTinker({ qpqConfig });

  // Execute a story directly
  const user = await tinker.run(createUser, ['alice@example.com', 'Alice']);
  console.log('Created:', user);

  // Run it again with different args
  const user2 = await tinker.run(createUser, ['bob@example.com', 'Bob']);
  console.log('Created:', user2);
}

main();
```

### Add a start script to package.json

```json
{
  "scripts": {
    "dev": "ts-node dev.ts",
    "tinker": "ts-node tinker.ts"
  }
}
```

## Local State

The dev server stores its state in the `runtimePath` directory (default `.qpq-runtime`):

| Path | Contents |
|---|---|
| `.qpq-runtime/db.sqlite` | Key-value store (DynamoDB emulation) |
| `.qpq-runtime/queues/` | Pending queue messages |
| `.qpq-files/` | File storage (S3 emulation) |

You can delete `.qpq-runtime` at any time to reset all local state.

## Related

- [quidproquo-testing](./quidproquo-testing) — unit test stories without a server
- [quidproquo-actionprocessor-node](./quidproquo-actionprocessors#node) — Node.js action processors used by the dev server
- [quidproquo-deploy-awscdk](./quidproquo-deploy-awscdk) — deploy to AWS when local testing is complete
