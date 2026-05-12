/**
 * DomainProxy (`@quidproquo-webserver/config/DomainProxy`) → `domain-proxy`
 * module.
 *
 * CDK parity: `QpqWebserverDomainProxyConstruct` — a CloudFront distribution
 * that fronts a custom HTTP origin (`httpProxyDomain`) under a QPQ-managed
 * domain. WAF baseline rules and OAC defaults live in the module body.
 */

import { attrs, moduleBlock } from '../../hcl';
import { QpqConfigSettingJson } from '../../synth/types';
import { buildModuleLabel, resolveQpqRuntimeResourceName } from '../naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from '../types';
import { readArray, readBool, readObject, readOwner, readString } from '../util';
import { WEBSERVER_SETTING_TYPE } from './settingTypes';

const MODULE_LOGICAL_NAME = 'domain-proxy';
const MODULE_LABEL_PREFIX = 'domain_proxy';
const QPQ_RESOURCE_TYPE_SUFFIX = 'proxy';

export const domainProxyGenerator: ResourceGenerator = {
  configSettingType: WEBSERVER_SETTING_TYPE.DomainProxy,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const name = readString(setting, 'name') ?? setting.uniqueKey;
    const httpProxyDomain = readString(setting, 'httpProxyDomain');
    if (!httpProxyDomain) {
      throw new Error(`DomainProxy "${setting.uniqueKey}" is missing a httpProxyDomain.`);
    }
    const domain = readObject(setting, 'domain') ?? {};
    const rootDomain = readString(domain, 'rootDomain');
    if (!rootDomain) {
      throw new Error(`DomainProxy "${setting.uniqueKey}" is missing a domain.rootDomain.`);
    }

    const resolvedName = resolveQpqRuntimeResourceName(
      name,
      QPQ_RESOURCE_TYPE_SUFFIX,
      ctx.resolved,
      readOwner(setting),
    );

    const subDomainNames = (readArray(domain, 'subDomainNames') ?? []).filter(
      (s): s is string => typeof s === 'string',
    );
    const ignoreCache = (readArray(setting, 'ignoreCache') ?? []).filter(
      (s): s is string => typeof s === 'string',
    );

    const block = moduleBlock({
      name: buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey),
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: attrs({
        name: resolvedName,
        proxy_name: name,
        viewer_protocol_policy: readString(setting, 'domainProxyViewerProtocolPolicy'),
        root_domain: rootDomain,
        sub_domain_names: subDomainNames,
        on_root_domain: readBool(domain, 'onRootDomain') ?? false,
        http_proxy_domain: httpProxyDomain,
        cache_settings_name: readString(setting, 'cacheSettingsName'),
        ignore_cache: ignoreCache,
        tags: {
          application: ctx.resolved.applicationName,
          module: ctx.resolved.moduleName,
          environment: ctx.resolved.environment,
          qpq_setting_type: 'domainProxy',
          qpq_unique_key: setting.uniqueKey,
        },
      }),
    });

    return [{ stack: 'web', blocks: [block] }];
  },
};
