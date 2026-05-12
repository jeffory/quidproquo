/**
 * Naming utilities mirroring `quidproquo-actionprocessor-awslambda/awsNamingUtils.ts`.
 *
 * The runtime processors look up AWS resources by these exact names, so the
 * generator MUST produce identical strings to the CDK deployer to keep
 * blue/green migration possible (ARCHITECTURE.md §3.1). The two sides are
 * tested for parity in HOM-26.
 */

import { ResolvedSynthContext } from '../synth/types';

/**
 * Cross-module owner override (mirrors `quidproquo-core.CrossModuleOwner`).
 * Any subset of these fields shadows the active context's values; if
 * `resourceName` is set, the entire computed runtime name is replaced.
 */
export interface CrossModuleOwnerOverride {
  application?: string;
  module?: string;
  environment?: string;
  feature?: string;
  resourceName?: string;
}

/** Subset of {@link ResolvedSynthContext} the naming functions actually read. */
export interface NamingContext {
  applicationName: string;
  moduleName: string;
  environment: string;
  feature?: string;
}

const namingContextFromResolved = (resolved: ResolvedSynthContext): NamingContext => {
  // `feature` is not yet surfaced on ResolvedSynthContext (HOM-24); fall
  // back to the appName setting's `feature` field when it appears there.
  const appNameSetting = resolved.config.settings.find(
    (s) => s.configSettingType === '@quidproquo-core/config/AppName',
  ) as { feature?: string } | undefined;

  return {
    applicationName: resolved.applicationName,
    moduleName: resolved.moduleName,
    environment: resolved.environment,
    feature: typeof appNameSetting?.feature === 'string' ? appNameSetting.feature : undefined,
  };
};

/** `<name>-<application>-<service>-<environment>[-<feature>]`. */
export const getConfigRuntimeResourceName = (
  resourceName: string,
  ctx: NamingContext,
): string => {
  const base = `${resourceName}-${ctx.applicationName}-${ctx.moduleName}-${ctx.environment}`;
  return ctx.feature ? `${base}-${ctx.feature}` : base;
};

/** `<name>-<application>-<service>-<environment>[-<feature>]-qpq<resourceType>`. */
export const getQpqRuntimeResourceName = (
  resourceName: string,
  resourceType: string,
  ctx: NamingContext,
): string => `${getConfigRuntimeResourceName(resourceName, ctx)}-qpq${resourceType}`;

/** `<name>-<application>-<environment>[-<feature>]`. Account-wide (no service). */
export const getConfigRuntimeBootstrapResourceName = (
  resourceName: string,
  ctx: NamingContext,
): string => {
  const base = `${resourceName}-${ctx.applicationName}-${ctx.environment}`;
  return ctx.feature ? `${base}-${ctx.feature}` : base;
};

/**
 * Resolve a runtime resource name in the active synth context, applying a
 * cross-module `owner` override when present. Equivalent to
 * `awsNamingUtils.resolveConfigRuntimeResourceNameFromConfig`.
 */
export const resolveRuntimeResourceName = (
  resourceName: string,
  resolved: ResolvedSynthContext,
  owner?: CrossModuleOwnerOverride,
): string => {
  if (owner?.resourceName) return owner.resourceName;
  const ctx = namingContextFromResolved(resolved);
  const effective: NamingContext = {
    applicationName: owner?.application ?? ctx.applicationName,
    moduleName: owner?.module ?? ctx.moduleName,
    environment: owner?.environment ?? ctx.environment,
    feature: owner?.feature ?? ctx.feature,
  };
  return getConfigRuntimeResourceName(resourceName, effective);
};

/** Same as {@link resolveRuntimeResourceName} but appends the `-qpq<type>` suffix. */
export const resolveQpqRuntimeResourceName = (
  resourceName: string,
  resourceType: string,
  resolved: ResolvedSynthContext,
  owner?: CrossModuleOwnerOverride,
): string => {
  if (owner?.resourceName) return owner.resourceName;
  const ctx = namingContextFromResolved(resolved);
  const effective: NamingContext = {
    applicationName: owner?.application ?? ctx.applicationName,
    moduleName: owner?.module ?? ctx.moduleName,
    environment: owner?.environment ?? ctx.environment,
    feature: owner?.feature ?? ctx.feature,
  };
  return getQpqRuntimeResourceName(resourceName, resourceType, effective);
};

const SNAKE_CASE_REPLACE = /[^a-zA-Z0-9_]+/g;

/**
 * Lower-snake-case a string suitable for a Terraform module instance label.
 * Hyphens, dots, slashes and any other punctuation collapse into single `_`s.
 */
export const toModuleLabel = (value: string): string => {
  const replaced = value.replace(SNAKE_CASE_REPLACE, '_').toLowerCase();
  const trimmed = replaced.replace(/^_+|_+$/g, '');
  return trimmed || 'unnamed';
};

/**
 * `<settingTypeShort>_<uniqueKey>` lower-snake-cased — the canonical label
 * inside `module "<label>"` (ARCHITECTURE.md §3.3).
 */
export const buildModuleLabel = (settingTypeShort: string, uniqueKey: string): string =>
  `${toModuleLabel(settingTypeShort)}_${toModuleLabel(uniqueKey)}`;
