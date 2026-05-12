/**
 * Cache (`@quidproquo-webserver/config/Cache`) → `cache` module.
 *
 * CDK parity: `QpqWebserverCacheConstruct` — an `aws_cloudfront_cache_policy`
 * backing CloudFront distributions emitted by `WebEntry` and `DomainProxy`.
 * Compliance defaults (forwarded headers, query-string allowlists) live in
 * the module body.
 */

import { attrs, moduleBlock } from '../../hcl';
import { QpqConfigSettingJson } from '../../synth/types';
import { buildModuleLabel, resolveQpqRuntimeResourceName } from '../naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from '../types';
import { readBool, readNumber, readObject, readOwner, readString } from '../util';
import { WEBSERVER_SETTING_TYPE } from './settingTypes';

const MODULE_LOGICAL_NAME = 'cache';
const MODULE_LABEL_PREFIX = 'cache';
const QPQ_RESOURCE_TYPE_SUFFIX = 'cache';

export const cacheGenerator: ResourceGenerator = {
  configSettingType: WEBSERVER_SETTING_TYPE.Cache,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const cacheName = readString(setting, 'name') ?? setting.uniqueKey;
    const cacheSettings = readObject(setting, 'cache') ?? {};

    const resolvedName = resolveQpqRuntimeResourceName(
      cacheName,
      QPQ_RESOURCE_TYPE_SUFFIX,
      ctx.resolved,
      readOwner(setting),
    );

    const block = moduleBlock({
      name: buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey),
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: attrs({
        name: resolvedName,
        cache_name: cacheName,
        min_ttl_seconds: readNumber(cacheSettings, 'minTTLInSeconds') ?? 0,
        max_ttl_seconds: readNumber(cacheSettings, 'maxTTLInSeconds') ?? 86400,
        default_ttl_seconds: readNumber(cacheSettings, 'defaultTTLInSeconds') ?? 60,
        must_revalidate: readBool(cacheSettings, 'mustRevalidate') ?? false,
        tags: {
          application: ctx.resolved.applicationName,
          module: ctx.resolved.moduleName,
          environment: ctx.resolved.environment,
          qpq_setting_type: 'cache',
          qpq_unique_key: setting.uniqueKey,
        },
      }),
    });

    return [{ stack: 'web', blocks: [block] }];
  },
};
