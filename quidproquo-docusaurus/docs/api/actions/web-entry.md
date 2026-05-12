---
sidebar_position: 29
---

# Web Entry Actions

Invalidate CDN/edge cache for paths served by a named web entry.

## Overview

Web entry actions let you programmatically invalidate cached paths in a web entry (a static-site or SPA deployment served through a CDN). When content changes — such as after a publish, deploy, or data update — you can push cache invalidations so users receive the latest version without waiting for TTL expiry.

## Available Actions

### askWebEntryInvalidateCache

Invalidate one or more cached paths for a named web entry.

#### Signature

```typescript
function* askWebEntryInvalidateCache(
  webEntryName: string,
  ...paths: string[]
): WebEntryInvalidateCacheActionRequester
```

#### Parameters

- **webEntryName** (`string`): The registered name of the web entry whose cache should be invalidated
- **paths** (`...string[]`): One or more path patterns to invalidate (e.g. `'/index.html'`, `'/assets/*'`)

#### Returns

Returns `void`.

#### Example

```typescript
import { askWebEntryInvalidateCache } from 'quidproquo-webserver';

function* publishBlogPost(postId: string) {
  // Save the post...

  // Invalidate the affected paths
  yield* askWebEntryInvalidateCache(
    'blog-web-entry',
    `/posts/${postId}`,
    '/index.html',
    '/sitemap.xml'
  );
}
```

## Usage Patterns

### Invalidate All Pages After a Global Config Change

```typescript
function* onGlobalConfigUpdate() {
  // Invalidate all cached paths
  yield* askWebEntryInvalidateCache('main-site', '/*');

  yield* askLogCreate(LogLevelEnum.INFO, 'Full cache invalidated after config update');
}
```

### Selective Invalidation After Content Update

```typescript
function* onProductUpdate(productId: string, categorySlug: string) {
  yield* askWebEntryInvalidateCache(
    'storefront',
    `/products/${productId}`,
    `/categories/${categorySlug}`,
    '/products/index.html'
  );
}
```

### Post-Deploy Cache Bust

```typescript
function* postDeployInvalidation(deployedVersion: string) {
  yield* askWebEntryInvalidateCache(
    'app-web-entry',
    '/index.html',
    '/manifest.json',
    `/static/js/${deployedVersion}/*`,
    `/static/css/${deployedVersion}/*`
  );

  yield* askLogCreate(LogLevelEnum.INFO, 'Cache invalidated for new deploy', {
    version: deployedVersion,
  });
}
```

## Best Practices

- Use specific paths rather than `/*` (invalidate all) where possible — blanket invalidations are slower and more expensive on most CDN providers.
- Combine cache invalidation with a logging call so you have a record of what was invalidated and when.
- Chain invalidation with the operation that changed the content (e.g. file write, KVS update) so they happen atomically within the same story.

## Related Actions

- **File Actions** — For writing static assets to storage drives
- **OpenAPI Spec Actions** — For serving the API spec, which may be cached
- **Log Actions** — For recording cache invalidation events
