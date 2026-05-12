import { afterEach, describe, expect, it, vi } from 'vitest';

import { HELP_TEXT, run } from './index';

describe('quidproquo-deploy-terraform', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes a CLI runner', () => {
    expect(typeof run).toBe('function');
  });

  it('prints help when invoked with --help', async () => {
    const writes: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    await run(['--help']);

    expect(writes.join('')).toBe(HELP_TEXT);
  });

  it('prints help when invoked with no arguments', async () => {
    const writes: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    await run([]);

    expect(writes.join('')).toContain('qpq-terraform <command>');
  });
});
