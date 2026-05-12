---
sidebar_position: 4
---

# WebSocket Connections

This tutorial shows how to build real-time features with Quidproquo using WebSocket actions — sending messages to connected clients, managing connection state, and broadcasting to groups.

## Overview

QPQ WebSocket actions let you push data to clients without polling. Connections are tracked in a key-value store and messages are sent via `askWebSocketSendMessage`. This works the same way on AWS (API Gateway WebSocket) and locally.

## Step 1: Define Storage for Connections

Each WebSocket connection gets an ID. Store them in a KVS so you can look up connections later:

```typescript
// src/config.ts
import { defineKeyValueStore } from 'quidproquo-core';

export const connectionStore = defineKeyValueStore('ws-connections', {
  partitionKey: 'connectionId',
  indexes: [
    {
      name: 'byUserId',
      partitionKey: 'userId',
      sortKey: 'connectedAt',
    },
  ],
});
```

## Step 2: Handle Connect and Disconnect

QPQ fires connect/disconnect events for each WebSocket lifecycle:

```typescript
// src/stories/websocket.ts
import {
  askKeyValueStoreUpsert,
  askKeyValueStoreDelete,
  askKeyValueStoreQuery,
  askWebSocketSendMessage,
  askDateNow,
  askLogCreate,
  LogLevelEnum,
} from 'quidproquo-core';

interface Connection {
  connectionId: string;
  userId: string;
  connectedAt: string;
}

export function* handleConnectStory(connectionId: string, userId: string) {
  const now = yield* askDateNow();

  const connection: Connection = {
    connectionId,
    userId,
    connectedAt: now,
  };

  yield* askKeyValueStoreUpsert('ws-connections', connection);
  yield* askLogCreate(LogLevelEnum.INFO, 'WebSocket connected', { connectionId, userId });
}

export function* handleDisconnectStory(connectionId: string) {
  yield* askKeyValueStoreDelete('ws-connections', connectionId);
  yield* askLogCreate(LogLevelEnum.INFO, 'WebSocket disconnected', { connectionId });
}
```

## Step 3: Send a Message to a Connection

Use `askWebSocketSendMessage` to push data to a specific connection:

```typescript
export function* sendToConnectionStory(connectionId: string, event: string, data: unknown) {
  const message = JSON.stringify({ event, data, timestamp: yield* askDateNow() });

  try {
    yield* askWebSocketSendMessage(connectionId, message);
  } catch {
    // Connection may have closed — clean up stale record
    yield* askKeyValueStoreDelete('ws-connections', connectionId);
  }
}
```

## Step 4: Broadcast to a User's Connections

A user might have multiple tabs open. Send to all of them:

```typescript
export function* broadcastToUserStory(userId: string, event: string, data: unknown) {
  const result = yield* askKeyValueStoreQuery<Connection>('ws-connections', {
    indexName: 'byUserId',
    partitionKey: userId,
  });

  for (const connection of result.items) {
    yield* sendToConnectionStory(connection.connectionId, event, data);
  }
}
```

## Step 5: Handle Incoming Messages

Clients can also send messages over the WebSocket. Route them by `action` field:

```typescript
export function* handleMessageStory(connectionId: string, rawMessage: string) {
  let message: { action: string; data?: unknown };

  try {
    message = JSON.parse(rawMessage);
  } catch {
    yield* sendToConnectionStory(connectionId, 'error', { message: 'Invalid JSON' });
    return;
  }

  switch (message.action) {
    case 'ping':
      yield* sendToConnectionStory(connectionId, 'pong', { ts: yield* askDateNow() });
      break;

    case 'subscribe':
      yield* handleSubscribeStory(connectionId, message.data as { channel: string });
      break;

    default:
      yield* sendToConnectionStory(connectionId, 'error', {
        message: `Unknown action: ${message.action}`,
      });
  }
}

function* handleSubscribeStory(connectionId: string, data: { channel: string }) {
  yield* sendToConnectionStory(connectionId, 'subscribed', { channel: data.channel });
}
```

## Step 6: Wire Up WebSocket Handlers

Register the lifecycle handlers in your config:

```typescript
// src/config.ts
import { defineKeyValueStore } from 'quidproquo-core';
import { defineWebSocket, defineService } from 'quidproquo-webserver';
import {
  handleConnectStory,
  handleDisconnectStory,
  handleMessageStory,
} from './stories/websocket';

export default [
  defineKeyValueStore('ws-connections', {
    partitionKey: 'connectionId',
    indexes: [
      { name: 'byUserId', partitionKey: 'userId', sortKey: 'connectedAt' },
    ],
  }),

  defineWebSocket('realtime', {
    onConnect:    handleConnectStory,
    onDisconnect: handleDisconnectStory,
    onMessage:    handleMessageStory,
  }),

  defineService('realtime-service', {
    webSockets: ['realtime'],
  }),
];
```

## Step 7: Push Notifications from REST Routes

Combine WebSockets with your REST API — push a live update after a database write:

```typescript
// src/api/posts.ts
import { broadcastToUserStory } from '../stories/websocket';
import { createPostStory } from '../stories/posts';

export function* handleCreatePost(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const { title, content, authorId } = JSON.parse(request.body ?? '{}');
  const post = yield* createPostStory(title, content, authorId);

  // Notify the author's connected clients in real time
  yield* broadcastToUserStory(authorId, 'post:created', post);

  return jsonResponse(201, post);
}
```

## Client-Side Usage

Connect from the browser using the standard WebSocket API:

```javascript
const ws = new WebSocket('wss://your-api.quidproquo.dev/realtime?token=ACCESS_TOKEN');

ws.onopen = () => {
  ws.send(JSON.stringify({ action: 'ping' }));
};

ws.onmessage = (event) => {
  const { event: type, data } = JSON.parse(event.data);

  switch (type) {
    case 'pong':
      console.log('Pong received', data);
      break;
    case 'post:created':
      console.log('New post', data);
      break;
  }
};
```

## Next Steps

- [Queue Processing](./queue-processing) — fan out WebSocket broadcasts via a queue for high-volume events
- [User Authentication](./user-authentication) — validate the token on connect
