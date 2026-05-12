---
sidebar_position: 6
---

# quidproquo-deploy-webpack

Webpack configuration helpers and a custom plugin for bundling QPQ services. Generates Node.js-targeted bundles with the correct entry points, environment variables, and asset handling needed by the QPQ Lambda runtime.

## When to use it

You typically do **not** invoke this package directly. `quidproquo-deploy-awscdk` uses it internally to bundle Lambda functions before uploading them. You only need to work with this package directly if you are customising the webpack build — for example to add loaders, tweak output paths, or integrate QPQ into an existing webpack project.

## Installation

```bash
npm install quidproquo-deploy-webpack
```

## Key Exports

### `getWebpackConfigForQpq(options)`

Returns a complete webpack configuration object tuned for QPQ Lambda bundles.

```typescript
function getWebpackConfigForQpq(options: {
  entries: Record<string, string>;   // { 'handlerName': './src/handler.ts' }
  qpqConfig: QPQConfig;
  rootDir: string;
  mode?: 'development' | 'production';
}): webpack.Configuration
```

**Generated config highlights:**
- Target: `node`
- Output format: CommonJS2
- Dynamic output filenames keyed by entry name
- Excludes `aws-sdk` from the bundle (provided by the Lambda runtime)
- Processes YAML/JSON asset files
- Injects QPQ runtime environment variables via `QpqPlugin`

### `QpqPlugin`

A custom webpack plugin that processes QPQ config at build time and injects environment variables (service entries, action processor sources, email templates) that the Lambda runtime reads.

### Utility functions

| Function | Purpose |
|---|---|
| `getWebpackBuildMode(qpqConfig)` | Resolves `'development'` or `'production'` from the QPQ config |
| `setupWebpackQPQRuntime()` | Configures loader environment variables (`allSrcEntries`, `rootDir`, `actionProcessorSources`, `emailTemplates`) |
| `getResolveLoaderModules()` | Returns the loader resolution path list for QPQ's custom loaders |

## Usage Example

### Custom webpack config for a QPQ service

```typescript
import { getWebpackConfigForQpq } from 'quidproquo-deploy-webpack';
import qpqConfig from './qpq.config';
import path from 'path';

export default getWebpackConfigForQpq({
  entries: {
    'api-handler': './src/entries/api.ts',
    'queue-handler': './src/entries/queue.ts',
  },
  qpqConfig,
  rootDir: path.resolve(__dirname),
});
```

### Extending the generated config

```typescript
import { getWebpackConfigForQpq } from 'quidproquo-deploy-webpack';
import qpqConfig from './qpq.config';
import path from 'path';

const base = getWebpackConfigForQpq({ entries, qpqConfig, rootDir });

export default {
  ...base,
  module: {
    ...base.module,
    rules: [
      ...(base.module?.rules ?? []),
      // Add a custom loader for .graphql files
      { test: /\.graphql$/, use: 'graphql-tag/loader' },
    ],
  },
};
```

## Related

- [quidproquo-deploy-awscdk](./quidproquo-deploy-awscdk) — uses this package to bundle Lambda code automatically
- [quidproquo-actionprocessor-awslambda](./quidproquo-actionprocessors#aws-lambda) — the runtime that executes bundled handlers
