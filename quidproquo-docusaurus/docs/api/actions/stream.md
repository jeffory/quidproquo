---
sidebar_position: 22
---

# Stream Actions

Read data from and close active streams in a platform-agnostic way.

## Overview

Stream actions let you consume data from a `StreamHandle` — an identifier for an active, server-side async stream. Streams are typically produced by other actions (e.g. `askAiPromptStream`) and must be explicitly closed when you are done reading.

Two operations are available: `askStreamRead` to pull the next chunk, and `askStreamClose` to release the stream.

## Core Concepts

### StreamHandle

A lightweight reference to an active stream, produced by actions that initiate streaming:

```typescript
interface StreamHandle<E extends StreamEncoding = StreamEncoding, T = unknown> {
  id: string;
  encoding: E;
}
```

The `encoding` field tells `askStreamRead` how to decode the raw wire data:

| Encoding | Raw wire type | Decoded TypeScript type |
|----------|---------------|-------------------------|
| `'text'` | `string` | `string` |
| `'binary'` | base64 `string` | `Uint8Array` |
| `'json'` | JSON `string` | `T` (generic parameter) |

### StreamChunk

The value returned by each `askStreamRead` call:

```typescript
interface StreamChunk<T = unknown> {
  done: boolean;      // true when the stream has ended
  skipped?: boolean;  // true when noWait was set and no data was available
  data?: T;           // the decoded chunk data (absent when done or skipped)
}
```

## Available Actions

### askStreamRead

Read the next chunk from a stream.

#### Signature

```typescript
function* askStreamRead<E extends StreamEncoding, T = unknown>(
  handle: StreamHandle<E, T>,
  noWait?: boolean,
): Generator<StreamReadAction, StreamChunk<StreamDataType<E, T>>, any>
```

#### Parameters

- **handle** (`StreamHandle<E, T>`): The stream to read from
- **noWait** (`boolean`, optional): When `true`, return immediately with a `skipped` chunk if no data is available rather than waiting

#### Returns

Returns a `StreamChunk` typed according to the handle's encoding:
- `StreamChunk<string>` for `text` streams
- `StreamChunk<Uint8Array>` for `binary` streams
- `StreamChunk<T>` for `json` streams (where `T` is the handle's type parameter)

#### Example

```typescript
import { askStreamRead } from 'quidproquo-core';

function* consumeTextStream(handle: StreamHandle<'text'>) {
  const lines: string[] = [];

  while (true) {
    const chunk = yield* askStreamRead(handle);

    if (chunk.done) break;
    if (chunk.data) {
      lines.push(chunk.data);
    }
  }

  return lines;
}
```

---

### askStreamClose

Close an active stream and release its server-side resources.

#### Signature

```typescript
function* askStreamClose(
  handle: StreamHandle,
): Generator<StreamCloseAction, void, any>
```

#### Parameters

- **handle** (`StreamHandle`): The stream to close

#### Example

```typescript
import { askStreamClose } from 'quidproquo-core';

function* cleanupStream(handle: StreamHandle) {
  yield* askStreamClose(handle);
}
```

## Usage Patterns

### Drain a Text Stream

```typescript
function* drainText(handle: StreamHandle<'text'>) {
  let result = '';

  while (true) {
    const chunk = yield* askStreamRead(handle);
    if (chunk.done) break;
    if (chunk.data) result += chunk.data;
  }

  yield* askStreamClose(handle);
  return result;
}
```

### Drain a JSON Stream (e.g. AI streaming)

The most common use of streams is consuming AI responses via `askAiPromptStream`:

```typescript
import { askAiPromptStream, askStreamRead, askStreamClose, AiModel, AiStreamPart } from 'quidproquo-core';

function* getAiResponse(prompt: string) {
  const handle = yield* askAiPromptStream(AiModel.ClaudeSonnet46, prompt);

  let text = '';

  while (true) {
    const chunk = yield* askStreamRead(handle);

    if (chunk.done) break;

    const part = chunk.data as AiStreamPart | undefined;
    if (part?.type === 'text-delta') {
      text += part.text;
    }
  }

  yield* askStreamClose(handle);
  return text;
}
```

### Non-Blocking Poll with `noWait`

Use `noWait` to poll without blocking — useful when interleaving stream reads with other work:

```typescript
function* pollStream(handle: StreamHandle<'text'>) {
  const chunks: string[] = [];

  while (true) {
    const chunk = yield* askStreamRead(handle, /* noWait */ true);

    if (chunk.done) break;

    if (chunk.skipped) {
      // No data yet — do other work before polling again
      yield* askLogCreate('DEBUG', 'No data available, yielding');
      continue;
    }

    if (chunk.data) {
      chunks.push(chunk.data);
    }
  }

  yield* askStreamClose(handle);
  return chunks;
}
```

### Read Binary Data

```typescript
function* readBinaryStream(handle: StreamHandle<'binary'>) {
  const buffers: Uint8Array[] = [];

  while (true) {
    const chunk = yield* askStreamRead(handle);
    if (chunk.done) break;
    if (chunk.data) buffers.push(chunk.data);
  }

  yield* askStreamClose(handle);

  // Combine all buffers
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }

  return result;
}
```

## Error Handling

Always close the stream even when an error occurs — use a try/finally pattern:

```typescript
function* safeReadStream(handle: StreamHandle<'text'>) {
  try {
    let result = '';

    while (true) {
      const chunk = yield* askStreamRead(handle);
      if (chunk.done) break;
      if (chunk.data) result += chunk.data;
    }

    return result;
  } finally {
    yield* askStreamClose(handle);
  }
}
```

## Best Practices

### 1. Always Close Streams

Unclosed streams leak server-side resources. Call `askStreamClose` in a `finally` block or after every code path that exits the read loop:

```typescript
function* readWithGuaranteedClose(handle: StreamHandle) {
  try {
    // ... read loop
  } finally {
    yield* askStreamClose(handle);
  }
}
```

### 2. Check `done` Before Accessing `data`

`data` is absent when `done` is `true` or `skipped` is `true`. Always guard:

```typescript
const chunk = yield* askStreamRead(handle);
if (!chunk.done && !chunk.skipped && chunk.data) {
  // safe to use chunk.data
}
```

### 3. Match the Handle Type Parameter to the Expected Data

For JSON streams, supply the type parameter on the handle so TypeScript can type `chunk.data` correctly:

```typescript
// handle: StreamHandle<'json', AiStreamPart>
const handle = yield* askAiPromptStream(AiModel.ClaudeSonnet46, prompt);

// chunk.data is typed as AiStreamPart | undefined
const chunk = yield* askStreamRead(handle);
```

## Testing

### Unit Testing

```typescript
test('drainText reads all chunks until done', () => {
  const handle: StreamHandle<'text'> = { id: 'stream-1', encoding: 'text' };
  const story = drainText(handle);

  // First read
  const { value: readAction1 } = story.next();
  expect(readAction1.type).toBe('@quidproquo-core/Stream/Read');
  expect(readAction1.payload.streamId).toBe('stream-1');

  // Second read
  const { value: readAction2 } = story.next({ done: false, data: 'hello ' });
  expect(readAction2.type).toBe('@quidproquo-core/Stream/Read');

  // Done chunk triggers close
  const { value: closeAction } = story.next({ done: true });
  expect(closeAction.type).toBe('@quidproquo-core/Stream/Close');

  const { value: result } = story.next();
  expect(result).toBe('hello ');
});
```

### Integration Testing

```typescript
test('drains a text stream', async () => {
  const runtime = createTestRuntime({
    streams: {
      'stream-42': ['chunk1', 'chunk2', null], // null signals done
    },
  });

  const handle: StreamHandle<'text'> = { id: 'stream-42', encoding: 'text' };

  const result = await runtime.execute(function* () {
    return yield* drainText(handle);
  });

  expect(result).toBe('chunk1chunk2');
});
```

## Related Actions

- **AI Actions** - `askAiPromptStream` is the primary producer of JSON streams
- **WebSocket Actions** - For forwarding stream chunks to connected clients in real time
- **Log Actions** - For tracing stream lifecycle events
