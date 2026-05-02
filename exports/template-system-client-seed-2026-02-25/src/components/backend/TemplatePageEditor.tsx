'use client';

import { useState } from 'react';
import CollapseCaretToggle from '@/components/backend/CollapseCaretToggle';
import {
  applyFlatImportToTemplatePageContent,
  pageTemplateRegistry,
  sectionRegistry,
  type TemplateFieldDef,
  type TemplatePageContent,
} from '@/lib/content/templatePages';

interface TemplatePageEditorProps {
  value: TemplatePageContent;
  onChange: (value: TemplatePageContent) => void;
}

export default function TemplatePageEditor({ value, onChange }: TemplatePageEditorProps) {
  const template = pageTemplateRegistry[value.templateKey];
  const [showTemplateSections, setShowTemplateSections] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  if (!template) {
    return <p className="form-error">Unknown page template: {value.templateKey}</p>;
  }

  function updateSectionData(sectionId: string, data: Record<string, unknown>) {
    onChange({
      ...value,
      sections: value.sections.map((section) => (section.id === sectionId ? { ...section, data } : section)),
    });
  }

  function updateSectionHidden(sectionId: string, hidden: boolean) {
    onChange({
      ...value,
      sections: value.sections.map((section) => (section.id === sectionId ? { ...section, hidden } : section)),
    });
  }

  function applyImportJson() {
    setImportError(null);
    try {
      const parsed = JSON.parse(importJson) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Import JSON must be an object');
      }
      onChange(applyFlatImportToTemplatePageContent(value, parsed));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Invalid import JSON');
    }
  }

  return (
    <div className="block-editor">
      <div className="block-editor__import">
        <div className="block-editor__top-actions">
          <div className="block-editor__top-left">
            <div className="block-editor__top-title">Template Sections</div>
            <div className="block-editor__top-meta">
              <strong>{template.label}</strong> - {template.slots.length} section{template.slots.length === 1 ? '' : 's'}
            </div>
          </div>
          <CollapseCaretToggle
            collapsed={!showTemplateSections}
            onClick={() => setShowTemplateSections((current) => !current)}
            expandedLabel="Collapse template sections"
            collapsedLabel="Expand template sections"
          />
        </div>
      </div>

      {showTemplateSections && (
        <>
          <div className="block-editor__blocks">
            {template.slots.map((slot) => {
              const section = value.sections.find((item) => item.slotId === slot.slotId);
              if (!section) return null;
              const sectionDef = sectionRegistry[slot.sectionType];
              if (!sectionDef) return null;

              return (
                <div key={section.id} className={`block-editor__block block-editor__block--${section.type}`}>
                  <div className="block-editor__controls">
                    <strong>{slot.label}</strong>
                    {slot.clientCanHide && (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={!section.hidden}
                          onChange={(event) => updateSectionHidden(section.id, !event.target.checked)}
                        />
                        Visible
                      </label>
                    )}
                  </div>
                  {slot.description && (
                    <p style={{ margin: '0 0 0.75rem', color: 'var(--color-muted, #666)' }}>{slot.description}</p>
                  )}
                  {slot.clientCanEdit ? (
                    <TemplateFieldList
                      fields={sectionDef.fields}
                      data={section.data}
                      onChange={(nextData) => updateSectionData(section.id, nextData)}
                    />
                  ) : sectionDef.fields.length > 0 ? (
                    <p>This section is locked.</p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="editor__field-group" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn" onClick={() => setShowImportPanel((current) => !current)}>
              {showImportPanel ? 'Hide Quick Import' : 'Quick Import (JSON)'}
            </button>
          </div>
          {showImportPanel && (
            <div className="editor__field-group">
              <label>
                Flat JSON values (example keys: `hero_headline`, `content_body`, `faqs_json`)
                <textarea
                  rows={8}
                  value={importJson}
                  onChange={(event) => setImportJson(event.target.value)}
                  placeholder={'{"hero_headline":"Kitchen Remodeling","content_body":"Page intro..."}'}
                />
              </label>
              <button type="button" className="btn" onClick={applyImportJson}>
                Apply Import Values
              </button>
              {importError && <p className="form-error">{importError}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TemplateFieldList({
  fields,
  data,
  onChange,
}: {
  fields: TemplateFieldDef[];
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  function setFieldValue(key: string, value: unknown) {
    onChange({ ...data, [key]: value });
  }

  return (
    <div className="block-editor__fields">
      {fields.map((field) => (
        <TemplateFieldInput
          key={field.key}
          field={field}
          value={data[field.key]}
          onChange={(nextValue) => setFieldValue(field.key, nextValue)}
        />
      ))}
    </div>
  );
}

function TemplateFieldInput({
  field,
  value,
  onChange,
}: {
  field: TemplateFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.kind === 'text' || field.kind === 'url') {
    return (
      <label>
        {field.label}
        <input
          type={field.kind === 'url' ? 'url' : 'text'}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }

  if (field.kind === 'textarea') {
    return (
      <label>
        {field.label}
        <textarea
          rows={4}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }

  if (field.kind === 'boolean') {
    return (
      <label>
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />{' '}
        {field.label}
      </label>
    );
  }

  if (field.kind === 'number') {
    return (
      <label>
        {field.label}
        <input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={typeof value === 'number' && Number.isFinite(value) ? value : ''}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
        />
      </label>
    );
  }

  if (field.kind === 'group') {
    const groupValue = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    return (
      <fieldset style={{ border: '1px solid var(--color-border, #ddd)', padding: '0.75rem' }}>
        <legend>{field.label}</legend>
        {field.fields.map((child) => (
          <TemplateFieldInput
            key={`${field.key}.${child.key}`}
            field={child}
            value={groupValue[child.key]}
            onChange={(nextValue) => onChange({ ...groupValue, [child.key]: nextValue })}
          />
        ))}
      </fieldset>
    );
  }

  if (field.kind === 'list') {
    const listField = field;
    const items = Array.isArray(value) ? value : [];

    function updateList(nextItems: unknown[]) {
      onChange(nextItems);
    }

    function addItem() {
      if (listField.itemSchema.kind === 'group') {
        const next: Record<string, unknown> = {};
        for (const child of listField.itemSchema.fields) {
          next[child.key] = child.kind === 'boolean' ? false : child.kind === 'number' ? 0 : '';
        }
        updateList([...items, next]);
        return;
      }

      updateList([...items, '']);
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{field.label}</strong>
          <button type="button" className="btn" onClick={addItem}>
            + Add {listField.itemLabel}
          </button>
        </div>
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.5rem' }}>
          {items.map((item, index) => (
            <div key={index} style={{ border: '1px solid var(--color-border, #ddd)', padding: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>
                  {listField.itemLabel} {index + 1}
                </strong>
                <button
                  type="button"
                  className="btn"
                  onClick={() => updateList(items.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>

              {listField.itemSchema.kind === 'group' ? (
                <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {listField.itemSchema.fields.map((childField) => {
                    const itemObj =
                      item && typeof item === 'object' && !Array.isArray(item)
                        ? (item as Record<string, unknown>)
                        : {};
                    return (
                      <TemplateFieldInput
                        key={`${index}.${childField.key}`}
                        field={childField}
                        value={itemObj[childField.key]}
                        onChange={(nextValue) => {
                          const nextItem = { ...itemObj, [childField.key]: nextValue };
                          updateList(items.map((row, i) => (i === index ? nextItem : row)));
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <TemplateFieldInput
                  field={listField.itemSchema}
                  value={item}
                  onChange={(nextValue) => updateList(items.map((row, i) => (i === index ? nextValue : row)))}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
