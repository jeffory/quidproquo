import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  loadQpqConfigFile,
  resolveSynthContext,
  validateQpqConfigFile,
} from './config';
import { SynthError } from './errors';
import { QpqConfigFile, SynthOptions } from './types';

const baseConfig = (): QpqConfigFile => ({
  qpqConfigVersion: 1,
  exportedAt: '2026-05-13T00:00:00Z',
  settings: [
    {
      configSettingType: '@quidproquo-core/config/AppName',
      uniqueKey: 'minimal-app',
      applicationName: 'minimal-app',
      configRoot: '/tmp/minimal-app',
      environment: 'dev',
    },
    {
      configSettingType: '@quidproquo-core/config/moduleName',
      uniqueKey: 'main',
      moduleName: 'main',
    },
    {
      configSettingType: '@quidproquo-aws/config/AwsServiceAccountInfo',
      uniqueKey: 'AwsServiceAccountInfo',
      deployAccountId: '000000000000',
      deployRegion: 'us-east-1',
    },
    {
      configSettingType: '@quidproquo-core/config/EnvironmentSettings',
      uniqueKey: 'dev',
    },
    {
      configSettingType: '@quidproquo-core/config/EnvironmentSettings',
      uniqueKey: 'prod',
    },
  ],
});

const baseOptions = (overrides: Partial<SynthOptions> = {}): SynthOptions => ({
  configPath: 'unused-in-tests.json',
  outDir: '/tmp/unused',
  env: 'dev',
  ...overrides,
});

describe('loadQpqConfigFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qpq-synth-load-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('parses a valid JSON file', async () => {
    const file = path.join(tmpDir, 'config.json');
    await fs.writeFile(file, JSON.stringify({ qpqConfigVersion: 1, settings: [] }));
    const parsed = await loadQpqConfigFile(file);
    expect(parsed).toEqual({ qpqConfigVersion: 1, settings: [] });
  });

  it('throws SynthError when the file is missing', async () => {
    await expect(loadQpqConfigFile(path.join(tmpDir, 'missing.json'))).rejects.toThrow(
      /Config file not found/,
    );
  });

  it('throws SynthError when the file is not JSON', async () => {
    const file = path.join(tmpDir, 'bad.json');
    await fs.writeFile(file, '{ not json');
    await expect(loadQpqConfigFile(file)).rejects.toThrow(/not valid JSON/);
  });
});

describe('validateQpqConfigFile', () => {
  it('accepts a well-formed config', () => {
    const cfg = baseConfig();
    expect(validateQpqConfigFile(cfg)).toBe(cfg);
  });

  it.each([
    ['null', null],
    ['array', []],
    ['number', 42],
    ['string', 'config'],
  ])('rejects a top-level %s', (_label, value) => {
    expect(() => validateQpqConfigFile(value)).toThrow(/JSON object at the top level/);
  });

  it('rejects a missing qpqConfigVersion', () => {
    expect(() => validateQpqConfigFile({ settings: [] })).toThrow(/qpqConfigVersion/);
  });

  it('rejects an unsupported qpqConfigVersion', () => {
    expect(() => validateQpqConfigFile({ qpqConfigVersion: 99, settings: [] })).toThrow(
      /Unsupported qpqConfigVersion 99/,
    );
  });

  it('rejects a missing settings array', () => {
    expect(() => validateQpqConfigFile({ qpqConfigVersion: 1 })).toThrow(/`settings` array/);
  });

  it('rejects a setting without configSettingType', () => {
    expect(() =>
      validateQpqConfigFile({
        qpqConfigVersion: 1,
        settings: [{ uniqueKey: 'x' }],
      }),
    ).toThrow(/settings\[0\] is missing a string `configSettingType`/);
  });

  it('rejects a setting without uniqueKey', () => {
    expect(() =>
      validateQpqConfigFile({
        qpqConfigVersion: 1,
        settings: [{ configSettingType: 'x' }],
      }),
    ).toThrow(/settings\[0\] is missing a string `uniqueKey`/);
  });
});

describe('resolveSynthContext', () => {
  it('resolves application, module, account and region', () => {
    const context = resolveSynthContext(baseConfig(), baseOptions());
    expect(context.applicationName).toBe('minimal-app');
    expect(context.moduleName).toBe('main');
    expect(context.environment).toBe('dev');
    expect(context.deployAccountId).toBe('000000000000');
    expect(context.deployRegion).toBe('us-east-1');
  });

  it('passes when --app and --module match the config', () => {
    const context = resolveSynthContext(
      baseConfig(),
      baseOptions({ app: 'minimal-app', module: 'main' }),
    );
    expect(context.applicationName).toBe('minimal-app');
    expect(context.moduleName).toBe('main');
  });

  it('throws when --app disagrees with the config', () => {
    expect(() => resolveSynthContext(baseConfig(), baseOptions({ app: 'other-app' }))).toThrow(
      /--app "other-app" does not match/,
    );
  });

  it('throws when --module disagrees with the config', () => {
    expect(() => resolveSynthContext(baseConfig(), baseOptions({ module: 'other' }))).toThrow(
      /--module "other" does not match/,
    );
  });

  it('throws when the app name setting is missing', () => {
    const cfg = baseConfig();
    cfg.settings = cfg.settings.filter(
      (s) => s.configSettingType !== '@quidproquo-core/config/AppName',
    );
    expect(() => resolveSynthContext(cfg, baseOptions())).toThrow(/application name/);
  });

  it('throws when the module name setting is missing', () => {
    const cfg = baseConfig();
    cfg.settings = cfg.settings.filter(
      (s) => s.configSettingType !== '@quidproquo-core/config/moduleName',
    );
    expect(() => resolveSynthContext(cfg, baseOptions())).toThrow(/module name/);
  });

  it('throws when the AWS service account info setting is missing', () => {
    const cfg = baseConfig();
    cfg.settings = cfg.settings.filter(
      (s) => s.configSettingType !== '@quidproquo-aws/config/AwsServiceAccountInfo',
    );
    expect(() => resolveSynthContext(cfg, baseOptions())).toThrow(/AWS service account info/);
  });

  it('throws when more than one AWS service account info setting is present', () => {
    const cfg = baseConfig();
    cfg.settings.push({
      configSettingType: '@quidproquo-aws/config/AwsServiceAccountInfo',
      uniqueKey: 'AwsServiceAccountInfo',
      deployAccountId: '111111111111',
      deployRegion: 'eu-west-1',
    });
    expect(() => resolveSynthContext(cfg, baseOptions())).toThrow(/more than one/);
  });

  it('throws when the AWS service account info is missing deployAccountId', () => {
    const cfg = baseConfig();
    const account = cfg.settings.find(
      (s) => s.configSettingType === '@quidproquo-aws/config/AwsServiceAccountInfo',
    );
    if (account) delete (account as Record<string, unknown>).deployAccountId;
    expect(() => resolveSynthContext(cfg, baseOptions())).toThrow(/deployAccountId/);
  });

  it('throws when --env is not in environmentSettings nor the app environment', () => {
    expect(() => resolveSynthContext(baseConfig(), baseOptions({ env: 'staging' }))).toThrow(
      /--env "staging" is not defined.*dev.*prod/,
    );
  });

  it('accepts --env that matches only the app-level environment', () => {
    const cfg = baseConfig();
    cfg.settings = cfg.settings.filter(
      (s) => s.configSettingType !== '@quidproquo-core/config/EnvironmentSettings',
    );
    const context = resolveSynthContext(cfg, baseOptions({ env: 'dev' }));
    expect(context.environment).toBe('dev');
  });

  it('throws as a SynthError (not a generic Error)', () => {
    try {
      resolveSynthContext(baseConfig(), baseOptions({ app: 'other' }));
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SynthError);
    }
  });
});
