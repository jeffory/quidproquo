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

/** Minimal config that includes a KVS and a queue so the pipeline generates .tf files. */
const CONFIG_WITH_RESOURCES = {
  ...MIN_CONFIG,
  settings: [
    ...MIN_CONFIG.settings,
    {
      configSettingType: '@quidproquo-core/config/KeyValueStore',
      uniqueKey: 'users',
      keyValueStoreName: 'users',
      partitionKey: { key: 'pk', type: 'string' },
      sortKeys: [],
      indexes: [],
    },
    {
      configSettingType: '@quidproquo-core/config/Queue',
      uniqueKey: 'jobs',
      queueName: 'jobs',
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

  it('returns empty stackPaths when all settings are translator-only', async () => {
    const result = await synth({ configPath, outDir, env: 'dev' });
    expect(result.output.stackPaths).toEqual({});
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

  describe('generator dispatch pipeline', () => {
    beforeEach(async () => {
      await fs.writeFile(configPath, JSON.stringify(CONFIG_WITH_RESOURCES));
    });

    it('writes inf.tf when a KeyValueStore resource is present', async () => {
      const result = await synth({ configPath, outDir, env: 'dev' });
      expect(result.output.stackPaths.inf).toBeDefined();
      const stat = await fs.stat(result.output.stackPaths.inf!);
      expect(stat.isFile()).toBe(true);
    });

    it('inf.tf contains a module block for the KVS resource', async () => {
      const result = await synth({ configPath, outDir, env: 'dev' });
      const content = await fs.readFile(result.output.stackPaths.inf!, 'utf-8');
      expect(content).toContain('module');
      expect(content).toContain('kvs');
      expect(content).toContain('source');
    });

    it('inf.tf contains a module block for the queue resource', async () => {
      const result = await synth({ configPath, outDir, env: 'dev' });
      const content = await fs.readFile(result.output.stackPaths.inf!, 'utf-8');
      expect(content).toContain('queue');
    });

    it('does not write .tf files for stacks with no resources', async () => {
      const result = await synth({ configPath, outDir, env: 'dev' });
      expect(result.output.stackPaths.bootstrap).toBeUndefined();
      expect(result.output.stackPaths.api).toBeUndefined();
      expect(result.output.stackPaths.web).toBeUndefined();
    });

    it('manifest includes generatedStacks listing only stacks with output', async () => {
      const result = await synth({ configPath, outDir, env: 'dev' });
      const manifest = JSON.parse(await fs.readFile(result.output.manifestPath, 'utf-8'));
      expect(manifest.generatedStacks).toEqual(expect.arrayContaining(['inf']));
      expect(manifest.generatedStacks).not.toContain('bootstrap');
      expect(manifest.generatedStacks).not.toContain('api');
      expect(manifest.generatedStacks).not.toContain('web');
    });
  });

  describe('unknown setting types', () => {
    it('skips unknown setting types with a warning and does not crash', async () => {
      const configWithUnknown = {
        ...MIN_CONFIG,
        settings: [
          ...MIN_CONFIG.settings,
          {
            configSettingType: '@quidproquo-custom/config/UnknownThing',
            uniqueKey: 'unknown-thing',
          },
        ],
      };
      await fs.writeFile(configPath, JSON.stringify(configWithUnknown));
      const result = await synth({ configPath, outDir, env: 'dev' });
      // Should complete without throwing; unknown type is warned and skipped
      expect(result.output.envDir).toBeDefined();
    });
  });
});
