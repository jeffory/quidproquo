/**
 * WebSocket (`@quidproquo-webserver/config/WebSocket`) → `websocket` module.
 *
 * CDK parity: `QpqWebserverWebSocketConstruct` — an API Gateway WebSocket
 * API plus the three event-source bindings (connect/disconnect/message).
 * Each event processor names a `service-function` by `QpqFunctionRuntime`;
 * the module body owns the IAM + integration wiring against that function.
 */

import { attrs, moduleBlock } from '../../hcl';
import { QpqConfigSettingJson } from '../../synth/types';
import { buildModuleLabel, resolveQpqRuntimeResourceName } from '../naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from '../types';
import { readBool, readObject, readOwner, readString } from '../util';
import { WEBSERVER_SETTING_TYPE } from './settingTypes';

const MODULE_LOGICAL_NAME = 'websocket';
const MODULE_LABEL_PREFIX = 'web_socket';
const QPQ_RESOURCE_TYPE_SUFFIX = 'ws';

export const websocketGenerator: ResourceGenerator = {
  configSettingType: WEBSERVER_SETTING_TYPE.WebSocket,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const apiName = readString(setting, 'apiName') ?? 'api';
    const apiSubdomain = readString(setting, 'apiSubdomain');
    if (!apiSubdomain) {
      throw new Error(`WebSocket "${setting.uniqueKey}" is missing an apiSubdomain.`);
    }
    const rootDomain = readString(setting, 'rootDomain');
    if (!rootDomain) {
      throw new Error(`WebSocket "${setting.uniqueKey}" is missing a rootDomain.`);
    }
    const eventProcessors = readObject(setting, 'eventProcessors') ?? {};

    const resolvedName = resolveQpqRuntimeResourceName(
      apiName,
      QPQ_RESOURCE_TYPE_SUFFIX,
      ctx.resolved,
      readOwner(setting),
    );

    const block = moduleBlock({
      name: buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey),
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: attrs({
        name: resolvedName,
        api_name: apiName,
        api_subdomain: apiSubdomain,
        root_domain: rootDomain,
        on_root_domain: readBool(setting, 'onRootDomain') ?? false,
        deprecated: readBool(setting, 'deprecated') ?? false,
        cloudflare_api_key_secret_name: readString(setting, 'cloudflareApiKeySecretName'),
        event_processors: {
          on_connect: eventProcessors.onConnect ?? null,
          on_disconnect: eventProcessors.onDisconnect ?? null,
          on_message: eventProcessors.onMessage ?? null,
        },
        tags: {
          application: ctx.resolved.applicationName,
          module: ctx.resolved.moduleName,
          environment: ctx.resolved.environment,
          qpq_setting_type: 'webSocket',
          qpq_unique_key: setting.uniqueKey,
        },
      }),
    });

    return [{ stack: 'api', blocks: [block] }];
  },
};
