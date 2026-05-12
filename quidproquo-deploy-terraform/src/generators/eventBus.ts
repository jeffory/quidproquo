/**
 * EventBus (`@quidproquo-core/config/EventBus`) → `event-bus` module (SNS topic).
 *
 * CDK parity: `QpqCoreEventBusConstruct` — a standard `aws_sns_topic` named
 * via `resourceName(name)`. Subscriptions live with the consuming service.
 */

import { attrs, moduleBlock } from '../hcl';
import { QpqConfigSettingJson } from '../synth/types';
import { buildModuleLabel, resolveRuntimeResourceName } from './naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from './types';
import { readOwner, readString } from './util';

const EVENT_BUS_SETTING_TYPE = '@quidproquo-core/config/EventBus';
const MODULE_LOGICAL_NAME = 'event-bus';
const MODULE_LABEL_PREFIX = 'event_bus';

export const eventBusGenerator: ResourceGenerator = {
  configSettingType: EVENT_BUS_SETTING_TYPE,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const eventBusName = readString(setting, 'name') ?? setting.uniqueKey;
    const owner = readOwner(setting);

    const moduleAttributes = attrs({
      topic_name: resolveRuntimeResourceName(eventBusName, ctx.resolved, owner),
      tags: {
        application: ctx.resolved.applicationName,
        module: ctx.resolved.moduleName,
        environment: ctx.resolved.environment,
        qpq_setting_type: 'eventBus',
        qpq_unique_key: eventBusName,
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
