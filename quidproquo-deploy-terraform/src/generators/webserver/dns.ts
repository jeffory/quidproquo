/**
 * Dns (`@quidproquo-webserver/config/Dns`) → `dns` module.
 *
 * CDK parity: today the Route53 hosted zone is created inside the
 * `feature/webserver/webEntry` and `feature/webserver/certificate` constructs;
 * the Terraform layer splits it out per ARCHITECTURE.md §2.3 so a single zone
 * can back multiple consumers without one godly module.
 *
 * The DNS base must be globally unique inside AWS, so the QPQ
 * `<app>-<module>-<env>` suffix is not appended.
 */

import { attrs, moduleBlock } from '../../hcl';
import { QpqConfigSettingJson } from '../../synth/types';
import { buildModuleLabel } from '../naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from '../types';
import { readString } from '../util';
import { WEBSERVER_SETTING_TYPE } from './settingTypes';

const MODULE_LOGICAL_NAME = 'dns';
const MODULE_LABEL_PREFIX = 'dns';

export const dnsGenerator: ResourceGenerator = {
  configSettingType: WEBSERVER_SETTING_TYPE.Dns,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const dnsBase = readString(setting, 'dnsBase') ?? setting.uniqueKey;

    const block = moduleBlock({
      name: buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey),
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: attrs({
        dns_base: dnsBase,
        tags: {
          application: ctx.resolved.applicationName,
          module: ctx.resolved.moduleName,
          environment: ctx.resolved.environment,
          qpq_setting_type: 'dns',
          qpq_unique_key: setting.uniqueKey,
        },
      }),
    });

    return [{ stack: 'web', blocks: [block] }];
  },
};
