# DevOps handoff & compliance overrides

This document is the contract between QPQ application teams and the DevOps /
platform team. It describes:

1. The `qpq.config.json` file that application teams hand over.
2. The Terraform module library that DevOps owns and versions.
3. How to add compliance controls (KMS, log retention, VPC endpoints, etc.)
   **without touching the generator or the application code**.
4. How to gate merges on `terraform plan`.
5. The drift detection / state reconciliation playbook.

Audience: a DevOps / platform engineer who has never seen QuidProQuo (QPQ)
before. You should be able to read this top-to-bottom and apply a compliance
change end-to-end without asking the app team for help.

> **Status:** This describes the target architecture being built out under
> the parent ticket *Document the Terraform translation layer steps*
> ([HOM-14]). The `quidproquo-deploy-terraform` package and `qpq-terraform-modules`
> library it points at are implemented across HOM-15…HOM-26. Wherever a step
> references a piece that is still in flight, this doc names the ticket and
> the intended shape, so the contract is stable even while the implementation
> lands.

---

## 1. The handoff in one picture

```
┌────────────────────────────┐        ┌──────────────────────────────┐
│  Application repo (app)    │        │  Platform repo (DevOps)      │
│                            │        │                              │
│  src/qpq.config.ts ───────►│  qpq.config.json  ───────────────────►│
│  (TypeScript, owned by app)│        │  (versioned artifact)        │
│                            │        │                              │
│                            │        │  qpq-terraform synth         │
│                            │        │     ├─ reads qpq.config.json │
│                            │        │     ├─ emits module calls    │
│                            │        │     └─ pins module library   │
│                            │        │                              │
│                            │        │  ./tf-modules/ (this repo,   │
│                            │        │     or qpq-terraform-modules │
│                            │        │     sourced via git ?ref=)   │
│                            │        │                              │
│                            │        │  terraform plan / apply      │
└────────────────────────────┘        └──────────────────────────────┘
```

The generator only emits `module "..."` calls plus `provider`, `backend`,
`variable`, and `output` blocks. **It never inlines provider resources.**
That is the lever that makes compliance changes possible without rebuilding
the app: every AWS resource is created inside a module body that DevOps owns.

---

## 2. `qpq.config.json` — the contract

### 2.1 What it is

`qpq.config.json` is the canonical, deterministically-ordered JSON artifact
produced by an application's QPQ config. It is the *only* thing the app
team needs to hand to DevOps. Everything in it is JSON-serialisable — no
functions, no classes, no symbols.

Produced by:

```bash
# in the app repo
npx qpq-config dump --env prod --out qpq.config.json
```

(See [HOM-17] for the dump/load implementation.)

### 2.2 Shape

Top-level keys:

| Key                 | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| `qpqConfigVersion`  | Integer schema version. **Bumped on breaking changes.**           |
| `name`              | App / stack name.                                                 |
| `environment`       | Logical environment (`dev`, `prod`, …).                           |
| `region`            | Primary AWS region for this env.                                  |
| `account`           | AWS account ID for this env.                                      |
| `settings`          | Array of typed settings — the resources the app needs.            |
| `environmentSettings` | Optional per-env overrides on top of `settings`.                |

A `setting` corresponds 1:1 with a module the DevOps library exposes. The
full list mirrors the existing AWS CDK feature constructs
(`quidproquo-deploy-awscdk/src/constructs/feature/`):

- **core**: `parameter`, `secret`, `kvs`, `storage-drive`, `queue`,
  `event-bus`, `schedule`, `user-directory`, `service-function`,
  `virtual-network`, `alarm`, `notify-error`, `graph-database`
- **webserver**: `api`, `websocket`, `web-entry`, `certificate`, `domain`,
  `dns`, `api-key`, `cache`, `redirect`, `domain-proxy`, `route`
- **aws-specific** (overrides only): `awsServiceAccountInfo`,
  `awsServiceAlarm`, `awsDynamoOverrideForKvs`

Example fragment:

```json
{
  "qpqConfigVersion": 1,
  "name": "federation-poc",
  "environment": "prod",
  "region": "ap-southeast-2",
  "account": "111122223333",
  "settings": [
    { "type": "kvs",              "name": "users",     "partitionKey": "id" },
    { "type": "storage-drive",    "name": "uploads"                          },
    { "type": "service-function", "name": "api-handler", "runtime": "nodejs20.x",
      "reads":  ["kvs:users"], "writes": ["storage-drive:uploads"] },
    { "type": "api",              "name": "public",
      "routes": [{ "path": "/users", "method": "GET", "function": "api-handler" }] }
  ]
}
```

### 2.3 Schema versioning

`qpqConfigVersion` is the load-bearing version field. The generator
(`qpq-terraform synth`) and the Terraform module library are both pinned to
a schema version. Mismatches fail fast at the loader with a clear message:

```
ERROR: qpq.config.json declares qpqConfigVersion=2,
       but quidproquo-deploy-terraform@1.4.0 supports versions 1.
       Upgrade the generator (or the app's QPQ deps) before continuing.
```

Compatibility rules:

- **Patch / minor bump of the generator** → schema version unchanged. Safe
  to upgrade in place.
- **Major bump of the generator** → schema version *may* bump. Read the
  changelog; the module library tag matching the new generator major is
  the one you upgrade to.
- **Schema version bump always implies a module library major bump**, so
  pin both together (see §3.3).

### 2.4 What is NOT in `qpq.config.json`

These are deliberately absent so DevOps owns them:

- KMS key choices (the modules pick / accept one).
- Log retention values (the modules default; DevOps overrides).
- VPC / subnet IDs (the `virtual-network` module owns those).
- IAM policy JSON (modules generate it from the `reads`/`writes` hints).
- Backend / state bucket configuration (DevOps-only, see §6).
- Provider credentials (env / OIDC / role-assumption — DevOps-only).

If you find yourself wanting any of these in the JSON, push back on the
app team: they belong in a module, in a `tfvars` file, or in a backend
config, **not** in the application contract.

---

## 3. The Terraform module library

### 3.1 Where it lives

Default layout: a sibling git repository, `qpq-terraform-modules`, with a
directory per module:

```
qpq-terraform-modules/
├── modules/
│   ├── parameter/
│   ├── secret/
│   ├── kvs/
│   ├── storage-drive/
│   ├── service-function/
│   ├── user-directory/
│   ├── virtual-network/
│   ├── queue/
│   ├── event-bus/
│   ├── schedule/
│   ├── alarm/
│   ├── notify-error/
│   ├── graph-database/
│   ├── api/
│   ├── websocket/
│   ├── web-entry/
│   ├── certificate/
│   ├── domain/
│   ├── dns/
│   ├── api-key/
│   ├── cache/
│   ├── redirect/
│   └── domain-proxy/
└── examples/
    └── <one example per module>
```

(Authored across [HOM-19], [HOM-20], [HOM-21].)

This repo is the **only** place DevOps writes Terraform that touches AWS
resources directly. The generator just emits calls into it.

### 3.2 How it's versioned

Git tags, semver: `v1.0.0`, `v1.1.0`, …

- **Patch** (`v1.0.0 → v1.0.1`): bug fix in a module body, no input/output
  change. Auto-roll on `terraform init -upgrade`.
- **Minor** (`v1.0.0 → v1.1.0`): new optional input, new module, additive
  output. Backwards-compatible. Roll forward at your cadence.
- **Major** (`v1.0.0 → v2.0.0`): removed input, removed module, renamed
  output, changed default that creates a destroy/recreate plan, or
  schema version bump. **Cut a per-env upgrade plan and read the
  changelog before merging.**

The CI for `qpq-terraform-modules` runs:

- `terraform fmt -check -recursive`
- `terraform validate` on every module's `examples/` invocation
- `tflint` with the repo's ruleset
- (optional) `terraform plan` against a sandbox account for breaking-change
  detection

### 3.3 Pinning a version

The generator writes pinned `source = "..."` lines for every `module`
block it emits. Default scheme: HTTPS git source with `?ref=<tag>`:

```hcl
module "users_kvs" {
  source = "git::https://github.com/yourorg/qpq-terraform-modules.git//modules/kvs?ref=v1.4.0"

  name          = "users"
  partition_key = "id"
}
```

You control the pinned tag with the generator config:

```bash
qpq-terraform synth \
  --config qpq.config.json \
  --module-source "git::https://github.com/yourorg/qpq-terraform-modules.git//modules/{name}?ref=v1.4.0" \
  --out .terraform-out/prod
```

Or set it once per env in the platform repo:

```toml
# .qpq-terraform/config.toml
[modules]
source_template = "git::https://github.com/yourorg/qpq-terraform-modules.git//modules/{name}?ref=v1.4.0"
```

**Always pin to a tag, never a branch.** A floating branch ref makes
`terraform init` non-deterministic and turns any push to the module repo
into a surprise change in every consumer.

---

## 4. Adding a compliance control — the playbook

This is the section to bookmark. Three flavours, ordered from preferred to
last-resort.

### 4.1 Preferred: change a module default

Use this for org-wide rules ("all S3 buckets must have versioning",
"all KMS must be customer-managed", "all Lambdas must log to the central
log group").

1. Open `qpq-terraform-modules/modules/<module>/`.
2. Change the default — e.g. flip `versioning_enabled` from optional to
   always-on, or set a new `kms_key_arn` default that points at the
   org's CMK.
3. Update the module's `README.md` so the default is documented.
4. Add or extend a `terraform plan`-based test in `examples/` proving
   the bucket comes out compliant.
5. Cut a minor (or major if it forces replacement) release.
6. Bump the pin in each consumer at a controlled cadence; run `plan`
   per env first.

The app team **does not need to do anything**. Their `qpq.config.json`
is unchanged.

### 4.2 Per-env override: `tfvars` and wrapper modules

Use this when a rule depends on the environment ("prod uses a separate
CMK", "prod retains logs 90 days, dev retains 7", "prod requires VPC
endpoints, dev does not").

Two options:

**(a) `terraform.tfvars` per env.** The generator writes a `terraform.tfvars`
file per environment using values from `environmentSettings`. DevOps adds
extra variables not present in `qpq.config.json` by editing the env's
tfvars file directly in the platform repo:

```hcl
# envs/prod/terraform.tfvars
log_retention_days = 90
kms_key_arn        = "arn:aws:kms:ap-southeast-2:111122223333:key/prod-cmk"
require_vpc_endpoints = true
```

These map onto module input variables already declared in the module
library. (See [HOM-24] for env handling.)

**(b) Wrapper module.** When the rule is structural — e.g. "every
service-function in prod must also have a CloudWatch metric filter and an
alarm wired to PagerDuty" — wrap the upstream module rather than fork it:

```hcl
# qpq-terraform-modules/modules/service-function-prod/main.tf
module "fn" {
  source = "../service-function"
  # pass through inputs
  name        = var.name
  runtime     = var.runtime
  handler     = var.handler
  # ...
  log_retention_days = 90
  kms_key_arn        = var.kms_key_arn
}

module "alarm" {
  source = "../alarm"
  name   = "${var.name}-errors"
  metric = "AWS/Lambda:Errors"
  dims   = { FunctionName = module.fn.function_name }
  sns_topic_arn = var.pagerduty_topic_arn
}

output "function_arn" { value = module.fn.function_arn }
```

Then point the generator at the wrapper for prod via the source template:

```toml
[modules]
source_template = "git::...//modules/{name}-prod?ref=v1.4.0"
```

Wrappers are the standard escape hatch when you need to compose, not
fork. Fork only as a true last resort (see §4.3).

### 4.3 Last resort: fork or replace a module

Only do this when neither (4.1) nor (4.2) work — typically because you
need a completely different AWS resource topology (e.g. swap DynamoDB for
DocumentDB). Forking is a real maintenance burden because you now have to
re-merge upstream fixes.

Workflow:

1. Copy the module into your platform repo, e.g.
   `tf-modules-local/kvs-docdb/`.
2. Update the generator's source template to point at the local copy
   for the affected module name only:

   ```toml
   [modules.overrides]
   kvs = "./tf-modules-local/kvs-docdb"
   ```

3. Document the fork (why, when, who owns reconciling upstream changes)
   in `tf-modules-local/README.md`.

### 4.4 What you must NEVER do

- **Edit files under `.terraform-out/`.** They are regenerated on every
  `synth` and your change will be wiped. Push the change up to the module
  body or a tfvars file.
- **Open a PR against the application repo to change infrastructure.**
  The contract is `qpq.config.json`; if you find yourself patching
  app-team code to fix a compliance issue, something is wrong with the
  module abstraction — file an issue against `qpq-terraform-modules`
  instead.
- **Pin to a branch instead of a tag.** See §3.3.

---

## 5. Gating merges on `terraform plan`

Every PR that changes either `qpq.config.json`, the module pin, or any
file in the platform repo should run a `plan` in CI and require it to
succeed.

### 5.1 The check

```bash
# in CI, against PR head
qpq-terraform synth   --config qpq.config.json --env prod --out .terraform-out/prod
cd .terraform-out/prod
terraform init -backend-config=../../envs/prod/backend.hcl
terraform plan -var-file=../../envs/prod/terraform.tfvars -out=tfplan -detailed-exitcode
```

`-detailed-exitcode` semantics:

| Exit | Meaning                       | CI action                              |
| ---- | ----------------------------- | -------------------------------------- |
| 0    | No changes                    | Pass.                                  |
| 1    | Error                         | Fail.                                  |
| 2    | Changes proposed              | Pass *and* post the plan summary on PR. |

### 5.2 Recommended additions

- **`terraform validate`** before `plan`: catches malformed HCL faster
  with a clearer message.
- **`tflint`** and **`checkov`** (or `tfsec`) on the rendered output:
  enforces org rules on the *generated* tree, not just the modules.
- **Plan artifact upload** so reviewers can pull it down with
  `terraform show tfplan` for line-by-line review.
- **`-refresh-only` plan** on a schedule (see §6.1) — different signal
  from the PR plan.

### 5.3 Approving plans with destroys

Any plan that contains a `destroy` action on a stateful resource (kvs,
storage-drive, secret, user-directory, graph-database) should require an
explicit "yes, I have a backup / migration plan" approval from a second
reviewer. Wire this with a CODEOWNERS rule on the platform repo or a
required-reviewer label.

---

## 6. Drift detection & state reconciliation

State drifts when AWS resources are changed outside Terraform — console
changes, other tools, manual incident response. The longer you wait, the
harder reconciliation gets.

### 6.1 Detecting drift

Run a refresh-only plan on a schedule, per env:

```bash
# scheduled CI job, daily
qpq-terraform synth --config qpq.config.json --env prod --out .terraform-out/prod
cd .terraform-out/prod
terraform init -backend-config=../../envs/prod/backend.hcl
terraform plan -refresh-only -var-file=../../envs/prod/terraform.tfvars -detailed-exitcode
```

Exit `2` on a refresh-only plan means **state drift**. The plan output
shows you which resources changed.

Alternatives / complements:

- **AWS Config** rules running in parallel — catches changes the AWS
  provider doesn't refresh (e.g. tag-only changes on some resources).
- **`terraform plan` (not refresh-only)** on schedule — catches drift
  *and* divergence between the committed code and the current modules
  if you don't pin to a tag (which you should, see §3.3).

### 6.2 Reconciling

Pick the answer that matches **the intended state of the world**:

| Situation                                                  | Action                                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| The drift was a mistake (console fix during an incident).  | `terraform apply` to revert; raise a follow-up to codify the fix.     |
| The drift is desired and should become permanent.          | Update the module/tfvars to match reality; `apply` to confirm 0 diff. |
| The drift introduced an unmanaged resource we want to keep.| `terraform import` it into the right module address.                  |
| The drift introduced an unmanaged resource we want gone.   | Delete it out-of-band, then re-run `plan` to confirm clean.           |
| The resource was deleted out-of-band and is needed.        | `terraform apply` will recreate it; verify data restore separately.   |
| The resource was deleted out-of-band and is no longer needed. | Remove it from the QPQ config (or module), re-synth, apply.        |

### 6.3 State storage hygiene

These belong to DevOps; the app team never sees them.

- **Backend**: remote state per env (e.g. one S3 bucket + key per env, or
  separate Terraform Cloud workspaces). Strongly prefer separate state
  files per env over Terraform workspaces — blast-radius and rotation
  are simpler.
- **Locking**: DynamoDB lock table for S3 backends; native locking for
  TFC.
- **Versioning & encryption**: S3 versioning on, SSE-KMS with a CMK,
  bucket policy restricted to the platform CI role.
- **Backup**: nightly S3 inventory + cross-region replication of the
  state bucket.
- **Recovery**: documented runbook for `terraform state pull` →
  edit → `terraform state push` (rare, last-resort) and for
  `terraform force-unlock` (after confirming no live apply).

### 6.4 When drift becomes an incident

If a drift means a security control was disabled (CMK rotated off,
public-access-block removed, log retention shortened):

1. Apply immediately to restore the control — do not wait for a code
   review on a known-good revert plan.
2. Open a post-incident ticket against `qpq-terraform-modules` if the
   control should have been undeletable (e.g. add a `prevent_destroy`
   lifecycle block, tighten an IAM permission).
3. Audit whether any other env has the same drift.

---

## 7. End-to-end: applying a real compliance change

Worked example — "all S3 buckets must enforce SSE-KMS with the org CMK and
block public access". Zero involvement from the app team.

1. **Module change** — open `qpq-terraform-modules`:

   ```hcl
   # modules/storage-drive/main.tf
   resource "aws_s3_bucket" "this" {
     bucket = var.name
   }

   resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
     bucket = aws_s3_bucket.this.id
     rule {
       apply_server_side_encryption_by_default {
         sse_algorithm     = "aws:kms"
         kms_master_key_id = var.kms_key_arn
       }
       bucket_key_enabled = true
     }
   }

   resource "aws_s3_bucket_public_access_block" "this" {
     bucket                  = aws_s3_bucket.this.id
     block_public_acls       = true
     block_public_policy     = true
     ignore_public_acls      = true
     restrict_public_buckets = true
   }
   ```

   ```hcl
   # modules/storage-drive/variables.tf
   variable "kms_key_arn" {
     type        = string
     description = "CMK used for SSE-KMS. Required."
   }
   ```

2. **Tag and release** — `git tag v1.5.0 && git push --tags`.

3. **Per-env input** — in the platform repo:

   ```hcl
   # envs/prod/terraform.tfvars
   kms_key_arn = "arn:aws:kms:ap-southeast-2:111122223333:key/prod-cmk"
   ```

4. **Pin the new module version**:

   ```toml
   # .qpq-terraform/config.toml
   [modules]
   source_template = "git::https://github.com/yourorg/qpq-terraform-modules.git//modules/{name}?ref=v1.5.0"
   ```

5. **Open a PR** with the pin bump + tfvars. CI runs:

   ```
   qpq-terraform synth …
   terraform init …
   terraform plan -detailed-exitcode …
   ```

   Plan is non-empty (expected) and shows SSE-KMS + public-access-block
   added on every storage-drive bucket. No `destroy` lines (expected).

6. **Merge & apply** — `terraform apply` from the platform CI's apply
   workflow. Verify the bucket policy in AWS console.

7. **Audit** — run the refresh-only plan on dev/staging, confirm parity.

At no point did anyone open the application repo.

---

## 8. Cheat sheet

```bash
# in the app repo (rarely)
npx qpq-config dump --env prod --out qpq.config.json

# in the platform repo (daily)
qpq-terraform synth   --config qpq.config.json --env prod --out .terraform-out/prod
cd .terraform-out/prod
terraform init   -backend-config=../../envs/prod/backend.hcl
terraform plan   -var-file=../../envs/prod/terraform.tfvars -out=tfplan
terraform apply  tfplan

# drift check (scheduled)
terraform plan -refresh-only -var-file=../../envs/prod/terraform.tfvars -detailed-exitcode
```

---

## 9. Ticket pointers

If something in this doc references a behaviour the codebase doesn't show
yet, it is being delivered under one of:

- [HOM-14] Parent: Document the Terraform translation layer
- [HOM-15] QPQ → Terraform contract & module boundary
- [HOM-16] `quidproquo-deploy-terraform` package + CLI
- [HOM-17] Stable JSON export/import for QPQ config
- [HOM-18] HCL emitter & module-call utility
- [HOM-19] Core modules
- [HOM-20] Async + observability modules
- [HOM-21] Webserver edge modules
- [HOM-22] Per-setting translators
- [HOM-23] Cross-resource wiring (IAM, ARNs, env vars)
- [HOM-24] Environment / account / region handling
- [HOM-25] Lambda artefact bundling + CLI commands
- [HOM-26] End-to-end conversion test

[HOM-14]: https://multica.io/issue/HOM-14
[HOM-15]: https://multica.io/issue/HOM-15
[HOM-16]: https://multica.io/issue/HOM-16
[HOM-17]: https://multica.io/issue/HOM-17
[HOM-18]: https://multica.io/issue/HOM-18
[HOM-19]: https://multica.io/issue/HOM-19
[HOM-20]: https://multica.io/issue/HOM-20
[HOM-21]: https://multica.io/issue/HOM-21
[HOM-22]: https://multica.io/issue/HOM-22
[HOM-23]: https://multica.io/issue/HOM-23
[HOM-24]: https://multica.io/issue/HOM-24
[HOM-25]: https://multica.io/issue/HOM-25
[HOM-26]: https://multica.io/issue/HOM-26
