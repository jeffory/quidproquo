/**
 * Parameter (`@quidproquo-core/config/parameter`) → `parameter` module (SSM).
 *
 * CDK parity: `QpqCoreParameterConstruct` — `aws_ssm_parameter` (String tier)
 * named via `resourceName(key)`. The QPQ runtime stamps the `value` at deploy
 * time; the generator passes it through.
 */

import { attrs, moduleBlock } from '../hcl';
import { QpqConfigSettingJson } from '../synth/types';
import { buildModuleLabel, resolveRuntimeResourceName } from './naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from './types';
import { readOwner, readString } from './util';

const PARAMETER_SETTING_TYPE = '@quidproquo-core/config/parameter';
const MODULE_LOGICAL_NAME = 'parameter';
const MODULE_LABEL_PREFIX = 'parameter';

export const parameterGenerator: ResourceGenerator = {
  configSettingType: PARAMETER_SETTING_TYPE,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const parameterKey = readString(setting, 'key') ?? setting.uniqueKey;
    const value = readString(setting, 'value') ?? '';
    const owner = readOwner(setting);

    const moduleAttributes = attrs({
      name: resolveRuntimeResourceName(parameterKey, ctx.resolved, owner),
      type: 'String',
      value,
      tags: {
        application: ctx.resolved.applicationName,
        module: ctx.resolved.moduleName,
        environment: ctx.resolved.environment,
        qpq_setting_type: 'parameter',
        qpq_unique_key: parameterKey,
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
