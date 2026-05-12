/**
 * UserDirectory (`@quidproquo-core/config/UserDirectory`) → `user-directory`
 * module (Cognito user pool + client(s)).
 *
 * CDK parity: `QpqInfCoreUserDirectoryConstruct` — `aws_cognito_user_pool`
 * named via `resourceName(name)`, with self-signup, email auto-verification,
 * optional phone requirement, and a single user-pool client.
 *
 * Federated providers, custom auth Lambdas, and email templates are
 * passed through as opaque module inputs; the module decides how to wire
 * them (see ARCHITECTURE.md §2.3).
 */

import { attrs, moduleBlock } from '../hcl';
import { QpqConfigSettingJson } from '../synth/types';
import { buildModuleLabel, resolveRuntimeResourceName } from './naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from './types';
import { readBool, readObject, readOwner, readString } from './util';

const USER_DIRECTORY_SETTING_TYPE = '@quidproquo-core/config/UserDirectory';
const MODULE_LOGICAL_NAME = 'user-directory';
const MODULE_LABEL_PREFIX = 'user_directory';

export const userDirectoryGenerator: ResourceGenerator = {
  configSettingType: USER_DIRECTORY_SETTING_TYPE,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const directoryName = readString(setting, 'name') ?? setting.uniqueKey;
    const owner = readOwner(setting);

    const phoneRequired = readBool(setting, 'phoneRequired') ?? false;
    const selfSignUpEnabled = readBool(setting, 'selfSignUpEnabled') ?? true;
    const oAuth = readObject(setting, 'oAuth');
    const dnsRecord = readObject(setting, 'dnsRecord');

    const moduleAttributes = attrs({
      name: resolveRuntimeResourceName(directoryName, ctx.resolved, owner),
      self_signup_enabled: selfSignUpEnabled,
      phone_required: phoneRequired,
      auto_verified_attributes: ['email'],
      username_attributes: ['email'],
      oauth: oAuth ?? undefined,
      dns_record: dnsRecord ?? undefined,
      tags: {
        application: ctx.resolved.applicationName,
        module: ctx.resolved.moduleName,
        environment: ctx.resolved.environment,
        qpq_setting_type: 'userDirectory',
        qpq_unique_key: directoryName,
      },
    });

    const block = moduleBlock({
      name: buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey),
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: moduleAttributes,
    });

    return [{ stack: 'inf', blocks: [block] }];
  },
};
