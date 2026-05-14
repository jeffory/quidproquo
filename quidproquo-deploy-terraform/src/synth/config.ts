import * as fs from 'fs';
import { QPQConfigItem, QPQConfigSetting, qpqCoreUtils } from 'quidproquo-core';

export interface QpqRawConfigFile {
  qpqConfigVersion: number;
  exportedAt: string;
  settings: QPQConfigItem[];
}

export interface SynthContext {
  env: string;
  settings: QPQConfigSetting[];
}

export function loadRawConfig(configPath: string): QpqRawConfigFile {
  let content: string;
  try {
    content = fs.readFileSync(configPath, 'utf8');
  } catch {
    throw new Error(`Config file not found: ${configPath}\nRun config-dump to generate qpq.config.json first.`);
  }

  const parsed = JSON.parse(content) as QpqRawConfigFile;
  if (typeof parsed.qpqConfigVersion !== 'number' || !Array.isArray(parsed.settings)) {
    throw new Error(`Invalid qpq.config.json at ${configPath}: missing qpqConfigVersion or settings`);
  }

  return parsed;
}

export function resolveSynthContext(rawConfig: QpqRawConfigFile, requestedEnv: string): SynthContext {
  const knownEnvs = qpqCoreUtils.getDefinedEnvironments(rawConfig.settings);

  if (!knownEnvs.includes(requestedEnv)) {
    const known = knownEnvs.length > 0 ? knownEnvs.join(', ') : '(none defined)';
    throw new Error(`--env "${requestedEnv}" is not defined in the config. Known environments: ${known}.`);
  }

  const settings = qpqCoreUtils.flattenQpqConfig(rawConfig.settings, requestedEnv);

  return { env: requestedEnv, settings };
}
