/**
 * Terraform synth fixture for the minimal-app example.
 *
 * Mirrors `cdk-synth.ts` so the parity CI can run both synthesisers and
 * diff the output. Steps:
 *
 * 1. Dump the QPQ config to `qpq.config.json` (via the same `flattenQpqConfig`
 *    path used in production).
 * 2. Create a stub artifact directory tree — one sub-directory per Lambda
 *    uniqueKey — so the generated Terraform's `source_code_path` values point
 *    at real paths on disk (required for `terraform plan`; `terraform validate`
 *    does not check file existence).
 * 3. Invoke the synth orchestrator directly to emit the per-stack `.tf` files.
 */

import { qpqCoreUtils } from 'quidproquo-core';
import { getMinimalAppConfig } from '../src/qpqConfig.js';
import { synth } from '../../../src/synth/synth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname_resolved = path.dirname(fileURLToPath(import.meta.url));

const config = getMinimalAppConfig();
const flat = qpqCoreUtils.flattenQpqConfig(config);

// --- 1. Write config dump ---------------------------------------------------
const configPath = path.resolve(__dirname_resolved, '../qpq.config.json');
const configJson = {
  qpqConfigVersion: 1,
  exportedAt: new Date().toISOString(),
  settings: flat,
};
fs.writeFileSync(configPath, JSON.stringify(configJson, null, 2));
console.log(`Config dumped to ${configPath}`);

// --- 2. Stub Lambda artifact directories ------------------------------------
// Create a stub sub-directory for every Lambda-backed setting.  The generator
// uses `path.join(artifactsDir, setting.uniqueKey)` as the `source_code_path`;
// having real directories allows `terraform plan` to resolve the paths.
const artifactsDir = path.resolve(__dirname_resolved, '../tf-artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const LAMBDA_SETTING_TYPES = new Set([
  '@quidproquo-webserver/config/ServiceFunction',
  '@quidproquo-core/config/Queue',
  '@quidproquo-webserver/config/Route',
]);

for (const setting of flat) {
  const s = setting as Record<string, unknown>;
  if (!LAMBDA_SETTING_TYPES.has(s.configSettingType as string)) continue;

  // Queue: only stub when there are processors
  if (
    s.configSettingType === '@quidproquo-core/config/Queue' &&
    (typeof s.qpqQueueProcessors !== 'object' ||
      Object.keys(s.qpqQueueProcessors as object).length === 0)
  ) {
    continue;
  }

  // Route: only stub when there is a runtime
  if (s.configSettingType === '@quidproquo-webserver/config/Route' && s.runtime == null) {
    continue;
  }

  const stubDir = path.join(artifactsDir, s.uniqueKey as string);
  fs.mkdirSync(stubDir, { recursive: true });
  fs.writeFileSync(
    path.join(stubDir, 'index.js'),
    `// fixture stub for ${s.uniqueKey}\nmodule.exports = {};\n`,
  );
}

console.log(`Lambda artifact stubs created in ${artifactsDir}`);

// --- 3. Run terraform synth -------------------------------------------------
const outDir = path.resolve(__dirname_resolved, '../tf.out');

await synth({
  configPath,
  outDir,
  env: 'dev',
  artifactsDir,
});

console.log(`Terraform synth complete. Output: ${outDir}`);
