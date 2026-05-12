---
sidebar_position: 19
---

# Query Params Actions

Read and update URL query parameters from within web stories.

## Overview

Query params actions provide a generator-based interface for interacting with the browser's URL query string. They let you read individual or all query parameters and update them programmatically, with optional browser history integration. These actions are available in the `quidproquo-web` package and are only applicable in web (browser) runtimes.

## Available Actions

### askQueryParamsGet

Retrieve all values for a specific query parameter key.

#### Signature

```typescript
function* askQueryParamsGet(key: string): QueryParamsGetActionRequester
```

#### Parameters

- **key** (`string`): The query parameter name to look up

#### Returns

`string[]` — An array of values for the given key. Returns an empty array if the key is not present.

#### Example

```typescript
import { askQueryParamsGet } from 'quidproquo-web';

function* getSearchTerm() {
  const values = yield* askQueryParamsGet('q');
  // URL: /search?q=hello
  // values => ['hello']

  const tags = yield* askQueryParamsGet('tag');
  // URL: /search?tag=react&tag=typescript
  // tags => ['react', 'typescript']

  return values[0] ?? '';
}
```

---

### askQueryParamsGetAll

Retrieve all query parameters as a map of key → values.

#### Signature

```typescript
function* askQueryParamsGetAll(): QueryParamsGetAllActionRequester
```

#### Parameters

None.

#### Returns

`Record<string, string[]>` — An object where each key maps to an array of its values.

#### Example

```typescript
import { askQueryParamsGetAll } from 'quidproquo-web';

function* inspectQueryString() {
  const params = yield* askQueryParamsGetAll();
  // URL: /search?q=hello&tag=react&tag=typescript
  // params => { q: ['hello'], tag: ['react', 'typescript'] }

  return params;
}
```

---

### askQueryParamsSet

Set the values for a specific query parameter key.

#### Signature

```typescript
function* askQueryParamsSet(
  key: string,
  values: string[],
  createHistoryEntry?: boolean
): QueryParamsSetActionRequester
```

#### Parameters

- **key** (`string`): The query parameter name to set
- **values** (`string[]`): The values to assign. Pass an empty array to remove the key
- **createHistoryEntry** (`boolean`, optional, default `false`): When `true`, pushes a new browser history entry so the change is navigable with the back button. When `false`, replaces the current entry silently

#### Returns

`void`

#### Example

```typescript
import { askQueryParamsSet } from 'quidproquo-web';

function* applyFilter(tag: string) {
  // Add a tag filter, replacing the current history entry
  yield* askQueryParamsSet('tag', [tag]);
}

function* navigateToSearch(query: string) {
  // Update the search term and create a back-navigable history entry
  yield* askQueryParamsSet('q', [query], true);
}

function* clearFilter() {
  // Remove the tag param entirely
  yield* askQueryParamsSet('tag', []);
}
```

---

## Usage Patterns

### Reading a single value with a default

```typescript
import { askQueryParamsGet } from 'quidproquo-web';

function* getCurrentPage(): Generator<any, number, any> {
  const values = yield* askQueryParamsGet('page');
  return values.length > 0 ? parseInt(values[0], 10) : 1;
}
```

### Syncing filters to the URL

```typescript
import { askQueryParamsSet } from 'quidproquo-web';

interface Filters {
  category: string;
  tags: string[];
}

function* syncFiltersToUrl(filters: Filters) {
  yield* askQueryParamsSet('category', [filters.category], true);
  yield* askQueryParamsSet('tag', filters.tags, false);
}
```

### Restoring state from the URL on load

```typescript
import { askQueryParamsGetAll } from 'quidproquo-web';

function* restoreFiltersFromUrl() {
  const params = yield* askQueryParamsGetAll();

  return {
    category: params['category']?.[0] ?? 'all',
    tags: params['tag'] ?? [],
    page: parseInt(params['page']?.[0] ?? '1', 10),
  };
}
```

### Updating one param while preserving others

```typescript
import { askQueryParamsSet } from 'quidproquo-web';

function* goToPage(page: number) {
  // Only the 'page' param changes; all other params remain untouched
  yield* askQueryParamsSet('page', [String(page)], true);
}
```

---

## Best Practices

### 1. Prefer `createHistoryEntry: true` for user-visible navigation

```typescript
// Good - user can press Back to undo the navigation
yield* askQueryParamsSet('q', [searchTerm], true);

// Acceptable - silent update, e.g. auto-saving a draft selection
yield* askQueryParamsSet('draft', [draftId]);
```

### 2. Always handle the empty-array case from `askQueryParamsGet`

```typescript
// Good - safe default
const [sortBy = 'date'] = yield* askQueryParamsGet('sort');

// Bad - crashes when the param is absent
const sortBy = (yield* askQueryParamsGet('sort'))[0].toLowerCase();
```

### 3. Use `askQueryParamsGetAll` when you need multiple params at once

```typescript
// Good - single action call
const params = yield* askQueryParamsGetAll();
const q = params['q']?.[0];
const page = params['page']?.[0];

// Wasteful - multiple round-trips for the same URL
const q = (yield* askQueryParamsGet('q'))[0];
const page = (yield* askQueryParamsGet('page'))[0];
```

### 4. Remove params explicitly rather than setting them to empty strings

```typescript
// Good - param disappears from the URL
yield* askQueryParamsSet('filter', []);

// Bad - leaves a visible ?filter= in the URL
yield* askQueryParamsSet('filter', ['']);
```

---

## Testing

```typescript
describe('Query Params Actions', () => {
  test('askQueryParamsGet yields the correct action', () => {
    function* story() {
      return yield* askQueryParamsGet('q');
    }

    const gen = story();
    const { value: action } = gen.next();

    expect(action.type).toBe('@quidproquo-web/QueryParams/Get');
    expect(action.payload).toEqual({ key: 'q' });
  });

  test('askQueryParamsGetAll yields the correct action', () => {
    function* story() {
      return yield* askQueryParamsGetAll();
    }

    const gen = story();
    const { value: action } = gen.next();

    expect(action.type).toBe('@quidproquo-web/QueryParams/GetAll');
    expect(action.payload).toBeUndefined();
  });

  test('askQueryParamsSet yields the correct action with history entry', () => {
    function* story() {
      yield* askQueryParamsSet('tag', ['react', 'typescript'], true);
    }

    const gen = story();
    const { value: action } = gen.next();

    expect(action.type).toBe('@quidproquo-web/QueryParams/Set');
    expect(action.payload).toEqual({
      key: 'tag',
      values: ['react', 'typescript'],
      createHistoryEntry: true,
    });
  });
});
```

---

## Related Actions

- **State Actions** - For in-memory application state that does not need to persist in the URL
- **Context Actions** - For passing data through the story call tree without URL exposure
- **Network Actions** - For constructing and parsing full URLs
