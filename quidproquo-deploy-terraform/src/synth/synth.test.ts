import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SynthError } from './errors';
import { synth } from './synth';
import { SYNTH_STACK_NAMES } from './types';

const MIN_CONFIG = {
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
  ],
};

describe('synth', () => {
  let tmpDir: string;
  let configPath: string;
  let outDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qpq-synth-e2e-'));
    configPath = path.join(tmpDir, 'qpq.config.json');
    outDir = path.join(tmpDir, 'tf.out');
    await fs.writeFile(configPath, JSON.stringify(MIN_CONFIG));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates the per-env output directory and writes a manifest', async () => {
    const result = await synth({ configPath, outDir, env: 'dev' });

    const envDir = path.join(outDir, 'dev');
    expect(result.output.envDir).toBe(envDir);
    expect(result.output.manifestPath).toBe(path.join(envDir, 'qpq-synth.manifest.json'));

    const dirStat = await fs.stat(envDir);
    expect(dirStat.isDirectory()).toBe(true);

    const manifest = JSON.parse(await fs.readFile(result.output.manifestPath, 'utf-8'));
    expect(manifest).toMatchObject({
      qpqConfigVersion: 1,
      application: 'minimal-app',
      module: 'main',
      environment: 'dev',
      deployAccountId: '000000000000',
      deployRegion: 'us-east-1',
      settingsCount: MIN_CONFIG.settings.length,
      stacks: [...SYNTH_STACK_NAMES],
    });
    expect(typeof manifest.synthedAt).toBe('string');
  });

  it('creates the outDir recursively when missing', async () => {
    const deepOut = path.join(tmpDir, 'a', 'b', 'c');
    const result = await synth({ configPath, outDir: deepOut, env: 'dev' });
    const dirStat = await fs.stat(result.output.envDir);
    expect(dirStat.isDirectory()).toBe(true);
  });

  it('throws SynthError when the config file is missing', async () => {
    await expect(
      synth({ configPath: path.join(tmpDir, 'no.json'), outDir, env: 'dev' }),
    ).rejects.toThrow(SynthError);
  });

  it('throws SynthError when --app does not match', async () => {
    await expect(
      synth({ configPath, outDir, env: 'dev', app: 'wrong-app' }),
    ).rejects.toThrow(/--app "wrong-app" does not match/);
  });

  it('throws SynthError when --env is unknown', async () => {
    await expect(synth({ configPath, outDir, env: 'staging' })).rejects.toThrow(
      /--env "staging" is not defined/,
    );
  });
});
