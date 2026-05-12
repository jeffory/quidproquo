import { CrossModuleOwnerOverride } from './naming';

/**
 * Read an arbitrary string field off a setting JSON object, returning the
 * trimmed value if present and non-empty. Generators use this when picking
 * the `uniqueKey`'s mirror field (e.g. `name`, `key`, `keyValueStoreName`)
 * off the JSON shape preserved by the QPQ config export.
 */
export const readString = (source: unknown, key: string): string | undefined => {
  if (typeof source !== 'object' || source === null) return undefined;
  const value = (source as Record<string, unknown>)[key];
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value;
};

export const readBool = (source: unknown, key: string): boolean | undefined => {
  if (typeof source !== 'object' || source === null) return undefined;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : undefined;
};

export const readNumber = (source: unknown, key: string): number | undefined => {
  if (typeof source !== 'object' || source === null) return undefined;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

export const readArray = (source: unknown, key: string): unknown[] | undefined => {
  if (typeof source !== 'object' || source === null) return undefined;
  const value = (source as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : undefined;
};

export const readObject = (
  source: unknown,
  key: string,
): Record<string, unknown> | undefined => {
  if (typeof source !== 'object' || source === null) return undefined;
  const value = (source as Record<string, unknown>)[key];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
};

/** Read the optional `owner` cross-module override block off a setting. */
export const readOwner = (source: unknown): CrossModuleOwnerOverride | undefined => {
  const owner = readObject(source, 'owner');
  if (!owner) return undefined;
  return {
    application: typeof owner.application === 'string' ? owner.application : undefined,
    module: typeof owner.module === 'string' ? owner.module : undefined,
    environment: typeof owner.environment === 'string' ? owner.environment : undefined,
    feature: typeof owner.feature === 'string' ? owner.feature : undefined,
    resourceName: typeof owner.resourceName === 'string' ? owner.resourceName : undefined,
  };
};
