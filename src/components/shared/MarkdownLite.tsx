import type { ReactNode } from 'react';

interface MarkdownLiteProps {
  content: string;
  className?: string;
}

type BlockNode =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string };

function normalize(text: string) {
  return text.replace(/\r\n?/g, '\n');
}

function parseMarkdownLite(input: string): BlockNode[] {
  const lines = normalize(input).split('\n');
  const blocks: BlockNode[] = [];

  let paragraph: string[] = [];
  let quote: string[] = [];
  let list:
    | { type: 'ul' | 'ol'; items: string[] }
    | null = null;

  function flushParagraph() {
    const text = paragraph.join(' ').trim();
    if (text) blocks.push({ type: 'paragraph', text });
    paragraph = [];
  }

  function flushQuote() {
    const text = quote.join('\n').trim();
    if (text) blocks.push({ type: 'quote', text });
    quote = [];
  }

  function flushList() {
    if (list && list.items.length > 0) {
      blocks.push(list);
    }
    list = null;
  }

  function flushAll() {
    flushParagraph();
    flushQuote();
    flushList();
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushAll();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    const ulMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      flushQuote();
      if (!list || list.type !== 'ul') list = { type: 'ul', items: [] };
      list.items.push(ulMatch[1].trim());
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      flushQuote();
      if (!list || list.type !== 'ol') list = { type: 'ol', items: [] };
      list.items.push(olMatch[1].trim());
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quote.push(quoteMatch[1].trim());
      continue;
    }

    flushQuote();
    flushList();
    paragraph.push(trimmed);
  }

  flushAll();
  return blocks;
}

function renderInline(text: string): ReactNode {
  return text;
}

export default function MarkdownLite({ content, className }: MarkdownLiteProps) {
  const blocks = parseMarkdownLite(content);
  if (blocks.length === 0) return null;

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const level = Math.min(6, Math.max(1, block.level));
          if (level === 1) return <h2 key={index}>{renderInline(block.text)}</h2>;
          if (level === 2) return <h3 key={index}>{renderInline(block.text)}</h3>;
          if (level === 3) return <h4 key={index}>{renderInline(block.text)}</h4>;
          if (level === 4) return <h5 key={index}>{renderInline(block.text)}</h5>;
          return <h6 key={index}>{renderInline(block.text)}</h6>;
        }

        if (block.type === 'paragraph') {
          return <p key={index}>{renderInline(block.text)}</p>;
        }

        if (block.type === 'quote') {
          return (
            <blockquote key={index}>
              {block.text.split('\n').map((line, lineIndex) => (
                <p key={lineIndex}>{renderInline(line)}</p>
              ))}
            </blockquote>
          );
        }

        if (block.type === 'ul') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        return (
          <ol key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item)}</li>
            ))}
          </ol>
        );
      })}
    </div>
  );
}

