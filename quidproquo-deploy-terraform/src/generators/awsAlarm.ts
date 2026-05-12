/**
 * AwsServiceAlarm (`@quidproquo-aws/config/AwsServiceAlarm`) → `alarm` module
 * (CloudWatch metric alarm).
 *
 * CDK parity: `QpqConfigAwsAlarmConstruct` — `aws_cloudwatch_metric_alarm`
 * named via `resourceName(name)`. The alarm's metric coordinates flow through
 * verbatim; the module decides how to fan-out to event-bus subscriptions.
 */

import { attrs, moduleBlock } from '../hcl';
import { QpqConfigSettingJson } from '../synth/types';
import { buildModuleLabel, resolveRuntimeResourceName } from './naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from './types';
import { readArray, readNumber, readObject, readString } from './util';

const ALARM_SETTING_TYPE = '@quidproquo-aws/config/AwsServiceAlarm';
const MODULE_LOGICAL_NAME = 'alarm';
const MODULE_LABEL_PREFIX = 'alarm';

const COMPARISON_OPERATOR: Record<string, string> = {
  GreaterThanThreshold: 'GreaterThanThreshold',
  GreaterThanOrEqualToThreshold: 'GreaterThanOrEqualToThreshold',
  LessThanOrEqualToThreshold: 'LessThanOrEqualToThreshold',
  LessThanThreshold: 'LessThanThreshold',
};

export const awsAlarmGenerator: ResourceGenerator = {
  configSettingType: ALARM_SETTING_TYPE,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const alarmName = readString(setting, 'name') ?? setting.uniqueKey;
    const alarmSettings = readObject(setting, 'alarmSettings') ?? {};

    const namespace = readString(alarmSettings as QpqConfigSettingJson, 'namespace');
    const metricName = readString(alarmSettings as QpqConfigSettingJson, 'metricName');
    const statistic = readString(alarmSettings as QpqConfigSettingJson, 'statistic');
    const operator = readString(alarmSettings as QpqConfigSettingJson, 'operator');
    const period = readNumber(alarmSettings as QpqConfigSettingJson, 'period');
    const threshold = readNumber(alarmSettings as QpqConfigSettingJson, 'threshold');
    const datapointsToAlarm = readNumber(alarmSettings as QpqConfigSettingJson, 'datapointsToAlarm');
    const evaluationPeriodsToAlarm = readNumber(
      alarmSettings as QpqConfigSettingJson,
      'evaluationPeriodsToAlarm',
    );

    if (!namespace || !metricName || !statistic || !operator) {
      throw new Error(
        `awsServiceAlarm "${setting.uniqueKey}" is missing required alarmSettings (namespace, metricName, statistic, operator).`,
      );
    }

    const onAlarm = readObject(alarmSettings as QpqConfigSettingJson, 'onAlarm');
    const publishToEventBus = onAlarm
      ? (readArray(onAlarm as QpqConfigSettingJson, 'publishToEventBus') ?? []).filter(
          (v): v is string => typeof v === 'string',
        )
      : [];

    const moduleAttributes = attrs({
      alarm_name: resolveRuntimeResourceName(alarmName, ctx.resolved),
      namespace,
      metric_name: metricName,
      statistic,
      comparison_operator: COMPARISON_OPERATOR[operator] ?? operator,
      threshold,
      period,
      datapoints_to_alarm: datapointsToAlarm,
      evaluation_periods: evaluationPeriodsToAlarm,
      publish_to_event_bus_names: publishToEventBus.map((eb) =>
        resolveRuntimeResourceName(eb, ctx.resolved),
      ),
      tags: {
        application: ctx.resolved.applicationName,
        module: ctx.resolved.moduleName,
        environment: ctx.resolved.environment,
        qpq_setting_type: 'awsServiceAlarm',
        qpq_unique_key: alarmName,
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
