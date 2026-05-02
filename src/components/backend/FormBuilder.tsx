'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export type FormBuilderFieldType =
  | 'text'
  | 'address'
  | 'city'
  | 'state'
  | 'zip'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'file';

export interface FormBuilderField {
  id: string;
  name: string;
  label: string;
  type: FormBuilderFieldType;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  options?: string[];
  row?: number;
  span?: number;
  enableGoogleMaps?: boolean;
}

interface FormBuilderProps {
  value: FormBuilderField[];
  onChange: (fields: FormBuilderField[]) => void;
  selectedFieldId?: string | null;
  onSelectedFieldIdChange?: (fieldId: string | null) => void;
  showInspector?: boolean;
}

const GRID_COLUMNS = 12;
const DRAG_START_THRESHOLD = 6;

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toFieldNameSeed(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) return 'field';
  if (/^[0-9]/.test(normalized)) return `field_${normalized}`;
  return normalized;
}

function autoAssignFieldNames(fields: FormBuilderField[]) {
  const counts = new Map<string, number>();

  return fields.map((field, index) => {
    const seed = toFieldNameSeed(field.label || field.placeholder || `${field.type}_${index + 1}`);
    const nextCount = (counts.get(seed) ?? 0) + 1;
    counts.set(seed, nextCount);

    return {
      ...field,
      name: nextCount === 1 ? seed : `${seed}_${nextCount}`,
    };
  });
}

function getDefaultSpan(type: FormBuilderFieldType) {
  if (type === 'textarea' || type === 'checkbox' || type === 'file' || type === 'address') return 12;
  return 6;
}

function getPredefinedFieldDefaults(type: FormBuilderFieldType) {
  switch (type) {
    case 'address':
      return { label: 'Address', placeholder: 'Street address' };
    case 'city':
      return { label: 'City', placeholder: 'City' };
    case 'state':
      return { label: 'State', placeholder: 'State' };
    case 'zip':
      return { label: 'Zip', placeholder: 'Zip code' };
    case 'email':
      return { label: 'Email', placeholder: 'Email' };
    case 'tel':
      return { label: 'Phone', placeholder: 'Phone' };
    case 'textarea':
      return { label: 'Message', placeholder: 'Message' };
    case 'file':
      return { label: 'File Upload', placeholder: '' };
    default:
      return null;
  }
}

function normalizeField(field: FormBuilderField, index: number): FormBuilderField {
  const rawRow = typeof field.row === 'number' && Number.isFinite(field.row) ? field.row : index + 1;
  const rawSpan = typeof field.span === 'number' && Number.isFinite(field.span) ? field.span : getDefaultSpan(field.type);

  return {
    ...field,
    row: Math.max(1, Math.trunc(rawRow)),
    span: clamp(Math.trunc(rawSpan), 1, GRID_COLUMNS),
    enableGoogleMaps: field.type === 'address' ? field.enableGoogleMaps !== false : undefined,
  };
}

function compactRows(fields: FormBuilderField[]) {
  const normalized = fields.map((field, index) => normalizeField(field, index));
  const uniqueRows = Array.from(new Set(normalized.map((field) => field.row ?? 1))).sort((a, b) => a - b);
  const rowMap = new Map<number, number>(uniqueRows.map((row, index) => [row, index + 1]));

  return autoAssignFieldNames(
    normalized.map((field, index) =>
      normalizeField(
        {
          ...field,
          row: rowMap.get(field.row ?? 1) ?? index + 1,
        },
        index,
      ),
    ),
  );
}

export function normalizeFormBuilderFields(fields: FormBuilderField[]) {
  return compactRows(fields);
}

function repositionField(
  fields: FormBuilderField[],
  draggedId: string,
  targetRow: number,
  beforeFieldId: string | null,
) {
  const sourceIndex = fields.findIndex((field) => field.id === draggedId);
  if (sourceIndex < 0) return fields;

  const next = [...fields];
  const [draggedField] = next.splice(sourceIndex, 1);
  const targetIndex = beforeFieldId ? next.findIndex((field) => field.id === beforeFieldId) : -1;

  const insertAt =
    targetIndex >= 0
      ? targetIndex
      : next.reduce((lastIndex, field, index) => ((field.row ?? 1) <= targetRow ? index + 1 : lastIndex), 0);

  next.splice(insertAt, 0, { ...draggedField, row: targetRow });
  return next;
}

function getDefaultField(type: FormBuilderFieldType = 'text'): FormBuilderField {
  const predefinedDefaults = getPredefinedFieldDefaults(type);
  return {
    id: createId(),
    name: '',
    label: predefinedDefaults?.label ?? '',
    type,
    placeholder: predefinedDefaults?.placeholder ?? '',
    required: false,
    helpText: '',
    options: type === 'select' ? ['Option 1'] : [],
    row: 1,
    span: getDefaultSpan(type),
    enableGoogleMaps: type === 'address' ? true : undefined,
  };
}

export default function FormBuilder({
  value,
  onChange,
  selectedFieldId: selectedFieldIdProp,
  onSelectedFieldIdChange,
  showInspector = true,
}: FormBuilderProps) {
  const fields = useMemo(() => compactRows(value), [value]);
  const [internalSelectedFieldId, setInternalSelectedFieldId] = useState<string | null>(fields[0]?.id ?? null);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ row: number; beforeFieldId: string | null } | null>(null);
  const selectedFieldId = selectedFieldIdProp !== undefined ? selectedFieldIdProp : internalSelectedFieldId;
  const fieldCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rowPanelRefs = useRef<Record<number, HTMLElement | null>>({});
  const interactionRef = useRef<
    | {
        type: 'drag';
        fieldId: string;
        startX: number;
        startY: number;
        moved: boolean;
      }
    | {
        type: 'resize';
        fieldId: string;
        index: number;
        startX: number;
        startSpan: number;
        gridWidth: number;
      }
    | null
  >(null);

  const setSelectedFieldId = useCallback(
    (nextId: string | null) => {
      if (selectedFieldIdProp === undefined) {
        setInternalSelectedFieldId(nextId);
      }
      onSelectedFieldIdChange?.(nextId);
    },
    [selectedFieldIdProp, onSelectedFieldIdChange],
  );

  useEffect(() => {
    if (fields.length === 0) {
      setSelectedFieldId(null);
      return;
    }

    if (!selectedFieldId || !fields.some((field) => field.id === selectedFieldId)) {
      setSelectedFieldId(fields[0].id);
    }
  }, [fields, selectedFieldId, setSelectedFieldId]);

  const rows = useMemo(() => {
    const grouped = new Map<number, Array<{ field: FormBuilderField; index: number }>>();
    fields.forEach((field, index) => {
      const row = field.row ?? 1;
      if (!grouped.has(row)) grouped.set(row, []);
      grouped.get(row)?.push({ field, index });
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [fields]);

  const commit = useCallback(
    (nextFields: FormBuilderField[]) => {
      onChange(compactRows(nextFields));
    },
    [onChange],
  );

  const updateField = useCallback(
    (index: number, nextField: FormBuilderField) => {
      const next = [...fields];
      next[index] = nextField;
      commit(next);
    },
    [commit, fields],
  );

  function removeField(index: number) {
    const removedId = fields[index]?.id;
    commit(fields.filter((_, i) => i !== index));
    if (selectedFieldId === removedId) {
      setSelectedFieldId(null);
    }
  }

  function addField(type: FormBuilderFieldType) {
    const maxRow = fields.reduce((max, field) => Math.max(max, field.row ?? 1), 0);
    const nextField = { ...getDefaultField(type), row: maxRow + 1 };
    commit([...fields, nextField]);
    setSelectedFieldId(nextField.id);
  }

  const clearInteraction = useCallback(() => {
    interactionRef.current = null;
    setDraggedFieldId(null);
    setDropTarget(null);
  }, []);

  const setDropTargetIfChanged = useCallback((nextTarget: { row: number; beforeFieldId: string | null } | null) => {
    setDropTarget((current) => {
      if (
        current?.row === nextTarget?.row &&
        current?.beforeFieldId === nextTarget?.beforeFieldId
      ) {
        return current;
      }
      return nextTarget;
    });
  }, []);

  const resolveDropTarget = useCallback(
    (clientX: number, clientY: number) => {
      const dragInteraction = interactionRef.current;
      const draggedId = dragInteraction?.type === 'drag' ? dragInteraction.fieldId : null;
      let bestRow: number | null = null;
      let bestRowDistance = Number.POSITIVE_INFINITY;

      rows.forEach(([rowNumber]) => {
        const rowPanel = rowPanelRefs.current[rowNumber];
        if (!rowPanel) return;
        const rect = rowPanel.getBoundingClientRect();
        const insideY = clientY >= rect.top && clientY <= rect.bottom;
        const distance = insideY
          ? 0
          : Math.min(Math.abs(clientY - rect.top), Math.abs(clientY - rect.bottom));

        if (distance < bestRowDistance) {
          bestRowDistance = distance;
          bestRow = rowNumber;
        }
      });

      if (bestRow === null) return null;

      const rowFields = rows.find(([rowNumber]) => rowNumber === bestRow)?.[1] ?? [];
      const visibleRowFields = rowFields.filter(({ field }) => field.id !== draggedId);

      for (const { field } of visibleRowFields) {
        const card = fieldCardRefs.current[field.id];
        if (!card) continue;
        const rect = card.getBoundingClientRect();
        if (clientX < rect.left + rect.width / 2) {
          return { row: bestRow, beforeFieldId: field.id };
        }
      }

      return { row: bestRow, beforeFieldId: null };
    },
    [rows],
  );

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const interaction = interactionRef.current;
      if (!interaction) return;

      if (interaction.type === 'drag') {
        const moved =
          interaction.moved ||
          Math.abs(event.clientX - interaction.startX) > DRAG_START_THRESHOLD ||
          Math.abs(event.clientY - interaction.startY) > DRAG_START_THRESHOLD;

        if (!moved) return;

        if (!interaction.moved) {
          interactionRef.current = { ...interaction, moved: true };
          setDraggedFieldId(interaction.fieldId);
        }

        setDropTargetIfChanged(resolveDropTarget(event.clientX, event.clientY));
        return;
      }

      const field = fields[interaction.index];
      if (!field) return;

      const gridWidth = interaction.gridWidth > 0 ? interaction.gridWidth : 1;
      const deltaColumns = Math.round((event.clientX - interaction.startX) / (gridWidth / GRID_COLUMNS));
      const nextSpan = clamp(interaction.startSpan + deltaColumns, 1, GRID_COLUMNS);

      if (nextSpan !== (field.span ?? GRID_COLUMNS)) {
        updateField(interaction.index, { ...field, span: nextSpan });
      }
    }

    function handlePointerEnd() {
      const interaction = interactionRef.current;
      if (!interaction) return;

      if (interaction.type === 'drag' && interaction.moved && dropTarget) {
        commit(repositionField(fields, interaction.fieldId, dropTarget.row, dropTarget.beforeFieldId));
      }

      clearInteraction();
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [clearInteraction, commit, dropTarget, fields, resolveDropTarget, setDropTargetIfChanged, updateField]);

  function startDrag(index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const field = fields[index];
    if (!field) return;

    interactionRef.current = {
      type: 'drag',
      fieldId: field.id,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    setSelectedFieldId(field.id);
  }

  function startResize(index: number, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const field = fields[index];
    if (!field) return;

    const card = fieldCardRefs.current[field.id];
    const gridWidth = card?.parentElement?.getBoundingClientRect().width ?? 0;

    interactionRef.current = {
      type: 'resize',
      fieldId: field.id,
      index,
      startX: event.clientX,
      startSpan: field.span ?? GRID_COLUMNS,
      gridWidth,
    };
    setSelectedFieldId(field.id);
  }

  return (
    <div className={`form-builder__workspace ${showInspector ? '' : 'form-builder__workspace--canvas-only'}`}>
      <div className="form-builder__canvas">
        <div className="form-builder__toolbar">
          <span className="form-builder__toolbar-label">Add field</span>
          <div className="form-builder__add-grid">
            <button type="button" className="block-editor__add-btn" onClick={() => addField('text')}>
              + Text
            </button>
            <button type="button" className="block-editor__add-btn" onClick={() => addField('address')}>
              + Address
            </button>
            <button type="button" className="block-editor__add-btn" onClick={() => addField('city')}>
              + City
            </button>
            <button type="button" className="block-editor__add-btn" onClick={() => addField('state')}>
              + State
            </button>
            <button type="button" className="block-editor__add-btn" onClick={() => addField('zip')}>
              + Zip
            </button>
            <button type="button" className="block-editor__add-btn" onClick={() => addField('textarea')}>
              + Textarea
            </button>
            <button type="button" className="block-editor__add-btn" onClick={() => addField('email')}>
              + Email
            </button>
            <button type="button" className="block-editor__add-btn" onClick={() => addField('tel')}>
              + Phone
            </button>
            <button type="button" className="block-editor__add-btn" onClick={() => addField('number')}>
              + Number
            </button>
            <button type="button" className="block-editor__add-btn" onClick={() => addField('select')}>
              + Select
            </button>
            <button type="button" className="block-editor__add-btn" onClick={() => addField('checkbox')}>
              + Checkbox
            </button>
            <button type="button" className="block-editor__add-btn" onClick={() => addField('file')}>
              + File
            </button>
          </div>
        </div>

        <div className="form-builder__rows">
          {rows.length === 0 ? (
            <div className="form-builder__empty">No fields yet. Add a field to start building.</div>
          ) : (
            rows.map(([rowNumber, rowFields]) => (
              <section
                key={rowNumber}
                ref={(node) => {
                  rowPanelRefs.current[rowNumber] = node;
                }}
                className={`form-builder__row-panel ${
                  dropTarget?.row === rowNumber ? 'form-builder__row-panel--drop-target' : ''
                }`}
                data-form-builder-row-panel="true"
                data-row={rowNumber}
              >
                <div className="form-builder__row-grid">
                  {rowFields.map(({ field, index }) => (
                    <Fragment key={field.id}>
                      {dropTarget?.row === rowNumber && dropTarget.beforeFieldId === field.id ? (
                        <div
                          className="form-builder__drop-slot"
                          style={{ gridColumn: `span ${field.span ?? GRID_COLUMNS}` }}
                          aria-hidden="true"
                        />
                      ) : null}
                      <div
                        ref={(node) => {
                          fieldCardRefs.current[field.id] = node;
                        }}
                        className={`form-builder__field-card ${
                          selectedFieldId === field.id ? 'form-builder__field-card--selected' : ''
                        } ${draggedFieldId === field.id ? 'form-builder__field-card--dragging' : ''}`}
                        style={{ gridColumn: `span ${field.span ?? GRID_COLUMNS}` }}
                        data-form-builder-field-card="true"
                        data-field-id={field.id}
                        data-row={rowNumber}
                      >
                        <div className="form-builder__field-body">
                          <button
                            type="button"
                            className="form-builder__field-main"
                            onClick={() => setSelectedFieldId(field.id)}
                          >
                            <span className="form-builder__field-title-row">
                              <span className="form-builder__field-title">
                                {field.label || field.name || `${field.type} field`}
                              </span>
                              <span className="form-builder__field-type-badge">{field.type}</span>
                            </span>
                            <span className="form-builder__summary">
                              {field.required ? 'Required' : 'Optional'}
                            </span>
                          </button>

                          <div className="form-builder__field-actions">
                            <button
                              type="button"
                              className="form-builder__drag-handle"
                              onPointerDown={(event) => startDrag(index, event)}
                              onClick={() => setSelectedFieldId(field.id)}
                              title="Drag field"
                              aria-label="Drag field"
                            >
                              <span aria-hidden="true">::</span>
                              <span>Drag</span>
                            </button>
                            <button
                              type="button"
                              className="btn block-editor__icon-action block-editor__icon-action--danger"
                              onClick={() => removeField(index)}
                              title="Delete field"
                              aria-label="Delete field"
                            >
                              <span aria-hidden="true">×</span>
                            </button>
                          </div>
                        </div>

                        <div
                          className="form-builder__resize-handle"
                          onPointerDown={(event) => startResize(index, event)}
                          title="Resize field"
                          aria-hidden="true"
                        />
                      </div>
                    </Fragment>
                  ))}
                  {dropTarget?.row === rowNumber && dropTarget.beforeFieldId === null ? (
                    <div className="form-builder__drop-slot form-builder__drop-slot--tail" aria-hidden="true" />
                  ) : null}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      {showInspector && (
        <FormBuilderFieldInspector
          value={fields}
          onChange={onChange}
          selectedFieldId={selectedFieldId}
        />
      )}
    </div>
  );
}

interface FormBuilderFieldInspectorProps {
  value: FormBuilderField[];
  onChange: (fields: FormBuilderField[]) => void;
  selectedFieldId: string | null;
  onSelectedFieldIdChange?: (fieldId: string | null) => void;
  embedded?: boolean;
}

export function FormBuilderFieldInspector({
  value,
  onChange,
  selectedFieldId,
  onSelectedFieldIdChange,
  embedded = false,
}: FormBuilderFieldInspectorProps) {
  void onSelectedFieldIdChange;
  const fields = useMemo(() => compactRows(value), [value]);
  const selectedIndex = fields.findIndex((field) => field.id === selectedFieldId);
  const selectedField = selectedIndex >= 0 ? fields[selectedIndex] : null;

  function commit(nextFields: FormBuilderField[]) {
    onChange(compactRows(nextFields));
  }

  function updateField(index: number, nextField: FormBuilderField) {
    const next = [...fields];
    next[index] = nextField;
    commit(next);
  }

  return (
    <aside
      className={`form-builder__inspector ${embedded ? 'form-builder__inspector--embedded' : ''}`}
      aria-label="Field settings"
    >
      <div className="form-builder__inspector-header">
        <strong>Field Settings</strong>
        {selectedField ? <span>{selectedField.type}</span> : null}
      </div>

      {!selectedField ? (
        <p className="form-builder__inspector-empty">Select a field to edit its settings.</p>
      ) : (
        <div className="block-editor__fields form-builder__inspector-fields">
          <label>
            <span>Label</span>
            <input
              type="text"
              value={selectedField.label}
              onChange={(event) => updateField(selectedIndex, { ...selectedField, label: event.target.value })}
              placeholder="Field label"
            />
          </label>

          <label>
            <span>Placeholder</span>
            <input
              type="text"
              value={selectedField.placeholder ?? ''}
              onChange={(event) => updateField(selectedIndex, { ...selectedField, placeholder: event.target.value })}
              placeholder="Optional"
            />
          </label>

          <label>
            <span>Help Text</span>
            <input
              type="text"
              value={selectedField.helpText ?? ''}
              onChange={(event) => updateField(selectedIndex, { ...selectedField, helpText: event.target.value })}
              placeholder="Optional"
            />
          </label>

          <label className="form-builder__required-toggle" title="Required field">
            <input
              type="checkbox"
              checked={selectedField.required === true}
              onChange={(event) => updateField(selectedIndex, { ...selectedField, required: event.target.checked })}
            />
            <span>Required field</span>
          </label>

          {selectedField.type === 'address' && (
            <label className="form-builder__required-toggle" title="Use Google Maps autocomplete on this field">
              <input
                type="checkbox"
                checked={selectedField.enableGoogleMaps !== false}
                onChange={(event) =>
                  updateField(selectedIndex, {
                    ...selectedField,
                    enableGoogleMaps: event.target.checked,
                  })
                }
              />
              <span>Enable Google Maps</span>
            </label>
          )}

          {selectedField.type === 'select' && (
            <label>
              <span>Options (one per line)</span>
              <textarea
                rows={5}
                value={(selectedField.options ?? []).join('\n')}
                onChange={(event) =>
                  updateField(selectedIndex, {
                    ...selectedField,
                    options: event.target.value
                      .split('\n')
                      .map((option) => option.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="One option per line"
              />
            </label>
          )}
        </div>
      )}
    </aside>
  );
}
