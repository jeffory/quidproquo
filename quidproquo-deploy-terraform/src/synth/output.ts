import { promises as fs } from 'node:fs';
import path from 'node:path';

import { ResolvedSynthContext, SYNTH_STACK_NAMES } from './types';

/** Files written into `<outDir>/<env>` by the synth step. */
export interface SynthOutputPaths {
  envDir: string;
  manifestPath: string;
}

/**
 * Skeleton output: creates the per-env directory and writes a manifest. The
 * actual stack `.tf` files are emitted by the downstream tickets (HOM-57+);
 * the manifest documents what those files will be so users and tooling can
 * observe progress.
 */
export const createSynthOutputTree = async (
  context: ResolvedSynthContext,
): Promise<SynthOutputPaths> => {
  const absOutDir = path.resolve(context.options.outDir);
  const envDir = path.join(absOutDir, context.environment);
  await fs.mkdir(envDir, { recursive: true });

  const manifestPath = path.join(envDir, 'qpq-synth.manifest.json');
  const manifest = {
    qpqConfigVersion: context.config.qpqConfigVersion,
    synthedAt: new Date().toISOString(),
    application: context.applicationName,
    module: context.moduleName,
    environment: context.environment,
    deployAccountId: context.deployAccountId,
    deployRegion: context.deployRegion,
    settingsCount: context.config.settings.length,
    stacks: SYNTH_STACK_NAMES,
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

  return { envDir, manifestPath };
};
