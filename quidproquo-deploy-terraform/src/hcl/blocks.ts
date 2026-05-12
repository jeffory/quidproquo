import { attrs, expr, list } from './expressions';
import {
  HclAttributes,
  HclExpression,
  TerraformBlock,
  TerraformDataConfig,
  TerraformFile,
  TerraformLocalsConfig,
  TerraformModuleConfig,
  TerraformOutputConfig,
  TerraformProviderConfig,
  TerraformResourceConfig,
  TerraformTopLevelConfig,
  TerraformVariableConfig,
} from './types';

const cleanAttrs = (input?: HclAttributes): HclAttributes => {
  if (!input) return {};
  const out: HclAttributes = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
};

export const block = (
  type: string,
  labels: string[],
  attributes: HclAttributes = {},
  blocks?: TerraformBlock[],
  comment?: string,
): TerraformBlock => ({
  type,
  labels,
  attributes: cleanAttrs(attributes),
  ...(blocks && blocks.length > 0 ? { blocks } : {}),
  ...(comment ? { comment } : {}),
});

/**
 * Build the top-level `terraform { ... }` block, which carries the required
 * version, required providers, and the state backend.
 */
export const terraformBlock = (config: TerraformTopLevelConfig): TerraformBlock => {
  const attributes: HclAttributes = {};
  if (config.requiredVersion !== undefined) {
    attributes.required_version = expr(config.requiredVersion);
  }

  const nested: TerraformBlock[] = [];

  if (config.requiredProviders && Object.keys(config.requiredProviders).length > 0) {
    const providerEntries: HclAttributes = {};
    for (const [localName, provider] of Object.entries(config.requiredProviders)) {
      const inner: Record<string, HclExpression> = {
        source: expr(provider.source),
      };
      if (provider.version !== undefined) {
        inner.version = expr(provider.version);
      }
      if (provider.configurationAliases && provider.configurationAliases.length > 0) {
        inner.configuration_aliases = list(
          provider.configurationAliases.map((alias) => ({ kind: 'ref', ref: alias })),
        );
      }
      providerEntries[localName] = { kind: 'object', entries: Object.entries(inner).map(([key, value]) => ({ key, value })) };
    }
    nested.push(block('required_providers', [], providerEntries));
  }

  if (config.backend) {
    nested.push(block('backend', [config.backend.type], cleanAttrs(config.backend.config)));
  }

  if (config.extras) {
    nested.push(...config.extras);
  }

  return block('terraform', [], attributes, nested, config.comment);
};

export const provider = (config: TerraformProviderConfig): TerraformBlock => {
  const attributes = cleanAttrs(config.attributes);
  if (config.alias !== undefined) {
    attributes.alias = expr(config.alias);
  }
  return block('provider', [config.name], attributes, config.blocks, config.comment);
};

export const resource = (config: TerraformResourceConfig): TerraformBlock =>
  block('resource', [config.type, config.name], cleanAttrs(config.attributes), config.blocks, config.comment);

export const data = (config: TerraformDataConfig): TerraformBlock =>
  block('data', [config.type, config.name], cleanAttrs(config.attributes), config.blocks, config.comment);

export const variable = (config: TerraformVariableConfig): TerraformBlock => {
  const attributes: HclAttributes = {};
  if (config.type !== undefined) {
    attributes.type = { kind: 'raw', raw: config.type };
  }
  if (config.description !== undefined) {
    attributes.description = expr(config.description);
  }
  if (config.default !== undefined) {
    attributes.default = config.default;
  }
  if (config.sensitive !== undefined) {
    attributes.sensitive = expr(config.sensitive);
  }
  if (config.nullable !== undefined) {
    attributes.nullable = expr(config.nullable);
  }
  return block('variable', [config.name], attributes, config.blocks, config.comment);
};

export const output = (config: TerraformOutputConfig): TerraformBlock => {
  const attributes: HclAttributes = { value: config.value };
  if (config.description !== undefined) {
    attributes.description = expr(config.description);
  }
  if (config.sensitive !== undefined) {
    attributes.sensitive = expr(config.sensitive);
  }
  if (config.dependsOn && config.dependsOn.length > 0) {
    attributes.depends_on = { kind: 'list', items: config.dependsOn };
  }
  return block('output', [config.name], attributes, undefined, config.comment);
};

export const locals = (config: TerraformLocalsConfig): TerraformBlock =>
  block('locals', [], cleanAttrs(config.values), undefined, config.comment);

export const moduleBlock = (config: TerraformModuleConfig): TerraformBlock => {
  const attributes: HclAttributes = {
    source: expr(config.source),
    ...cleanAttrs(config.attributes),
  };
  if (config.version !== undefined) {
    attributes.version = expr(config.version);
  }
  return block('module', [config.name], attributes, config.blocks, config.comment);
};

export const file = (blocks: TerraformBlock[]): TerraformFile => ({ blocks });

export { attrs };
