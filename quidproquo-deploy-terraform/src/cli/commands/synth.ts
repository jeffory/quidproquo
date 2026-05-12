import path from 'node:path';

import { parseSynthArgs, synth, SYNTH_HELP_TEXT, SynthError } from '../../synth';

/**
 * `qpq-terraform synth` entry point. Parses argv, runs the synth orchestrator,
 * and reports a one-line summary on success. On {@link SynthError}, writes the
 * message to stderr and sets `process.exitCode = 1` (the bin wrapper does the
 * actual exit).
 */
export async function runSynth(args: string[]): Promise<void> {
  let opts;
  try {
    opts = parseSynthArgs(args);
  } catch (err) {
    if (err instanceof SynthError) {
      process.stderr.write(`${err.message}\n\n${SYNTH_HELP_TEXT}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  if (opts.help) {
    process.stdout.write(SYNTH_HELP_TEXT);
    return;
  }

  try {
    const result = await synth(opts);
    process.stdout.write(
      `Synthed ${result.context.applicationName}/${result.context.moduleName} (${result.context.environment}) → ${path.relative(process.cwd(), result.output.envDir) || result.output.envDir}\n`,
    );
  } catch (err) {
    if (err instanceof SynthError) {
      process.stderr.write(`${err.message}\n`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}
