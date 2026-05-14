import { describe, expect, it } from 'vitest';

import { emitFile, file } from '../hcl';
import { QpqConfigFile, QpqConfigSettingJson, ResolvedSynthContext } from '../synth/types';
import { awsAlarmGenerator } from './awsAlarm';
import { eventBusGenerator } from './eventBus';
import { graphDatabaseGenerator } from './graphDatabase';
import { generateServiceRoleModule } from './iam';
import { keyValueStoreGenerator } from './keyValueStore';
import { createDefaultModuleSource, createLocalModuleSource } from './moduleSource';
import {
  buildModuleLabel,
  getConfigRuntimeResourceName,
  getQpqRuntimeResourceName,
  resolveRuntimeResourceName,
  toModuleLabel,
} from './naming';
import { notifyErrorGenerator } from './notifyError';
import { parameterGenerator } from './parameter';
import { queueGenerator } from './queue';
import {
  buildResourceGeneratorRegistry,
  CORE_RESOURCE_GENERATORS,
  isTranslatorOnlySettingType,
} from './registry';
import { secretGenerator } from './secret';
import { storageDriveGenerator } from './storageDrive';
import { GeneratorContext } from './types';
import { userDirectoryGenerator } from './userDirectory';

const baseConfig: QpqConfigFile = {
  qpqConfigVersion: 1,
  exportedAt: '2026-05-13T00:00:00Z',
  settings: [
    {
      configSettingType: '@quidproquo-core/config/AppName',
      uniqueKey: 'appname',
      applicationName: 'myapp',
    },
  ],
};

const baseResolved: ResolvedSynthContext = {
  options: {
    configPath: 'qpq.config.json',
    outDir: 'out',
    env: 'dev',
  },
  config: baseConfig,
  applicationName: 'myapp',
  moduleName: 'svc',
  environment: 'dev',
  deployAccountId: '123456789012',
  deployRegion: 'us-east-1',
};

const ctx: GeneratorContext = {
  resolved: baseResolved,
  moduleSource: createLocalModuleSource('../../tf-modules'),
};

const renderAttribute = (attrs: Record<string, unknown>, key: string): string => {
  const value = attrs[key];
  if (typeof value === 'object' && value !== null && 'kind' in (value as object)) {
    return emitFile(
      file([
        {
          type: 'output',
          labels: ['probe'],
          attributes: { value: value as never },
        },
      ]),
    );
  }
  return String(value);
};

describe('naming utilities', () => {
  it('builds the standard resource name', () => {
    expect(
      getConfigRuntimeResourceName('users', {
        applicationName: 'myapp',
        moduleName: 'svc',
        environment: 'dev',
      }),
    ).toBe('users-myapp-svc-dev');
  });

  it('appends the feature suffix when present', () => {
    expect(
      getConfigRuntimeResourceName('users', {
        applicationName: 'myapp',
        moduleName: 'svc',
        environment: 'dev',
        feature: 'beta',
      }),
    ).toBe('users-myapp-svc-dev-beta');
  });

  it('appends the qpq<type> suffix', () => {
    expect(
      getQpqRuntimeResourceName('users', 'kvs', {
        applicationName: 'myapp',
        moduleName: 'svc',
        environment: 'dev',
      }),
    ).toBe('users-myapp-svc-dev-qpqkvs');
  });

  it('respects a cross-module owner override', () => {
    expect(
      resolveRuntimeResourceName('users', baseResolved, {
        application: 'shared',
        module: 'auth',
        environment: 'prod',
      }),
    ).toBe('users-shared-auth-prod');
  });

  it('returns the owner.resourceName verbatim when set', () => {
    expect(
      resolveRuntimeResourceName('users', baseResolved, {
        resourceName: 'pre-existing-table',
      }),
    ).toBe('pre-existing-table');
  });

  it('lower-snake-cases identifiers', () => {
    expect(toModuleLabel('My-Service.Name')).toBe('my_service_name');
    expect(toModuleLabel('_leading_')).toBe('leading');
    expect(toModuleLabel('')).toBe('unnamed');
  });

  it('builds composite module labels', () => {
    expect(buildModuleLabel('kvs', 'user-sessions')).toBe('kvs_user_sessions');
  });
});

describe('module source resolvers', () => {
  it('emits the default git URL', () => {
    const resolve = createDefaultModuleSource();
    expect(resolve('kvs')).toBe(
      'git::https://github.com/quidproquo/quidproquo-tf-modules.git//modules/kvs?ref=v0.1.0',
    );
  });

  it('respects baseUrl / ref / modulesPath overrides', () => {
    const resolve = createDefaultModuleSource({
      baseUrl: 'git::ssh://git@example.com/org/modules.git',
      ref: 'v2.0.0',
      modulesPath: 'tf',
    });
    expect(resolve('queue')).toBe(
      'git::ssh://git@example.com/org/modules.git//tf/queue?ref=v2.0.0',
    );
  });

  it('emits local paths for dev', () => {
    expect(createLocalModuleSource('./modules')('parameter')).toBe('./modules/parameter');
  });
});

describe('registry', () => {
  it('contains all 10 core generators with unique types', () => {
    const registry = buildResourceGeneratorRegistry();
    expect(registry.size).toBe(CORE_RESOURCE_GENERATORS.length);
    expect(registry.size).toBe(10);
  });

  it('detects duplicate registrations', () => {
    expect(() =>
      buildResourceGeneratorRegistry([keyValueStoreGenerator, keyValueStoreGenerator]),
    ).toThrow(/Duplicate ResourceGenerator/);
  });

  it('flags translator-only settings', () => {
    expect(isTranslatorOnlySettingType('@quidproquo-core/config/AppName')).toBe(true);
    expect(isTranslatorOnlySettingType('@quidproquo-core/config/KeyValueStore')).toBe(false);
  });
});

describe('keyValueStore generator', () => {
  const partitionOnly: QpqConfigSettingJson = {
    configSettingType: '@quidproquo-core/config/KeyValueStore',
    uniqueKey: 'users',
    keyValueStoreName: 'users',
    partitionKey: { key: 'userId', type: 'string' },
    sortKeys: [],
    indexes: [],
    global: false,
    enableMonthlyRollingBackups: false,
  };

  it('emits a module with the qpq-suffixed table name and primary key', () => {
    const [result] = keyValueStoreGenerator.generate(partitionOnly, ctx);
    expect(result.stack).toBe('inf');
    expect(result.blocks).toHaveLength(1);
    const block = result.blocks[0]!;
    expect(block.labels).toEqual(['kvs_users']);
    expect(block.attributes.source).toEqual({
      kind: 'string',
      value: '../../tf-modules/kvs',
    });
    expect(block.attributes.name).toEqual({
      kind: 'string',
      value: 'users-myapp-svc-dev-qpqkvs',
    });
    expect(block.attributes.hash_key).toEqual({ kind: 'string', value: 'userId' });
    expect(block.attributes.hash_key_type).toEqual({ kind: 'string', value: 'S' });
    expect(block.attributes.range_key).toBeUndefined();
    expect(block.attributes.ttl_enabled).toEqual({ kind: 'bool', value: false });
    expect(block.attributes.point_in_time_recovery).toEqual({ kind: 'bool', value: false });
  });

  it('wires a sort key, TTL and PITR when configured', () => {
    const setting: QpqConfigSettingJson = {
      ...partitionOnly,
      sortKeys: [{ key: 'created', type: 'number' }],
      ttlAttribute: 'expiresAt',
      enableMonthlyRollingBackups: true,
    };
    const [result] = keyValueStoreGenerator.generate(setting, ctx);
    const attrs = result.blocks[0]!.attributes;
    expect(attrs.range_key).toEqual({ kind: 'string', value: 'created' });
    expect(attrs.range_key_type).toEqual({ kind: 'string', value: 'N' });
    expect(attrs.ttl_attribute).toEqual({ kind: 'string', value: 'expiresAt' });
    expect(attrs.ttl_enabled).toEqual({ kind: 'bool', value: true });
    expect(attrs.point_in_time_recovery).toEqual({ kind: 'bool', value: true });
  });

  it('declares GSI attributes that are not already on the primary key', () => {
    const setting: QpqConfigSettingJson = {
      ...partitionOnly,
      indexes: [
        {
          partitionKey: { key: 'email', type: 'string' },
          sortKey: { key: 'created', type: 'number' },
        },
      ],
    };
    const [result] = keyValueStoreGenerator.generate(setting, ctx);
    const attrs = result.blocks[0]!.attributes;
    expect(attrs.attributes).toBeDefined();
    expect(attrs.global_secondary_indexes).toBeDefined();
    const rendered = renderAttribute(attrs, 'attributes');
    expect(rendered).toContain('email');
    expect(rendered).toContain('created');
  });

  it('throws when partitionKey is missing', () => {
    const setting: QpqConfigSettingJson = {
      configSettingType: '@quidproquo-core/config/KeyValueStore',
      uniqueKey: 'broken',
      keyValueStoreName: 'broken',
    };
    expect(() => keyValueStoreGenerator.generate(setting, ctx)).toThrow(/partitionKey/);
  });
});

describe('storageDrive generator', () => {
  it('emits a bucket module with the resource-name', () => {
    const setting: QpqConfigSettingJson = {
      configSettingType: '@quidproquo-core/config/storageDrive',
      uniqueKey: 'assets',
      storageDrive: 'assets',
      global: false,
    };
    const [result] = storageDriveGenerator.generate(setting, ctx);
    expect(result.stack).toBe('inf');
    const block = result.blocks[0]!;
    expect(block.labels).toEqual(['storage_drive_assets']);
    expect(block.attributes.bucket_name).toEqual({
      kind: 'string',
      value: 'assets-myapp-svc-dev',
    });
    expect(block.attributes.lifecycle_rules).toBeUndefined();
  });

  it('translates lifecycle rules', () => {
    const setting: QpqConfigSettingJson = {
      configSettingType: '@quidproquo-core/config/storageDrive',
      uniqueKey: 'assets',
      storageDrive: 'assets',
      lifecycleRules: [
        {
          prefix: 'tmp/',
          enabled: true,
          deleteAfterDays: 30,
          transitions: [
            { storageDriveTier: 'COLD_STORAGE', transitionAfterDays: 7 },
            { storageDriveTier: 'DEEP_COLD_STORAGE', transitionAfterDays: 365 },
          ],
        },
      ],
    };
    const [result] = storageDriveGenerator.generate(setting, ctx);
    const rendered = renderAttribute(result.blocks[0]!.attributes, 'lifecycle_rules');
    expect(rendered).toContain('transition_glacier_days');
    expect(rendered).toContain('transition_deep_archive_days');
    expect(rendered).toContain('expiration_days');
    expect(rendered).toContain('tmp/');
  });
});

describe('queue generator', () => {
  it('emits the queue + DLQ inputs without artifact vars when no processors', () => {
    const setting: QpqConfigSettingJson = {
      configSettingType: '@quidproquo-core/config/Queue',
      uniqueKey: 'onboarding',
      name: 'onboarding',
      ttRetryInSeconds: 60,
      maxTries: 5,
      hasDeadLetterQueue: true,
    };
    const [result] = queueGenerator.generate(setting, ctx);
    // No processors → just the module block
    expect(result.blocks).toHaveLength(1);
    const attrs = result.blocks[0]!.attributes;
    expect(attrs.name).toEqual({ kind: 'string', value: 'onboarding-myapp-svc-dev' });
    expect(attrs.visibility_timeout_seconds).toEqual({ kind: 'number', value: 60 });
    expect(attrs.dead_letter_queue_enabled).toEqual({ kind: 'bool', value: true });
    expect(attrs.dead_letter_queue_name).toEqual({
      kind: 'string',
      value: 'onboarding-myapp-svc-dev-dead',
    });
    expect(attrs.max_receive_count).toEqual({ kind: 'number', value: 5 });
    expect(attrs.handler_s3_bucket).toBeUndefined();
  });

  it('emits handler artifact variable refs + declarations when processors are present', () => {
    const setting: QpqConfigSettingJson = {
      configSettingType: '@quidproquo-core/config/Queue',
      uniqueKey: 'jobs',
      name: 'jobs',
      hasDeadLetterQueue: true,
      qpqQueueProcessors: { default: '/handlers/jobHandler::handler' },
    };
    const [result] = queueGenerator.generate(setting, ctx);
    // module block + 3 variable declarations
    expect(result.blocks).toHaveLength(4);
    const moduleAttrs = result.blocks[0]!.attributes;
    expect(moduleAttrs.handler_s3_bucket).toEqual({
      kind: 'ref',
      ref: 'var.queue_jobs_artifact_s3_bucket',
    });
    expect(moduleAttrs.handler_s3_key).toEqual({
      kind: 'ref',
      ref: 'var.queue_jobs_artifact_s3_key',
    });
    expect(moduleAttrs.handler_source_code_hash).toEqual({
      kind: 'ref',
      ref: 'var.queue_jobs_artifact_source_code_hash',
    });
    const varHcl = result.blocks.slice(1).map((b) => emitFile(file([b]))).join('\n');
    expect(varHcl).toContain('variable "queue_jobs_artifact_s3_bucket"');
    expect(varHcl).toContain('variable "queue_jobs_artifact_s3_key"');
    expect(varHcl).toContain('variable "queue_jobs_artifact_source_code_hash"');
  });

  it('omits DLQ inputs when disabled', () => {
    const setting: QpqConfigSettingJson = {
      configSettingType: '@quidproquo-core/config/Queue',
      uniqueKey: 'ephemeral',
      name: 'ephemeral',
      hasDeadLetterQueue: false,
    };
    const [result] = queueGenerator.generate(setting, ctx);
    const attrs = result.blocks[0]!.attributes;
    expect(attrs.dead_letter_queue_enabled).toEqual({ kind: 'bool', value: false });
    expect(attrs.dead_letter_queue_name).toBeUndefined();
    expect(attrs.max_receive_count).toBeUndefined();
  });
});

describe('eventBus generator', () => {
  it('emits an SNS topic module', () => {
    const [result] = eventBusGenerator.generate(
      {
        configSettingType: '@quidproquo-core/config/EventBus',
        uniqueKey: 'orders',
        name: 'orders',
      },
      ctx,
    );
    expect(result.blocks[0]!.labels).toEqual(['event_bus_orders']);
    expect(result.blocks[0]!.attributes.topic_name).toEqual({
      kind: 'string',
      value: 'orders-myapp-svc-dev',
    });
  });
});

describe('secret + parameter generators', () => {
  it('secret emits the resource-named module', () => {
    const [result] = secretGenerator.generate(
      {
        configSettingType: '@quidproquo-core/config/secret',
        uniqueKey: 'stripe-key',
        key: 'stripe-key',
      },
      ctx,
    );
    expect(result.blocks[0]!.labels).toEqual(['secret_stripe_key']);
    expect(result.blocks[0]!.attributes.name).toEqual({
      kind: 'string',
      value: 'stripe-key-myapp-svc-dev',
    });
  });

  it('parameter emits name + value', () => {
    const [result] = parameterGenerator.generate(
      {
        configSettingType: '@quidproquo-core/config/parameter',
        uniqueKey: 'log-level',
        key: 'log-level',
        value: 'INFO',
      },
      ctx,
    );
    const attrs = result.blocks[0]!.attributes;
    expect(attrs.name).toEqual({ kind: 'string', value: 'log-level-myapp-svc-dev' });
    expect(attrs.value).toEqual({ kind: 'string', value: 'INFO' });
  });
});

describe('userDirectory generator', () => {
  it('emits a Cognito module', () => {
    const [result] = userDirectoryGenerator.generate(
      {
        configSettingType: '@quidproquo-core/config/UserDirectory',
        uniqueKey: 'customers',
        name: 'customers',
        phoneRequired: false,
        selfSignUpEnabled: true,
        emailTemplates: {},
      },
      ctx,
    );
    const attrs = result.blocks[0]!.attributes;
    expect(attrs.name).toEqual({ kind: 'string', value: 'customers-myapp-svc-dev' });
    expect(attrs.self_signup_enabled).toEqual({ kind: 'bool', value: true });
    expect(attrs.phone_required).toEqual({ kind: 'bool', value: false });
  });
});

describe('graphDatabase generator', () => {
  it('wires the virtual network name', () => {
    const [result] = graphDatabaseGenerator.generate(
      {
        configSettingType: '@quidproquo-core/config/GraphDatabase',
        uniqueKey: 'social',
        name: 'social',
        virualNetworkName: 'main',
      },
      ctx,
    );
    const attrs = result.blocks[0]!.attributes;
    expect(attrs.name).toEqual({ kind: 'string', value: 'social-myapp-svc-dev' });
    expect(attrs.virtual_network_name).toEqual({
      kind: 'string',
      value: 'main-myapp-svc-dev',
    });
  });

  it('rejects a missing VPC reference', () => {
    expect(() =>
      graphDatabaseGenerator.generate(
        {
          configSettingType: '@quidproquo-core/config/GraphDatabase',
          uniqueKey: 'social',
          name: 'social',
        },
        ctx,
      ),
    ).toThrow(/virualNetworkName/);
  });
});

describe('notifyError + alarm generators', () => {
  it('notifyError fans out to event-bus names', () => {
    const [result] = notifyErrorGenerator.generate(
      {
        configSettingType: '@quidproquo-core/config/notifyError',
        uniqueKey: 'on-fail',
        name: 'on-fail',
        onAlarm: { publishToEventBus: ['orders'] },
      },
      ctx,
    );
    const attrs = result.blocks[0]!.attributes;
    expect(attrs.error_alarm_name).toEqual({
      kind: 'string',
      value: 'on-fail-error-myapp-svc-dev',
    });
    expect(attrs.throttle_alarm_name).toEqual({
      kind: 'string',
      value: 'on-fail-throttle-myapp-svc-dev',
    });
    const rendered = renderAttribute(attrs, 'publish_to_event_bus_names');
    expect(rendered).toContain('orders-myapp-svc-dev');
  });

  it('awsAlarm passes through the metric coordinates', () => {
    const [result] = awsAlarmGenerator.generate(
      {
        configSettingType: '@quidproquo-aws/config/AwsServiceAlarm',
        uniqueKey: 'lambda-errors',
        name: 'lambda-errors',
        alarmSettings: {
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          statistic: 'Sum',
          operator: 'GreaterThanThreshold',
          threshold: 1,
          period: 300,
          datapointsToAlarm: 1,
          evaluationPeriodsToAlarm: 1,
          onAlarm: { publishToEventBus: ['ops'] },
        },
      },
      ctx,
    );
    const attrs = result.blocks[0]!.attributes;
    expect(attrs.alarm_name).toEqual({
      kind: 'string',
      value: 'lambda-errors-myapp-svc-dev',
    });
    expect(attrs.namespace).toEqual({ kind: 'string', value: 'AWS/Lambda' });
    expect(attrs.metric_name).toEqual({ kind: 'string', value: 'Errors' });
    expect(attrs.comparison_operator).toEqual({
      kind: 'string',
      value: 'GreaterThanThreshold',
    });
  });

  it('awsAlarm errors out when required metric fields are missing', () => {
    expect(() =>
      awsAlarmGenerator.generate(
        {
          configSettingType: '@quidproquo-aws/config/AwsServiceAlarm',
          uniqueKey: 'broken',
          name: 'broken',
          alarmSettings: { namespace: 'AWS/Lambda' },
        },
        ctx,
      ),
    ).toThrow(/alarmSettings/);
  });
});

describe('service role IAM module', () => {
  it('emits the role module with deduped, sorted grant lists', () => {
    const block = generateServiceRoleModule(ctx, {
      kvs_read: ['users-myapp-svc-dev-qpqkvs', 'users-myapp-svc-dev-qpqkvs', 'sessions-myapp-svc-dev-qpqkvs'],
      queue_send: ['onboarding-myapp-svc-dev'],
    });
    expect(block.labels).toEqual(['service_role']);
    expect(block.attributes.role_name).toEqual({
      kind: 'string',
      value: 'service-role-myapp-svc-dev',
    });
    const rendered = renderAttribute(block.attributes, 'kvs_read');
    expect(rendered).toContain('sessions-myapp-svc-dev-qpqkvs');
    expect(rendered).toContain('users-myapp-svc-dev-qpqkvs');
    // deduped: appears once
    expect(rendered.split('users-myapp-svc-dev-qpqkvs').length - 1).toBe(1);
  });

  it('handles empty grants', () => {
    const block = generateServiceRoleModule(ctx);
    const rendered = renderAttribute(block.attributes, 'kvs_read');
    expect(rendered).toContain('[]');
  });
});

describe('end-to-end emit smoke test', () => {
  it('renders a full stack file with multiple generators', () => {
    const blocks = [
      ...keyValueStoreGenerator
        .generate(
          {
            configSettingType: '@quidproquo-core/config/KeyValueStore',
            uniqueKey: 'users',
            keyValueStoreName: 'users',
            partitionKey: { key: 'userId', type: 'string' },
            sortKeys: [],
            indexes: [],
            global: false,
            enableMonthlyRollingBackups: false,
          },
          ctx,
        )
        .flatMap((g) => g.blocks),
      ...secretGenerator
        .generate(
          {
            configSettingType: '@quidproquo-core/config/secret',
            uniqueKey: 'stripe-key',
            key: 'stripe-key',
          },
          ctx,
        )
        .flatMap((g) => g.blocks),
      generateServiceRoleModule(ctx, {
        kvs_read: ['users-myapp-svc-dev-qpqkvs'],
        secret_read: ['stripe-key-myapp-svc-dev'],
      }),
    ];
    const rendered = emitFile(file(blocks));
    expect(rendered).toContain('module "kvs_users"');
    expect(rendered).toContain('module "secret_stripe_key"');
    expect(rendered).toContain('module "service_role"');
    expect(rendered).toContain('users-myapp-svc-dev-qpqkvs');
    expect(rendered).toContain('stripe-key-myapp-svc-dev');
    expect(rendered.endsWith('\n')).toBe(true);
  });
});
