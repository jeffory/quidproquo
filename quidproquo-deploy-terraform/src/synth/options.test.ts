import { describe, expect, it } from 'vitest';

import { SynthError } from './errors';
import { parseSynthArgs } from './options';

describe('parseSynthArgs', () => {
  it('returns the help sentinel when --help is passed', () => {
    expect(parseSynthArgs(['--help'])).toEqual({ help: true });
    expect(parseSynthArgs(['-h'])).toEqual({ help: true });
  });

  it('parses the full required and optional set', () => {
    const result = parseSynthArgs([
      '--config',
      './qpq.config.json',
      '--outdir',
      './tf.out',
      '--env',
      'dev',
      '--app',
      'minimal-app',
      '--module',
      'main',
    ]);
    expect(result).toEqual({
      help: false,
      configPath: './qpq.config.json',
      outDir: './tf.out',
      env: 'dev',
      app: 'minimal-app',
      module: 'main',
    });
  });

  it('leaves --app and --module unset when omitted', () => {
    const result = parseSynthArgs(['--config', 'c.json', '--outdir', 'out', '--env', 'dev']);
    expect(result).toMatchObject({ help: false, app: undefined, module: undefined });
  });

  it('throws when a required option is missing', () => {
    expect(() => parseSynthArgs(['--config', 'c.json', '--outdir', 'out'])).toThrowError(
      /Missing required option\(s\): --env/,
    );
  });

  it('lists every missing required option in a single message', () => {
    try {
      parseSynthArgs([]);
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SynthError);
      expect((err as Error).message).toContain('--config');
      expect((err as Error).message).toContain('--outdir');
      expect((err as Error).message).toContain('--env');
    }
  });

  it('rejects unknown options', () => {
    expect(() =>
      parseSynthArgs(['--config', 'c.json', '--outdir', 'o', '--env', 'dev', '--bogus', 'x']),
    ).toThrowError(SynthError);
  });

  it('rejects positional arguments', () => {
    expect(() =>
      parseSynthArgs(['--config', 'c.json', '--outdir', 'o', '--env', 'dev', 'positional']),
    ).toThrowError(SynthError);
  });
});
