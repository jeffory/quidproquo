/**
 * Queue (`@quidproquo-core/config/Queue`) → `queue` module.
 *
 * CDK parity: `QpqCoreQueueConstruct` — an `aws_sqs_queue` (visibility = max
 * batch window + retry timeout), with an optional dead-letter queue named
 * `<queue>-dead` (also via `resourceName`). The queue module also deploys the
 * Lambda handler(s) defined in `qpqQueueProcessors`.
 *
 * Artifact wiring for the handler Lambda follows the same two-mode convention
 * as the service-function generator:
 *   - No artifactsDir: emits `var.<label>_artifact_*` refs + `variable` blocks.
 *   - artifactsDir set: embeds `handler_source_code_path` directly.
 */

import path from 'node:path';

import { attrs, moduleBlock, ref, variable } from '../hcl';
import { QpqConfigSettingJson } from '../synth/types';
import { buildModuleLabel, resolveRuntimeResourceName } from './naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from './types';
import { readBool, readNumber, readString } from './util';

const QUEUE_SETTING_TYPE = '@quidproquo-core/config/Queue';
const MODULE_LOGICAL_NAME = 'queue';
const MODULE_LABEL_PREFIX = 'queue';

const hasProcessors = (setting: QpqConfigSettingJson): boolean => {
  const processors = setting.qpqQueueProcessors;
  return typeof processors === 'object' && processors !== null && Object.keys(processors as object).length > 0;
};

export const queueGenerator: ResourceGenerator = {
  configSettingType: QUEUE_SETTING_TYPE,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const queueName = readString(setting, 'name') ?? setting.uniqueKey;
    const visibilityTimeoutSeconds = readNumber(setting, 'ttRetryInSeconds') ?? 30;
    const maxReceiveCount = readNumber(setting, 'maxTries') ?? 1;
    const hasDeadLetterQueue = readBool(setting, 'hasDeadLetterQueue') ?? true;
    const label = buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey);
    const artifactsDir = ctx.resolved.options.artifactsDir;

    const resolvedQueueName = resolveRuntimeResourceName(queueName, ctx.resolved);
    const dlqName = `${resolvedQueueName}-dead`;

    const handlerArtifactAttrs = hasProcessors(setting)
      ? artifactsDir
        ? { handler_source_code_path: path.join(artifactsDir, setting.uniqueKey) }
        : {
            handler_s3_bucket: ref(`var.${label}_artifact_s3_bucket`),
            handler_s3_key: ref(`var.${label}_artifact_s3_key`),
            handler_source_code_hash: ref(`var.${label}_artifact_source_code_hash`),
          }
      : {};

    const moduleAttributes = attrs({
      name: resolvedQueueName,
      visibility_timeout_seconds: visibilityTimeoutSeconds,
      max_receive_count: hasDeadLetterQueue ? maxReceiveCount : undefined,
      dead_letter_queue_enabled: hasDeadLetterQueue,
      dead_letter_queue_name: hasDeadLetterQueue ? dlqName : undefined,
      ...handlerArtifactAttrs,
      tags: {
        application: ctx.resolved.applicationName,
        module: ctx.resolved.moduleName,
        environment: ctx.resolved.environment,
        qpq_setting_type: 'queue',
        qpq_unique_key: queueName,
      },
    });

    const moduleBlk = moduleBlock({
      name: label,
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: moduleAttributes,
    });

    const blocks =
      hasProcessors(setting) && !artifactsDir
        ? [
            moduleBlk,
            variable({ name: `${label}_artifact_s3_bucket`, type: 'string' }),
            variable({ name: `${label}_artifact_s3_key`, type: 'string' }),
            variable({ name: `${label}_artifact_source_code_hash`, type: 'string' }),
          ]
        : [moduleBlk];

    return [{ stack: 'inf', blocks }];
  },
};
