import { loadQpqConfigFile, resolveSynthContext, validateQpqConfigFile } from './config';
import { createSynthOutputTree, SynthOutputPaths } from './output';
import { ResolvedSynthContext, SynthOptions } from './types';

export interface SynthResult {
  context: ResolvedSynthContext;
  output: SynthOutputPaths;
}

/**
 * End-to-end synth orchestrator. Loads + validates the QPQ config, resolves
 * the synth context, and writes the output directory tree. Throws
 * {@link SynthError} on any user-correctable failure.
 */
export const synth = async (options: SynthOptions): Promise<SynthResult> => {
  const raw = await loadQpqConfigFile(options.configPath);
  const config = validateQpqConfigFile(raw);
  const context = resolveSynthContext(config, options);
  const output = await createSynthOutputTree(context);
  return { context, output };
};
