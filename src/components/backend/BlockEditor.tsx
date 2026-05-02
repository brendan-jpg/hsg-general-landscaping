'use client';

import { ChangeEvent, useState } from 'react';
import CollapseCaretToggle from '@/components/backend/CollapseCaretToggle';
import Button from '@/components/shared/Button';
import DeleteIcon from '@/components/shared/icons/DeleteIcon';

interface Block {
  type: string;
  data: Record<string, unknown>;
}

interface BlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  embedded?: boolean;
  allowedBlockTypes?: Array<'heading' | 'paragraph' | 'quote' | 'list' | 'html'>;
}

const BLOCK_TYPE_LABELS: Record<'heading' | 'paragraph' | 'quote' | 'list' | 'html', string> = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  quote: 'Quote',
  list: 'List',
  html: 'HTML',
};

export default function BlockEditor({
  blocks,
  onChange,
  embedded = false,
  allowedBlockTypes = ['paragraph', 'heading', 'quote', 'list', 'html'],
}: BlockEditorProps) {
  const [showContentBlocks, setShowContentBlocks] = useState(false);

  function updateBlock(index: number, nextBlock: Block) {
    const next = [...blocks];
    next[index] = nextBlock;
    onChange(next);
  }

  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function duplicateBlock(index: number) {
    const block = blocks[index];
    if (!block) return;

    const duplicated: Block = {
      type: block.type,
      data: structuredClone(block.data),
    };

    const next = [...blocks];
    next.splice(index + 1, 0, duplicated);
    onChange(next);
  }

  function replaceBlock(index: number, nextBlocks: Block[]) {
    const before = blocks.slice(0, index);
    const after = blocks.slice(index + 1);
    onChange([...before, ...nextBlocks, ...after]);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;

    const next = [...blocks];
    const current = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = current;
    onChange(next);
  }

  function addBlock(type: string) {
    const defaults: Record<string, Block> = {
      heading: { type: 'heading', data: { text: 'New heading', level: 2 } },
      paragraph: { type: 'paragraph', data: { text: '' } },
      quote: { type: 'quote', data: { text: 'Quote text', attribution: '' } },
      list: { type: 'list', data: { ordered: false, items: ['List item'] } },
      html: { type: 'html', data: { html: '<p>Custom HTML</p>' } },
    };

    onChange([...blocks, defaults[type] ?? defaults.paragraph]);
  }

  const shouldShowBlockContent = embedded ? true : showContentBlocks;

  return (
    <div className={`block-editor${embedded ? ' block-editor--embedded' : ''}`}>
      {!embedded ? (
        <div className="block-editor__top-actions">
          <div className="block-editor__top-left">
            <div className="block-editor__top-title">Content Blocks</div>
            <div className="block-editor__top-meta">
              <strong>{blocks.length}</strong> block{blocks.length === 1 ? '' : 's'}
            </div>
          </div>
          <CollapseCaretToggle
            collapsed={!showContentBlocks}
            onClick={() => setShowContentBlocks((current) => !current)}
            expandedLabel="Collapse content blocks"
            collapsedLabel="Expand content blocks"
          />
        </div>
      ) : null}
      {shouldShowBlockContent && (
        <>
          <div className="block-editor__blocks">
            {blocks.map((block, i) => (
              <div key={i} className={`block-editor__block block-editor__block--${block.type}`}>
                <div className="block-editor__controls">
                  <strong>{block.type}</strong>
                  <div>
                    <button
                      type="button"
                      className="btn block-editor__icon-action block-editor__icon-action--move"
                      onClick={() => moveBlock(i, -1)}
                      disabled={i === 0}
                      aria-label={`Move ${block.type} block up`}
                      title="Move up"
                    >
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button
                      type="button"
                      className="btn block-editor__icon-action block-editor__icon-action--move"
                      onClick={() => moveBlock(i, 1)}
                      disabled={i === blocks.length - 1}
                      aria-label={`Move ${block.type} block down`}
                      title="Move down"
                    >
                      <span aria-hidden="true">↓</span>
                    </button>
                    <button
                      type="button"
                      className="btn block-editor__icon-action block-editor__icon-action--duplicate"
                      onClick={() => duplicateBlock(i)}
                      aria-label={`Duplicate ${block.type} block`}
                      title="Duplicate block"
                    >
                      <span aria-hidden="true">Copy</span>
                    </button>
                    <button
                      type="button"
                      className="btn block-editor__icon-action block-editor__icon-action--danger"
                      onClick={() => removeBlock(i)}
                      aria-label={`Delete ${block.type} block`}
                      title="Delete block"
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </div>
                <BlockFields
                  block={block}
                  onChange={(nextBlock) => updateBlock(i, nextBlock)}
                  onExpandParagraphPaste={(nextBlocks) => replaceBlock(i, nextBlocks)}
                />
              </div>
            ))}
          </div>
          {allowedBlockTypes.length > 0 ? (
            <div className="block-editor__add">
              {allowedBlockTypes.map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant="btn--primary"
                  className="block-editor__add-btn"
                  onClick={() => addBlock(type)}
                >
                  Add {BLOCK_TYPE_LABELS[type]}
                </Button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function BlockFields({
  block,
  onChange,
  onExpandParagraphPaste,
}: {
  block: Block;
  onChange: (nextBlock: Block) => void;
  onExpandParagraphPaste?: (nextBlocks: Block[]) => void;
}) {
  function setData(nextData: Record<string, unknown>) {
    onChange({ ...block, data: nextData });
  }

  function setTextField(field: string) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setData({ ...block.data, [field]: event.target.value });
    };
  }

  if (block.type === 'heading') {
    return (
      <div className="block-editor__fields block-editor__fields--heading">
        <select
          value={String(typeof block.data.level === 'number' ? block.data.level : 2)}
          onChange={(event) =>
            setData({
              ...block.data,
              level: Math.min(6, Math.max(1, Number(event.target.value) || 2)),
            })
          }
          aria-label="Heading level"
        >
          <option value="1">H1</option>
          <option value="2">H2</option>
          <option value="3">H3</option>
          <option value="4">H4</option>
          <option value="5">H5</option>
          <option value="6">H6</option>
        </select>
        <input
          type="text"
          value={typeof block.data.text === 'string' ? block.data.text : ''}
          onChange={setTextField('text')}
          placeholder="Heading text"
        />
      </div>
    );
  }

  if (block.type === 'paragraph' || block.type === 'quote') {
    return (
      <div className="block-editor__fields">
        <textarea
          rows={4}
          value={typeof block.data.text === 'string' ? block.data.text : ''}
          onChange={setTextField('text')}
          onPaste={(event) => {
            if (block.type !== 'paragraph' || !onExpandParagraphPaste) return;

            const pastedText = event.clipboardData.getData('text');
            const paragraphs = pastedText
              .split(/\r?\n\s*\r?\n/g)
              .map((part) => part.trim())
              .filter(Boolean);

            if (paragraphs.length <= 1) return;

            event.preventDefault();
            onExpandParagraphPaste(
              paragraphs.map((text) => ({
                type: 'paragraph',
                data: { text },
              })),
            );
          }}
        />
        {block.type === 'quote' && (
          <input
            type="text"
            value={typeof block.data.attribution === 'string' ? block.data.attribution : ''}
            onChange={setTextField('attribution')}
            placeholder="Attribution"
          />
        )}
      </div>
    );
  }

  if (block.type === 'list') {
    const listText = Array.isArray(block.data.items)
      ? block.data.items.filter((item): item is string => typeof item === 'string').join('\n')
      : '';

    return (
      <div className="block-editor__fields">
        <label>
          <input
            type="checkbox"
            checked={block.data.ordered === true}
            onChange={(event) => setData({ ...block.data, ordered: event.target.checked })}
          />
          Ordered list
        </label>
        <textarea
          rows={4}
          value={listText}
          onChange={(event) =>
            setData({
              ...block.data,
              items: event.target.value
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
            })
          }
          placeholder="One list item per line"
        />
      </div>
    );
  }

  if (block.type === 'html') {
    return (
      <div className="block-editor__fields">
        <textarea
          rows={5}
          value={typeof block.data.html === 'string' ? block.data.html : ''}
          onChange={setTextField('html')}
          placeholder="<p>Custom HTML</p>"
        />
      </div>
    );
  }

  return (
    <div className="block-editor__fields">
      <textarea
        rows={4}
        value={JSON.stringify(block.data, null, 2)}
        onChange={(event) => {
          try {
            const parsed = JSON.parse(event.target.value) as Record<string, unknown>;
            setData(parsed);
          } catch {
            // keep raw edits local until valid JSON
          }
        }}
      />
    </div>
  );
}










