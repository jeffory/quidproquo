---
sidebar_position: 6
---

# Scheduled Tasks

This tutorial shows how to run stories on a schedule (cron jobs) using Quidproquo's event-driven scheduling — for daily reports, cleanup jobs, health checks, and more.

## Overview

QPQ scheduled tasks are stories that run on a cron expression. They're defined in your config with `defineSchedule` and have access to the full QPQ action set — KVS, file storage, queues, network calls, and more.

## Step 1: Define a Scheduled Task

```typescript
// src/config.ts
import { defineSchedule, defineServiceFunction } from 'quidproquo-core';

export const schedules = [
  // Daily report at 08:00 UTC
  defineSchedule('daily-report', {
    cronExpression: '0 8 * * ? *',
    story: defineServiceFunction('generateDailyReport'),
  }),

  // Hourly health check
  defineSchedule('health-check', {
    cronExpression: '0 * * * ? *',
    story: defineServiceFunction('runHealthCheck'),
  }),

  // Weekly cleanup every Sunday at 02:00 UTC
  defineSchedule('weekly-cleanup', {
    cronExpression: '0 2 ? * 1 *',
    story: defineServiceFunction('cleanupExpiredData'),
  }),

  // Every 5 minutes during business hours (Mon–Fri, 09:00–17:00 UTC)
  defineSchedule('business-hours-sync', {
    cronExpression: '0/5 9-17 ? * 2-6 *',
    story: defineServiceFunction('syncExternalData'),
  }),
];
```

## Step 2: Daily Report Story

A scheduled story receives no arguments and has access to the full QPQ runtime:

```typescript
// src/stories/scheduled/generateDailyReport.ts
import {
  askKeyValueStoreQuery,
  askFileWrite,
  askDateNow,
  askQueueSendMessages,
  askLogCreate,
  LogLevelEnum,
} from 'quidproquo-core';

export function* generateDailyReportStory() {
  const now = yield* askDateNow();
  const today = now.slice(0, 10);

  yield* askLogCreate(LogLevelEnum.INFO, 'Generating daily report', { date: today });

  // Query data from the last 24 hours
  const ordersResult = yield* askKeyValueStoreQuery('orders', {
    indexName: 'byDate',
    partitionKey: today,
  });

  const totalRevenue = ordersResult.items.reduce(
    (sum: number, order: any) => sum + (order.amount ?? 0),
    0,
  );

  const report = {
    date: today,
    totalOrders: ordersResult.items.length,
    totalRevenue,
    generatedAt: now,
  };

  // Write report to file storage
  const reportPath = `reports/${today}/daily-summary.json`;
  yield* askFileWrite('reports', reportPath, JSON.stringify(report, null, 2));

  // Queue email to administrators
  yield* askQueueSendMessages('email-queue', {
    data: {
      to: 'admin@example.com',
      subject: `Daily Report – ${today}`,
      body: `Orders: ${report.totalOrders}, Revenue: $${report.totalRevenue.toFixed(2)}`,
    },
  });

  yield* askLogCreate(LogLevelEnum.INFO, 'Daily report complete', report);
}
```

## Step 3: Data Cleanup Story

Remove expired records to keep your database lean:

```typescript
// src/stories/scheduled/cleanupExpiredData.ts
import {
  askKeyValueStoreQuery,
  askKeyValueStoreDelete,
  askDateNow,
  askLogCreate,
  LogLevelEnum,
} from 'quidproquo-core';

const TTL_DAYS = 90;

export function* cleanupExpiredDataStory() {
  const now = new Date(yield* askDateNow());
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - TTL_DAYS);
  const cutoffStr = cutoff.toISOString();

  yield* askLogCreate(LogLevelEnum.INFO, 'Starting cleanup', { cutoff: cutoffStr });

  let deleted = 0;
  let cursor: string | undefined;

  do {
    const result = yield* askKeyValueStoreQuery('sessions', {
      indexName: 'byExpiry',
      sortKey: { lessThan: cutoffStr },
      cursor,
      limit: 100,
    });

    for (const session of result.items as Array<{ id: string }>) {
      yield* askKeyValueStoreDelete('sessions', session.id);
      deleted++;
    }

    cursor = result.cursor;
  } while (cursor);

  yield* askLogCreate(LogLevelEnum.INFO, 'Cleanup complete', { deleted });
}
```

## Step 4: Health Check Story

Verify external dependencies and alert on failures:

```typescript
// src/stories/scheduled/runHealthCheck.ts
import {
  askNetworkRequest,
  askQueueSendMessages,
  askDateNow,
  askLogCreate,
  LogLevelEnum,
} from 'quidproquo-core';
import { askCatch } from 'quidproquo-core';

const ENDPOINTS = [
  { name: 'Payment API', url: 'https://api.payments.example.com/health' },
  { name: 'Email Service', url: 'https://api.email.example.com/ping' },
];

export function* runHealthCheckStory() {
  const results: Array<{ name: string; ok: boolean; error?: string }> = [];

  for (const endpoint of ENDPOINTS) {
    const result = yield* askCatch(
      askNetworkRequest<undefined, { status: string }>('GET', endpoint.url),
    );

    results.push({
      name: endpoint.name,
      ok: result.success,
      error: result.success ? undefined : result.error.errorText,
    });
  }

  const failures = results.filter((r) => !r.ok);

  if (failures.length > 0) {
    yield* askLogCreate(LogLevelEnum.ERROR, 'Health check failures', { failures });

    yield* askQueueSendMessages('email-queue', {
      data: {
        to: 'oncall@example.com',
        subject: `[ALERT] ${failures.length} service(s) degraded`,
        body: failures.map((f) => `${f.name}: ${f.error}`).join('\n'),
      },
    });
  } else {
    yield* askLogCreate(LogLevelEnum.INFO, 'All health checks passed', { results });
  }
}
```

## Step 5: Sync External Data

Pull data from a third-party API and write it to your store:

```typescript
// src/stories/scheduled/syncExternalData.ts
import {
  askNetworkRequest,
  askKeyValueStoreUpsert,
  askDateNow,
  askLogCreate,
  LogLevelEnum,
} from 'quidproquo-core';

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  date: string;
}

export function* syncExternalDataStory() {
  yield* askLogCreate(LogLevelEnum.INFO, 'Syncing exchange rates');

  const rates = yield* askNetworkRequest<undefined, ExchangeRates>(
    'GET',
    'https://api.exchangerate.host/latest',
    { params: { base: 'USD' } },
  );

  const now = yield* askDateNow();

  yield* askKeyValueStoreUpsert('exchange-rates', {
    id: 'USD',
    ...rates,
    syncedAt: now,
  });

  yield* askLogCreate(LogLevelEnum.INFO, 'Exchange rates synced', { date: rates.date });
}
```

## Step 6: Full Config

```typescript
// src/config.ts
import {
  defineSchedule,
  defineServiceFunction,
  defineKeyValueStore,
  defineQueue,
} from 'quidproquo-core';
import { defineService } from 'quidproquo-webserver';

export default [
  defineKeyValueStore('orders',        { partitionKey: 'id' }),
  defineKeyValueStore('sessions',      { partitionKey: 'id' }),
  defineKeyValueStore('exchange-rates', { partitionKey: 'id' }),

  defineQueue('email-queue', {
    consumer: defineServiceFunction('sendEmailWorker'),
  }),

  defineSchedule('daily-report',       { cronExpression: '0 8 * * ? *',   story: defineServiceFunction('generateDailyReport') }),
  defineSchedule('health-check',       { cronExpression: '0 * * * ? *',   story: defineServiceFunction('runHealthCheck') }),
  defineSchedule('weekly-cleanup',     { cronExpression: '0 2 ? * 1 *',   story: defineServiceFunction('cleanupExpiredData') }),
  defineSchedule('business-hours-sync', { cronExpression: '0/5 9-17 ? * 2-6 *', story: defineServiceFunction('syncExternalData') }),

  defineService('my-app', {
    schedules: ['daily-report', 'health-check', 'weekly-cleanup', 'business-hours-sync'],
    queues: ['email-queue'],
    serviceStories: {
      generateDailyReport: 'generateDailyReportStory',
      runHealthCheck:      'runHealthCheckStory',
      cleanupExpiredData:  'cleanupExpiredDataStory',
      syncExternalData:    'syncExternalDataStory',
      sendEmailWorker:     'sendEmailWorkerStory',
    },
  }),
];
```

## Cron Expression Reference

QPQ uses AWS EventBridge cron syntax: `minute hour day-of-month month day-of-week year`

| Expression | Meaning |
|---|---|
| `0 8 * * ? *` | Every day at 08:00 UTC |
| `0 * * * ? *` | Every hour |
| `0/5 * * * ? *` | Every 5 minutes |
| `0 0 1 * ? *` | First day of every month at midnight |
| `0 9 ? * 2 *` | Every Monday at 09:00 UTC |
| `0 2 ? * 1 *` | Every Sunday at 02:00 UTC |

Use `?` as a wildcard for either day-of-month or day-of-week (not both).

## Next Steps

- [Queue Processing](./queue-processing) — enqueue work from scheduled tasks for parallel processing
- [Graph Database Queries](./graph-database) — run scheduled graph traversals for recommendation updates
