/**
 * Certificate (`@quidproquo-webserver/config/Certificate`) → `certificate`
 * module.
 *
 * CDK parity: `QpqWebserverCertificateConstruct` — an `aws_acm_certificate`
 * + DNS validation records. The module body picks the `us-east-1` provider
 * alias when the certificate is consumed by CloudFront and the regional
 * provider otherwise.
 */

import { attrs, moduleBlock } from '../../hcl';
import { QpqConfigSettingJson } from '../../synth/types';
import { buildModuleLabel, resolveQpqRuntimeResourceName } from '../naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from '../types';
import { readBool, readOwner, readString } from '../util';
import { WEBSERVER_SETTING_TYPE } from './settingTypes';

const MODULE_LOGICAL_NAME = 'certificate';
const MODULE_LABEL_PREFIX = 'certificate';
const QPQ_RESOURCE_TYPE_SUFFIX = 'cert';

export const certificateGenerator: ResourceGenerator = {
  configSettingType: WEBSERVER_SETTING_TYPE.Certificate,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const rootDomain = readString(setting, 'rootDomain');
    if (!rootDomain) {
      throw new Error(`Certificate "${setting.uniqueKey}" is missing a rootDomain.`);
    }
    const subdomain = readString(setting, 'subdomain');
    const onRootDomain = readBool(setting, 'onRootDomain') ?? false;

    // Use the FQDN (sanitised to dashes) as the resource-name seed; falls back
    // to the uniqueKey if neither side is usable.
    const fqdn = onRootDomain
      ? rootDomain
      : [subdomain, rootDomain].filter(Boolean).join('.');
    const seed = (fqdn || setting.uniqueKey).replace(/[^a-zA-Z0-9-]+/g, '-').replace(/-+/g, '-');

    const resolvedName = resolveQpqRuntimeResourceName(
      seed,
      QPQ_RESOURCE_TYPE_SUFFIX,
      ctx.resolved,
      readOwner(setting),
    );

    const block = moduleBlock({
      name: buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey),
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: attrs({
        name: resolvedName,
        root_domain: rootDomain,
        subdomain,
        on_root_domain: onRootDomain,
        tags: {
          application: ctx.resolved.applicationName,
          module: ctx.resolved.moduleName,
          environment: ctx.resolved.environment,
          qpq_setting_type: 'certificate',
          qpq_unique_key: setting.uniqueKey,
        },
      }),
    });

    return [{ stack: 'web', blocks: [block] }];
  },
};
