import { promises as fs } from 'node:fs';
import path from 'node:path';

import { runGeneratorPipeline, StackPaths } from './pipeline';
import { ResolvedSynthContext, SYNTH_STACK_NAMES } from './types';

/** Files written into `<outDir>/<env>` by the synth step. */
export interface SynthOutputPaths {
  envDir: string;
  manifestPath: string;
  /** Per-stack `.tf` file paths, keyed by stack name. Only stacks with output are present. */
  stackPaths: StackPaths;
}

/**
 * Creates the per-env directory, runs the generator dispatch pipeline to write
 * per-stack `.tf` files, and writes a manifest recording the outcome.
 */
export const createSynthOutputTree = async (
  context: ResolvedSynthContext,
): Promise<SynthOutputPaths> => {
  const absOutDir = path.resolve(context.options.outDir);
  const envDir = path.join(absOutDir, context.environment);
  await fs.mkdir(envDir, { recursive: true });

  const { stackPaths } = await runGeneratorPipeline(context, envDir);

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
    generatedStacks: Object.keys(stackPaths),
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

  return { envDir, manifestPath, stackPaths };
};
