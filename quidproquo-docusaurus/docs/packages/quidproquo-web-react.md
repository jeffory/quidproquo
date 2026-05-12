---
sidebar_position: 4
---

# quidproquo-web-react

React integration for QuidProQuo. Provides hooks that execute QPQ stories inside React components, atom-based global state via [Jotai](https://jotai.org), auth context, WebSocket support, and form field binding utilities.

## When to use it

Use this package when building a React SPA that talks to a QPQ backend. The central hook `useQpq` lets you run generator stories directly from components, with the full QPQ runtime wired up behind the scenes.

## Installation

```bash
npm install quidproquo-web-react
```

## Key Exports

### Core hook — `useQpq`

Runs a QPQ story from inside a React component. Handles lifecycle, versioning to avoid stale closures, and integrates with the browser action processors.

```typescript
function useQpq<TResult, TArgs extends unknown[]>(
  story: (...args: TArgs) => Generator,
  args: TArgs,
  deps?: DependencyList
): { result: TResult | undefined; loading: boolean; error: any }
```

### Auth

| Export | Purpose |
|---|---|
| `RefreshAuthTokensProvider` | Wrap your app to enable automatic token refresh |
| `useAuthAccessToken()` | Returns the current access token string |
| `useIsLoggedIn()` | Returns `true` if a valid session exists |
| `useRefreshTokens()` | Manually trigger a token refresh |
| `authContext` | Raw React context for auth state |

### API hooks

| Hook | Purpose |
|---|---|
| `useNetworkRequest(url, options, deps?)` | Fire a fetch request from a component; re-runs on dep changes |
| `useAuthenticatedNetworkRequest(url, options, deps?)` | Same as above but injects the current access token as a Bearer header |

### Utility hooks

| Hook | Purpose |
|---|---|
| `useAsyncEffect(fn, deps)` | `useEffect` with an async callback |
| `useEffectCallback(fn, deps)` | Stable callback that only changes when deps change |
| `useFastCallback(fn)` | Always-stable callback that reads the latest values via a ref |
| `useMetadata(key)` | Read metadata values from the QPQ config in a component |
| `useOnKeyDownEffect(key, fn, deps?)` | Trigger a side effect on a specific keyboard key |
| `useRunEvery(fn, intervalMs, deps?)` | Call a function on a timer; cleans up on unmount |
| `useThrottledMemo(fn, ms, deps)` | Like `useMemo` but rate-limited |
| `useZipArrays(a, b)` | Merge two arrays element-wise |

### State — `state`

Jotai atom factory helpers. Create typed atoms that persist in the QPQ global store and are reactive to React renders.

### WebSocket — `websocket` and `webSocketQueue`

| Export | Purpose |
|---|---|
| `WebSocketProvider` | Establishes and maintains a WebSocket connection |
| `useWebSocket()` | Read messages and send from any component |
| `webSocketQueueUtils` | Helpers for queue-backed WebSocket communication patterns |

### Form binding

| Export | Purpose |
|---|---|
| `useFieldBinding(atom, key)` | Bind a form `<input>` to a Jotai atom field; returns `{ value, onChange }` |
| `useSharedQueryParams(key, defaultValue)` | Sync a component state value with a URL query parameter |

## Usage Examples

### Run a story on mount

```typescript
import { useQpq } from 'quidproquo-web-react';
import { getUser } from '../stories/user';

function UserProfile({ userId }: { userId: string }) {
  const { result: user, loading } = useQpq(getUser, [userId], [userId]);

  if (loading) return <p>Loading…</p>;
  if (!user) return <p>User not found</p>;

  return <h1>{user.name}</h1>;
}
```

### Authenticated API request

```typescript
import { useAuthenticatedNetworkRequest } from 'quidproquo-web-react';

function OrderList() {
  const { result, loading } = useAuthenticatedNetworkRequest('/api/orders', {}, []);

  return loading ? <Spinner /> : <pre>{JSON.stringify(result, null, 2)}</pre>;
}
```

### Global state with Jotai

```typescript
import { atom, useAtom } from 'jotai';

// Define an atom
const cartAtom = atom<CartItem[]>([]);

// Use it in any component — no provider needed
function CartBadge() {
  const [cart] = useAtom(cartAtom);
  return <span>{cart.length}</span>;
}
```

### Auth-aware app shell

```typescript
import { RefreshAuthTokensProvider, useIsLoggedIn } from 'quidproquo-web-react';

function App() {
  return (
    <RefreshAuthTokensProvider>
      <Routes />
    </RefreshAuthTokensProvider>
  );
}

function Routes() {
  const loggedIn = useIsLoggedIn();
  return loggedIn ? <Dashboard /> : <Login />;
}
```

### WebSocket real-time updates

```typescript
import { WebSocketProvider, useWebSocket } from 'quidproquo-web-react';

function App() {
  return (
    <WebSocketProvider url="wss://api.example.com/ws">
      <LiveFeed />
    </WebSocketProvider>
  );
}

function LiveFeed() {
  const { messages, send } = useWebSocket();
  return (
    <ul>
      {messages.map((m, i) => <li key={i}>{m.data}</li>)}
    </ul>
  );
}
```

## Related

- [quidproquo-web](./quidproquo-web) — lower-level client utilities this package builds on
- [quidproquo-actionprocessor-web](./quidproquo-actionprocessors#web) — browser action processors wired up by `useQpq`
- [quidproquo-actionprocessor-node](./quidproquo-actionprocessors#node) — Node-compatible processors also used during SSR
- [User Directory Actions](../api/actions/user-directory) — server-side auth stories
