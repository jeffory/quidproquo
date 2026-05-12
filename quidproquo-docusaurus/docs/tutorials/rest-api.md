---
sidebar_position: 1
---

# Building a REST API

This tutorial walks through building a complete REST API with Quidproquo — from defining routes and stories to running and testing locally.

## What You'll Build

A simple blog post API with:
- `GET /posts` — list all posts
- `GET /posts/:id` — get a single post
- `POST /posts` — create a post
- `PUT /posts/:id` — update a post
- `DELETE /posts/:id` — delete a post

## Prerequisites

Install the required packages:

```bash
npm install quidproquo-core quidproquo-webserver
npm install --save-dev quidproquo-dev-server
```

## Step 1: Define Your Data Model

Create a TypeScript interface for your data:

```typescript
// src/types.ts
export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}
```

## Step 2: Define the Key-Value Store

Configure storage for your posts in your app config:

```typescript
// src/config.ts
import { defineKeyValueStore } from 'quidproquo-core';

export const stores = [
  defineKeyValueStore('posts', {
    partitionKey: 'id',
    indexes: [
      {
        name: 'byAuthor',
        partitionKey: 'authorId',
        sortKey: 'createdAt',
      },
    ],
  }),
];
```

## Step 3: Write Stories

Stories contain your business logic. Each story is a generator function that yields actions:

```typescript
// src/stories/posts.ts
import {
  askKeyValueStoreGet,
  askKeyValueStoreUpsert,
  askKeyValueStoreDelete,
  askKeyValueStoreQuery,
  askGuidNew,
  askDateNow,
  askThrowError,
} from 'quidproquo-core';
import { Post } from '../types';

export function* getPostStory(postId: string) {
  const post = yield* askKeyValueStoreGet<Post>('posts', postId);

  if (!post) {
    yield* askThrowError('NOT_FOUND', `Post ${postId} not found`);
  }

  return post;
}

export function* listPostsStory(authorId?: string) {
  if (authorId) {
    const result = yield* askKeyValueStoreQuery<Post>('posts', {
      indexName: 'byAuthor',
      partitionKey: authorId,
    });
    return result.items;
  }

  const result = yield* askKeyValueStoreQuery<Post>('posts', {});
  return result.items;
}

export function* createPostStory(
  title: string,
  content: string,
  authorId: string,
) {
  const id = yield* askGuidNew();
  const now = yield* askDateNow();

  const post: Post = {
    id,
    title,
    content,
    authorId,
    createdAt: now,
    updatedAt: now,
  };

  yield* askKeyValueStoreUpsert('posts', post);
  return post;
}

export function* updatePostStory(
  postId: string,
  updates: Partial<Pick<Post, 'title' | 'content'>>,
) {
  const existing = yield* askKeyValueStoreGet<Post>('posts', postId);

  if (!existing) {
    yield* askThrowError('NOT_FOUND', `Post ${postId} not found`);
  }

  const now = yield* askDateNow();
  const updated: Post = { ...existing!, ...updates, updatedAt: now };

  yield* askKeyValueStoreUpsert('posts', updated);
  return updated;
}

export function* deletePostStory(postId: string) {
  const existing = yield* askKeyValueStoreGet<Post>('posts', postId);

  if (!existing) {
    yield* askThrowError('NOT_FOUND', `Post ${postId} not found`);
  }

  yield* askKeyValueStoreDelete('posts', postId);
}
```

## Step 4: Write Route Handlers

Route handlers are also stories — they receive the HTTP request and return an HTTP response:

```typescript
// src/api/posts.ts
import { askCatch } from 'quidproquo-core';
import { HTTPMethod, HTTPResponse, RouteRequest } from 'quidproquo-webserver';
import {
  getPostStory,
  listPostsStory,
  createPostStory,
  updatePostStory,
  deletePostStory,
} from '../stories/posts';

function jsonResponse(statusCode: number, body: unknown): HTTPResponse {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function* handleListPosts(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const { authorId } = request.queryParams ?? {};
  const posts = yield* listPostsStory(authorId);
  return jsonResponse(200, posts);
}

export function* handleGetPost(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const { id } = request.pathParams;

  const result = yield* askCatch(getPostStory(id));

  if (!result.success) {
    return jsonResponse(404, { error: result.error.errorText });
  }

  return jsonResponse(200, result.result);
}

export function* handleCreatePost(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const { title, content, authorId } = JSON.parse(request.body ?? '{}');

  if (!title || !content || !authorId) {
    return jsonResponse(400, { error: 'title, content, and authorId are required' });
  }

  const post = yield* createPostStory(title, content, authorId);
  return jsonResponse(201, post);
}

export function* handleUpdatePost(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const { id } = request.pathParams;
  const updates = JSON.parse(request.body ?? '{}');

  const result = yield* askCatch(updatePostStory(id, updates));

  if (!result.success) {
    return jsonResponse(404, { error: result.error.errorText });
  }

  return jsonResponse(200, result.result);
}

export function* handleDeletePost(request: RouteRequest): Generator<any, HTTPResponse, any> {
  const { id } = request.pathParams;

  const result = yield* askCatch(deletePostStory(id));

  if (!result.success) {
    return jsonResponse(404, { error: result.error.errorText });
  }

  return jsonResponse(204, null);
}
```

## Step 5: Wire Up Routes

Register your handlers with `defineRoute` and `defineApi`:

```typescript
// src/config.ts
import { defineKeyValueStore } from 'quidproquo-core';
import { defineRoute, defineApi, defineService, HTTPMethod } from 'quidproquo-webserver';
import {
  handleListPosts,
  handleGetPost,
  handleCreatePost,
  handleUpdatePost,
  handleDeletePost,
} from './api/posts';

export default [
  defineKeyValueStore('posts', {
    partitionKey: 'id',
    indexes: [
      { name: 'byAuthor', partitionKey: 'authorId', sortKey: 'createdAt' },
    ],
  }),

  defineApi('main', {
    routes: [
      defineRoute(HTTPMethod.GET,    '/posts',      handleListPosts),
      defineRoute(HTTPMethod.GET,    '/posts/:id',  handleGetPost),
      defineRoute(HTTPMethod.POST,   '/posts',      handleCreatePost),
      defineRoute(HTTPMethod.PUT,    '/posts/:id',  handleUpdatePost),
      defineRoute(HTTPMethod.DELETE, '/posts/:id',  handleDeletePost),
    ],
  }),

  defineService('blog-api', {
    apis: ['main'],
  }),
];
```

## Step 6: Run Locally

```typescript
// src/dev.ts
import { createDevServer } from 'quidproquo-dev-server';
import config from './config';

const server = createDevServer({ config, port: 3000, watch: true });
server.start().then(() => console.log('Running on http://localhost:3000'));
```

```bash
npx ts-node src/dev.ts
```

## Test Your API

```bash
# Create a post
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello QPQ","content":"My first post","authorId":"user-1"}'

# List all posts
curl http://localhost:3000/posts

# Get a single post (replace <id> with the returned id)
curl http://localhost:3000/posts/<id>

# Update a post
curl -X PUT http://localhost:3000/posts/<id> \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated title"}'

# Delete a post
curl -X DELETE http://localhost:3000/posts/<id>
```

## Error Handling

QPQ uses `askCatch` to handle errors from stories without crashing the route:

```typescript
const result = yield* askCatch(getPostStory(id));

if (!result.success) {
  // result.error.errorType  — machine-readable code
  // result.error.errorText  — human-readable message
  return jsonResponse(404, { error: result.error.errorText });
}

// result.result is the successful value
return jsonResponse(200, result.result);
```

## Next Steps

- [File Storage](./file-storage) — serve file uploads from your API
- [User Authentication](./user-authentication) — protect routes with JWT tokens
- [Queue Processing](./queue-processing) — offload slow work to background queues
