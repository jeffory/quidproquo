---
sidebar_position: 7
---

# Graph Database Queries

This tutorial shows how to model, query, and traverse connected data using Quidproquo's graph database actions with OpenCypher syntax.

## When to Use a Graph Database

Graph databases excel when relationships between entities are first-class — social graphs, recommendations, permission hierarchies, fraud detection, and knowledge graphs. QPQ supports AWS Neptune, Neo4j, and other OpenCypher-compatible databases through the same `askGraphDatabaseExecuteOpenCypherQuery` action.

## Step 1: Define the Graph Database

```typescript
// src/config.ts
import { defineGraphDatabase } from 'quidproquo-neo4j';

export const graph = [
  defineGraphDatabase('social', {
    // Connection is provided by the platform adapter (Neptune URL, Neo4j bolt URI, etc.)
  }),
];
```

## Step 2: Basic Node Operations

### Create a Node

```typescript
// src/stories/graph/users.ts
import {
  askGraphDatabaseExecuteOpenCypherQuery,
  GraphDatabaseInstanceType,
} from 'quidproquo-core';

const DB = 'social';

export function* createUserNodeStory(userId: string, name: string, email: string) {
  yield* askGraphDatabaseExecuteOpenCypherQuery(
    DB,
    GraphDatabaseInstanceType.write,
    `
      MERGE (u:User { id: $userId })
      SET u.name = $name,
          u.email = $email,
          u.createdAt = $createdAt
      RETURN u
    `,
    { userId, name, email, createdAt: new Date().toISOString() },
  );
}
```

### Find a Node

```typescript
export function* getUserNodeStory(userId: string) {
  const result = yield* askGraphDatabaseExecuteOpenCypherQuery(
    DB,
    GraphDatabaseInstanceType.read,
    `MATCH (u:User { id: $userId }) RETURN u`,
    { userId },
  );

  return result.results[0]?.u ?? null;
}
```

### Delete a Node

```typescript
export function* deleteUserNodeStory(userId: string) {
  yield* askGraphDatabaseExecuteOpenCypherQuery(
    DB,
    GraphDatabaseInstanceType.write,
    `MATCH (u:User { id: $userId }) DETACH DELETE u`,
    { userId },
  );
}
```

## Step 3: Relationship Operations

### Follow / Unfollow

```typescript
export function* followUserStory(followerId: string, followeeId: string) {
  yield* askGraphDatabaseExecuteOpenCypherQuery(
    DB,
    GraphDatabaseInstanceType.write,
    `
      MATCH (a:User { id: $followerId }), (b:User { id: $followeeId })
      MERGE (a)-[r:FOLLOWS]->(b)
      SET r.createdAt = $createdAt
    `,
    { followerId, followeeId, createdAt: new Date().toISOString() },
  );
}

export function* unfollowUserStory(followerId: string, followeeId: string) {
  yield* askGraphDatabaseExecuteOpenCypherQuery(
    DB,
    GraphDatabaseInstanceType.write,
    `
      MATCH (a:User { id: $followerId })-[r:FOLLOWS]->(b:User { id: $followeeId })
      DELETE r
    `,
    { followerId, followeeId },
  );
}
```

## Step 4: Traversal Queries

### Get a User's Followers

```typescript
export function* getFollowersStory(userId: string, limit = 20) {
  const result = yield* askGraphDatabaseExecuteOpenCypherQuery(
    DB,
    GraphDatabaseInstanceType.read,
    `
      MATCH (follower:User)-[:FOLLOWS]->(u:User { id: $userId })
      RETURN follower
      ORDER BY follower.name
      LIMIT $limit
    `,
    { userId, limit },
  );

  return result.results.map((r: any) => r.follower);
}
```

### Get a User's Feed (Posts from Followed Users)

```typescript
export function* getUserFeedStory(userId: string, limit = 50) {
  const result = yield* askGraphDatabaseExecuteOpenCypherQuery(
    DB,
    GraphDatabaseInstanceType.read,
    `
      MATCH (me:User { id: $userId })-[:FOLLOWS]->(author:User)-[:AUTHORED]->(post:Post)
      WHERE post.publishedAt IS NOT NULL
      RETURN post, author
      ORDER BY post.publishedAt DESC
      LIMIT $limit
    `,
    { userId, limit },
  );

  return result.results.map((r: any) => ({
    ...r.post,
    author: r.author,
  }));
}
```

### Friends-of-Friends (2-hop Traversal)

```typescript
export function* getPeopleYouMayKnowStory(userId: string, limit = 10) {
  const result = yield* askGraphDatabaseExecuteOpenCypherQuery(
    DB,
    GraphDatabaseInstanceType.read,
    `
      MATCH (me:User { id: $userId })-[:FOLLOWS]->(friend:User)-[:FOLLOWS]->(fof:User)
      WHERE fof.id <> $userId
        AND NOT (me)-[:FOLLOWS]->(fof)
      RETURN fof, count(friend) AS mutualCount
      ORDER BY mutualCount DESC
      LIMIT $limit
    `,
    { userId, limit },
  );

  return result.results.map((r: any) => ({
    ...r.fof,
    mutualConnections: r.mutualCount,
  }));
}
```

## Step 5: Recommendation Engine

Combine QPQ KVS metadata with graph traversal for personalized recommendations:

```typescript
// src/stories/graph/recommendations.ts
import {
  askGraphDatabaseExecuteOpenCypherQuery,
  askKeyValueStoreGet,
  GraphDatabaseInstanceType,
} from 'quidproquo-core';

export function* recommendPostsStory(userId: string) {
  // Step 1: get posts liked by users I follow (collaborative filtering)
  const result = yield* askGraphDatabaseExecuteOpenCypherQuery(
    DB,
    GraphDatabaseInstanceType.read,
    `
      MATCH (me:User { id: $userId })-[:FOLLOWS]->(peer:User)-[:LIKED]->(post:Post)
      WHERE NOT (me)-[:LIKED]->(post)
        AND NOT (me)-[:AUTHORED]->(post)
      WITH post, count(peer) AS score
      ORDER BY score DESC
      LIMIT 20
      RETURN post.id AS postId, score
    `,
    { userId },
  );

  // Step 2: enrich with full post data from KVS
  const posts = await Promise.all(
    result.results.map(async (r: { postId: string; score: number }) => {
      const post = yield* askKeyValueStoreGet('posts', r.postId);
      return post ? { ...post, score: r.score } : null;
    }),
  );

  return posts.filter(Boolean);
}
```

## Step 6: Permission Hierarchy

Graph databases are ideal for RBAC hierarchies:

```typescript
// Check if a user has permission via any role in a hierarchy
export function* hasPermissionStory(userId: string, permission: string) {
  const result = yield* askGraphDatabaseExecuteOpenCypherQuery(
    DB,
    GraphDatabaseInstanceType.read,
    `
      MATCH (u:User { id: $userId })-[:HAS_ROLE]->(role:Role)-[:GRANTS*1..3]->(p:Permission { name: $permission })
      RETURN count(p) > 0 AS granted
    `,
    { userId, permission },
  );

  return result.results[0]?.granted === true;
}
```

## Step 7: Wire Up in Config

```typescript
// src/config.ts
import { defineGraphDatabase } from 'quidproquo-neo4j';
import { defineKeyValueStore } from 'quidproquo-core';
import { defineRoute, defineApi, defineService, HTTPMethod } from 'quidproquo-webserver';
import { handleGetFeed, handleFollow, handleRecommendations } from './api/graph';

export default [
  defineGraphDatabase('social'),

  defineKeyValueStore('posts', { partitionKey: 'id' }),

  defineApi('main', {
    routes: [
      defineRoute(HTTPMethod.GET,  '/feed',                    handleGetFeed),
      defineRoute(HTTPMethod.POST, '/users/:id/follow',        handleFollow),
      defineRoute(HTTPMethod.GET,  '/recommendations/posts',   handleRecommendations),
    ],
  }),

  defineService('social-service', { apis: ['main'] }),
];
```

## OpenCypher Quick Reference

| Pattern | Meaning |
|---|---|
| `(n:Label)` | Node with label |
| `(n { prop: value })` | Node with property match |
| `(a)-[:REL]->(b)` | Directed relationship |
| `(a)-[:REL*1..3]->(b)` | Variable-length path (1–3 hops) |
| `MERGE` | Create if not exists |
| `DETACH DELETE` | Delete node and all its relationships |
| `WITH ... ORDER BY ... LIMIT` | Pagination and sorting mid-query |

## Next Steps

- [Scheduled Tasks](./scheduled-tasks) — refresh recommendation caches on a schedule
- [Queue Processing](./queue-processing) — fan out graph writes for high-write workloads
