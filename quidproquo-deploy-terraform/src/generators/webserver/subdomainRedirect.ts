/**
 * SubdomainRedirect (`@quidproquo-webserver/config/SubdomainRedirect`) →
 * `redirect` module.
 *
 * CDK parity: `QpqWebserverRedirectConstruct` — a CloudFront + Lambda@Edge
 * pair (or equivalent) that 301s `<subdomain>.<rootDomain>` to `redirectUrl`.
 */

import { attrs, moduleBlock } from '../../hcl';
import { QpqConfigSettingJson } from '../../synth/types';
import { buildModuleLabel, resolveQpqRuntimeResourceName } from '../naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from '../types';
import { readBool, readString } from '../util';
import { WEBSERVER_SETTING_TYPE } from './settingTypes';

const MODULE_LOGICAL_NAME = 'redirect';
const MODULE_LABEL_PREFIX = 'subdomain_redirect';
const QPQ_RESOURCE_TYPE_SUFFIX = 'redirect';

export const subdomainRedirectGenerator: ResourceGenerator = {
  configSettingType: WEBSERVER_SETTING_TYPE.SubdomainRedirect,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const subdomain = readString(setting, 'subdomain') ?? setting.uniqueKey;
    const redirectUrl = readString(setting, 'redirectUrl');
    if (!redirectUrl) {
      throw new Error(
        `SubdomainRedirect "${setting.uniqueKey}" is missing a redirectUrl.`,
      );
    }

    const resolvedName = resolveQpqRuntimeResourceName(
      subdomain,
      QPQ_RESOURCE_TYPE_SUFFIX,
      ctx.resolved,
    );

    const block = moduleBlock({
      name: buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey),
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: attrs({
        name: resolvedName,
        subdomain,
        redirect_url: redirectUrl,
        api_build_path: readString(setting, 'apiBuildPath'),
        on_root_domain: readBool(setting, 'onRootDomain') ?? true,
        add_environment: readBool(setting, 'addEnvironment') ?? true,
        add_feature_environment: readBool(setting, 'addFeatureEnvironment') ?? true,
        cloudflare_api_key_secret_name: readString(setting, 'cloudflareApiKeySecretName'),
        tags: {
          application: ctx.resolved.applicationName,
          module: ctx.resolved.moduleName,
          environment: ctx.resolved.environment,
          qpq_setting_type: 'subdomainRedirect',
          qpq_unique_key: setting.uniqueKey,
        },
      }),
    });

    return [{ stack: 'web', blocks: [block] }];
  },
};
