/**
 * StorageDrive (`@quidproquo-core/config/storageDrive`) → `storage-drive` module.
 *
 * CDK parity: `QpqCoreStorageDriveConstruct` — an `aws_s3_bucket` with sensible
 * defaults plus optional lifecycle rules. Encryption, public-access-block,
 * versioning and KMS live inside the module per ARCHITECTURE.md §6.
 */

import { attrs, expr, list, moduleBlock } from '../hcl';
import { QpqConfigSettingJson } from '../synth/types';
import { buildModuleLabel, resolveRuntimeResourceName } from './naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from './types';
import { readArray, readBool, readNumber, readObject, readOwner, readString } from './util';

const STORAGE_DRIVE_SETTING_TYPE = '@quidproquo-core/config/storageDrive';
const MODULE_LOGICAL_NAME = 'storage-drive';
const MODULE_LABEL_PREFIX = 'storage_drive';

// Map QPQ lifecycle storage-tier enum names to the S3 transition keys
// recognised by the `storage-drive` module (`transition_<key>_days`).
const TIER_TO_VARIABLE_KEY: Record<string, 'standard_ia' | 'glacier' | 'deep_archive'> = {
  REGULAR: 'standard_ia',
  OCCASIONAL_ACCESS: 'standard_ia',
  SINGLE_ZONE_OCCASIONAL_ACCESS: 'standard_ia',
  COLD_STORAGE: 'glacier',
  COLD_STORAGE_INSTANT_ACCESS: 'glacier',
  DEEP_COLD_STORAGE: 'deep_archive',
  SMART_TIERING: 'standard_ia',
};

export const storageDriveGenerator: ResourceGenerator = {
  configSettingType: STORAGE_DRIVE_SETTING_TYPE,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const storageDriveName = readString(setting, 'storageDrive') ?? setting.uniqueKey;
    const owner = readOwner(setting);

    const bucketName = resolveRuntimeResourceName(storageDriveName, ctx.resolved, owner);

    const lifecycleRules = (readArray(setting, 'lifecycleRules') ?? [])
      .map((rule, index) => {
        if (typeof rule !== 'object' || rule === null) return undefined;
        const prefix = readString(rule, 'prefix') ?? '';
        const enabled = readBool(rule, 'enabled') ?? true;
        const deleteAfterDays = readNumber(rule, 'deleteAfterDays');
        const transitions = (readArray(rule, 'transitions') ?? [])
          .map((transition) => {
            if (typeof transition !== 'object' || transition === null) return undefined;
            const tier = readString(transition, 'storageDriveTier');
            const days = readNumber(transition, 'transitionAfterDays');
            if (!tier || days === undefined) return undefined;
            const tierKey = TIER_TO_VARIABLE_KEY[tier];
            if (!tierKey) return undefined;
            return { tierKey, days };
          })
          .filter((v): v is { tierKey: 'standard_ia' | 'glacier' | 'deep_archive'; days: number } => Boolean(v));

        const ruleAttrs: Record<string, unknown> = {
          id: `rule-${index}`,
          enabled,
          prefix,
        };
        for (const transition of transitions) {
          ruleAttrs[`transition_${transition.tierKey}_days`] = transition.days;
        }
        if (deleteAfterDays !== undefined) {
          ruleAttrs.expiration_days = deleteAfterDays;
        }
        return ruleAttrs;
      })
      .filter((v): v is Record<string, unknown> => Boolean(v));

    const moduleAttributes = attrs({
      bucket_name: bucketName,
      tags: {
        application: ctx.resolved.applicationName,
        module: ctx.resolved.moduleName,
        environment: ctx.resolved.environment,
        qpq_setting_type: 'storageDrive',
        qpq_unique_key: storageDriveName,
      },
    });

    if (lifecycleRules.length > 0) {
      moduleAttributes.lifecycle_rules = list(lifecycleRules.map((rule) => expr(rule)));
    }

    // Silence unused-import when no lifecycle path runs.
    void readObject;

    const block = moduleBlock({
      name: buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey),
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: moduleAttributes,
    });

    return [{ stack: 'inf', blocks: [block] }];
  },
};
