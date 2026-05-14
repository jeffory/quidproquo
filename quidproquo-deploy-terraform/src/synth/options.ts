import { parseArgs } from 'node:util';

import { SynthError } from './errors';
import { SynthOptions } from './types';

export const SYNTH_HELP_TEXT = `qpq-terraform synth [options]

Generate a Terraform configuration from a QPQ JSON specification.

Required options:
  --config <path>     Path to the QPQ config JSON (the file produced by
                      \`qpqCoreUtils.flattenQpqConfig\`).
  --outdir <path>     Directory the generated Terraform files are written under.
                      A per-environment subdirectory (\`<outdir>/<env>\`) is
                      created on synth.
  --env <name>        Environment to synthesise — must match an entry defined by
                      \`defineEnvironmentSettings\` (or the application's own
                      environment).

Optional options:
  --app <name>        Application name. If set, must match the value resolved
                      from the QPQ config; otherwise synth aborts.
  --module <name>     Module name. If set, must match the value resolved from
                      the QPQ config; otherwise synth aborts.
  --artifacts-dir <path>
                      Path to the pre-built Lambda artifact bundle directory.
                      When set, generators embed local \`source_code_path\`
                      values directly (useful for parity fixtures and local
                      development). When omitted, generators emit Terraform
                      \`variable\` blocks so callers supply artifact S3
                      coordinates at apply time.
  -h, --help          Show this help text.
`;

/** Either the parsed options or a `help` sentinel — the CLI prints help and exits. */
export type SynthArgsResult = { help: true } | ({ help: false } & SynthOptions);

/**
 * Parse a raw CLI arg vector. Throws {@link SynthError} on missing required
 * flags or unknown flags so the CLI layer can exit non-zero with a usage hint.
 */
export const parseSynthArgs = (args: string[]): SynthArgsResult => {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args,
      options: {
        config: { type: 'string' },
        outdir: { type: 'string' },
        env: { type: 'string' },
        app: { type: 'string' },
        module: { type: 'string' },
        'artifacts-dir': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: true,
      allowPositionals: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SynthError(`Invalid synth arguments: ${message}`);
  }

  const values = parsed.values as {
    config?: string;
    outdir?: string;
    env?: string;
    app?: string;
    module?: string;
    'artifacts-dir'?: string;
    help?: boolean;
  };

  if (values.help) {
    return { help: true };
  }

  const missing: string[] = [];
  if (!values.config) missing.push('--config');
  if (!values.outdir) missing.push('--outdir');
  if (!values.env) missing.push('--env');
  if (missing.length > 0) {
    throw new SynthError(`Missing required option(s): ${missing.join(', ')}`);
  }

  return {
    help: false,
    configPath: values.config as string,
    outDir: values.outdir as string,
    env: values.env as string,
    app: values.app,
    module: values.module,
    artifactsDir: values['artifacts-dir'],
  };
};
