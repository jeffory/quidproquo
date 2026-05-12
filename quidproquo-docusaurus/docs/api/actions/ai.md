---
sidebar_position: 20
---

# AI Actions

Send prompts to AI language models and stream responses in your Quidproquo applications.

## Overview

AI actions provide a platform-agnostic interface for sending prompts to large language models and receiving responses. Two modes are supported: a single-shot prompt that returns the full response text, and a streaming prompt that returns a `StreamHandle` for reading response chunks incrementally.

## Core Concepts

### AiModel

The `AiModel` enum lists the available Claude models:

```typescript
import { AiModel } from 'quidproquo-core';

AiModel.ClaudeHaiku35     // claude-3-5-haiku
AiModel.ClaudeSonnet35    // claude-3-5-sonnet
AiModel.ClaudeSonnet4     // claude-sonnet-4
AiModel.ClaudeOpus4       // claude-opus-4
AiModel.ClaudeHaiku45     // claude-haiku-4-5
AiModel.ClaudeSonnet45    // claude-sonnet-4-5
AiModel.ClaudeOpus45      // claude-opus-4-5
AiModel.ClaudeSonnet46    // claude-sonnet-4-6
AiModel.ClaudeOpus46      // claude-opus-4-6
```

### AiMessage

Represents a single turn in a conversation history:

```typescript
interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}
```

### AiStreamPart

The union type for parts emitted during a streaming response:

```typescript
type AiStreamPart =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string; output: unknown };
```

## Available Actions

### askAiPrompt

Send a prompt and receive the full response text.

#### Signature

```typescript
function* askAiPrompt(
  model: AiModel,
  prompt: string,
  options?: AskAiPromptOptions,
): Generator<AiPromptAction, AiPromptActionResult, any>
```

#### Parameters

- **model** (`AiModel`): The AI model to use
- **prompt** (`string`): The user prompt
- **options** (`AskAiPromptOptions`, optional):
  - **system** (`string`): System prompt to set context or persona
  - **aiName** (`string`): Named AI configuration defined in your QPQ config

#### Returns

Returns an `AiPromptActionResult` containing:
- `text`: The AI's full response as a string

#### Example

```typescript
import { askAiPrompt, AiModel } from 'quidproquo-core';

function* summariseText(input: string) {
  const result = yield* askAiPrompt(
    AiModel.ClaudeSonnet46,
    `Summarise the following text in one paragraph:\n\n${input}`,
    { system: 'You are a helpful assistant that writes concise summaries.' },
  );

  return result.text;
}

function* classifySupport(message: string) {
  const result = yield* askAiPrompt(
    AiModel.ClaudeHaiku45,
    `Classify this support message as: billing, technical, or general.\n\nMessage: ${message}\n\nRespond with just the category.`,
  );

  return result.text.trim().toLowerCase();
}
```

---

### askAiPromptStream

Send a prompt and receive a `StreamHandle` for reading the response incrementally as `AiStreamPart` chunks.

#### Signature

```typescript
function* askAiPromptStream(
  model: AiModel,
  prompt: string,
  options?: AskAiPromptStreamOptions,
): Generator<AiPromptStreamAction, StreamHandle<'json', AiStreamPart>, any>
```

#### Parameters

- **model** (`AiModel`): The AI model to use
- **prompt** (`string`): The user prompt
- **options** (`AskAiPromptStreamOptions`, optional):
  - **system** (`string`): System prompt
  - **aiName** (`string`): Named AI configuration
  - **messages** (`AiMessage[]`): Prior conversation turns for multi-turn dialogue

#### Returns

Returns a `StreamHandle<'json', AiStreamPart>` that can be consumed with `askStreamRead` and `askStreamClose` from the [Stream Actions](./stream.md).

#### Example

```typescript
import { askAiPromptStream, askStreamRead, askStreamClose, AiModel } from 'quidproquo-core';

function* streamResponse(prompt: string) {
  const handle = yield* askAiPromptStream(AiModel.ClaudeSonnet46, prompt);

  let fullText = '';

  while (true) {
    const chunk = yield* askStreamRead(handle);

    if (chunk.done) break;

    if (chunk.data?.type === 'text-delta') {
      fullText += chunk.data.text;
      // Send chunk to websocket, buffer, etc.
    }
  }

  yield* askStreamClose(handle);

  return fullText;
}
```

## Usage Patterns

### Multi-Turn Conversation

Use `messages` to pass prior turns so the model has conversation context:

```typescript
function* chat(history: AiMessage[], newUserMessage: string) {
  const messages: AiMessage[] = [
    ...history,
    { role: 'user', content: newUserMessage },
  ];

  const handle = yield* askAiPromptStream(
    AiModel.ClaudeSonnet46,
    newUserMessage,
    {
      system: 'You are a helpful assistant.',
      messages,
    },
  );

  let reply = '';

  while (true) {
    const chunk = yield* askStreamRead(handle);
    if (chunk.done) break;
    if (chunk.data?.type === 'text-delta') {
      reply += chunk.data.text;
    }
  }

  yield* askStreamClose(handle);

  return reply;
}
```

### Structured Output via JSON Prompting

Ask the model to reply in JSON and parse the result:

```typescript
interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

function* analyseSentiment(text: string): Generator<any, SentimentResult, any> {
  const result = yield* askAiPrompt(
    AiModel.ClaudeHaiku45,
    `Analyse the sentiment of this text and respond with JSON only.
Schema: { "sentiment": "positive" | "negative" | "neutral", "confidence": 0.0–1.0 }

Text: ${text}`,
  );

  return JSON.parse(result.text) as SentimentResult;
}
```

### Choosing a Model

```typescript
function* processWithAppropriateModel(task: string, complexity: 'simple' | 'complex') {
  const model = complexity === 'simple' ? AiModel.ClaudeHaiku45 : AiModel.ClaudeSonnet46;

  const result = yield* askAiPrompt(model, task);
  return result.text;
}
```

## Error Handling

```typescript
function* safeAiPrompt(prompt: string) {
  const result = yield* askCatch(
    askAiPrompt(AiModel.ClaudeSonnet46, prompt),
  );

  if (!result.success) {
    yield* askLogCreate('ERROR', `AI prompt failed: ${result.error.errorType}`);
    return null;
  }

  return result.result.text;
}
```

## Best Practices

### 1. Use System Prompts to Set Persona and Constraints

```typescript
function* extractEntities(text: string) {
  return yield* askAiPrompt(
    AiModel.ClaudeSonnet46,
    `Extract all named entities from this text:\n\n${text}`,
    {
      system:
        'You are a precise NLP assistant. Return only a JSON array of entity strings. Never add explanation.',
    },
  );
}
```

### 2. Prefer Streaming for User-Facing Responses

Use `askAiPromptStream` when displaying responses in a UI so text appears incrementally rather than after a long wait.

### 3. Choose the Right Model for the Task

| Task | Recommended Model |
|------|-------------------|
| Simple classification, short extraction | `ClaudeHaiku45` |
| General reasoning, summarisation | `ClaudeSonnet46` |
| Complex analysis, long context | `ClaudeOpus46` |

### 4. Always Close Streams

Always call `askStreamClose` after consuming a `StreamHandle` to release server-side resources, even when breaking early:

```typescript
function* readFirstChunk(prompt: string) {
  const handle = yield* askAiPromptStream(AiModel.ClaudeHaiku45, prompt);
  const chunk = yield* askStreamRead(handle);
  yield* askStreamClose(handle); // always close
  return chunk.data;
}
```

## Platform-Specific Implementations

### AWS

- Model calls are proxied through a configured Lambda or Bedrock integration
- The `aiName` option maps to a named AI resource defined in your QPQ config

### Local Development

- Requires an Anthropic API key configured in the dev server environment
- All models are available; usage is billed to the configured API key

## Testing

### Unit Testing

```typescript
test('summariseText yields an AI prompt action', () => {
  const story = summariseText('Hello world');

  const { value: action } = story.next();

  expect(action.type).toBe('@quidproquo-core/Ai/Prompt');
  expect(action.payload.model).toBe(AiModel.ClaudeSonnet46);
  expect(action.payload.prompt).toContain('Hello world');

  const { value: result } = story.next({ text: 'A greeting.' });
  expect(result).toBe('A greeting.');
});
```

### Integration Testing

```typescript
test('AI prompt returns text', async () => {
  const runtime = createTestRuntime({
    ai: {
      mockResponse: { text: 'Mocked AI response' },
    },
  });

  const result = await runtime.execute(function* () {
    return yield* askAiPrompt(AiModel.ClaudeHaiku45, 'Say hello');
  });

  expect(result.text).toBe('Mocked AI response');
});
```

## Related Actions

- **Stream Actions** - Required for consuming `askAiPromptStream` handles
- **WebSocket Actions** - For forwarding streaming AI output to connected clients
- **Log Actions** - For auditing AI usage and errors
