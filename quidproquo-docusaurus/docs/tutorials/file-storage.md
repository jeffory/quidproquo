---
sidebar_position: 2
---

# File Storage Operations

This tutorial shows how to upload, download, and manage files in Quidproquo using storage drives — a platform-agnostic abstraction over S3, GCS, Azure Blob, and local disk.

## Core Concepts

A **storage drive** is a named logical container for files (like an S3 bucket). You define drives in your config and QPQ maps them to the appropriate service in each environment.

## Step 1: Define Storage Drives

```typescript
// src/config.ts
import { defineStorageDrive } from 'quidproquo-core';
import { StorageDriveTier } from 'quidproquo-core';

export const drives = [
  // General user uploads
  defineStorageDrive('user-uploads'),

  // Images with automatic processing trigger
  defineStorageDrive('profile-images'),

  // Logs with automatic archival
  defineStorageDrive('app-logs', {
    lifecycleRules: [
      {
        transitions: [
          {
            storageDriveTier: StorageDriveTier.OCCASIONAL_ACCESS,
            transitionAfterDays: 30,
          },
          {
            storageDriveTier: StorageDriveTier.COLD_STORAGE,
            transitionAfterDays: 90,
          },
        ],
        deleteAfterDays: 365,
      },
    ],
  }),
];
```

## Step 2: Upload a File

Use `askFileWrite` to write content to a drive:

```typescript
// src/stories/files.ts
import {
  askFileWrite,
  askFileRead,
  askFileDelete,
  askFileList,
  askGuidNew,
  askDateNow,
  askLogCreate,
  LogLevelEnum,
} from 'quidproquo-core';

export function* uploadFileStory(
  filename: string,
  content: Buffer | string,
  mimeType: string,
) {
  const id = yield* askGuidNew();
  const now = yield* askDateNow();
  const ext = filename.split('.').pop() ?? 'bin';
  const path = `uploads/${now.slice(0, 10)}/${id}.${ext}`;

  yield* askFileWrite('user-uploads', path, content);
  yield* askLogCreate(LogLevelEnum.INFO, 'File uploaded', { path, mimeType });

  return { path, id };
}
```

## Step 3: Download a File

Use `askFileRead` to retrieve file contents:

```typescript
export function* downloadFileStory(path: string) {
  const content = yield* askFileRead('user-uploads', path);

  if (!content) {
    return null;
  }

  return content;
}
```

## Step 4: List Files in a Directory

```typescript
export function* listUploadsStory(prefix: string) {
  const result = yield* askFileList('user-uploads', prefix);
  return result.files;
}
```

## Step 5: Delete a File

```typescript
export function* deleteFileStory(path: string) {
  yield* askFileDelete('user-uploads', path);
}
```

## Step 6: Build a File Upload Route

Wire the stories into HTTP handlers:

```typescript
// src/api/files.ts
import { askCatch } from 'quidproquo-core';
import { HTTPMethod, HTTPResponse, RouteRequest } from 'quidproquo-webserver';
import { uploadFileStory, downloadFileStory, listUploadsStory, deleteFileStory } from '../stories/files';

function jsonResponse(statusCode: number, body: unknown): HTTPResponse {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// POST /files — upload a file (body is base64-encoded content)
export function* handleUploadFile(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const { filename, content, mimeType } = JSON.parse(request.body ?? '{}');

  if (!filename || !content) {
    return jsonResponse(400, { error: 'filename and content are required' });
  }

  const buffer = Buffer.from(content, 'base64');
  const result = yield* uploadFileStory(filename, buffer, mimeType ?? 'application/octet-stream');

  return jsonResponse(201, result);
}

// GET /files — list files by optional prefix
export function* handleListFiles(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const prefix = request.queryParams?.prefix ?? '';
  const files = yield* listUploadsStory(prefix);
  return jsonResponse(200, { files });
}

// GET /files/* — download a file by path
export function* handleDownloadFile(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const path = request.pathParams.proxy;

  const content = yield* downloadFileStory(path);

  if (!content) {
    return jsonResponse(404, { error: 'File not found' });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/octet-stream' },
    body: content.toString('base64'),
    isBase64Encoded: true,
  };
}

// DELETE /files/* — delete a file
export function* handleDeleteFile(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const path = request.pathParams.proxy;
  yield* deleteFileStory(path);
  return jsonResponse(204, null);
}
```

## Step 7: Register Routes

```typescript
// src/config.ts
import { defineStorageDrive } from 'quidproquo-core';
import { defineRoute, defineApi, defineService, HTTPMethod } from 'quidproquo-webserver';
import {
  handleUploadFile,
  handleListFiles,
  handleDownloadFile,
  handleDeleteFile,
} from './api/files';

export default [
  defineStorageDrive('user-uploads'),

  defineApi('main', {
    routes: [
      defineRoute(HTTPMethod.POST,   '/files',    handleUploadFile),
      defineRoute(HTTPMethod.GET,    '/files',    handleListFiles),
      defineRoute(HTTPMethod.GET,    '/files/*',  handleDownloadFile),
      defineRoute(HTTPMethod.DELETE, '/files/*',  handleDeleteFile),
    ],
  }),

  defineService('file-service', { apis: ['main'] }),
];
```

## Event-Driven File Processing

Trigger a story automatically whenever a file is created or deleted:

```typescript
import { defineStorageDrive, defineServiceFunction } from 'quidproquo-core';

defineStorageDrive('profile-images', {
  onEvent: {
    create: defineServiceFunction('resizeImage'),
    delete: defineServiceFunction('cleanupImageMetadata'),
  },
});
```

The `resizeImage` service function receives the file path and drive name and runs in the same QPQ story model:

```typescript
// src/stories/resizeImage.ts
import { askFileRead, askFileWrite, askLogCreate, LogLevelEnum } from 'quidproquo-core';

export function* resizeImageStory(event: { path: string; driveName: string }) {
  yield* askLogCreate(LogLevelEnum.INFO, 'Processing new image', event);

  const original = yield* askFileRead(event.driveName, event.path);
  if (!original) return;

  // ... resize logic using a sharp/jimp library ...
  const resized = original; // placeholder

  const thumbPath = event.path.replace(/(\.\w+)$/, '_thumb$1');
  yield* askFileWrite(event.driveName, thumbPath, resized);
}
```

## Storage Tiers

| Tier | Use Case | Access Pattern |
|------|----------|----------------|
| `STANDARD` | Frequently accessed data | Sub-millisecond |
| `OCCASIONAL_ACCESS` | Monthly access | Milliseconds |
| `COLD_STORAGE` | Archival / compliance | Minutes |

Lifecycle rules automatically transition files between tiers based on age, reducing storage costs without manual intervention.

## Next Steps

- [User Authentication](./user-authentication) — restrict uploads to authenticated users
- [Queue Processing](./queue-processing) — process uploaded files asynchronously
