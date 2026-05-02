import { cache } from 'react';
import { readFile } from 'node:fs/promises';
import { getFrontendThemeFilePath, STARTER_THEME_KEY, type FrontendTheme } from '@/lib/frontend/themes';

const DEFAULT_THEME: FrontendTheme = STARTER_THEME_KEY;

type CssNode =
  | { type: 'statement'; text: string }
  | { type: 'rule'; header: string; body: string };

type NestedBodyPart =
  | { type: 'declaration'; text: string }
  | { type: 'rule'; header: string; body: string };

const readThemeCss = cache(async (theme: FrontendTheme): Promise<string> => {
  const css = await getFrontendThemeSource(theme);
  return compileThemeCss(wrapThemeEditorSource(theme, css));
});

export const getFrontendThemeSource = cache(async (theme: FrontendTheme): Promise<string> => {
  const requestedThemePath = getFrontendThemeFilePath(theme);
  const requestedThemeSource = await readFile(requestedThemePath, 'utf8');
  if (theme === STARTER_THEME_KEY) return requestedThemeSource;
  if (requestedThemePath !== getFrontendThemeFilePath(STARTER_THEME_KEY)) return requestedThemeSource;

  const starterThemeSource = requestedThemeSource;
  return starterThemeSource.replaceAll(
    getThemeWrapperSelector(STARTER_THEME_KEY),
    getThemeWrapperSelector(theme),
  );
});

function normalizeEditorSiteSelectors(css: string, theme: FrontendTheme) {
  return css
    .replaceAll(getThemeWrapperSelector(theme), '&')
    .replace(/(^|[^-_a-zA-Z0-9])\.site(?=(?:\s|[>+~:.#\[]|$))/gm, '$1&');
}

function getThemeWrapperSelector(theme: FrontendTheme) {
  return `.site[data-theme='${theme}']`;
}

function skipWhitespaceAndComments(css: string, index: number) {
  let cursor = index;
  while (cursor < css.length) {
    if (css[cursor] === '/' && css[cursor + 1] === '*') {
      const commentEnd = css.indexOf('*/', cursor + 2);
      if (commentEnd === -1) return css.length;
      cursor = commentEnd + 2;
      continue;
    }
    if (/\s/.test(css[cursor])) {
      cursor += 1;
      continue;
    }
    break;
  }
  return cursor;
}

function readUntilBraceOrSemicolon(css: string, index: number) {
  let cursor = index;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let parenDepth = 0;
  let bracketDepth = 0;
  while (cursor < css.length) {
    const char = css[cursor];
    const prev = cursor > 0 ? css[cursor - 1] : '';
    if (!inDoubleQuote && char === "'" && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
      cursor += 1;
      continue;
    }
    if (!inSingleQuote && char === '"' && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      cursor += 1;
      continue;
    }
    if (inSingleQuote || inDoubleQuote) {
      cursor += 1;
      continue;
    }
    if (char === '(') parenDepth += 1;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (char === '[') bracketDepth += 1;
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if ((char === '{' || char === ';') && parenDepth === 0 && bracketDepth === 0) {
      break;
    }
    cursor += 1;
  }
  return { text: css.slice(index, cursor), index: cursor };
}

function readBlock(css: string, openBraceIndex: number) {
  let cursor = openBraceIndex;
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  while (cursor < css.length) {
    const char = css[cursor];
    const next = css[cursor + 1];
    const prev = cursor > 0 ? css[cursor - 1] : '';
    if (!inSingleQuote && !inDoubleQuote && char === '/' && next === '*') {
      const commentEnd = css.indexOf('*/', cursor + 2);
      if (commentEnd === -1) throw new Error('Unterminated CSS comment');
      cursor = commentEnd + 2;
      continue;
    }
    if (!inDoubleQuote && char === "'" && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
      cursor += 1;
      continue;
    }
    if (!inSingleQuote && char === '"' && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      cursor += 1;
      continue;
    }
    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          return {
            body: css.slice(openBraceIndex + 1, cursor),
            index: cursor + 1,
          };
        }
      }
    }
    cursor += 1;
  }
  throw new Error('Unterminated CSS block');
}

function parseCssNodes(css: string) {
  const nodes: CssNode[] = [];
  let cursor = 0;
  while (cursor < css.length) {
    cursor = skipWhitespaceAndComments(css, cursor);
    if (cursor >= css.length) break;
    const headerResult = readUntilBraceOrSemicolon(css, cursor);
    const header = headerResult.text.trim();
    cursor = headerResult.index;
    if (!header) {
      cursor += 1;
      continue;
    }
    if (css[cursor] === ';') {
      nodes.push({ type: 'statement', text: `${header};` });
      cursor += 1;
      continue;
    }
    const blockResult = readBlock(css, cursor);
    nodes.push({ type: 'rule', header, body: blockResult.body });
    cursor = blockResult.index;
  }
  return nodes;
}

function splitTopLevelList(value: string) {
  const parts: string[] = [];
  let start = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const prev = index > 0 ? value[index - 1] : '';
    if (!inDoubleQuote && char === "'" && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (!inSingleQuote && char === '"' && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (inSingleQuote || inDoubleQuote) continue;
    if (char === '(') parenDepth += 1;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (char === '[') bracketDepth += 1;
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === ',' && parenDepth === 0 && bracketDepth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  const last = value.slice(start).trim();
  if (last) parts.push(last);
  return parts;
}

function isDirectAttachmentSelector(selector: string) {
  return selector.startsWith(':') || selector.startsWith('[');
}

function parseNestedBody(body: string) {
  const parts: NestedBodyPart[] = [];
  let cursor = 0;
  let declarationStart = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  const flushDeclaration = (end: number) => {
    const declaration = body.slice(declarationStart, end).trim();
    if (declaration) {
      parts.push({ type: 'declaration', text: declaration.endsWith(';') ? declaration : `${declaration};` });
    }
  };

  while (cursor < body.length) {
    const char = body[cursor];
    const prev = cursor > 0 ? body[cursor - 1] : '';
    const next = body[cursor + 1];
    if (!inSingleQuote && !inDoubleQuote && char === '/' && next === '*') {
      const commentEnd = body.indexOf('*/', cursor + 2);
      if (commentEnd === -1) throw new Error('Unterminated CSS comment');
      cursor = commentEnd + 2;
      continue;
    }
    if (!inDoubleQuote && char === "'" && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
      cursor += 1;
      continue;
    }
    if (!inSingleQuote && char === '"' && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      cursor += 1;
      continue;
    }
    if (inSingleQuote || inDoubleQuote) {
      cursor += 1;
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      cursor += 1;
      continue;
    }
    if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      cursor += 1;
      continue;
    }
    if (char === '[') {
      bracketDepth += 1;
      cursor += 1;
      continue;
    }
    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      cursor += 1;
      continue;
    }
    if (char === ';' && parenDepth === 0 && bracketDepth === 0) {
      flushDeclaration(cursor + 1);
      cursor += 1;
      declarationStart = cursor;
      continue;
    }
    if (char === '{' && parenDepth === 0 && bracketDepth === 0) {
      const header = body.slice(declarationStart, cursor).trim();
      const blockResult = readBlock(body, cursor);
      if (header) {
        parts.push({ type: 'rule', header, body: blockResult.body });
      }
      cursor = blockResult.index;
      declarationStart = cursor;
      continue;
    }
    cursor += 1;
  }

  flushDeclaration(cursor);
  return parts;
}

function resolveNestedSelectors(parentSelector: string, nestedSelector: string) {
  const parents = splitTopLevelList(parentSelector);
  const children = splitTopLevelList(nestedSelector);
  const resolved: string[] = [];

  for (const parent of parents) {
    for (const child of children) {
      if (!child) continue;
      if (child.includes('&')) {
        resolved.push(child.replaceAll('&', parent));
        continue;
      }
      if (/^[>+~]/.test(child)) {
        resolved.push(`${parent} ${child}`);
        continue;
      }
      if (isDirectAttachmentSelector(child)) {
        resolved.push(`${parent}${child}`);
        continue;
      }
      resolved.push(`${parent} ${child}`);
    }
  }

  return resolved.join(', ');
}

function indentBlock(value: string) {
  return value
    .split('\n')
    .map((line) => (line.trim() ? `  ${line}` : line))
    .join('\n');
}

function wrapAtRules(css: string, atRules: string[]) {
  if (!css.trim()) return '';
  return atRules.reduceRight((result, atRule) => `${atRule} {\n${indentBlock(result)}\n}`, css);
}

function compileNestedContext(selector: string, body: string, atRules: string[] = []): string[] {
  const parts = parseNestedBody(body);
  const declarations = parts
    .filter((part): part is Extract<NestedBodyPart, { type: 'declaration' }> => part.type === 'declaration')
    .map((part) => part.text.trim())
    .filter(Boolean);

  const compiled: string[] = [];
  if (declarations.length > 0) {
    compiled.push(
      wrapAtRules(
        `${selector} {\n${declarations.map((declaration) => `  ${declaration}`).join('\n')}\n}`,
        atRules,
      ),
    );
  }

  for (const part of parts) {
    if (part.type !== 'rule') continue;
    if (part.header.startsWith('@media') || part.header.startsWith('@supports') || part.header.startsWith('@container') || part.header.startsWith('@layer')) {
      compiled.push(...compileNestedContext(selector, part.body, [...atRules, part.header]));
      continue;
    }
    if (part.header.startsWith('@keyframes')) {
      compiled.push(wrapAtRules(`${part.header} {\n${part.body.trim()}\n}`, atRules));
      continue;
    }
    compiled.push(...compileNestedContext(resolveNestedSelectors(selector, part.header), part.body, atRules));
  }

  return compiled.filter((entry) => entry.trim());
}

function compileRule(header: string, body: string, atRules: string[] = []): string[] {
  if (header.startsWith('@keyframes')) {
    return [wrapAtRules(`${header} {\n${body.trim()}\n}`, atRules)];
  }

  if (header.startsWith('@media') || header.startsWith('@supports') || header.startsWith('@container') || header.startsWith('@layer')) {
    const nestedNodes = parseCssNodes(body);
    return compileNodes(nestedNodes, [...atRules, header]);
  }

  return compileNestedContext(header, body, atRules);
}

function compileNodes(nodes: CssNode[], atRules: string[] = []): string[] {
  const compiled: string[] = [];
  for (const node of nodes) {
    if (node.type === 'statement') {
      compiled.push(wrapAtRules(node.text, atRules));
      continue;
    }
    compiled.push(...compileRule(node.header, node.body, atRules));
  }
  return compiled;
}

function compileThemeCss(css: string) {
  return compileNodes(parseCssNodes(css))
    .filter((block) => block.trim())
    .join('\n\n');
}

export function compileFrontendThemeSource(css: string) {
  return compileThemeCss(css);
}

export function unwrapThemeEditorSource(theme: FrontendTheme, css: string) {
  const nodes = parseCssNodes(css);
  const wrapperSelector = getThemeWrapperSelector(theme);
  if (
    nodes.length === 1
    && nodes[0]?.type === 'rule'
    && nodes[0].header.trim() === wrapperSelector
  ) {
    return nodes[0].body.trim();
  }
  return css.trim();
}

export function wrapThemeEditorSource(theme: FrontendTheme, css: string) {
  const normalized = css.trim();
  if (!normalized) {
    return `${getThemeWrapperSelector(theme)} {\n}\n`;
  }

  const alreadyWrapped = unwrapThemeEditorSource(theme, normalized) !== normalized;
  if (alreadyWrapped) return normalized;

  const indentedBody = normalized
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

  return `${getThemeWrapperSelector(theme)} {\n${indentedBody}\n}\n`;
}

export const getFrontendThemeEditorBaseSource = cache(async (): Promise<string> => {
  const starterThemeSource = await readFile(getFrontendThemeFilePath(STARTER_THEME_KEY), 'utf8');
  return normalizeEditorSiteSelectors(starterThemeSource, STARTER_THEME_KEY).trim();
});

export async function getFrontendThemeEditorBaseSourceForTheme(theme: FrontendTheme) {
  const themeSource = await getFrontendThemeSource(theme);
  return unwrapThemeEditorSource(theme, themeSource).trim();
}

export async function getFrontendThemeCss(theme: FrontendTheme): Promise<string> {
  try {
    return await readThemeCss(theme);
  } catch {
    if (theme === DEFAULT_THEME) return '';
    return readThemeCss(DEFAULT_THEME);
  }
}
