'use client';

import { FormEvent, useEffect, useState } from 'react';
import EditorSaveButton from '@/components/backend/EditorSaveButton';
import { useRouter } from 'next/navigation';
import FormBuilder, {
  FormBuilderFieldInspector,
  normalizeFormBuilderFields,
  type FormBuilderField,
} from '@/components/backend/FormBuilder';
import useDirtyState from '@/components/backend/useDirtyState';
import { saveFormDefinitionAction } from '@/lib/actions';
import type { Json, Tables } from '@/lib/types/database';
import type { DashboardFormDefinition } from '@/lib/forms/queries';

interface FormBuilderPlaygroundProps {
  initialForms: DashboardFormDefinition[];
  mode?: 'list' | 'edit';
  initialSelectedFormId?: string | null;
  showFormsSidebarList?: boolean;
}

interface EditableForm {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  autoResponseTemplateId: string | null;
  thankYouMessage: string;
  fields: FormBuilderField[];
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function toFormBuilderFields(value: Json | null | undefined): FormBuilderField[] {
  if (!Array.isArray(value)) return [];

  const parsed = value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const typeValue = typeof row.type === 'string' ? row.type : 'text';
    const type = (
      ['text', 'address', 'textarea', 'email', 'tel', 'number', 'select', 'checkbox', 'file'].includes(typeValue)
        ? typeValue
        : 'text'
    ) as FormBuilderField['type'];

    const field: FormBuilderField = {
      id: typeof row.id === 'string' && row.id.trim() ? row.id : `field-${index + 1}`,
      name: typeof row.name === 'string' ? row.name : '',
      label: typeof row.label === 'string' ? row.label : '',
      type,
      placeholder: typeof row.placeholder === 'string' ? row.placeholder : '',
      required: row.required === true,
      helpText: typeof row.helpText === 'string' ? row.helpText : '',
      options: Array.isArray(row.options) ? row.options.filter((option): option is string => typeof option === 'string') : [],
      row: typeof row.row === 'number' && Number.isFinite(row.row) ? Math.max(1, Math.trunc(row.row)) : index + 1,
      span:
        typeof row.span === 'number' && Number.isFinite(row.span)
          ? Math.max(1, Math.min(12, Math.trunc(row.span)))
          : type === 'textarea' || type === 'checkbox' || type === 'file' || type === 'address'
            ? 12
            : 6,
      enableGoogleMaps: type === 'address' ? row.enableGoogleMaps !== false : undefined,
    };
    return field;
  });

  return parsed.filter((field): field is FormBuilderField => field !== null);
}

function toEditableForm(form?: DashboardFormDefinition | null): EditableForm {
  if (!form) {
    return {
      id: null,
      name: '',
      slug: '',
      description: '',
      autoResponseTemplateId: null,
      thankYouMessage: '',
      fields: [],
    };
  }

  return {
    id: form.id,
    name: form.name,
    slug: form.slug,
    description: form.description ?? '',
    autoResponseTemplateId:
      'auto_response_template_id' in form && typeof form.auto_response_template_id === 'string'
        ? form.auto_response_template_id
        : null,
    thankYouMessage: 'thank_you_message' in form && typeof form.thank_you_message === 'string' ? form.thank_you_message : '',
    fields: toFormBuilderFields(form.fields),
  };
}

export default function FormBuilderPlayground({
  initialForms,
  mode = 'edit',
  initialSelectedFormId = null,
  showFormsSidebarList = true,
}: FormBuilderPlaygroundProps) {
  const router = useRouter();
  const [forms, setForms] = useState<DashboardFormDefinition[]>(initialForms);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedFormId);
  const [editor, setEditor] = useState<EditableForm>(() => {
    const initialSelected = initialForms.find((form) => form.id === initialSelectedFormId) ?? null;
    return toEditableForm(initialSelected);
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBuilderFieldId, setSelectedBuilderFieldId] = useState<string | null>(null);
  const isDirty = useDirtyState(editor);
  const selectedForm = forms.find((form) => form.id === selectedId) ?? null;

  useEffect(() => {
    setEditor(toEditableForm(selectedForm));
    setSelectedBuilderFieldId(null);
  }, [selectedForm]);

  function handleCreateNew() {
    router.push('/dashboard/forms/new');
  }

  function handleOpenForm(formId: string) {
    router.push(`/dashboard/forms/${formId}`);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const formData = new FormData();
      if (editor.id) formData.set('id', editor.id);
      formData.set('name', editor.name);
      formData.set('slug', editor.slug || slugify(editor.name));
      formData.set('description', '');
      const normalizedFields = normalizeFormBuilderFields(editor.fields);
      formData.set('fields', JSON.stringify(normalizedFields));
      formData.set('auto_response_template_id', editor.autoResponseTemplateId ?? '');
      formData.set('thank_you_message', editor.thankYouMessage);
      const result = await saveFormDefinitionAction(formData);
      const saved = result.form;

      setForms((current) => {
        const exists = current.some((item) => item.id === saved.id);
        const nextSaved = {
          ...saved,
          is_used: current.find((item) => item.id === saved.id)?.is_used ?? false,
        };
        const next = exists ? current.map((item) => (item.id === saved.id ? nextSaved : item)) : [...current, nextSaved];
        return [...next].sort((a, b) => a.name.localeCompare(b.name));
      });
      setSelectedId(saved.id);
      setSelectedBuilderFieldId(null);

      router.push('/dashboard/forms');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save form');
    } finally {
      setIsSaving(false);
    }
  }

  function renderFormsListPanel() {
    return (
      <div className="forms-manager__panel forms-manager__panel--list">
        <div className="forms-manager__sidebar-header">
          <div>
            <h3>Forms</h3>
            <p className="forms-manager__muted">{forms.length} saved form{forms.length === 1 ? '' : 's'}</p>
          </div>
          <button type="button" className="btn btn--primary" onClick={handleCreateNew}>
            New Form
          </button>
        </div>

        <div className="forms-manager__list">
          {forms.length === 0 ? (
            <p className="forms-manager__empty">No forms saved yet.</p>
          ) : (
            forms.map((form) => (
              <button
                key={form.id}
                type="button"
                className={`forms-manager__list-item ${selectedId === form.id ? 'forms-manager__list-item--active' : ''}`}
                onClick={() => handleOpenForm(form.id)}
                title={form.slug}
              >
                <span className="forms-manager__list-title">
                  {form.name}
                </span>
                <span className="forms-manager__list-meta">
                  {form.is_used ? 'In Use' : 'Unused'} - {form.slug}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  if (mode === 'list') {
    return <div className="forms-manager forms-manager--list-view">{renderFormsListPanel()}</div>;
  }

  return (
    <div className="forms-manager">
      <form onSubmit={handleSave} className="editor">
        <div className="editor__main">
          <section className="forms-manager__panel forms-manager__panel--meta">
            <div className="forms-manager__meta-grid">
              <label className="editor__field-group">
                <span>Form name</span>
                <input
                  type="text"
                  value={editor.name}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setEditor((current) => ({
                      ...current,
                      name: nextName,
                      slug: current.id ? current.slug : slugify(nextName),
                    }));
                  }}
                  required
                />
              </label>
              <div className="editor__field-group forms-manager__meta-controls">
                <span className="forms-manager__meta-controls-label" aria-hidden="true">Status</span>
                <div className="forms-manager__meta-controls-row">
                  <span className={`forms-manager__status ${selectedForm?.is_used ? 'forms-manager__status--active' : ''}`}>
                    {selectedForm?.is_used ? 'In Use' : 'Unused'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <FormBuilder
            value={editor.fields}
            onChange={(fields) => setEditor((current) => ({ ...current, fields }))}
            selectedFieldId={selectedBuilderFieldId}
            onSelectedFieldIdChange={setSelectedBuilderFieldId}
            showInspector={false}
          />

          <section className="forms-manager__panel forms-manager__panel--meta">
            <label className="editor__field-group forms-manager__meta-field forms-manager__meta-field--wide">
              <span>Confirmation message</span>
              <textarea
                value={editor.thankYouMessage}
                onChange={(event) => {
                  const nextMessage = event.target.value;
                  setEditor((current) => ({
                    ...current,
                    thankYouMessage: nextMessage,
                  }));
                }}
                rows={3}
                placeholder="We'll be in touch shortly."
              />
            </label>
          </section>

          {error && <p className="form-error">{error}</p>}
        </div>

        <aside className="editor__sidebar forms-manager__sidebar">
          {showFormsSidebarList ? renderFormsListPanel() : null}

          <div className="forms-manager__panel forms-manager__panel--actions">
            <FormBuilderFieldInspector
              value={editor.fields}
              onChange={(fields) => setEditor((current) => ({ ...current, fields }))}
              selectedFieldId={selectedBuilderFieldId}
              onSelectedFieldIdChange={setSelectedBuilderFieldId}
              embedded
            />
          </div>

          <div className="forms-manager__panel forms-manager__panel--actions">
            <div className="forms-manager__actions">
              <EditorSaveButton isDirty={isDirty} isSaving={isSaving} label="Save Form" disabled={isSaving} />
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
