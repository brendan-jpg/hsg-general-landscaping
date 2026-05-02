export const THEME_EDITOR_SECTION_ORDER = [
  'variables',
  'elements',
  'bgPatterns',
  'everythingElse',
] as const;

export type ThemeEditorSectionKey = (typeof THEME_EDITOR_SECTION_ORDER)[number];

export type ThemeEditorSections = Record<ThemeEditorSectionKey, string>;

export const THEME_EDITOR_SECTION_LABELS: Record<ThemeEditorSectionKey, string> = {
  variables: 'Variables',
  elements: 'Elements',
  bgPatterns: 'BG Patterns',
  everythingElse: 'Everything Else',
};

const SECTION_HEADER_TITLES: Record<ThemeEditorSectionKey, string> = {
  variables: 'VARIABLES',
  elements: 'ELEMENTS',
  bgPatterns: 'BG PATTERNS',
  everythingElse: 'EVERYTHING ELSE',
};

function createEmptySections(): ThemeEditorSections {
  return {
    variables: '',
    elements: '',
    bgPatterns: '',
    everythingElse: '',
  };
}

function normalizeCss(css: string) {
  return css.replace(/\r\n?/g, '\n').trim();
}

function skipLeadingCommentsAndWhitespace(value: string) {
  let cursor = 0;
  while (cursor < value.length) {
    if (/\s/.test(value[cursor] ?? '')) {
      cursor += 1;
      continue;
    }
    if (value[cursor] === '/' && value[cursor + 1] === '*') {
      const commentEnd = value.indexOf('*/', cursor + 2);
      if (commentEnd === -1) return value.length;
      cursor = commentEnd + 2;
      continue;
    }
    break;
  }
  return cursor;
}

function extractChunkHeader(chunk: string) {
  const start = skipLeadingCommentsAndWhitespace(chunk);
  let cursor = start;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let parenDepth = 0;
  let bracketDepth = 0;

  while (cursor < chunk.length) {
    const char = chunk[cursor] ?? '';
    const prev = cursor > 0 ? chunk[cursor - 1] ?? '' : '';

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

  return chunk.slice(start, cursor).trim();
}

function extractTopLevelChunks(css: string) {
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < css.length) {
    const chunkStart = cursor;
    let inLeadingComment = true;

    while (cursor < css.length && inLeadingComment) {
      if (/\s/.test(css[cursor] ?? '')) {
        cursor += 1;
        continue;
      }
      if (css[cursor] === '/' && css[cursor + 1] === '*') {
        const commentEnd = css.indexOf('*/', cursor + 2);
        if (commentEnd === -1) {
          cursor = css.length;
          break;
        }
        cursor = commentEnd + 2;
        continue;
      }
      inLeadingComment = false;
    }

    if (cursor >= css.length) {
      const trailing = css.slice(chunkStart).trim();
      if (trailing) chunks.push(trailing);
      break;
    }

    let inSingleQuote = false;
    let inDoubleQuote = false;
    let parenDepth = 0;
    let bracketDepth = 0;

    while (cursor < css.length) {
      const char = css[cursor] ?? '';
      const prev = cursor > 0 ? css[cursor - 1] ?? '' : '';

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
        cursor += 1;
        break;
      }
      if (char === '{' && parenDepth === 0 && bracketDepth === 0) {
        let depth = 1;
        cursor += 1;

        while (cursor < css.length && depth > 0) {
          const blockChar = css[cursor] ?? '';
          const blockPrev = cursor > 0 ? css[cursor - 1] ?? '' : '';

          if (!inDoubleQuote && blockChar === "'" && blockPrev !== '\\') {
            inSingleQuote = !inSingleQuote;
            cursor += 1;
            continue;
          }
          if (!inSingleQuote && blockChar === '"' && blockPrev !== '\\') {
            inDoubleQuote = !inDoubleQuote;
            cursor += 1;
            continue;
          }
          if (inSingleQuote || inDoubleQuote) {
            cursor += 1;
            continue;
          }
          if (blockChar === '/' && css[cursor + 1] === '*') {
            const commentEnd = css.indexOf('*/', cursor + 2);
            if (commentEnd === -1) {
              cursor = css.length;
              break;
            }
            cursor = commentEnd + 2;
            continue;
          }
          if (blockChar === '{') depth += 1;
          else if (blockChar === '}') depth -= 1;
          cursor += 1;
        }
        break;
      }
      cursor += 1;
    }

    const chunk = css.slice(chunkStart, cursor).trim();
    if (chunk) chunks.push(chunk);
  }

  return chunks;
}

function detectSectionFromText(text: string): ThemeEditorSectionKey | null {
  const lower = text.toLowerCase();
  if (lower.includes('bg patterns') || lower.includes('background patterns')) return 'bgPatterns';
  if (
    lower.includes('theme tokens')
    || lower.includes('tokens')
    || lower.includes('variables')
  ) {
    return 'variables';
  }
  if (
    lower.includes('global styles')
    || lower.includes('globals')
    || lower.includes('base utilities')
    || lower.includes('elements')
  ) {
    return 'elements';
  }
  if (lower.includes('everything else') || lower.includes('theme:')) return 'everythingElse';
  return null;
}

function looksLikeVariableChunk(chunk: string, header: string) {
  const trimmedHeader = header.trim();
  if (trimmedHeader === ':root') return true;

  const variableMatches = chunk.match(/(^|[\s{;])--[-a-z0-9_]+\s*:/gim) ?? [];
  if (variableMatches.length >= 4) return true;

  if (trimmedHeader === '&') {
    const nonVariableDeclarations = chunk
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && line.includes(':') && !line.startsWith('--') && !line.startsWith('/*'));
    return variableMatches.length >= 2 && nonVariableDeclarations.length <= 3;
  }

  return false;
}

function looksLikeBgPatternChunk(chunk: string, header: string) {
  const lower = `${chunk}\n${header}`.toLowerCase();
  return /(^|[^a-z0-9_-])\.bg-\d/.test(lower) || lower.includes('.bg-pattern-');
}

function looksLikeElementChunk(header: string) {
  const lowerHeader = header.toLowerCase();
  const elementStarts = [
    'body',
    'html',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'a',
    'button',
    'input',
    'textarea',
    'select',
    'label',
    'ul',
    'ol',
    'li',
    'img',
    'video',
    'section',
    'article',
    'header',
    'footer',
    'aside',
    'table',
    'thead',
    'tbody',
    'tr',
    'td',
    'th',
    ':root',
    '&',
    '.container',
    '.auto-grid',
    '.btn',
    '.card',
    '.form',
    '.accent',
    '.lede',
    '.grid-',
    '.col-',
    '.row-',
    '.block-renderer',
    '.bg-light',
    '.bg-dark',
  ];

  return elementStarts.some((prefix) => lowerHeader.startsWith(prefix));
}

function classifyChunk(
  chunk: string,
  currentSection: ThemeEditorSectionKey | null,
): ThemeEditorSectionKey {
  const explicitSection = detectSectionFromText(chunk);
  if (explicitSection) return explicitSection;
  if (currentSection) return currentSection;

  const header = extractChunkHeader(chunk);

  if (looksLikeBgPatternChunk(chunk, header)) return 'bgPatterns';
  if (looksLikeVariableChunk(chunk, header)) return 'variables';
  if (looksLikeElementChunk(header)) return 'elements';
  return 'everythingElse';
}

function joinSectionChunks(chunks: string[]) {
  return chunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function buildSectionBlock(section: ThemeEditorSectionKey, content: string) {
  const normalized = content.trim();
  return [
    '/* ============================================================================',
    `   ${SECTION_HEADER_TITLES[section]}`,
    '   ============================================================================ */',
    normalized,
  ]
    .filter((part, index) => part || index < 3)
    .join('\n')
    .trimEnd();
}

export function splitThemeEditorSource(css: string): ThemeEditorSections {
  const normalized = normalizeCss(css);
  const sections = createEmptySections();
  if (!normalized) return sections;

  const chunksBySection: Record<ThemeEditorSectionKey, string[]> = {
    variables: [],
    elements: [],
    bgPatterns: [],
    everythingElse: [],
  };

  let currentSection: ThemeEditorSectionKey | null = null;

  for (const chunk of extractTopLevelChunks(normalized)) {
    const explicitSection = detectSectionFromText(chunk);
    if (explicitSection) currentSection = explicitSection;

    const section = classifyChunk(chunk, currentSection);
    chunksBySection[section].push(chunk);
  }

  for (const section of THEME_EDITOR_SECTION_ORDER) {
    sections[section] = joinSectionChunks(chunksBySection[section]);
  }

  return sections;
}

export function assembleThemeEditorSections(sections: ThemeEditorSections) {
  return THEME_EDITOR_SECTION_ORDER
    .map((section) => {
      const content = (sections[section] ?? '').trim();
      return content ? buildSectionBlock(section, content) : '';
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();
}
