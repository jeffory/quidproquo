/**
 * Secret (`@quidproquo-core/config/secret`) → `secret` module (Secrets Manager).
 *
 * CDK parity: `QpqCoreSecretConstruct` — `aws_secretsmanager_secret` named via
 * `resourceName(key)`. Initial value rotation lives inside the module; the
 * generator only emits the placeholder.
 */

import { attrs, moduleBlock } from '../hcl';
import { QpqConfigSettingJson } from '../synth/types';
import { buildModuleLabel, resolveRuntimeResourceName } from './naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from './types';
import { readOwner, readString } from './util';

const SECRET_SETTING_TYPE = '@quidproquo-core/config/secret';
const MODULE_LOGICAL_NAME = 'secret';
const MODULE_LABEL_PREFIX = 'secret';

export const secretGenerator: ResourceGenerator = {
  configSettingType: SECRET_SETTING_TYPE,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const secretKey = readString(setting, 'key') ?? setting.uniqueKey;
    const owner = readOwner(setting);

    const moduleAttributes = attrs({
      name: resolveRuntimeResourceName(secretKey, ctx.resolved, owner),
      tags: {
        application: ctx.resolved.applicationName,
        module: ctx.resolved.moduleName,
        environment: ctx.resolved.environment,
        qpq_setting_type: 'secret',
        qpq_unique_key: secretKey,
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
