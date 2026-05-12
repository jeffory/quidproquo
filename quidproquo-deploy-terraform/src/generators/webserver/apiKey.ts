/**
 * ApiKey (`@quidproquo-webserver/config/ApiKey`) → `api-key` module.
 *
 * CDK parity: `QpqWebserverApiKeyConstruct` (an `aws_api_gateway_api_key`
 * registered against any `Api` whose `Route.options.apiKeys[]` mentions it).
 * The QPQ value is optional; if omitted the module body generates one at
 * apply time.
 */

import { attrs, moduleBlock } from '../../hcl';
import { QpqConfigSettingJson } from '../../synth/types';
import { buildModuleLabel, resolveQpqRuntimeResourceName } from '../naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from '../types';
import { readObject, readOwner, readString } from '../util';
import { WEBSERVER_SETTING_TYPE } from './settingTypes';

const MODULE_LOGICAL_NAME = 'api-key';
const MODULE_LABEL_PREFIX = 'api_key';
const QPQ_RESOURCE_TYPE_SUFFIX = 'apikey';

export const apiKeyGenerator: ResourceGenerator = {
  configSettingType: WEBSERVER_SETTING_TYPE.ApiKey,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const apiKey = readObject(setting, 'apiKey') ?? {};
    const apiKeyName = readString(apiKey, 'name') ?? setting.uniqueKey;

    const resolvedName = resolveQpqRuntimeResourceName(
      apiKeyName,
      QPQ_RESOURCE_TYPE_SUFFIX,
      ctx.resolved,
      readOwner(setting),
    );

    const block = moduleBlock({
      name: buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey),
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: attrs({
        name: resolvedName,
        api_key_name: apiKeyName,
        description: readString(apiKey, 'description'),
        value: readString(apiKey, 'value'),
        tags: {
          application: ctx.resolved.applicationName,
          module: ctx.resolved.moduleName,
          environment: ctx.resolved.environment,
          qpq_setting_type: 'apiKey',
          qpq_unique_key: setting.uniqueKey,
        },
      }),
    });

    return [{ stack: 'api', blocks: [block] }];
  },
};
