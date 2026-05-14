import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { loadRawConfig, resolveSynthContext } from './config';

const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../examples/minimal-app/qpq.config.json',
);

describe('minimal-app fixture integration', () => {
  it('loads the minimal-app fixture without error', () => {
    const raw = loadRawConfig(FIXTURE_PATH);
    expect(raw.qpqConfigVersion).toBe(1);
  });

  it('synth --env prod succeeds on the minimal-app fixture', () => {
    const raw = loadRawConfig(FIXTURE_PATH);
    expect(() => resolveSynthContext(raw, 'prod')).not.toThrow();
    const ctx = resolveSynthContext(raw, 'prod');
    expect(ctx.env).toBe('prod');
  });

  it('synth --env staging fails cleanly on the minimal-app fixture', () => {
    const raw = loadRawConfig(FIXTURE_PATH);
    expect(() => resolveSynthContext(raw, 'staging')).toThrow(
      '--env "staging" is not defined in the config. Known environments: dev, prod.',
    );
  });
});
