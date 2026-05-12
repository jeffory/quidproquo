import { describe, expect, it } from 'vitest';

import {
  attrs,
  bool,
  data,
  emitBlock,
  emitExpression,
  emitFile,
  expr,
  file,
  heredoc,
  list,
  locals,
  moduleBlock,
  nullValue,
  num,
  obj,
  output,
  provider,
  raw,
  ref,
  resource,
  str,
  terraformBlock,
  variable,
} from './index';

describe('emitExpression', () => {
  it('emits primitive strings, numbers, bools, null', () => {
    expect(emitExpression(str('hello'))).toBe('"hello"');
    expect(emitExpression(num(42))).toBe('42');
    expect(emitExpression(num(3.14))).toBe('3.14');
    expect(emitExpression(bool(true))).toBe('true');
    expect(emitExpression(bool(false))).toBe('false');
    expect(emitExpression(nullValue())).toBe('null');
  });

  it('emits references unquoted', () => {
    expect(emitExpression(ref('var.region'))).toBe('var.region');
    expect(emitExpression(ref('module.kvs_users.table_arn'))).toBe('module.kvs_users.table_arn');
  });

  it('escapes special characters in strings', () => {
    expect(emitExpression(str('a"b'))).toBe('"a\\"b"');
    expect(emitExpression(str('line1\nline2'))).toBe('"line1\\nline2"');
    expect(emitExpression(str('back\\slash'))).toBe('"back\\\\slash"');
    expect(emitExpression(str('tab\there'))).toBe('"tab\\there"');
  });

  it('escapes interpolation and template directives', () => {
    expect(emitExpression(str('${var.x}'))).toBe('"$${var.x}"');
    expect(emitExpression(str('%{if x}'))).toBe('"%%{if x}"');
    // Lone `$` and `%` are not escaped.
    expect(emitExpression(str('price $5'))).toBe('"price $5"');
    expect(emitExpression(str('50% off'))).toBe('"50% off"');
  });

  it('emits raw expressions verbatim', () => {
    expect(emitExpression(raw('concat(a, b)'))).toBe('concat(a, b)');
    expect(emitExpression(raw('list(string)'))).toBe('list(string)');
  });

  it('emits inline lists when short and primitive-only', () => {
    expect(emitExpression(list([num(1), num(2), num(3)]))).toBe('[1, 2, 3]');
    expect(emitExpression(list([]))).toBe('[]');
    expect(emitExpression(list([str('a'), ref('var.b')]))).toBe('["a", var.b]');
  });

  it('breaks lists across lines when they contain collections', () => {
    const e = list([obj({ a: num(1) }), obj({ b: num(2) })]);
    expect(emitExpression(e)).toBe(
      ['[', '  {', '    a = 1', '  },', '  {', '    b = 2', '  },', ']'].join('\n'),
    );
  });

  it('emits empty objects inline', () => {
    expect(emitExpression(obj({}))).toBe('{}');
  });

  it('quotes object keys only when they are not valid identifiers', () => {
    const o = obj({ name: str('x'), 'weird key': str('y'), 'with-hyphen': str('z') });
    const out = emitExpression(o);
    expect(out).toMatch(/\n {2}name\s+= "x"/);
    expect(out).toMatch(/\n {2}"weird key"\s+= "y"/);
    expect(out).toMatch(/\n {2}with-hyphen\s+= "z"/);
  });

  it('emits heredocs', () => {
    const e = heredoc('EOT', 'first\nsecond', false);
    expect(emitExpression(e)).toBe('<<EOT\nfirst\nsecond\nEOT');
    const indented = heredoc('EOT', 'first\nsecond', true);
    expect(emitExpression(indented)).toBe('<<-EOT\nfirst\nsecond\nEOT');
  });
});

describe('expr auto-converter', () => {
  it('converts primitives', () => {
    expect(emitExpression(expr('hello'))).toBe('"hello"');
    expect(emitExpression(expr(42))).toBe('42');
    expect(emitExpression(expr(true))).toBe('true');
    expect(emitExpression(expr(null))).toBe('null');
    expect(emitExpression(expr(undefined))).toBe('null');
  });

  it('converts arrays and objects recursively', () => {
    expect(emitExpression(expr([1, 2]))).toBe('[1, 2]');
    expect(emitExpression(expr({ a: 1, b: 'two' }))).toBe('{\n  a = 1\n  b = "two"\n}');
  });

  it('passes HclExpression values through unchanged', () => {
    const r = ref('var.x');
    expect(expr(r)).toBe(r);
  });

  it('drops undefined values in attrs() helper', () => {
    const a = attrs({ keep: 'yes', drop: undefined, also_keep: 0 });
    expect(Object.keys(a)).toEqual(['keep', 'also_keep']);
  });
});

describe('emitBlock', () => {
  it('emits an empty block as a one-liner', () => {
    expect(emitBlock(resource({ type: 'aws_iam_role', name: 'empty' }))).toBe(
      'resource "aws_iam_role" "empty" {}',
    );
  });

  it('aligns attribute names with consistent padding', () => {
    const r = resource({
      type: 'aws_s3_bucket',
      name: 'assets',
      attributes: attrs({ bucket: 'my-bucket', force_destroy: true }),
    });
    expect(emitBlock(r)).toBe(
      [
        'resource "aws_s3_bucket" "assets" {',
        '  bucket        = "my-bucket"',
        '  force_destroy = true',
        '}',
      ].join('\n'),
    );
  });

  it('indents nested blocks two spaces per level', () => {
    const r = resource({
      type: 'aws_s3_bucket',
      name: 'assets',
      attributes: attrs({ bucket: 'b' }),
      blocks: [
        {
          type: 'lifecycle',
          labels: [],
          attributes: attrs({ prevent_destroy: true }),
        },
      ],
    });
    expect(emitBlock(r)).toBe(
      [
        'resource "aws_s3_bucket" "assets" {',
        '  bucket = "b"',
        '',
        '  lifecycle {',
        '    prevent_destroy = true',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('renders leading comments', () => {
    const r = resource({
      type: 'aws_iam_role',
      name: 'app',
      comment: 'managed by qpq-terraform synth\ndo not edit by hand',
    });
    expect(emitBlock(r)).toBe(
      [
        '# managed by qpq-terraform synth',
        '# do not edit by hand',
        'resource "aws_iam_role" "app" {}',
      ].join('\n'),
    );
  });
});

describe('factories', () => {
  it('builds a terraform block with required providers and an S3 backend', () => {
    const tf = terraformBlock({
      requiredVersion: '>= 1.5.0',
      requiredProviders: {
        aws: { source: 'hashicorp/aws', version: '~> 5.0' },
      },
      backend: {
        type: 's3',
        config: attrs({ bucket: 'state-bucket', key: 'inf.tfstate', region: 'us-east-1' }),
      },
    });
    expect(emitBlock(tf)).toBe(
      [
        'terraform {',
        '  required_version = ">= 1.5.0"',
        '',
        '  required_providers {',
        '    aws = {',
        '      source  = "hashicorp/aws"',
        '      version = "~> 5.0"',
        '    }',
        '  }',
        '',
        '  backend "s3" {',
        '    bucket = "state-bucket"',
        '    key    = "inf.tfstate"',
        '    region = "us-east-1"',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('builds a provider block with an alias attribute', () => {
    const p = provider({
      name: 'aws',
      alias: 'east',
      attributes: attrs({ region: 'us-east-1' }),
    });
    expect(emitBlock(p)).toBe(
      ['provider "aws" {', '  region = "us-east-1"', '  alias  = "east"', '}'].join('\n'),
    );
  });

  it('builds a data source block', () => {
    const d = data({
      type: 'terraform_remote_state',
      name: 'bootstrap',
      attributes: {
        backend: str('s3'),
        config: obj({ bucket: str('state'), key: str('bootstrap.tfstate') }),
      },
    });
    expect(emitBlock(d)).toBe(
      [
        'data "terraform_remote_state" "bootstrap" {',
        '  backend = "s3"',
        '  config = {',
        '    bucket = "state"',
        '    key    = "bootstrap.tfstate"',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('emits a variable block with an unquoted type expression', () => {
    const v = variable({
      name: 'tags',
      type: 'map(string)',
      description: 'Common tags',
      default: obj({ env: str('dev') }),
    });
    expect(emitBlock(v)).toBe(
      [
        'variable "tags" {',
        '  type        = map(string)',
        '  description = "Common tags"',
        '  default = {',
        '    env = "dev"',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('emits an output block with depends_on', () => {
    const o = output({
      name: 'bucket_arn',
      value: ref('aws_s3_bucket.assets.arn'),
      description: 'ARN of the assets bucket',
      sensitive: false,
      dependsOn: [ref('aws_s3_bucket.assets')],
    });
    expect(emitBlock(o)).toBe(
      [
        'output "bucket_arn" {',
        '  value       = aws_s3_bucket.assets.arn',
        '  description = "ARN of the assets bucket"',
        '  sensitive   = false',
        '  depends_on  = [aws_s3_bucket.assets]',
        '}',
      ].join('\n'),
    );
  });

  it('emits a locals block', () => {
    const l = locals({
      values: attrs({ app: 'myapp', env: 'prod' }),
    });
    expect(emitBlock(l)).toBe(['locals {', '  app = "myapp"', '  env = "prod"', '}'].join('\n'));
  });

  it('emits a module block with a git source and inputs', () => {
    const m = moduleBlock({
      name: 'kvs_users',
      source: 'git::https://github.com/example/qpq-tf-modules.git//modules/kvs?ref=v1.2.3',
      attributes: attrs({ name: 'users-app-auth-prod-qpqkvs', billing_mode: 'PAY_PER_REQUEST' }),
    });
    expect(emitBlock(m)).toBe(
      [
        'module "kvs_users" {',
        '  source       = "git::https://github.com/example/qpq-tf-modules.git//modules/kvs?ref=v1.2.3"',
        '  name         = "users-app-auth-prod-qpqkvs"',
        '  billing_mode = "PAY_PER_REQUEST"',
        '}',
      ].join('\n'),
    );
  });

  it('module block places source before user-provided attributes', () => {
    const m = moduleBlock({
      name: 'queue_onboarding',
      source: 'git::https://example/repo.git//modules/queue?ref=v0.1.0',
      version: '0.1.0',
      attributes: attrs({ name: 'q1' }),
    });
    const out = emitBlock(m);
    const sourceIdx = out.indexOf('source');
    const nameIdx = out.indexOf('name');
    const versionIdx = out.indexOf('version');
    expect(sourceIdx).toBeGreaterThanOrEqual(0);
    expect(sourceIdx).toBeLessThan(nameIdx);
    expect(versionIdx).toBeGreaterThan(nameIdx);
  });
});

describe('emitFile', () => {
  it('returns the empty string for a file with no blocks', () => {
    expect(emitFile(file([]))).toBe('');
  });

  it('separates top-level blocks with a single blank line and trailing newline', () => {
    const f = file([
      terraformBlock({
        requiredVersion: '>= 1.5.0',
        backend: { type: 's3', config: attrs({ bucket: 'b', key: 'k', region: 'us-east-1' }) },
      }),
      provider({ name: 'aws', attributes: attrs({ region: 'us-east-1' }) }),
      moduleBlock({
        name: 'kvs_users',
        source: 'git::https://example/repo.git//modules/kvs?ref=v1.0.0',
        attributes: attrs({ name: 'users' }),
      }),
    ]);
    const text = emitFile(f);
    expect(text.endsWith('\n')).toBe(true);
    // Top-level closers are followed by exactly one blank line before the next
    // top-level header; the final closer is followed by a single trailing newline.
    expect(text).toMatch(/}\n\nprovider "aws" {/);
    expect(text).toMatch(/}\n\nmodule "kvs_users" {/);
    expect(text).toMatch(/}\n$/);
    expect(text).not.toMatch(/}\n\n\n/);
  });

  it('produces byte-identical output for byte-identical input (determinism)', () => {
    const buildFile = () =>
      file([
        terraformBlock({
          requiredVersion: '>= 1.5.0',
          requiredProviders: { aws: { source: 'hashicorp/aws', version: '~> 5.0' } },
        }),
        locals({ values: attrs({ app: 'myapp', env: 'dev' }) }),
        moduleBlock({
          name: 'kvs_users',
          source: 'git::https://example/repo.git//modules/kvs?ref=v1.0.0',
          attributes: attrs({ name: 'users' }),
        }),
      ]);
    expect(emitFile(buildFile())).toBe(emitFile(buildFile()));
  });
});
