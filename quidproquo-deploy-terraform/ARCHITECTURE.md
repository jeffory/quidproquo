# quidproquo-deploy-terraform — Architecture

Status: design gate for the QPQ → Terraform translation layer. This document defines the contract between QPQ application config and the DevOps-owned Terraform module library, and the boundary that keeps compliance/security changes out of the application build path. It is the gating artefact for [HOM-15](mention://issue/76565db7-4781-438f-840d-6179f3a39731); no code in this package should land before this document is reviewed.

---

## 1. Goal and shape of the system

QPQ today carries two responsibilities in one repo:

1. **Application config** — TypeScript `defineX(...)` calls that describe what infrastructure the app needs (KVS tables, queues, APIs, Lambdas, etc.).
2. **Infrastructure code** — `quidproquo-deploy-awscdk` walks that config and synthesises a CDK app that creates raw AWS resources (Dynamo tables, S3 buckets, Lambda functions, IAM policies, …).

Mixing these two means every compliance or security change (KMS, log retention, VPC endpoints, IAM baselines) requires a coordinated change in application code and a redeploy by an app team. That coupling is what this package is built to remove.

The Terraform translation layer flips the ownership:

```
+-----------------------+     +----------------------+     +--------------------------+     +-------------------+
|  TypeScript QPQ       |     |  qpq.config.json     |     |  qpq-terraform           |     |  *.tf files       |
|  defineX(...) calls   | --> |  (canonical export   | --> |  translator              | --> |  (only `module {}`|
|  (app teams own)      |     |   produced by app)   |     |  (QPQ-team owned)        |     |   + provider/     |
+-----------------------+     +----------------------+     +--------------------------+     |   backend + tfvars)|
                                                                                            +---------+---------+
                                                                                                      |
                                                                                                      v
                                                                                          +-----------------------+
                                                                                          |  Terraform module     |
                                                                                          |  library (DevOps own) |
                                                                                          |  pinned via ?ref=vX   |
                                                                                          +-----------+-----------+
                                                                                                      |
                                                                                                      v
                                                                                          +-----------------------+
                                                                                          |  Raw AWS resources    |
                                                                                          |  (Dynamo, S3, Lambda, |
                                                                                          |   IAM, ACM, ...)      |
                                                                                          +-----------------------+
```

**The hard rule that drives everything else**: the generator emits only `module "..."` calls plus the surrounding `provider`/`backend`/`variable`/`output` glue. It MUST NOT emit raw `aws_*` resource blocks, raw IAM policy documents, or any compliance-controlled configuration. Anything that compliance or security would want to change without an app rebuild lives inside a module body, in a DevOps-owned repository, behind a semver tag.

The 1-page interface diagram for that contract is:

```
+---------------------------+        emits        +-----------------------------+
| qpq-terraform synth       | ------------------> | <out>/<env>/main.tf         |
| (this package)            |                     |   terraform {               |
|                           |                     |     backend "s3" {...}      |
| Inputs:                   |                     |   }                         |
|  - qpq.config.json        |                     |   provider "aws" {...}      |
|  - artefacts/             |                     |   module "kvs_users" {      |
|    (Lambda zips, hashes)  |                     |     source  = "git::...?ref=v1.2.3"
|                           |                     |     name    = "..."         |
| Outputs:                  |                     |     ...module inputs...     |
|  - HCL files (per env)    |                     |   }                         |
|  - per-env .tfvars        |                     |   module "fn_login" { ... } |
|  - artefact references    |                     |   ... one module per setting ...
+---------------------------+                     +-----------------------------+
                                                                |
                                                                | terraform init / plan / apply
                                                                v
                                                  +-----------------------------+
                                                  | DevOps module library       |
                                                  | (separate repo, semver)     |
                                                  |  modules/                   |
                                                  |   kvs/                      |
                                                  |   storage-drive/            |
                                                  |   service-function/         |
                                                  |   ... etc                   |
                                                  +-----------------------------+
```

---

## 2. The contract: `qpq.config.json`

`qpq.config.json` is the only thing QPQ application teams hand off. It is a versioned, deterministically-ordered, fully JSON-serialisable dump of the runtime QPQ config tree (`QPQConfig` in `quidproquo-core`). Read by `qpq-terraform` and validated against a schema before any code is emitted.

### 2.1 Top-level shape

```jsonc
{
  "qpqConfigVersion": 1,                  // schema version; bump on breaking changes
  "exportedAt": "2026-05-12T11:21:45Z",   // for traceability only
  "settings": [ /* QPQConfigSetting[] */ ] // the flattened, ordered setting list
}
```

`settings` is the flattened, ordered output of the same recursion `qpqCoreUtils` already does over the nested `QPQConfig` tree — every entry is a `QPQConfigSetting` (has `configSettingType`, `uniqueKey`, optional `owner`).

Determinism: settings are sorted by `(configSettingType, uniqueKey)` after the flatten step. Two builds of the same source must produce byte-identical JSON.

### 2.2 Serialisability

QPQ settings are JSON-safe today except in one place: `QpqFunctionRuntime`. Two shapes exist (see `quidproquo-core/src/types/QpqFunctionRuntime.ts`):

- Relative: `` `/${string}::${string}` `` — already a string, JSON-safe.
- Absolute: `{ basePath, relativePath, functionName }` — already a plain object, JSON-safe.

Neither carries a function value, class instance, or `Symbol`. The audit task in [HOM-17](mention://issue/afb82244-db9e-468d-ab3d-b52a754a339d) must confirm no setting type leaks any of those before the schema is frozen.

### 2.3 Setting type → Terraform module map

This map is the contract. Every entry below is a setting type currently emitted by `quidproquo-core`, `quidproquo-config-aws`, or `quidproquo-webserver`, with the Terraform module it translates to and the CDK feature construct it must reach parity with.

#### Core (`quidproquo-core/src/config/QPQConfig.ts` — `QPQCoreConfigSettingType`)

| `configSettingType` enum | Module called by generator | CDK parity construct |
|---|---|---|
| `parameter` | `parameter` | `feature/core/parameter` |
| `secret` | `secret` | `feature/core/secret` |
| `keyValueStore` | `kvs` | `feature/core/keyValueStore` |
| `storageDrive` | `storage-drive` | `feature/core/storageDrive` |
| `queue` | `queue` | `feature/core/queue` |
| `eventBus` | `event-bus` | `feature/core/eventBus` |
| `schedule` | `schedule` | `feature/core/schedule` |
| `userDirectory` | `user-directory` | `feature/core/auth` |
| `graphDatabase` | `graph-database` | `feature/core/graphDatabase` |
| `virtualNetwork` | `virtual-network` | `feature/core/virtualNetwork` |
| `notifyError` | `notify-error` | `feature/core/notifyError` |
| `inlineFunction` | `service-function` (with `inline=true`) | (covered by Function basic + serviceFunction) |
| `ai` / `claudeAi` | passed as `service-function` env vars | (consumed at runtime, no AWS resource) |
| `global` | env vars on every `service-function` | (consumed at runtime) |
| `appName` / `moduleName` | naming inputs only — see §3 | (consumed at runtime) |
| `apiBuildPath` | translator-only (artefact lookup) | (consumed at synth time) |
| `actionProcessors` | translator-only (runtime config) | (consumed at runtime) |
| `configValue` | env vars on every `service-function` | (consumed at runtime) |
| `deployEvent` | `deploy-event` (or folded into module hooks) | `feature/core/deployEvents` |
| `environmentSettings` | **not a module** — see §4 | (drives provider/backend selection) |

#### AWS-specific (`quidproquo-config-aws/src/config/QPQConfig.ts` — `QPQAwsConfigSettingType`)

| `configSettingType` enum | Module called by generator | Notes |
|---|---|---|
| `awsServiceAccountInfo` | translator-only — drives `provider "aws"` | account id + region per env |
| `awsServiceAlarm` | `alarm` | `feature/core/alarm` (CDK) and `feature/config/alarm` |
| `awsDyanmoOverrideForKvs` | translator-only — folds into `kvs` module inputs | controls table-name override |
| `bootstrapAwsOrganization` | translator-only — only emitted into the bootstrap stack | account/OU bootstrap |

The three "translator-only" entries do not produce a `module` call of their own; they are consumed by the translator and feed into the inputs of other module calls (or into the `provider`/`backend` blocks).

#### Webserver (`quidproquo-webserver/src/config/QPQConfig.ts` — `QPQWebServerConfigSettingType`)

| `configSettingType` enum | Module called by generator | CDK parity construct |
|---|---|---|
| `Api` | `api` | `feature/webserver/api` |
| `Route` | folded into `api` module inputs (`routes = [...]`) | (consumed by api) |
| `DefaultRouteOptions` | folded into `api` module inputs | (consumed by api) |
| `WebSocket` | `websocket` | `feature/webserver/websocket` |
| `WebEntry` | `web-entry` | `feature/webserver/webEntry` |
| `Certificate` | `certificate` | `feature/webserver/certificate` |
| `Dns` | `dns` | (currently inside webEntry/certificate constructs) |
| `Domain` (implicit in webEntry/api) | `domain` | `feature/webserver/serviceFunction/ServiceDomain` |
| `DomainProxy` | `domain-proxy` | `feature/webserver/domainProxy` |
| `ApiKey` | `api-key` | `feature/webserver/apiKey` |
| `Cache` | `cache` | `feature/webserver/cache` |
| `SubdomainRedirect` | `redirect` | `feature/webserver/redirect` |
| `ServiceFunction` | `service-function` | `feature/webserver/serviceFunction` |
| `OpenApi` | folded into `api` module inputs | (consumed by api) |
| `Seo` | folded into `web-entry` module inputs | (consumed by webEntry) |

> **Decision**: `Dns` and `Domain` get their own modules in the new layout rather than being buried inside `web-entry`/`certificate`. CDK collapses them today because IConstruct trees naturally share scope; Terraform modules don't, so splitting up-front prevents a single `web-entry` module from growing into a god-module.

### 2.4 Setting types that are NOT modules

Some settings are consumed entirely by the translator and never become a `module` call:

- `appName`, `moduleName`, `apiBuildPath`, `actionProcessors`, `environmentSettings`, `awsServiceAccountInfo`, `awsDyanmoOverrideForKvs`, `bootstrapAwsOrganization`, `defaultRouteOptions`, `openApi`, `seo`.

These flow into the `provider`/`backend` blocks, the per-env `.tfvars`, or as input arguments on other module calls. Calling them out explicitly here so the parity audit in [HOM-26](mention://issue/9782a069-7ada-4818-979f-739a206a79ef) doesn't flag them as missing.

---

## 3. Naming conventions for generated resources

QPQ already has a naming convention that we mirror exactly — both for parity with CDK-deployed stacks (so blue/green migration is possible) and because the existing runtime processors look up resources by these names.

Reference: `quidproquo-actionprocessor-awslambda/src/awsNamingUtils.ts`.

### 3.1 The pattern

```
<resourceName>-<application>-<module>-<environment>[-<feature>][-qpq<resourceType>]
```

Where:

- `application` — `qpqCoreUtils.getApplicationName(qpqConfig)` (`appName` setting).
- `module` — `qpqCoreUtils.getApplicationModuleName(qpqConfig)` (`moduleName` setting).
- `environment` — `qpqCoreUtils.getApplicationModuleEnvironment(qpqConfig)` (resolved from `environmentSettings`).
- `feature` — optional, from the active `feature` flag.
- `qpq<resourceType>` — a suffix marking the AWS resource kind (e.g. `kvs`, `s3`, `sfunc`, `sns-topic-arn-export`). Only present on resources that need to be disambiguated when several QPQ types map onto the same physical resource.

### 3.2 Cross-module owner overrides

A `QPQConfigSetting` can carry an `owner: CrossModuleOwner` which overrides `application`/`module`/`environment`/`feature` and/or the resource name itself. The translator MUST respect these (`resolveConfigRuntimeResourceNameFromConfig` in `awsNamingUtils.ts` is the canonical resolver). This is how shared resources (e.g. a KVS owned by service A consumed by service B) keep a stable name.

### 3.3 Terraform-side identifiers

Two distinct identifiers per resource:

1. **Module instance label** (the `module "<label>"` name in HCL). Use `<settingType>_<uniqueKey>` lower-snake-cased — e.g. `module "kvs_users"`, `module "service_function_login_handler"`. This is purely a label inside the Terraform graph; it never reaches AWS. It MUST be stable: changing it triggers a resource replacement.
2. **AWS resource name** (passed as an input to the module, e.g. `name = "users-myapp-auth-dev-qpqkvs"`). This is the runtime-visible name and follows §3.1 exactly.

### 3.4 Stack split

CDK splits a deploy into four stacks today (`BootstrapQpqServiceStack`, `InfQpqServiceStack`, `ApiQpqServiceStack`, `WebQpqServiceStack`). The translator mirrors that by emitting four root files per environment:

```
<out>/<env>/
  bootstrap.tf   # account-level, region-level pre-reqs (KMS, ECR, S3 assets bucket)
  inf.tf         # data + identity + async (KVS, secrets, queues, user pools, ...)
  api.tf         # API gateway + websocket + lambda functions
  web.tf         # web-entry, CloudFront, certificates
  variables.tf
  outputs.tf
  terraform.tfvars
```

Each file holds its own `terraform { backend "s3" { key = "<app>-<env>-<stack>.tfstate" } }`. This preserves the CDK plan boundary so DevOps can `apply` them in the same order (`bootstrap → inf → api → web`) and so a broken web change can't block a data-layer rollout.

Cross-stack outputs flow as remote-state lookups (`data.terraform_remote_state`), not as hard-wired ARNs. The translator emits both ends ([HOM-23](mention://issue/acaef1a9-23d0-44ff-84fe-2f0c43d01d07)).

---

## 4. Module ownership split

This is the central architectural decision. Two repos, two owners, two release cadences.

### 4.1 What the generator owns (`quidproquo-deploy-terraform`)

Lives in this repo. App team owns the QPQ TypeScript config that feeds it. The generator:

- Reads `qpq.config.json` and validates it against the schema for `qpqConfigVersion`.
- Walks the settings list and, per setting, looks up its translator.
- Emits HCL containing **only** `module`, `provider`, `terraform`, `backend`, `variable`, `output`, `locals`, and `data` blocks.
- Embeds the module `source` and `version` from the configured module library reference.
- Bundles Lambda artefacts (zip + hash) and passes them as module inputs.

The generator never knows about IAM document syntax, KMS key construction, log-retention policy, VPC CIDR allocation, S3 public-access-block, etc. If it ends up importing the AWS provider schema, that is a smell — it should not need to.

### 4.2 What the module library owns (separate, DevOps-owned repo)

Lives in its own repo (working name: `quidproquo-tf-modules` — final name to be confirmed by DevOps before [HOM-19](mention://issue/a449a4fd-8a81-43ef-8c1a-48396adab46b) lands). DevOps owns it. Each module:

- Accepts a tightly-typed input contract — `variable` declarations with `type` + `description` + `default`.
- Owns every compliance-controlled knob internally: KMS keys, log retention, public-access-block, encryption-at-rest, IAM least-privilege policies, VPC endpoints.
- Exposes a stable output contract (ARNs, names, URLs) the generator can wire into other modules.
- Has its own README documenting the compliance defaults baked in.
- Has its own `examples/` directory used as integration tests.
- Tagged with semver. Compliance changes are minor or patch bumps inside a major; breaking input changes are major bumps and must be paired with a generator change.

### 4.3 Why two repos and not one

- **Different release cadences.** Compliance fixes can ship to all consumers by retagging the module repo and rerunning `terraform plan`. The generator and app config do not need to rebuild.
- **Different reviewers.** Security/compliance approves module bodies; app team approves application config. PRs do not have to cross teams.
- **Different blast radius.** A breaking change in `quidproquo-deploy-terraform` invalidates `qpq.config.json` schema. A breaking change in a module is local to that module's input contract.
- **Different sensitivity.** Modules may need to encode account-specific compliance hooks (e.g. mandatory tags, mandatory KMS aliases). Keeping them out of the app repo means app teams do not need to see, edit, or even check out that code.

### 4.4 Where compliance customisation lives

When DevOps needs to add a new control (e.g. "all S3 buckets in prod must replicate to a compliance bucket"), the change is:

1. Edit the `storage-drive` module body to add the replication block, defaulting the new behaviour off.
2. Set the new variable to `true` via a per-env `tfvars` file in DevOps' own repo (NOT one the generator writes).
3. Tag the module repo, bump the `?ref=` in the generator's module-library reference, regenerate.

App team rebuild is not required for step 1 or 2. Step 3 is a generator config change (single line in `qpq-terraform synth`), not an app code change.

---

## 5. Module versioning and source

### 5.1 Decision: git source with a pinned ref

```hcl
module "kvs_users" {
  source = "git::https://github.com/<org>/quidproquo-tf-modules.git//modules/kvs?ref=v1.2.3"
  ...
}
```

Reasoning:

- **Terraform Registry** is fine for public modules but adds a publication step and gives DevOps less control over consumption rate.
- **Local path** (`source = "../tf-modules/kvs"`) couples the two repos and breaks once we ship outside this monorepo.
- **Git ref** lets DevOps tag, lets consumers pin, supports private repos cleanly, and is what every Terraform team eventually ends up using anyway.

### 5.2 Schema-version → module-version compatibility

`qpq.config.json` carries `qpqConfigVersion`. The generator carries a `compatibleModuleLibraryVersionRange` constant (semver range). On `synth`:

1. Generator validates `qpqConfigVersion` against the schema it was built against — hard fail on mismatch.
2. Generator selects the module library `?ref=` from its own config (defaults to the pinned version baked in at build time; can be overridden by `--module-library-ref` for DevOps to test new versions).
3. Generated HCL embeds the resolved ref in every `module` source URL so a future `terraform plan` is reproducible.

### 5.3 What happens on a module breaking change

- DevOps cuts a major version of the module library.
- The generator's pinned ref is bumped in a paired PR.
- The generator's `qpqConfigVersion` is bumped if the module change requires a config change; otherwise it is unchanged.
- App teams pick up the new generator on their next build and re-`synth`.

The user-visible promise: **bumping the module library version does not require app teams to do anything except re-run `qpq-terraform synth`** when the generator pinned ref catches up. Compliance changes that fit inside a minor or patch never require an app rebuild — DevOps reruns `apply` against the same generated HCL with a different `?ref=`.

---

## 6. What is explicitly NOT in scope for the generator

These items stay inside module bodies. The generator MUST NOT emit them, even via a "default" code path.

- **IAM policy documents** — only IAM grants are inferred (see [HOM-23](mention://issue/acaef1a9-23d0-44ff-84fe-2f0c43d01d07)); the policy *contents* live inside each module.
- **KMS key configuration** — modules create or reference keys as their compliance defaults dictate.
- **Log retention** — modules set their own `aws_cloudwatch_log_group` retention.
- **S3 public-access-block, versioning, encryption defaults** — module-internal.
- **VPC CIDR allocation, NAT gateway count, VPC endpoints** — module-internal (the generator only chooses *which* VPC by name).
- **CloudFront WAF baseline rules** — module-internal.
- **Tagging policy** — modules apply org-mandated tags via `default_tags` on a wrapper provider or via internal `aws_resourcegroupstaggingapi` logic; the generator only passes through `application`, `module`, `environment`, `feature` as input variables.
- **State backend bootstrap (the S3 bucket + DynamoDB lock table)** — handled by a one-time DevOps bootstrap module, not generated.
- **AWS provider version constraints** — pinned inside modules; the generator only declares which providers are needed.

The smell test for "is this generator-scope?": if the answer to "could DevOps need to change this for compliance reasons without re-running the app build?" is yes, it is not generator-scope.

---

## 7. Lambda artefacts

Lambda zips are produced by the same `apiBuildPath` machinery the CDK uses today (`qpqAwsCdkPathUtils.getApiBuildPathFullPath` + `aws_lambda.Code.fromAsset` in `quidproquo-deploy-awscdk/src/constructs/basic/Function.ts`). The generator:

1. Builds each zip from `<apiBuildPath>/<functionType>`.
2. Hashes the zip with SHA256.
3. Uploads to the env's assets bucket (provisioned by the bootstrap module) at a key derived from the hash.
4. Passes `s3_bucket`, `s3_key`, `source_code_hash` to the `service-function` module.

The bootstrap module owns the assets bucket; the generator only references it by remote-state output. Detail is in [HOM-25](mention://issue/abbf171f-4e92-4190-bf8d-acdeb29bb78d).

---

## 8. Cross-resource wiring (preview — full design in HOM-23)

QPQ infers permissions today by walking story dependencies: a `service-function` that yields a `KeyValueStore` action gets read/write on that table. We preserve that by:

1. The translator builds a reference graph from `qpq.config.json` (story-level dependencies are emitted into the JSON during the export step).
2. For each `service-function`, the translator computes a deduplicated list of referenced resources by setting type — e.g. `kvs_read = ["users", "sessions"]`, `queue_send = ["onboarding"]`.
3. Those lists are passed as inputs to the `service-function` module.
4. The module body resolves the listed names to ARNs (via remote-state lookups or via direct `aws_*` data sources) and writes the IAM policy.

The generator never writes IAM JSON. This is the most load-bearing piece of the translation layer; the full design lives in [HOM-23](mention://issue/acaef1a9-23d0-44ff-84fe-2f0c43d01d07).

---

## 9. Environments, accounts, regions (preview — full design in HOM-24)

QPQ's `environmentSettings` carries per-env overrides for everything below it. The translator maps each environment to:

- A dedicated state file (recommended over `terraform workspace`; isolates blast radius).
- A `provider "aws"` block with the env's region and assume-role.
- A `terraform.tfvars` file containing per-env overrides resolved from the QPQ env settings tree.
- A dedicated output directory: `<out>/<env>/`.

Multi-region support: one provider alias per region inside the env. The translator emits aliased providers automatically when a setting carries a region different from the env default. Full design in [HOM-24](mention://issue/0d459ffb-3a09-4e2b-bdde-5109ae8c21a6).

---

## 10. Out-of-scope for this document

These are deliberately deferred to the children of this issue:

- HCL emitter implementation choice — [HOM-18](mention://issue/91d817c3-656f-4060-beeb-43a8b69a4c64).
- Per-setting translator implementations — [HOM-22](mention://issue/3839cce0-56af-45aa-95cd-868831391214).
- Module bodies (core / async / webserver) — [HOM-19](mention://issue/a449a4fd-8a81-43ef-8c1a-48396adab46b), [HOM-20](mention://issue/ce20f5f2-7611-4a76-8161-9496bf5c99a7), [HOM-21](mention://issue/a164f941-3b73-46c0-ad92-454821e34576).
- DevOps handoff doc — [HOM-27](mention://issue/a2193fc7-0b35-4cfb-8e4a-ca8e3c838412).

This document fixes the contract, the naming, the ownership split, the versioning model, and the generator's scope ceiling. Everything downstream conforms to it.

---

## 11. Open questions

Recorded here so they are settled in the relevant downstream tickets and do not get lost.

1. **Drop or keep `awsDyanmoOverrideForKvs`?** It exists to point a KVS at a pre-existing Dynamo table that does not follow the QPQ naming pattern. In Terraform we have a cleaner option: have the `kvs` module support an `existing_table_name` input. Recommendation: fold into `kvs` module input and drop the dedicated setting. Decision deadline: [HOM-22](mention://issue/3839cce0-56af-45aa-95cd-868831391214).
2. **`bootstrapAwsOrganization` mapping.** CDK currently produces an org/OU bootstrap stack from this. Likely a dedicated `bootstrap-organization` module in the library, only referenced from `bootstrap.tf`. Confirm in [HOM-19](mention://issue/a449a4fd-8a81-43ef-8c1a-48396adab46b).
3. **`deployEvent` lifecycle hooks.** CDK runs them in the CDK app process. Terraform's analogue is `null_resource` + `local-exec` or a `terraform_data` resource. Could also live inside the relevant feature module as a `provisioner`. Decision in [HOM-22](mention://issue/3839cce0-56af-45aa-95cd-868831391214).
4. **Schema-version drift policy.** If the app emits `qpqConfigVersion: 2` but the installed generator only understands `1`, do we hard fail or attempt a forward-compat translation? Recommend hard fail with a clear "upgrade `quidproquo-deploy-terraform` to ≥ X" message. Final call in [HOM-17](mention://issue/afb82244-db9e-468d-ab3d-b52a754a339d).
