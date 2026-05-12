import {
  HclBoolExpr,
  HclExpression,
  HclHeredocExpr,
  HclListExpr,
  HclNullExpr,
  HclNumberExpr,
  HclObjectExpr,
  HclRawExpr,
  HclReferenceExpr,
  HclStringExpr,
} from './types';

export const str = (value: string): HclStringExpr => ({ kind: 'string', value });

export const num = (value: number): HclNumberExpr => {
  if (!Number.isFinite(value)) {
    throw new Error(`HCL number must be finite, got ${value}`);
  }
  return { kind: 'number', value };
};

export const bool = (value: boolean): HclBoolExpr => ({ kind: 'bool', value });

export const nullValue = (): HclNullExpr => ({ kind: 'null' });

export const ref = (expression: string): HclReferenceExpr => ({ kind: 'ref', ref: expression });

export const list = (items: HclExpression[]): HclListExpr => ({ kind: 'list', items });

export const obj = (entries: Record<string, HclExpression>): HclObjectExpr => ({
  kind: 'object',
  entries: Object.entries(entries).map(([key, value]) => ({ key, value })),
});

export const heredoc = (tag: string, body: string, indented = false): HclHeredocExpr => ({
  kind: 'heredoc',
  tag,
  body,
  indented,
});

export const raw = (source: string): HclRawExpr => ({ kind: 'raw', raw: source });

const isHclExpression = (value: unknown): value is HclExpression => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const kind = (value as { kind?: unknown }).kind;
  return (
    kind === 'string' ||
    kind === 'number' ||
    kind === 'bool' ||
    kind === 'null' ||
    kind === 'ref' ||
    kind === 'list' ||
    kind === 'object' ||
    kind === 'heredoc' ||
    kind === 'raw'
  );
};

/**
 * Auto-convert a JS value into an {@link HclExpression}. Use the explicit
 * factories ({@link str}, {@link ref}, {@link raw}, …) when the conversion is
 * ambiguous — `expr("var.region")` becomes a quoted string literal, not a
 * traversal.
 */
export const expr = (value: unknown): HclExpression => {
  if (isHclExpression(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return nullValue();
  }
  if (typeof value === 'string') {
    return str(value);
  }
  if (typeof value === 'number') {
    return num(value);
  }
  if (typeof value === 'boolean') {
    return bool(value);
  }
  if (Array.isArray(value)) {
    return list(value.map(expr));
  }
  if (typeof value === 'object') {
    const entries: Record<string, HclExpression> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (raw === undefined) continue;
      entries[key] = expr(raw);
    }
    return obj(entries);
  }
  throw new Error(`Cannot convert value of type ${typeof value} to an HCL expression`);
};

/** Convert an attribute bag from a plain JS object, dropping `undefined` values. */
export const attrs = (input: Record<string, unknown>): Record<string, HclExpression> => {
  const out: Record<string, HclExpression> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    out[key] = expr(value);
  }
  return out;
};
