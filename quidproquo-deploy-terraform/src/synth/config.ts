import { promises as fs } from 'node:fs';
import path from 'node:path';

import { SynthError } from './errors';
import {
  QpqConfigFile,
  QpqConfigSettingJson,
  ResolvedSynthContext,
  SUPPORTED_QPQ_CONFIG_VERSION,
  SynthOptions,
} from './types';

const APP_NAME_TYPE = '@quidproquo-core/config/AppName';
const MODULE_NAME_TYPE = '@quidproquo-core/config/moduleName';
const ENVIRONMENT_SETTINGS_TYPE = '@quidproquo-core/config/EnvironmentSettings';
const AWS_SERVICE_ACCOUNT_INFO_TYPE = '@quidproquo-aws/config/AwsServiceAccountInfo';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const findSetting = (
  settings: QpqConfigSettingJson[],
  configSettingType: string,
): QpqConfigSettingJson | undefined => settings.find((s) => s.configSettingType === configSettingType);

const findSettings = (
  settings: QpqConfigSettingJson[],
  configSettingType: string,
): QpqConfigSettingJson[] => settings.filter((s) => s.configSettingType === configSettingType);

/** Read and JSON-parse the config file. Throws {@link SynthError} on IO/parse errors. */
export const loadQpqConfigFile = async (configPath: string): Promise<unknown> => {
  const absPath = path.resolve(configPath);
  let raw: string;
  try {
    raw = await fs.readFile(absPath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new SynthError(`Config file not found: ${absPath}`);
    }
    throw new SynthError(`Failed to read config file ${absPath}: ${(err as Error).message}`);
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new SynthError(`Config file ${absPath} is not valid JSON: ${(err as Error).message}`);
  }
};

/**
 * Validate the top-level shape of the parsed config file. Returns the same
 * value typed as {@link QpqConfigFile} on success; throws {@link SynthError}
 * with a precise message otherwise.
 */
export const validateQpqConfigFile = (raw: unknown): QpqConfigFile => {
  if (!isPlainObject(raw)) {
    throw new SynthError('Config file must be a JSON object at the top level.');
  }

  const version = raw.qpqConfigVersion;
  if (typeof version !== 'number') {
    throw new SynthError('Config file is missing the `qpqConfigVersion` number.');
  }
  if (version !== SUPPORTED_QPQ_CONFIG_VERSION) {
    throw new SynthError(
      `Unsupported qpqConfigVersion ${version}; this build understands ${SUPPORTED_QPQ_CONFIG_VERSION}. ` +
        'Upgrade `quidproquo-deploy-terraform` or regenerate the config.',
    );
  }

  if (!Array.isArray(raw.settings)) {
    throw new SynthError('Config file is missing a `settings` array.');
  }

  raw.settings.forEach((setting, index) => {
    if (!isPlainObject(setting)) {
      throw new SynthError(`settings[${index}] is not an object.`);
    }
    if (typeof setting.configSettingType !== 'string' || setting.configSettingType.length === 0) {
      throw new SynthError(`settings[${index}] is missing a string \`configSettingType\`.`);
    }
    if (typeof setting.uniqueKey !== 'string' || setting.uniqueKey.length === 0) {
      throw new SynthError(`settings[${index}] is missing a string \`uniqueKey\`.`);
    }
  });

  return raw as unknown as QpqConfigFile;
};

/**
 * Resolve the synth context against the validated config. Enforces:
 * - `appName` setting present (matches `--app` if provided)
 * - `moduleName` setting present (matches `--module` if provided)
 * - `awsServiceAccountInfo` setting present with `deployAccountId` + `deployRegion`
 * - `--env` matches either the application's own environment or an
 *   `environmentSettings` entry
 */
export const resolveSynthContext = (
  config: QpqConfigFile,
  options: SynthOptions,
): ResolvedSynthContext => {
  const appSetting = findSetting(config.settings, APP_NAME_TYPE);
  if (!appSetting) {
    throw new SynthError(
      'Config is missing an application name. Use `defineApplication` in your QPQ config.',
    );
  }
  const applicationName = appSetting.applicationName;
  if (typeof applicationName !== 'string' || applicationName.length === 0) {
    throw new SynthError('Application name setting is missing a string `applicationName`.');
  }
  if (options.app !== undefined && options.app !== applicationName) {
    throw new SynthError(
      `--app "${options.app}" does not match the application name "${applicationName}" in the config.`,
    );
  }

  const moduleSetting = findSetting(config.settings, MODULE_NAME_TYPE);
  if (!moduleSetting) {
    throw new SynthError(
      'Config is missing a module name. Use `defineModule` in your QPQ config.',
    );
  }
  const moduleName = moduleSetting.moduleName;
  if (typeof moduleName !== 'string' || moduleName.length === 0) {
    throw new SynthError('Module name setting is missing a string `moduleName`.');
  }
  if (options.module !== undefined && options.module !== moduleName) {
    throw new SynthError(
      `--module "${options.module}" does not match the module name "${moduleName}" in the config.`,
    );
  }

  const accountSettings = findSettings(config.settings, AWS_SERVICE_ACCOUNT_INFO_TYPE);
  if (accountSettings.length === 0) {
    throw new SynthError(
      'Config is missing an AWS service account info entry. Use `defineAwsServiceAccountInfo`.',
    );
  }
  if (accountSettings.length > 1) {
    throw new SynthError(
      'Config has more than one `defineAwsServiceAccountInfo` entry; expected exactly one.',
    );
  }
  const accountSetting = accountSettings[0];
  const deployAccountId = accountSetting.deployAccountId;
  const deployRegion = accountSetting.deployRegion;
  if (typeof deployAccountId !== 'string' || deployAccountId.length === 0) {
    throw new SynthError(
      'AWS service account info setting is missing a string `deployAccountId`.',
    );
  }
  if (typeof deployRegion !== 'string' || deployRegion.length === 0) {
    throw new SynthError(
      'AWS service account info setting is missing a string `deployRegion`.',
    );
  }

  const appEnvironment = typeof appSetting.environment === 'string' ? appSetting.environment : undefined;
  const envSettingKeys = findSettings(config.settings, ENVIRONMENT_SETTINGS_TYPE).map(
    (s) => s.uniqueKey,
  );
  const knownEnvironments = new Set<string>(envSettingKeys);
  if (appEnvironment) {
    knownEnvironments.add(appEnvironment);
  }
  if (knownEnvironments.size > 0 && !knownEnvironments.has(options.env)) {
    const list = [...knownEnvironments].sort().join(', ');
    throw new SynthError(
      `--env "${options.env}" is not defined in the config. Known environments: ${list}.`,
    );
  }

  return {
    options,
    config,
    applicationName,
    moduleName,
    environment: options.env,
    deployAccountId,
    deployRegion,
  };
};
