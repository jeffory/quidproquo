import { runApply } from './commands/apply';
import { runDestroy } from './commands/destroy';
import { runPlan } from './commands/plan';
import { runSynth } from './commands/synth';

export const HELP_TEXT = `qpq-terraform <command> [options]

Commands:
  synth     Generate Terraform configuration from a QPQ JSON specification
  plan      (TODO) Run \`terraform plan\` against the generated configuration
  apply     (TODO) Run \`terraform apply\` against the generated configuration
  destroy   (TODO) Run \`terraform destroy\` against the generated configuration

Options:
  -h, --help     Show this help text
`;

export async function run(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;

  if (!command || command === '-h' || command === '--help' || command === 'help') {
    process.stdout.write(HELP_TEXT);
    return;
  }

  switch (command) {
    case 'synth':
      await runSynth(rest);
      return;
    case 'plan':
      await runPlan(rest);
      return;
    case 'apply':
      await runApply(rest);
      return;
    case 'destroy':
      await runDestroy(rest);
      return;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${HELP_TEXT}`);
      process.exit(1);
  }
}
