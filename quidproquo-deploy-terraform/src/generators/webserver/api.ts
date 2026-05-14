/**
 * Api (`@quidproquo-webserver/config/Api`) → `api` module.
 *
 * CDK parity: `QpqWebserverApiConstruct`. Per ARCHITECTURE.md §2.3 the
 * `Route`, `DefaultRouteOptions`, and `OpenApi` settings are *not* their own
 * modules; they fold into this module's inputs (`routes`, `default_route_options`,
 * `openapi_spec_paths`). The host module body owns the IAM + integration
 * wiring against the `service-function` modules each route points at.
 *
 * Each route that carries a `runtime` (i.e. a Lambda handler) requires its
 * own artifact inputs.  Artifact wiring follows the same two-mode convention
 * as the service-function and queue generators:
 *   - No artifactsDir: emits per-route `var.<apiLabel>_route_<routeLabel>_artifact_*`
 *     refs inside the routes list and matching `variable` declarations.
 *   - artifactsDir set: embeds `source_code_path` directly; no variable blocks.
 */

import path from 'node:path';

import { attrs, moduleBlock, ref, variable, type TerraformBlock } from '../../hcl';
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

    const apiLabel = buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey);
    const artifactsDir = ctx.resolved.options.artifactsDir;
    const settings = ctx.resolved.config.settings;

    const routeSettings = filterByType(settings, WEBSERVER_SETTING_TYPE.Route);

    const artifactVariableBlocks: TerraformBlock[] = [];

    const routes = routeSettings.map((r) => {
      const hasRuntime = r.runtime != null;
      if (!hasRuntime) {
        return {
          unique_key: r.uniqueKey,
          method: readString(r, 'method'),
          path: readString(r, 'path'),
          runtime: null,
          options: r.options ?? {},
        };
      }

      const routeLabel = buildModuleLabel('route', r.uniqueKey);

      if (artifactsDir) {
        return {
          unique_key: r.uniqueKey,
          method: readString(r, 'method'),
          path: readString(r, 'path'),
          runtime: r.runtime,
          options: r.options ?? {},
          source_code_path: path.join(artifactsDir, r.uniqueKey),
        };
      }

      const bucketVar = `${apiLabel}_${routeLabel}_artifact_s3_bucket`;
      const keyVar = `${apiLabel}_${routeLabel}_artifact_s3_key`;
      const hashVar = `${apiLabel}_${routeLabel}_artifact_source_code_hash`;

      artifactVariableBlocks.push(
        variable({ name: bucketVar, type: 'string' }),
        variable({ name: keyVar, type: 'string' }),
        variable({ name: hashVar, type: 'string' }),
      );

      return {
        unique_key: r.uniqueKey,
        method: readString(r, 'method'),
        path: readString(r, 'path'),
        runtime: r.runtime,
        options: r.options ?? {},
        artifact_s3_bucket: ref(`var.${bucketVar}`),
        artifact_s3_key: ref(`var.${keyVar}`),
        artifact_source_code_hash: ref(`var.${hashVar}`),
      };
    });

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

    const moduleBlk = moduleBlock({
      name: apiLabel,
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: moduleAttributes,
    });

    return [{ stack: 'api', blocks: [moduleBlk, ...artifactVariableBlocks] }];
  },
};
