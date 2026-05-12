import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SYNTH_HELP_TEXT } from '../../synth';
import { runSynth } from './synth';

const MIN_CONFIG = {
  qpqConfigVersion: 1,
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
  ],
};

describe('runSynth', () => {
  let tmpDir: string;
  let configPath: string;
  let outDir: string;
  let stdout: string[];
  let stderr: string[];
  let originalExitCode: number | string | undefined;

  beforeEach(async () => {
    originalExitCode = process.exitCode;
    process.exitCode = 0;
    stdout = [];
    stderr = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    });
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qpq-runsynth-'));
    configPath = path.join(tmpDir, 'qpq.config.json');
    outDir = path.join(tmpDir, 'tf.out');
    await fs.writeFile(configPath, JSON.stringify(MIN_CONFIG));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
    process.exitCode = originalExitCode;
  });

  it('prints help when --help is passed', async () => {
    await runSynth(['--help']);
    expect(stdout.join('')).toBe(SYNTH_HELP_TEXT);
    expect(process.exitCode).toBe(0);
  });

  it('synths successfully with valid options', async () => {
    await runSynth(['--config', configPath, '--outdir', outDir, '--env', 'dev']);
    expect(process.exitCode).toBe(0);
    expect(stdout.join('')).toContain('Synthed minimal-app/main (dev)');
    const dirStat = await fs.stat(path.join(outDir, 'dev'));
    expect(dirStat.isDirectory()).toBe(true);
  });

  it('sets a non-zero exit code on a parse error and prints help to stderr', async () => {
    await runSynth([]);
    expect(process.exitCode).toBe(1);
    expect(stderr.join('')).toContain('Missing required option(s)');
    expect(stderr.join('')).toContain('qpq-terraform synth');
  });

  it('sets a non-zero exit code on a validation error and prints the cause to stderr', async () => {
    await runSynth(['--config', configPath, '--outdir', outDir, '--env', 'staging']);
    expect(process.exitCode).toBe(1);
    expect(stderr.join('')).toContain('--env "staging" is not defined');
  });

  it('sets a non-zero exit code when the config file is missing', async () => {
    await runSynth(['--config', path.join(tmpDir, 'missing.json'), '--outdir', outDir, '--env', 'dev']);
    expect(process.exitCode).toBe(1);
    expect(stderr.join('')).toContain('Config file not found');
  });
});
