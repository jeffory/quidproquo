/**
 * Queue (`@quidproquo-core/config/Queue`) → `queue` module.
 *
 * CDK parity: `QpqCoreQueueConstruct` — an `aws_sqs_queue` (visibility = max
 * batch window + retry timeout), with an optional dead-letter queue named
 * `<queue>-dead` (also via `resourceName`). Subscriptions and Lambda event-source
 * wiring are inferred by HOM-23/HOM-58; here we only emit the storage.
 */

import { attrs, moduleBlock } from '../hcl';
import { QpqConfigSettingJson } from '../synth/types';
import { buildModuleLabel, resolveRuntimeResourceName } from './naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from './types';
import { readBool, readNumber, readString } from './util';

const QUEUE_SETTING_TYPE = '@quidproquo-core/config/Queue';
const MODULE_LOGICAL_NAME = 'queue';
const MODULE_LABEL_PREFIX = 'queue';

export const queueGenerator: ResourceGenerator = {
  configSettingType: QUEUE_SETTING_TYPE,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const queueName = readString(setting, 'name') ?? setting.uniqueKey;
    const visibilityTimeoutSeconds = readNumber(setting, 'ttRetryInSeconds') ?? 30;
    const maxReceiveCount = readNumber(setting, 'maxTries') ?? 1;
    const hasDeadLetterQueue = readBool(setting, 'hasDeadLetterQueue') ?? true;

    const resolvedQueueName = resolveRuntimeResourceName(queueName, ctx.resolved);
    const dlqName = `${resolvedQueueName}-dead`;

    const moduleAttributes = attrs({
      name: resolvedQueueName,
      visibility_timeout_seconds: visibilityTimeoutSeconds,
      max_receive_count: hasDeadLetterQueue ? maxReceiveCount : undefined,
      dead_letter_queue_enabled: hasDeadLetterQueue,
      dead_letter_queue_name: hasDeadLetterQueue ? dlqName : undefined,
      tags: {
        application: ctx.resolved.applicationName,
        module: ctx.resolved.moduleName,
        environment: ctx.resolved.environment,
        qpq_setting_type: 'queue',
        qpq_unique_key: queueName,
      },
    });

    const block = moduleBlock({
      name: buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey),
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: moduleAttributes,
    });

    return [{ stack: 'inf', blocks: [block] }];
  },
};
