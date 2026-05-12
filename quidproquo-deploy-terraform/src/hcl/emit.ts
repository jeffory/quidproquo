import { isValidHclIdentifier } from './identifier';
import { HclExpression, HclObjectEntry, TerraformBlock, TerraformFile } from './types';

const INDENT = '  ';

const indent = (depth: number): string => INDENT.repeat(depth);

/** Escape a JS string for inclusion in a double-quoted HCL string literal. */
const escapeQuotedString = (value: string): string => {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    switch (ch) {
      case '\\':
        out += '\\\\';
        break;
      case '"':
        out += '\\"';
        break;
      case '\n':
        out += '\\n';
        break;
      case '\r':
        out += '\\r';
        break;
      case '\t':
        out += '\\t';
        break;
      case '$':
        // Escape `${` interpolation only — bare `$` is fine.
        if (value[i + 1] === '{') {
          out += '$$';
        } else {
          out += '$';
        }
        break;
      case '%':
        // Escape `%{` template directives only — bare `%` is fine.
        if (value[i + 1] === '{') {
          out += '%%';
        } else {
          out += '%';
        }
        break;
      default: {
        const code = ch.charCodeAt(0);
        if (code < 0x20) {
          out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
          out += ch;
        }
      }
    }
  }
  return out;
};

const quoteLabel = (label: string): string => `"${escapeQuotedString(label)}"`;

const formatNumber = (value: number): string => {
  if (Number.isInteger(value)) return value.toString(10);
  return value.toString();
};

const formatObjectKey = (key: string): string =>
  isValidHclIdentifier(key) ? key : quoteLabel(key);

export const emitExpression = (expression: HclExpression, depth = 0): string => {
  switch (expression.kind) {
    case 'string':
      return `"${escapeQuotedString(expression.value)}"`;
    case 'number':
      return formatNumber(expression.value);
    case 'bool':
      return expression.value ? 'true' : 'false';
    case 'null':
      return 'null';
    case 'ref':
      return expression.ref;
    case 'raw':
      return expression.raw;
    case 'list':
      return emitList(expression.items, depth);
    case 'object':
      return emitObject(expression.entries, depth);
    case 'heredoc':
      return emitHeredoc(expression.tag, expression.body, expression.indented ?? false, depth);
  }
};

const emitList = (items: HclExpression[], depth: number): string => {
  if (items.length === 0) return '[]';

  const inlineParts = items.map((item) => emitExpression(item, depth));
  const inline = `[${inlineParts.join(', ')}]`;
  // Prefer one-line lists when the contents stay short and contain no
  // collection types — matches what `terraform fmt` produces.
  const hasCollection = items.some(
    (item) => item.kind === 'object' || item.kind === 'list' || item.kind === 'heredoc',
  );
  if (!hasCollection && inline.length <= 80) {
    return inline;
  }

  const lines = items.map((item) => `${indent(depth + 1)}${emitExpression(item, depth + 1)},`);
  return ['[', ...lines, `${indent(depth)}]`].join('\n');
};

const emitObject = (entries: HclObjectEntry[], depth: number): string => {
  if (entries.length === 0) return '{}';

  const rendered: Array<{ key: string; valueText: string; isMultiLine: boolean }> = entries.map(
    (entry) => {
      const valueText = emitExpression(entry.value, depth + 1);
      return {
        key: formatObjectKey(entry.key),
        valueText,
        isMultiLine: valueText.includes('\n'),
      };
    },
  );
  let alignWidth = 0;
  for (const item of rendered) {
    if (!item.isMultiLine && item.key.length > alignWidth) alignWidth = item.key.length;
  }
  const inner = rendered.map(
    (item) =>
      `${indent(depth + 1)}${item.isMultiLine ? item.key : item.key.padEnd(alignWidth, ' ')} = ${item.valueText}`,
  );
  return ['{', ...inner, `${indent(depth)}}`].join('\n');
};

const emitHeredoc = (tag: string, body: string, indented: boolean, depth: number): string => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tag)) {
    throw new Error(`Invalid heredoc tag: ${tag}`);
  }
  const opener = indented ? `<<-${tag}` : `<<${tag}`;
  // The closing tag must sit at column 0 for the plain form; for the
  // indented form, Terraform strips the common leading whitespace at parse
  // time, so we align the closer to the current depth.
  const closer = indented ? `${indent(depth)}${tag}` : tag;
  const bodyWithNewline = body.endsWith('\n') ? body : `${body}\n`;
  return `${opener}\n${bodyWithNewline}${closer}`;
};

const emitAttributes = (
  attributes: Record<string, HclExpression>,
  depth: number,
): string[] => {
  const rendered: Array<{ key: string; valueText: string; isMultiLine: boolean }> = [];
  for (const [key, value] of Object.entries(attributes)) {
    const valueText = emitExpression(value, depth);
    rendered.push({ key, valueText, isMultiLine: valueText.includes('\n') });
  }
  let alignWidth = 0;
  for (const item of rendered) {
    if (!item.isMultiLine && item.key.length > alignWidth) alignWidth = item.key.length;
  }
  return rendered.map(
    (item) =>
      `${indent(depth)}${item.isMultiLine ? item.key : item.key.padEnd(alignWidth, ' ')} = ${item.valueText}`,
  );
};

const emitComment = (comment: string, depth: number): string[] =>
  comment.split('\n').map((line) => `${indent(depth)}# ${line}`.trimEnd());

export const emitBlock = (block: TerraformBlock, depth = 0): string => {
  const header = [block.type, ...block.labels.map(quoteLabel)].join(' ');
  const childBlocks = block.blocks ?? [];
  const hasAttributes = Object.keys(block.attributes).length > 0;
  const hasChildren = childBlocks.length > 0;

  const lines: string[] = [];
  if (block.comment) {
    lines.push(...emitComment(block.comment, depth));
  }

  if (!hasAttributes && !hasChildren) {
    lines.push(`${indent(depth)}${header} {}`);
    return lines.join('\n');
  }

  lines.push(`${indent(depth)}${header} {`);
  if (hasAttributes) {
    lines.push(...emitAttributes(block.attributes, depth + 1));
  }
  if (hasAttributes && hasChildren) {
    lines.push('');
  }
  for (let i = 0; i < childBlocks.length; i += 1) {
    if (i > 0) lines.push('');
    lines.push(emitBlock(childBlocks[i], depth + 1));
  }
  lines.push(`${indent(depth)}}`);

  return lines.join('\n');
};

export const emitFile = (file: TerraformFile): string => {
  const parts = file.blocks.map((block) => emitBlock(block, 0));
  return parts.length === 0 ? '' : `${parts.join('\n\n')}\n`;
};
