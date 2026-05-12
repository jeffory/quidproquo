---
sidebar_position: 25
---

# OpenAPI Spec Actions

Retrieve the OpenAPI specification for the current webserver.

## Overview

OpenAPI spec actions allow you to programmatically retrieve the OpenAPI (Swagger) specification generated for the current webserver instance. This is useful for exposing the spec via an API endpoint, generating client SDKs, or performing runtime introspection of available routes.

## Available Actions

### askGetOpenApiSpec

Retrieve the OpenAPI specification document for the current webserver.

#### Signature

```typescript
function* askGetOpenApiSpec(): OpenApiSpecGetOpenApiSpecActionRequester
```

#### Parameters

None.

#### Returns

Returns the OpenAPI specification as a `string` (typically JSON or YAML).

#### Example

```typescript
import { askGetOpenApiSpec } from 'quidproquo-webserver';

function* serveApiSpec() {
  const spec = yield* askGetOpenApiSpec();
  return spec;
}
```

## Usage Patterns

### Expose the Spec via an HTTP Endpoint

```typescript
import { askGetOpenApiSpec } from 'quidproquo-webserver';

function* getOpenApiSpecRoute(event: HTTPEvent) {
  const spec = yield* askGetOpenApiSpec();

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: spec,
  };
}
```

### Return Parsed Spec for Validation

```typescript
function* validateRouteExistsInSpec(routePath: string, method: string) {
  const specString = yield* askGetOpenApiSpec();
  const spec = JSON.parse(specString);

  const pathEntry = spec.paths?.[routePath];
  const methodEntry = pathEntry?.[method.toLowerCase()];

  if (!methodEntry) {
    yield* askThrowError(
      'NOT_FOUND',
      `Route ${method} ${routePath} not found in OpenAPI spec`
    );
  }

  return methodEntry;
}
```

## Related Actions

- **Web Entry Actions** — For managing cache invalidation of web resources
- **Platform Actions** — For environment and infrastructure details
