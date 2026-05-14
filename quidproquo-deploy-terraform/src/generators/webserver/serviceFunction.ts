/**
 * ServiceFunction (`@quidproquo-webserver/config/ServiceFunction`) →
 * `service-function` module.
 *
 * CDK parity: `QpqWebserverServiceFunctionConstruct` — an `aws_lambda_function`
 * plus its log group + execution role. The IAM grants the function actually
 * needs are inferred from the story dependency graph; HOM-23 wires those.
 *
 * Artifact wiring (two modes, selected by whether `--artifacts-dir` is set):
 *   - No artifactsDir: emits `var.<label>_artifact_s3_bucket/key/hash` refs
 *     and matching `variable` declarations.  The build pipeline populates these
 *     at `terraform apply` time.
 *   - artifactsDir set: embeds `source_code_path = <artifactsDir>/<uniqueKey>`
 *     directly; no variable declarations emitted.  Used for local dev and the
 *     parity CI fixture.
 */

import path from 'node:path';

import { attrs, moduleBlock, ref, variable } from '../../hcl';
import { QpqConfigSettingJson } from '../../synth/types';
import { buildModuleLabel, resolveQpqRuntimeResourceName } from '../naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from '../types';
import { readOwner, readString } from '../util';
import { WEBSERVER_SETTING_TYPE } from './settingTypes';

const MODULE_LOGICAL_NAME = 'service-function';
const MODULE_LABEL_PREFIX = 'service_function';
const QPQ_RESOURCE_TYPE_SUFFIX = 'sfunc';

export const serviceFunctionGenerator: ResourceGenerator = {
  configSettingType: WEBSERVER_SETTING_TYPE.ServiceFunction,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const functionName = readString(setting, 'functionName') ?? setting.uniqueKey;
    const label = buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey);
    const artifactsDir = ctx.resolved.options.artifactsDir;

    const resolvedName = resolveQpqRuntimeResourceName(
      functionName,
      QPQ_RESOURCE_TYPE_SUFFIX,
      ctx.resolved,
      readOwner(setting),
    );

    const artifactAttrs = artifactsDir
      ? { source_code_path: path.join(artifactsDir, setting.uniqueKey) }
      : {
          s3_bucket: ref(`var.${label}_artifact_s3_bucket`),
          s3_key: ref(`var.${label}_artifact_s3_key`),
          source_code_hash: ref(`var.${label}_artifact_source_code_hash`),
        };

    const moduleBlk = moduleBlock({
      name: label,
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: attrs({
        function_name: resolvedName,
        qpq_function_name: functionName,
        runtime: setting.runtime ?? null,
        virtual_network_name: readString(setting, 'virtualNetworkName'),
        ...artifactAttrs,
        tags: {
          application: ctx.resolved.applicationName,
          module: ctx.resolved.moduleName,
          environment: ctx.resolved.environment,
          qpq_setting_type: 'serviceFunction',
          qpq_unique_key: setting.uniqueKey,
        },
      }),
    });

    const blocks = artifactsDir
      ? [moduleBlk]
      : [
          moduleBlk,
          variable({ name: `${label}_artifact_s3_bucket`, type: 'string' }),
          variable({ name: `${label}_artifact_s3_key`, type: 'string' }),
          variable({ name: `${label}_artifact_source_code_hash`, type: 'string' }),
        ];

    return [{ stack: 'api', blocks }];
  },
};
