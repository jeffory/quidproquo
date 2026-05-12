# quidproquo-deploy-terraform

The `quidproquo-deploy-terraform` package translates a QPQ deployment JSON
specification into a module-heavy Terraform configuration. It is the
Terraform counterpart to `quidproquo-deploy-awscdk` and is intended to give
DevOps a clean handoff point: application developers ship a QPQ JSON, this
package emits Terraform that calls reusable modules, and DevOps owns
compliance, security, and rollout from there.

## WARNING: NOT FOR PRODUCTION

This package is in the scaffolding stage. The `synth` subcommand loads and
validates a QPQ JSON config and writes the per-environment output directory,
but does not yet emit `.tf` files — those land in HOM-57 and friends.
`plan`, `apply`, and `destroy` currently exit with a `TODO`. Do not depend
on it for real deployments yet.

## CLI

After installing and building the workspace, the `qpq-terraform` binary
becomes available:

```
qpq-terraform <command> [options]

Commands:
  synth     Generate Terraform configuration from a QPQ JSON specification
  plan      (TODO) Run `terraform plan` against the generated configuration
  apply     (TODO) Run `terraform apply` against the generated configuration
  destroy   (TODO) Run `terraform destroy` against the generated configuration

Options:
  -h, --help     Show help
```

### `qpq-terraform synth`

```
qpq-terraform synth --config <path> --outdir <path> --env <name> [--app <name>] [--module <name>]
```

Reads the QPQ config JSON (the file produced by `qpqCoreUtils.flattenQpqConfig`),
validates its top-level shape, looks up the application/module name and AWS
account/region, and creates `<outdir>/<env>/` containing a
`qpq-synth.manifest.json` describing the resolved synth context. Returns a
non-zero exit code with a descriptive stderr message on any validation
failure.

## Programmatic API

The package also exports `run(argv)`, the same entry point the CLI binary
calls. Tests and embedding tools can drive the CLI without spawning a
subprocess:

```ts
import { run } from 'quidproquo-deploy-terraform';

await run(['--help']);
```
