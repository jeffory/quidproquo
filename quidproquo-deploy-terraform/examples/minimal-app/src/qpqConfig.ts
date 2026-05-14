import {
  defineApplicationModule,
  defineEnvironmentSettings,
  defineKeyValueStore,
  defineParameter,
  defineQueue,
  defineSecret,
  defineStorageDrive,
  QPQConfig,
} from 'quidproquo-core';
import { defineAwsServiceAccountInfo } from 'quidproquo-config-aws';
import { defineApi, defineRoute, defineServiceFunction } from 'quidproquo-webserver';

export const getMinimalAppConfig = (): QPQConfig => {
  const baseConfig: QPQConfig = [
    ...defineApplicationModule('minimal-app', 'main', 'dev', __dirname, 'dist'),

    defineAwsServiceAccountInfo('000000000000', 'us-east-1', [], {
      disableLogs: true,
      disableLambdaWarming: true,
    }),

    defineParameter('sample-param', { value: 'hello-world' }),
    defineSecret('sample-secret'),

    defineKeyValueStore(
      'items',
      'id',
      ['sortKey'],
      {
        indexes: [
          { partitionKey: 'gsiPk', sortKey: 'gsiSk' },
        ],
      },
    ),

    defineStorageDrive('assets'),

    defineQueue(
      'process-queue',
      {
        default: {
          basePath: __dirname,
          relativePath: '/handlers/queueHandler',
          functionName: 'handler',
        },
      },
      {
        hasDeadLetterQueue: true,
        maxTries: 3,
        ttRetryInSeconds: 300,
      },
    ),

    defineServiceFunction(
      {
        basePath: __dirname,
        relativePath: '/handlers/serviceHandler',
        functionName: 'handler',
      },
      {
        functionName: 'sample-service-function',
      },
    ),

    defineApi('api', 'example.com', { subDomain: 'api' }),

    defineRoute(
      'GET',
      '/hello',
      {
        basePath: __dirname,
        relativePath: '/handlers/apiHandler',
        functionName: 'handler',
      },
    ),

    defineEnvironmentSettings('dev', []),
    defineEnvironmentSettings('prod', []),
  ];

  return baseConfig;
};
