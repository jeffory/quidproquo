/**
 * NotifyError (`@quidproquo-core/config/notifyError`) → `notify-error` module.
 *
 * CDK parity: `QpqCoreNotifyError` — two CloudWatch alarms (`<name>-error` for
 * Lambda errors, `<name>-throttle` for Lambda throttles), each backed by an
 * SNS subscription that fans the alarm out to the configured event-bus topics.
 *
 * The module owns the alarm shape; this generator only passes the input
 * tuples through.
 */

import { attrs, moduleBlock } from '../hcl';
import { QpqConfigSettingJson } from '../synth/types';
import { buildModuleLabel, resolveRuntimeResourceName } from './naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from './types';
import { readArray, readObject, readString } from './util';

const NOTIFY_ERROR_SETTING_TYPE = '@quidproquo-core/config/notifyError';
const MODULE_LOGICAL_NAME = 'notify-error';
const MODULE_LABEL_PREFIX = 'notify_error';

export const notifyErrorGenerator: ResourceGenerator = {
  configSettingType: NOTIFY_ERROR_SETTING_TYPE,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const notifyName = readString(setting, 'name') ?? setting.uniqueKey;
    const onAlarm = readObject(setting, 'onAlarm');
    const publishToEventBus = onAlarm
      ? (readArray(onAlarm as QpqConfigSettingJson, 'publishToEventBus') ?? []).filter(
          (v): v is string => typeof v === 'string',
        )
      : [];

    const errorAlarmName = resolveRuntimeResourceName(`${notifyName}-error`, ctx.resolved);
    const throttleAlarmName = resolveRuntimeResourceName(`${notifyName}-throttle`, ctx.resolved);

    const moduleAttributes = attrs({
      name: resolveRuntimeResourceName(notifyName, ctx.resolved),
      error_alarm_name: errorAlarmName,
      throttle_alarm_name: throttleAlarmName,
      publish_to_event_bus_names: publishToEventBus.map((eb) =>
        resolveRuntimeResourceName(eb, ctx.resolved),
      ),
      tags: {
        application: ctx.resolved.applicationName,
        module: ctx.resolved.moduleName,
        environment: ctx.resolved.environment,
        qpq_setting_type: 'notifyError',
        qpq_unique_key: notifyName,
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
