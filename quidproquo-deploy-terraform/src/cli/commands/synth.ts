import * as fs from 'fs';
import * as path from 'path';
import { loadRawConfig, resolveSynthContext } from '../../synth/config';

function parseArgs(args: string[]): { env?: string; config?: string; out?: string } {
  const result: { env?: string; config?: string; out?: string } = {};
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--env' || args[i] === '-e') && i + 1 < args.length) {
      result.env = args[++i];
    } else if (args[i] === '--config' && i + 1 < args.length) {
      result.config = args[++i];
    } else if (args[i] === '--out' && i + 1 < args.length) {
      result.out = args[++i];
    }
  }
  return result;
}

export async function runSynth(args: string[]): Promise<void> {
  const { env, config: configArg, out: outArg } = parseArgs(args);

  if (!env) {
    process.stderr.write('qpq-terraform synth: --env <environment> is required\n');
    process.stderr.write('Usage: qpq-terraform synth --env <env> [--config <path>] [--out <dir>]\n');
    process.exit(1);
  }

  const configPath = configArg ?? path.join(process.cwd(), 'qpq.config.json');

  let rawConfig;
  try {
    rawConfig = loadRawConfig(configPath);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  }

  let context;
  try {
    context = resolveSynthContext(rawConfig, env);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  }

  const outDir = path.resolve(outArg ?? path.join(path.dirname(configPath), 'out', env));
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = {
    env,
    settingCount: context.settings.length,
    generatedAt: new Date().toISOString(),
    stacks: ['bootstrap', 'inf', 'api', 'web'],
  };

  fs.writeFileSync(path.join(outDir, 'qpq-synth.manifest.json'), JSON.stringify(manifest, null, 2));

  process.stdout.write(
    `qpq-terraform synth: synthesised env "${env}" → ${outDir} (${context.settings.length} settings)\n`,
  );
  // TODO: HOM-99 — generator dispatch pipeline writes bootstrap.tf, inf.tf, api.tf, web.tf here
}
