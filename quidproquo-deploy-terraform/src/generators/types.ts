/**
 * Generator framework: each QPQ core setting type maps to a {@link ResourceGenerator}
 * that emits Terraform `module {}` calls (plus any supporting `output {}` blocks).
 *
 * The generators are pure: they receive the validated setting JSON and a
 * {@link GeneratorContext} and return {@link GeneratedResource} records the
 * synth pipeline (HOM-59) groups into per-stack `.tf` files.
 *
 * Per ARCHITECTURE.md §1 the output is restricted to `module`, `output`,
 * `locals`, `data` and the surrounding `provider`/`backend`/`variable`
 * glue — never raw `aws_*` resources. The shape below enforces that on the
 * type level by only carrying `TerraformBlock` outputs from this layer.
 */

import { TerraformBlock } from '../hcl';
import { QpqConfigSettingJson, ResolvedSynthContext, SynthStackName } from '../synth/types';

/**
 * Resolves the `source = "..."` argument for a logical module name.
 *
 * The synth pipeline picks the active resolver from CLI flags or defaults
 * (see ARCHITECTURE.md §5). Generators MUST go through this function — they
 * never embed the module library URL directly.
 */
export type ModuleSourceResolver = (logicalName: string) => string;

export interface GeneratorContext {
  resolved: ResolvedSynthContext;
  moduleSource: ModuleSourceResolver;
}

/** Output of a single generator invocation. */
export interface GeneratedResource {
  /** The stack `.tf` file the block(s) below belong to. */
  stack: SynthStackName;
  /** Terraform blocks to splice into the stack file. Typically a single `module`. */
  blocks: TerraformBlock[];
}

/**
 * Per-setting translator. One generator handles a single
 * `configSettingType`; the registry dispatches a flattened settings list to
 * the matching generator.
 */
export interface ResourceGenerator<TSetting extends QpqConfigSettingJson = QpqConfigSettingJson> {
  /** The `configSettingType` enum value this generator handles. */
  readonly configSettingType: string;
  /** Translate a single setting into one or more Terraform blocks. */
  generate(setting: TSetting, ctx: GeneratorContext): GeneratedResource[];
}
