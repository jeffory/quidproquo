import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadRawConfig, resolveSynthContext, QpqRawConfigFile } from './config';

const MINIMAL_APP_CONFIG: QpqRawConfigFile = {
  qpqConfigVersion: 1,
  exportedAt: '2026-05-14T00:00:00.000Z',
  settings: [
    {
      configSettingType: '@quidproquo-core/config/AppName',
      uniqueKey: 'minimal-app',
      applicationName: 'minimal-app',
      configRoot: '/config',
      environment: 'dev',
    } as any,
    {
      configSettingType: '@quidproquo-core/config/moduleName',
      uniqueKey: 'core',
      moduleName: 'core',
    } as any,
    {
      configSettingType: '@quidproquo-core/config/EnvironmentSettings',
      uniqueKey: 'dev',
      environment: 'dev',
      settings: [],
    } as any,
    {
      configSettingType: '@quidproquo-core/config/EnvironmentSettings',
      uniqueKey: 'prod',
      environment: 'prod',
      settings: [],
    } as any,
  ],
};

describe('resolveSynthContext', () => {
  it('accepts a valid env (prod) defined in the config', () => {
    const ctx = resolveSynthContext(MINIMAL_APP_CONFIG, 'prod');
    expect(ctx.env).toBe('prod');
    expect(Array.isArray(ctx.settings)).toBe(true);
  });

  it('accepts a valid env (dev) defined in the config', () => {
    const ctx = resolveSynthContext(MINIMAL_APP_CONFIG, 'dev');
    expect(ctx.env).toBe('dev');
  });

  it('rejects an env not defined in the config', () => {
    expect(() => resolveSynthContext(MINIMAL_APP_CONFIG, 'staging')).toThrow(
      '--env "staging" is not defined in the config. Known environments: dev, prod.',
    );
  });

  it('error message lists all known environments', () => {
    expect(() => resolveSynthContext(MINIMAL_APP_CONFIG, 'staging')).toThrow(/Known environments: dev, prod/);
  });

  it('does not include EnvironmentSettings entries in the flattened settings', () => {
    const ctx = resolveSynthContext(MINIMAL_APP_CONFIG, 'prod');
    const envSettingsTypes = ctx.settings.filter(
      (s) => s.configSettingType === '@quidproquo-core/config/EnvironmentSettings',
    );
    expect(envSettingsTypes).toHaveLength(0);
  });
});

describe('loadRawConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpq-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads and parses a valid config file', () => {
    const configPath = path.join(tmpDir, 'qpq.config.json');
    fs.writeFileSync(configPath, JSON.stringify(MINIMAL_APP_CONFIG));
    const result = loadRawConfig(configPath);
    expect(result.qpqConfigVersion).toBe(1);
    expect(Array.isArray(result.settings)).toBe(true);
  });

  it('throws when the file does not exist', () => {
    const missingPath = path.join(tmpDir, 'missing.json');
    expect(() => loadRawConfig(missingPath)).toThrow(/Config file not found/);
  });

  it('throws on a config file missing required fields', () => {
    const configPath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(configPath, JSON.stringify({ wrong: true }));
    expect(() => loadRawConfig(configPath)).toThrow(/Invalid qpq.config.json/);
  });
});
