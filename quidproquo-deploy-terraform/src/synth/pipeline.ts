/**
 * Generator dispatch pipeline.
 *
 * Walks a resolved synth context's settings list, routes each setting to its
 * registered {@link ResourceGenerator}, groups the resulting blocks by stack,
 * and writes one `<stack>.tf` file per stack that produced output.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { emitFile } from '../hcl/emit';
import { TerraformFile } from '../hcl/types';
import { createDefaultModuleSource } from '../generators/moduleSource';
import {
  ALL_RESOURCE_GENERATORS,
  buildResourceGeneratorRegistry,
  isTranslatorOnlySettingType,
} from '../generators/registry';
import { GeneratorContext } from '../generators/types';
import { ResolvedSynthContext, SynthStackName, SYNTH_STACK_NAMES } from './types';

export type StackPaths = Partial<Record<SynthStackName, string>>;

export interface PipelineResult {
  stackPaths: StackPaths;
}

/**
 * Run the full generator dispatch pipeline and write per-stack `.tf` files.
 *
 * - Translator-only setting types are silently skipped.
 * - Unknown setting types emit a warning to stderr and are skipped.
 * - Stacks with no output blocks produce no file.
 */
export const runGeneratorPipeline = async (
  context: ResolvedSynthContext,
  envDir: string,
): Promise<PipelineResult> => {
  const registry = buildResourceGeneratorRegistry(ALL_RESOURCE_GENERATORS);
  const moduleSource = createDefaultModuleSource();
  const ctx: GeneratorContext = { resolved: context, moduleSource };

  const grouped: Partial<Record<SynthStackName, TerraformFile['blocks']>> = {};

  for (const setting of context.config.settings) {
    if (isTranslatorOnlySettingType(setting.configSettingType)) continue;

    const generator = registry.get(setting.configSettingType);
    if (!generator) {
      process.stderr.write(
        `[qpq-terraform synth] Unknown configSettingType "${setting.configSettingType}" — skipping\n`,
      );
      continue;
    }

    const resources = generator.generate(setting, ctx);
    for (const resource of resources) {
      const existing = grouped[resource.stack];
      if (existing) {
        existing.push(...resource.blocks);
      } else {
        grouped[resource.stack] = [...resource.blocks];
      }
    }
  }

  const stackPaths: StackPaths = {};

  for (const stackName of SYNTH_STACK_NAMES) {
    const blocks = grouped[stackName];
    if (!blocks || blocks.length === 0) continue;

    const hcl = emitFile({ blocks });
    if (!hcl) continue;

    const stackPath = path.join(envDir, `${stackName}.tf`);
    await fs.writeFile(stackPath, hcl, 'utf-8');
    stackPaths[stackName] = stackPath;
  }

  return { stackPaths };
};
