export interface ImportedContentBlock {
  type: string;
  data: Record<string, unknown>;
}

export function parseImportedContentToBlocks(input: string): ImportedContentBlock[] {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const nextBlocks: ImportedContentBlock[] = [];
  let i = 0;

  function parsePrefixedHeading(value: string) {
    const match = value.match(/^H([1-6])\s*:\s*(.+)$/i);
    if (!match) return null;
    return {
      level: Number(match[1]),
      text: match[2].trim(),
    };
  }

  function parsePrefixedQuote(value: string) {
    const match = value.match(/^Quote\s*:\s*(.+)$/i);
    if (!match) return null;
    return {
      text: match[1].trim(),
    };
  }

  function pushParagraph(text: string) {
    const value = text.trim();
    if (!value) return;
    nextBlocks.push({ type: 'paragraph', data: { text: value } });
  }

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      nextBlocks.push({
        type: 'heading',
        data: {
          text: headingMatch[2].trim(),
          level: headingMatch[1].length,
        },
      });
      i += 1;
      continue;
    }

    const prefixedHeading = parsePrefixedHeading(line);
    if (prefixedHeading) {
      nextBlocks.push({
        type: 'heading',
        data: {
          text: prefixedHeading.text,
          level: prefixedHeading.level,
        },
      });
      i += 1;
      continue;
    }

    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const quoteLine = lines[i].trim();
        if (!quoteLine.startsWith('>')) break;
        quoteLines.push(quoteLine.replace(/^>\s?/, '').trim());
        i += 1;
      }
      nextBlocks.push({
        type: 'quote',
        data: { text: quoteLines.join(' ').trim(), attribution: '' },
      });
      continue;
    }

    const prefixedQuote = parsePrefixedQuote(line);
    if (prefixedQuote) {
      nextBlocks.push({
        type: 'quote',
        data: { text: prefixedQuote.text, attribution: '' },
      });
      i += 1;
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch);
      const items: string[] = [];

      while (i < lines.length) {
        const listLine = lines[i].trim();
        if (!listLine) break;
        const itemMatch = ordered
          ? listLine.match(/^\d+\.\s+(.+)$/)
          : listLine.match(/^[-*]\s+(.+)$/);
        if (!itemMatch) break;
        items.push(itemMatch[1].trim());
        i += 1;
      }

      if (items.length > 0) {
        nextBlocks.push({ type: 'list', data: { ordered, items } });
      }
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const current = lines[i].trim();
      if (!current) break;
      if (/^(#{1,6})\s+/.test(current)) break;
      if (/^H[1-6]\s*:\s*/i.test(current)) break;
      if (/^>\s?/.test(current)) break;
      if (/^Quote\s*:\s*/i.test(current)) break;
      if (/^[-*]\s+/.test(current)) break;
      if (/^\d+\.\s+/.test(current)) break;
      paragraphLines.push(current);
      i += 1;
    }
    pushParagraph(paragraphLines.join(' '));
  }

  return nextBlocks;
}
