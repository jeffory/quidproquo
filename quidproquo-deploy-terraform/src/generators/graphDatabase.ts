/**
 * GraphDatabase (`@quidproquo-core/config/GraphDatabase`) → `graph-database`
 * module (Neptune cluster).
 *
 * CDK parity: the Neptune build path (`QpqCoreGraphDatabaseConstruct` once it
 * lands the VPC wiring). The generator pairs the database with a
 * `VirtualNetwork` reference: the module resolves the VPC and subnet IDs
 * internally using the configured `vpc_name` input.
 */

import { attrs, moduleBlock } from '../hcl';
import { QpqConfigSettingJson } from '../synth/types';
import { buildModuleLabel, resolveRuntimeResourceName } from './naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from './types';
import { readOwner, readString } from './util';

const GRAPH_DATABASE_SETTING_TYPE = '@quidproquo-core/config/GraphDatabase';
const MODULE_LOGICAL_NAME = 'graph-database';
const MODULE_LABEL_PREFIX = 'graph_database';

export const graphDatabaseGenerator: ResourceGenerator = {
  configSettingType: GRAPH_DATABASE_SETTING_TYPE,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const databaseName = readString(setting, 'name') ?? setting.uniqueKey;
    const virtualNetworkName = readString(setting, 'virualNetworkName');
    if (!virtualNetworkName) {
      throw new Error(
        `graphDatabase "${setting.uniqueKey}" is missing \`virualNetworkName\`.`,
      );
    }
    const owner = readOwner(setting);

    const moduleAttributes = attrs({
      name: resolveRuntimeResourceName(databaseName, ctx.resolved, owner),
      virtual_network_name: resolveRuntimeResourceName(virtualNetworkName, ctx.resolved),
      tags: {
        application: ctx.resolved.applicationName,
        module: ctx.resolved.moduleName,
        environment: ctx.resolved.environment,
        qpq_setting_type: 'graphDatabase',
        qpq_unique_key: databaseName,
      },
    });

    const block = moduleBlock({
      name: buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey),
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: moduleAttributes,
    });

    return [{ stack: 'inf', blocks: [block] }];
  },
};
