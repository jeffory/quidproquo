/**
 * WebEntry (`@quidproquo-webserver/config/WebEntry`) → `web-entry` module.
 *
 * CDK parity: `QpqWebserverWebEntryConstruct` — a CloudFront distribution
 * + S3 origin (the latter optional). Per ARCHITECTURE.md §2.3 `Seo` settings
 * fold in as inputs on this module; an unset `Seo.webEntry` field applies to
 * every web entry (matches CDK behaviour).
 */

import { attrs, moduleBlock } from '../../hcl';
import { QpqConfigSettingJson } from '../../synth/types';
import { buildModuleLabel, resolveQpqRuntimeResourceName } from '../naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from '../types';
import { readArray, readBool, readObject, readOwner, readString } from '../util';
import { WEBSERVER_SETTING_TYPE } from './settingTypes';

const MODULE_LOGICAL_NAME = 'web-entry';
const MODULE_LABEL_PREFIX = 'web_entry';
const QPQ_RESOURCE_TYPE_SUFFIX = 'web';

export const webEntryGenerator: ResourceGenerator = {
  configSettingType: WEBSERVER_SETTING_TYPE.WebEntry,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const name = readString(setting, 'name') ?? setting.uniqueKey;
    const indexRoot = readString(setting, 'indexRoot') ?? 'index.html';
    const domain = readObject(setting, 'domain') ?? {};
    const rootDomain = readString(domain, 'rootDomain');
    if (!rootDomain) {
      throw new Error(`WebEntry "${setting.uniqueKey}" is missing a domain.rootDomain.`);
    }
    const storageDrive = readObject(setting, 'storageDrive') ?? {};

    const resolvedName = resolveQpqRuntimeResourceName(
      name,
      QPQ_RESOURCE_TYPE_SUFFIX,
      ctx.resolved,
      readOwner(setting),
    );

    const seoSettings = ctx.resolved.config.settings.filter(
      (s) => s.configSettingType === WEBSERVER_SETTING_TYPE.Seo,
    );
    const seoPaths = seoSettings
      .filter((s) => {
        const webEntry = readString(s, 'webEntry');
        return webEntry === undefined || webEntry === name;
      })
      .map((s) => ({
        unique_key: s.uniqueKey,
        path: readString(s, 'path'),
        runtime: s.runtime ?? null,
        deprecated: readBool(s, 'deprecated') ?? false,
        cache_settings_name: readString(s, 'cacheSettingsName'),
      }));

    const ignoreCache = (readArray(setting, 'ignoreCache') ?? []).filter(
      (s): s is string => typeof s === 'string',
    );

    const block = moduleBlock({
      name: buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey),
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: attrs({
        name: resolvedName,
        web_entry_name: name,
        index_root: indexRoot,
        build_path: readString(setting, 'buildPath'),
        compress_files: readBool(setting, 'compressFiles') ?? true,
        root_domain: rootDomain,
        sub_domain_name: readString(domain, 'subDomainName'),
        on_root_domain: readBool(domain, 'onRootDomain') ?? false,
        cache_settings_name: readString(setting, 'cacheSettingsName'),
        ignore_cache: ignoreCache,
        cloudflare_api_key_secret_name: readString(setting, 'cloudflareApiKeySecretName'),
        security_headers: readObject(setting, 'securityHeaders'),
        storage_drive: {
          source_storage_drive: readString(storageDrive, 'sourceStorageDrive'),
          auto_upload: readBool(storageDrive, 'autoUpload') ?? true,
        },
        seo_paths: seoPaths,
        tags: {
          application: ctx.resolved.applicationName,
          module: ctx.resolved.moduleName,
          environment: ctx.resolved.environment,
          qpq_setting_type: 'webEntry',
          qpq_unique_key: setting.uniqueKey,
        },
      }),
    });

    return [{ stack: 'web', blocks: [block] }];
  },
};
