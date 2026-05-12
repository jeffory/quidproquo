/**
 * Api (`@quidproquo-webserver/config/Api`) → `api` module.
 *
 * CDK parity: `QpqWebserverApiConstruct`. Per ARCHITECTURE.md §2.3 the
 * `Route`, `DefaultRouteOptions`, and `OpenApi` settings are *not* their own
 * modules; they fold into this module's inputs (`routes`, `default_route_options`,
 * `openapi_spec_paths`). The host module body owns the IAM + integration
 * wiring against the `service-function` modules each route points at.
 */

import { attrs, moduleBlock } from '../../hcl';
import { QpqConfigSettingJson } from '../../synth/types';
import { buildModuleLabel, resolveQpqRuntimeResourceName } from '../naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from '../types';
import { readBool, readOwner, readString } from '../util';
import { WEBSERVER_SETTING_TYPE } from './settingTypes';

const MODULE_LOGICAL_NAME = 'api';
const MODULE_LABEL_PREFIX = 'api';
const QPQ_RESOURCE_TYPE_SUFFIX = 'api';

const filterByType = (settings: QpqConfigSettingJson[], type: string): QpqConfigSettingJson[] =>
  settings.filter((s) => s.configSettingType === type);

export const apiGenerator: ResourceGenerator = {
  configSettingType: WEBSERVER_SETTING_TYPE.Api,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const apiName = readString(setting, 'apiName') ?? setting.uniqueKey;
    const apiSubdomain = readString(setting, 'apiSubdomain') ?? apiName;
    const rootDomain = readString(setting, 'rootDomain');
    if (!rootDomain) {
      throw new Error(`Api "${setting.uniqueKey}" is missing a rootDomain.`);
    }

    const resolvedName = resolveQpqRuntimeResourceName(
      apiName,
      QPQ_RESOURCE_TYPE_SUFFIX,
      ctx.resolved,
      readOwner(setting),
    );

    const settings = ctx.resolved.config.settings;
    const routes = filterByType(settings, WEBSERVER_SETTING_TYPE.Route).map((r) => ({
      unique_key: r.uniqueKey,
      method: readString(r, 'method'),
      path: readString(r, 'path'),
      runtime: r.runtime ?? null,
      options: r.options ?? {},
    }));
    const defaultRouteOptions = filterByType(
      settings,
      WEBSERVER_SETTING_TYPE.DefaultRouteOptions,
    ).map((d) => ({
      group: d.uniqueKey,
      options: d.routeOptions ?? {},
    }));
    const openapiSpecPaths = filterByType(settings, WEBSERVER_SETTING_TYPE.OpenApi)
      .map((o) => readString(o, 'openApiSpecPath'))
      .filter((p): p is string => Boolean(p));

    const moduleAttributes = attrs({
      name: resolvedName,
      api_name: apiName,
      api_subdomain: apiSubdomain,
      root_domain: rootDomain,
      deprecated: readBool(setting, 'deprecated') ?? false,
      virtual_network_name: readString(setting, 'virtualNetworkName'),
      cloudflare_api_key_secret_name: readString(setting, 'cloudflareApiKeySecretName'),
      default_route_options: defaultRouteOptions,
      openapi_spec_paths: openapiSpecPaths,
      routes,
      tags: {
        application: ctx.resolved.applicationName,
        module: ctx.resolved.moduleName,
        environment: ctx.resolved.environment,
        qpq_setting_type: 'api',
        qpq_unique_key: setting.uniqueKey,
      },
    });

    const block = moduleBlock({
      name: buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey),
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: moduleAttributes,
    });

    return [{ stack: 'api', blocks: [block] }];
  },
};
