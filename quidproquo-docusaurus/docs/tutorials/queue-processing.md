---
sidebar_position: 5
---

# Queue Processing

This tutorial shows how to offload slow or high-volume work to background queues using Quidproquo's queue actions.

## Why Use Queues?

- **Decouple services** — the sender doesn't wait for the consumer
- **Handle spikes** — work is buffered when consumers are busy
- **Retry on failure** — failed messages are automatically retried
- **Fan out** — one message triggers multiple independent consumers

## Step 1: Define a Queue

```typescript
// src/config.ts
import { defineQueue, defineServiceFunction } from 'quidproquo-core';

export const queues = [
  // Email notifications queue
  defineQueue('email-queue', {
    consumer: defineServiceFunction('sendEmailWorker'),
    visibilityTimeoutSeconds: 30,
    retentionPeriodDays: 4,
  }),

  // Image processing queue with DLQ handling
  defineQueue('image-processing-queue', {
    consumer: defineServiceFunction('processImageWorker'),
    maxReceiveCount: 3, // retry up to 3 times before moving to DLQ
  }),

  // Ordered queue (FIFO) for sequential operations
  defineQueue('order-queue', {
    consumer: defineServiceFunction('processOrderWorker'),
    fifo: true,
  }),
];
```

## Step 2: Send Messages to a Queue

Use `askQueueSendMessages` to enqueue work:

```typescript
// src/stories/notifications.ts
import { askQueueSendMessages, askDateNow } from 'quidproquo-core';

interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  templateId?: string;
}

export function* sendWelcomeEmailStory(email: string, name: string) {
  yield* askQueueSendMessages<{ data: EmailMessage }>('email-queue', {
    data: {
      to: email,
      subject: 'Welcome to QPQ App!',
      body: `Hi ${name}, welcome aboard!`,
      templateId: 'welcome-v2',
    },
  });
}

export function* sendBatchNotificationsStory(recipients: Array<{ email: string; name: string }>) {
  const messages = recipients.map((r) => ({
    data: {
      to: r.email,
      subject: 'New update available',
      body: `Hi ${r.name}, check out what's new!`,
    },
  }));

  yield* askQueueSendMessages('email-queue', ...messages);
}
```

## Step 3: Delay a Message

Pass `delaySeconds` to defer processing:

```typescript
export function* scheduleReminderStory(email: string, name: string, delaySeconds: number) {
  yield* askQueueSendMessages('email-queue', {
    data: {
      to: email,
      subject: 'Reminder',
      body: `Hi ${name}, this is your reminder!`,
    },
    delaySeconds,
  });
}
```

## Step 4: Write the Consumer Story

The consumer story receives each message and processes it. QPQ calls it automatically when messages arrive:

```typescript
// src/stories/workers/sendEmailWorker.ts
import {
  askLogCreate,
  askNetworkRequest,
  LogLevelEnum,
} from 'quidproquo-core';

interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  templateId?: string;
}

export function* sendEmailWorkerStory(message: EmailMessage) {
  yield* askLogCreate(LogLevelEnum.INFO, 'Sending email', { to: message.to });

  await yield* askNetworkRequest('POST', 'https://api.sendgrid.com/v3/mail/send', {
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: {
      to: [{ email: message.to }],
      subject: message.subject,
      content: [{ type: 'text/plain', value: message.body }],
      template_id: message.templateId,
    },
  });

  yield* askLogCreate(LogLevelEnum.INFO, 'Email sent', { to: message.to });
}
```

## Step 5: Image Processing Worker

A more complex consumer that reads and writes files:

```typescript
// src/stories/workers/processImageWorker.ts
import {
  askFileRead,
  askFileWrite,
  askKeyValueStoreUpsert,
  askDateNow,
  askLogCreate,
  LogLevelEnum,
} from 'quidproquo-core';

interface ImageJob {
  imageId: string;
  sourcePath: string;
  driveName: string;
}

export function* processImageWorkerStory(job: ImageJob) {
  yield* askLogCreate(LogLevelEnum.INFO, 'Processing image', { imageId: job.imageId });

  const content = yield* askFileRead(job.driveName, job.sourcePath);

  if (!content) {
    yield* askLogCreate(LogLevelEnum.WARN, 'Image not found', { path: job.sourcePath });
    return;
  }

  // Simulate thumbnail generation (replace with actual image library)
  const thumbnail = content;
  const thumbPath = job.sourcePath.replace(/(\.\w+)$/, '_thumb$1');

  yield* askFileWrite(job.driveName, thumbPath, thumbnail);

  const now = yield* askDateNow();
  yield* askKeyValueStoreUpsert('image-metadata', {
    id: job.imageId,
    originalPath: job.sourcePath,
    thumbPath,
    processedAt: now,
    status: 'processed',
  });

  yield* askLogCreate(LogLevelEnum.INFO, 'Image processed', { thumbPath });
}
```

## Step 6: FIFO Queue for Ordered Processing

Use FIFO queues when message order matters (e.g., payment steps):

```typescript
export function* processOrderStory(orderId: string, action: 'reserve' | 'charge' | 'fulfill') {
  yield* askQueueSendMessages('order-queue', {
    data: { orderId, action },
    messageGroupId: orderId,       // all messages for same order stay ordered
    deduplicationId: `${orderId}-${action}`, // prevent duplicate processing
  });
}
```

## Step 7: Wire Everything in Config

```typescript
// src/config.ts
import { defineQueue, defineKeyValueStore, defineServiceFunction } from 'quidproquo-core';
import { defineApi, defineService, defineRoute, HTTPMethod } from 'quidproquo-webserver';
import { handleRegister } from './api/auth';

export default [
  defineKeyValueStore('image-metadata', { partitionKey: 'id' }),

  defineQueue('email-queue', {
    consumer: defineServiceFunction('sendEmailWorker'),
  }),

  defineQueue('image-processing-queue', {
    consumer: defineServiceFunction('processImageWorker'),
    maxReceiveCount: 3,
  }),

  defineApi('main', {
    routes: [
      defineRoute(HTTPMethod.POST, '/auth/register', handleRegister),
    ],
  }),

  defineService('my-app', {
    apis: ['main'],
    queues: ['email-queue', 'image-processing-queue'],
    serviceStories: {
      sendEmailWorker:    'sendEmailWorkerStory',
      processImageWorker: 'processImageWorkerStory',
    },
  }),
];
```

## Monitoring Queue Health

Messages that fail after all retries are moved to a dead-letter queue (DLQ). Monitor the DLQ for failures:

```typescript
export function* drainDlqStory() {
  const messages = yield* askQueueReceiveMessages('email-queue-dlq');

  for (const msg of messages) {
    yield* askLogCreate(LogLevelEnum.ERROR, 'DLQ message', { data: msg.data });
    // Inspect, re-queue, or alert
  }
}
```

## Next Steps

- [Scheduled Tasks](./scheduled-tasks) — run queue consumers on a schedule rather than event-driven
- [WebSocket Connections](./websockets) — notify connected clients after queue processing completes
