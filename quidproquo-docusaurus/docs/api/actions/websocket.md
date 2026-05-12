---
sidebar_position: 30
---

# WebSocket Actions

Send messages to connected WebSocket clients.

## Overview

WebSocket actions let your server-side stories push messages to specific connected clients. You identify the target by its `connectionId` (provided in the WebSocket event) and the `websocketApiName` of the WebSocket API they connected through. The message payload is generic, so you can send any serializable data.

## Available Actions

### askWebsocketSendMessage

Send a message to a connected WebSocket client.

#### Signature

```typescript
function* askWebsocketSendMessage<T>(
  websocketApiName: string,
  connectionId: string,
  payload: T
): WebsocketSendMessageActionRequester<T>
```

#### Parameters

- **websocketApiName** (`string`): The registered name of the WebSocket API the client connected through
- **connectionId** (`string`): The connection ID of the target client (available on the WebSocket event)
- **payload** (`T`): The message to send (any serializable type)

#### Returns

Returns `void`.

#### Example

```typescript
import { askWebsocketSendMessage } from 'quidproquo-webserver';

interface ChatMessage {
  from: string;
  text: string;
  timestamp: string;
}

function* broadcastMessage(
  connectionId: string,
  message: ChatMessage
) {
  yield* askWebsocketSendMessage<ChatMessage>(
    'chat-websocket-api',
    connectionId,
    message
  );
}
```

## Error Types

- **Throttled** — The WebSocket API is rate-limiting outbound messages; back off and retry
- **Disconnected** — The client has disconnected; the `connectionId` is no longer valid

## Usage Patterns

### Push a Notification to a Single Client

```typescript
function* notifyClient(connectionId: string, notification: unknown) {
  yield* askWebsocketSendMessage(
    'notifications-ws',
    connectionId,
    {
      type: 'NOTIFICATION',
      data: notification,
      sentAt: yield* askDateNow(),
    }
  );
}
```

### Broadcast to Multiple Connections

```typescript
function* broadcastToAll(connectionIds: string[], event: unknown) {
  for (const connectionId of connectionIds) {
    try {
      yield* askWebsocketSendMessage('live-updates-ws', connectionId, event);
    } catch (error) {
      if (error.errorType === 'Disconnected') {
        // Clean up stale connection
        yield* removeStaleConnection(connectionId);
      } else {
        yield* askLogCreate(LogLevelEnum.ERROR, 'Failed to send WS message', {
          connectionId,
          error: error.message,
        });
      }
    }
  }
}
```

### Real-Time Job Progress Updates

```typescript
interface ProgressUpdate {
  jobId: string;
  percent: number;
  status: 'running' | 'complete' | 'error';
  message?: string;
}

function* processJobWithProgress(
  jobId: string,
  connectionId: string,
  steps: (() => Generator<any, void, any>)[]
) {
  const total = steps.length;

  for (let i = 0; i < steps.length; i++) {
    yield* steps[i]();

    const update: ProgressUpdate = {
      jobId,
      percent: Math.round(((i + 1) / total) * 100),
      status: i + 1 === total ? 'complete' : 'running',
    };

    yield* askWebsocketSendMessage<ProgressUpdate>(
      'jobs-ws',
      connectionId,
      update
    );
  }
}
```

## Error Handling

```typescript
function* safeSendMessage<T>(
  websocketApiName: string,
  connectionId: string,
  payload: T
): Generator<any, boolean, any> {
  const result = yield* askCatch(
    askWebsocketSendMessage(websocketApiName, connectionId, payload)
  );

  if (!result.success) {
    switch (result.error.errorType) {
      case 'Disconnected':
        yield* askLogCreate(LogLevelEnum.INFO, 'Client disconnected', { connectionId });
        return false;

      case 'Throttled':
        yield* askDelay(1000);
        return yield* safeSendMessage(websocketApiName, connectionId, payload);

      default:
        throw result.error;
    }
  }

  return true;
}
```

## Related Actions

- **Event Bus Actions** — For pub/sub messaging to multiple subscribers
- **Queue Actions** — For durable async delivery to backend consumers
- **Key-Value Store Actions** — For storing and looking up active connection IDs
