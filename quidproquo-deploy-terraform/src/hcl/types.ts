/**
 * Internal TypeScript model for a generated Terraform file. The emitter walks
 * these structures verbatim — see ARCHITECTURE.md §1 for the contract this
 * model is required to express (terraform/provider/backend/variable/output/
 * locals/data/module blocks; no raw `aws_*` resource blocks in normal use).
 *
 * The generic {@link TerraformBlock} is the universal escape hatch. The named
 * config interfaces below feed the typed factories in `./blocks` and exist for
 * ergonomics — every factory output is just a {@link TerraformBlock} on the wire.
 */

export type HclExpression =
  | HclStringExpr
  | HclNumberExpr
  | HclBoolExpr
  | HclNullExpr
  | HclReferenceExpr
  | HclListExpr
  | HclObjectExpr
  | HclHeredocExpr
  | HclRawExpr;

export interface HclStringExpr {
  kind: 'string';
  value: string;
}

export interface HclNumberExpr {
  kind: 'number';
  value: number;
}

export interface HclBoolExpr {
  kind: 'bool';
  value: boolean;
}

export interface HclNullExpr {
  kind: 'null';
}

/**
 * A bare HCL traversal — e.g. `var.region`, `module.kvs_users.table_arn`,
 * `data.terraform_remote_state.bootstrap.outputs.assets_bucket`. The string
 * is emitted unquoted; callers are responsible for using a syntactically
 * valid traversal expression.
 */
export interface HclReferenceExpr {
  kind: 'ref';
  ref: string;
}

export interface HclListExpr {
  kind: 'list';
  items: HclExpression[];
}

export interface HclObjectEntry {
  key: string;
  value: HclExpression;
}

export interface HclObjectExpr {
  kind: 'object';
  entries: HclObjectEntry[];
}

/**
 * Heredoc string literal. When `indented` is true the `<<-TAG` form is used,
 * which lets Terraform strip the smallest common leading whitespace at parse
 * time. The body is emitted unmodified; callers control whitespace.
 */
export interface HclHeredocExpr {
  kind: 'heredoc';
  tag: string;
  body: string;
  indented?: boolean;
}

/**
 * Escape hatch for expressions the model does not yet cover (function calls,
 * ternaries, splats, complex `for` expressions, unquoted type expressions).
 * The string is emitted verbatim in place of an expression.
 */
export interface HclRawExpr {
  kind: 'raw';
  raw: string;
}

export type HclAttributes = Record<string, HclExpression>;

/**
 * The shape every emitted block reduces to. Typed factories return this.
 *
 * - `type` is the leading keyword (`resource`, `module`, `terraform`, ...).
 * - `labels` are the quoted strings between the keyword and `{` — `["aws_s3_bucket", "assets"]`.
 * - `attributes` are `name = expr` pairs inside the body.
 * - `blocks` are nested child blocks (e.g. `lifecycle`, `dynamic`, `required_providers`).
 * - `comment` is rendered as `#`-prefixed lines immediately above the block.
 */
export interface TerraformBlock {
  type: string;
  labels: string[];
  attributes: HclAttributes;
  blocks?: TerraformBlock[];
  comment?: string;
}

export interface TerraformFile {
  blocks: TerraformBlock[];
}

export interface TerraformBackend {
  /** Backend type, e.g. `s3`, `local`, `remote`. */
  type: string;
  config?: HclAttributes;
}

export interface RequiredProvider {
  source: string;
  version?: string;
  configurationAliases?: string[];
}

export interface TerraformTopLevelConfig {
  requiredVersion?: string;
  requiredProviders?: Record<string, RequiredProvider>;
  backend?: TerraformBackend;
  /** Additional blocks under the top-level `terraform {}` (e.g. `cloud`). */
  extras?: TerraformBlock[];
  comment?: string;
}

export interface TerraformProviderConfig {
  /** Provider local name as referenced by `required_providers`. */
  name: string;
  /** Optional alias for instancing the same provider multiple times. */
  alias?: string;
  attributes?: HclAttributes;
  blocks?: TerraformBlock[];
  comment?: string;
}

export interface TerraformResourceConfig {
  /** Resource type, e.g. `aws_s3_bucket`. */
  type: string;
  /** Resource instance name. */
  name: string;
  attributes?: HclAttributes;
  blocks?: TerraformBlock[];
  comment?: string;
}

export interface TerraformDataConfig {
  /** Data source type, e.g. `terraform_remote_state`. */
  type: string;
  /** Data source instance name. */
  name: string;
  attributes?: HclAttributes;
  blocks?: TerraformBlock[];
  comment?: string;
}

export interface TerraformVariableConfig {
  name: string;
  /**
   * Type constraint as an unquoted HCL type expression — e.g. `string`,
   * `list(string)`, `object({ name = string })`. Emitted verbatim.
   */
  type?: string;
  description?: string;
  default?: HclExpression;
  sensitive?: boolean;
  nullable?: boolean;
  /** Additional blocks (typically `validation { ... }`). */
  blocks?: TerraformBlock[];
  comment?: string;
}

export interface TerraformOutputConfig {
  name: string;
  value: HclExpression;
  description?: string;
  sensitive?: boolean;
  /** References to depend on; rendered as `depends_on = [...]`. */
  dependsOn?: HclReferenceExpr[];
  comment?: string;
}

export interface TerraformLocalsConfig {
  values: HclAttributes;
  comment?: string;
}

export interface TerraformModuleConfig {
  /** Module instance label. */
  name: string;
  /** Module source URL or path. */
  source: string;
  /** Optional `version` attribute (Terraform Registry sources only). */
  version?: string;
  attributes?: HclAttributes;
  blocks?: TerraformBlock[];
  comment?: string;
}
