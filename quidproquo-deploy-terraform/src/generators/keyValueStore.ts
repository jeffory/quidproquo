/**
 * KeyValueStore (`@quidproquo-core/config/KeyValueStore`) → `kvs` module.
 *
 * CDK parity: `QpqCoreKeyValueStoreConstruct` (a single `aws_dynamodb_table`,
 * PAY_PER_REQUEST, optional TTL, optional point-in-time recovery). The Terraform
 * `kvs` module accepts a superset of these inputs; we wire only the ones QPQ
 * controls and let the module's defaults provide the compliance baseline.
 */

import { attrs, expr, list, moduleBlock, obj, ref, str } from '../hcl';
import { QpqConfigSettingJson } from '../synth/types';
import { buildModuleLabel, resolveQpqRuntimeResourceName } from './naming';
import { GeneratedResource, GeneratorContext, ResourceGenerator } from './types';
import { readArray, readBool, readObject, readOwner, readString } from './util';

const KVS_SETTING_TYPE = '@quidproquo-core/config/KeyValueStore';
const MODULE_LOGICAL_NAME = 'kvs';
const MODULE_LABEL_PREFIX = 'kvs';
const QPQ_RESOURCE_TYPE_SUFFIX = 'kvs';

const DDB_ATTRIBUTE_TYPE: Record<string, 'S' | 'N' | 'B'> = {
  string: 'S',
  number: 'N',
  binary: 'B',
};

interface KvsKeyJson {
  key: string;
  type: string;
}

const readKvsKey = (source: unknown): KvsKeyJson | undefined => {
  if (typeof source !== 'object' || source === null) return undefined;
  const record = source as Record<string, unknown>;
  const key = typeof record.key === 'string' ? record.key : undefined;
  const type = typeof record.type === 'string' ? record.type : 'string';
  if (!key) return undefined;
  return { key, type };
};

const ddbType = (kvsType: string): 'S' | 'N' | 'B' =>
  DDB_ATTRIBUTE_TYPE[kvsType] ?? 'S';

export const keyValueStoreGenerator: ResourceGenerator = {
  configSettingType: KVS_SETTING_TYPE,

  generate(setting: QpqConfigSettingJson, ctx: GeneratorContext): GeneratedResource[] {
    const keyValueStoreName = readString(setting, 'keyValueStoreName') ?? setting.uniqueKey;
    const partitionKey = readKvsKey(readObject(setting, 'partitionKey'));
    if (!partitionKey) {
      throw new Error(
        `keyValueStore "${setting.uniqueKey}" is missing a partitionKey.`,
      );
    }
    const sortKeys = (readArray(setting, 'sortKeys') ?? [])
      .map(readKvsKey)
      .filter((value): value is KvsKeyJson => Boolean(value));
    const primarySortKey = sortKeys[0];

    interface KvsIndexJson {
      pk: KvsKeyJson;
      sk: KvsKeyJson | undefined;
    }
    const indexes: KvsIndexJson[] = (readArray(setting, 'indexes') ?? [])
      .map((index): KvsIndexJson | undefined => {
        if (typeof index !== 'object' || index === null) return undefined;
        const pk = readKvsKey(readObject(index, 'partitionKey'));
        if (!pk) return undefined;
        const sk = readKvsKey(readObject(index, 'sortKey'));
        return { pk, sk };
      })
      .filter((v): v is KvsIndexJson => Boolean(v));

    const ttlAttribute = readString(setting, 'ttlAttribute');
    const enableMonthlyRollingBackups = readBool(setting, 'enableMonthlyRollingBackups') ?? false;

    const owner = readOwner(setting);
    const tableName = resolveQpqRuntimeResourceName(
      keyValueStoreName,
      QPQ_RESOURCE_TYPE_SUFFIX,
      ctx.resolved,
      owner,
    );

    // Build the deduplicated GSI attribute set required by aws_dynamodb_table.
    const declaredKeys = new Set<string>([
      partitionKey.key,
      ...(primarySortKey ? [primarySortKey.key] : []),
    ]);
    const extraAttributes: { name: string; type: 'S' | 'N' | 'B' }[] = [];
    for (const index of indexes) {
      for (const key of [index.pk, index.sk].filter((k): k is KvsKeyJson => Boolean(k))) {
        if (!declaredKeys.has(key.key)) {
          declaredKeys.add(key.key);
          extraAttributes.push({ name: key.key, type: ddbType(key.type) });
        }
      }
    }

    const moduleAttributes = attrs({
      name: tableName,
      hash_key: partitionKey.key,
      hash_key_type: ddbType(partitionKey.type),
      range_key: primarySortKey ? primarySortKey.key : undefined,
      range_key_type: primarySortKey ? ddbType(primarySortKey.type) : undefined,
      ttl_enabled: Boolean(ttlAttribute),
      ttl_attribute: ttlAttribute,
      point_in_time_recovery: enableMonthlyRollingBackups,
    });

    if (extraAttributes.length > 0) {
      moduleAttributes.attributes = list(
        extraAttributes.map((a) => obj({ name: str(a.name), type: str(a.type) })),
      );
    }

    if (indexes.length > 0) {
      moduleAttributes.global_secondary_indexes = list(
        indexes.map((index, position) =>
          obj({
            name: str(`gsi-${position}-${index.pk.key}${index.sk ? `-${index.sk.key}` : ''}`),
            hash_key: str(index.pk.key),
            range_key: index.sk ? str(index.sk.key) : expr(null),
            projection_type: str('ALL'),
          }),
        ),
      );
    }

    moduleAttributes.tags = obj({
      application: str(ctx.resolved.applicationName),
      module: str(ctx.resolved.moduleName),
      environment: str(ctx.resolved.environment),
      qpq_setting_type: str('keyValueStore'),
      qpq_unique_key: str(keyValueStoreName),
    });

    const block = moduleBlock({
      name: buildModuleLabel(MODULE_LABEL_PREFIX, setting.uniqueKey),
      source: ctx.moduleSource(MODULE_LOGICAL_NAME),
      attributes: moduleAttributes,
    });

    // Suppress unused-import warning when no GSI/attributes path is taken.
    void ref;

    return [{ stack: 'inf', blocks: [block] }];
  },
};
