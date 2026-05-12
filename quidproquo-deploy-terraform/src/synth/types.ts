/**
 * Public types for the synth pipeline. The CLI command parses arguments into a
 * {@link SynthOptions}; the orchestrator resolves that against the loaded
 * `qpq.config.json` to produce a {@link ResolvedSynthContext}, which the
 * downstream HCL generators (HOM-57 and friends) will consume.
 */

/** Schema version this build of `quidproquo-deploy-terraform` understands. */
export const SUPPORTED_QPQ_CONFIG_VERSION = 1;

/** Stacks emitted per environment — mirrors the CDK deployer split. */
export const SYNTH_STACK_NAMES = ['bootstrap', 'inf', 'api', 'web'] as const;
export type SynthStackName = (typeof SYNTH_STACK_NAMES)[number];

/** Options accepted by `qpq-terraform synth`. */
export interface SynthOptions {
  /** Path to the QPQ config JSON exported via `qpqCoreUtils.flattenQpqConfig`. */
  configPath: string;
  /** Root directory the synth output is written under. */
  outDir: string;
  /** Environment to synthesise (selects the matching `environmentSettings`). */
  env: string;
  /** Optional override; if set, must equal the application name in the config. */
  app?: string;
  /** Optional override; if set, must equal the module name in the config. */
  module?: string;
}

/**
 * The single QPQ setting object on disk. The on-disk shape is a flat union of
 * every concrete `*QPQConfigSetting`; we only depend on the two universal fields
 * during validation. Other properties are preserved verbatim.
 */
export interface QpqConfigSettingJson {
  configSettingType: string;
  uniqueKey: string;
  [key: string]: unknown;
}

/** Top-level shape of the `qpq.config.json` file (see ARCHITECTURE.md §2.1). */
export interface QpqConfigFile {
  qpqConfigVersion: number;
  exportedAt?: string;
  settings: QpqConfigSettingJson[];
}

/** The synth context after the config has been loaded, validated and resolved. */
export interface ResolvedSynthContext {
  options: SynthOptions;
  config: QpqConfigFile;
  applicationName: string;
  moduleName: string;
  environment: string;
  deployAccountId: string;
  deployRegion: string;
}
