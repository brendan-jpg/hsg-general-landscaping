'use client';

import { useEffect, useRef, useState } from 'react';
import BlockEditor from '@/components/backend/BlockEditor';
import CollapseCaretToggle from '@/components/backend/CollapseCaretToggle';
import MediaPickerField from '@/components/backend/MediaPickerField';
import Button from '@/components/shared/Button';
import MarkdownLite from '@/components/shared/MarkdownLite';
import DeleteIcon from '@/components/shared/icons/DeleteIcon';
import DownIcon from '@/components/shared/icons/DownIcon';
import UpIcon from '@/components/shared/icons/UpIcon';
import type { SharedSectionComponent } from '@/lib/sections/sharedSections';
import {
  listGlobalSectionCatalog,
  pageTemplateRegistry,
  sectionRegistry,
  type TemplateFieldDef,
  type TemplatePageContent,
} from '@/lib/sections/templatePages';
import {
  CANONICAL_RENDERER_VERSION,
  CANONICAL_CONTENT_SECTION_FIELDS,
  createExperimentalFlexibleSectionDefaults,
  createExperimentalLockedSectionDefaults,
  CANONICAL_INSERTABLE_SECTION_TYPES,
  CANONICAL_LOCKED_SECTION_FIELDS,
  CANONICAL_SECTION_FIELDS,
  getExperimentalInsertableLabel,
  isCanonicalLockedSectionType,
  isCanonicalSectionData,
  normalizeCanonicalContentLayout,
  usesCanonicalSectionSystem,
} from '@/lib/sections/canonicalSections';

interface TemplatePageEditorProps {
  value: TemplatePageContent;
  sharedSections?: SharedSectionComponent[];
  currentFeaturedImageUrl?: string;
  templateOptions?: Array<{ key: string; label: string }>;
  dynamicSelectOptions?: Record<string, Array<{ value: string; label: string }>>;
  onTemplateChange?: (templateKey: string) => void;
  onSharedSectionsChange?: (sharedSections: SharedSectionComponent[]) => void;
  onChange: (value: TemplatePageContent) => void;
}

function createSectionId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `section-${Math.random().toString(36).slice(2, 10)}`;
}

const INSERTABLE_SECTION_DEFS = listGlobalSectionCatalog()
  .filter((sectionDef) => (CANONICAL_INSERTABLE_SECTION_TYPES as readonly string[]).includes(sectionDef.type))
  .map((sectionDef) => ({
    ...sectionDef,
    label: getExperimentalInsertableLabel(sectionDef.type, sectionDef.label),
  }));

const CONTENT_SECTION_INSERT_OPTIONS = [
  { type: 'long_form_body_section', label: 'Body Content' },
  { type: 'canonical_content_block', label: 'Block' },
  { type: 'canonical_content_stack_2_text_top', label: 'Stack 2 - Text Top' },
  { type: 'canonical_content_stack_2_text_bottom', label: 'Stack 2 - Text Bottom' },
  { type: 'canonical_content_row_2_text_left', label: 'Row 2 - Text Left' },
  { type: 'canonical_content_row_2_text_right', label: 'Row 2 - Text Right' },
] as const;

const LEGACY_SECTION_INSERT_OPTIONS = [
  { type: 'legacy_gl_hero', label: 'Hero - GL' },
  { type: 'legacy_gl_cta', label: 'CTA - GL' },
  { type: 'legacy_gl_form', label: 'Form Section - GL' },
] as const;

function getSectionCategoryLabel(sectionType: string, sectionLabel: string) {
  const normalizedLabel = sectionLabel.toLowerCase();

  if (sectionType.startsWith('canonical_content_')) return 'Content';
  if (sectionType.includes('hero')) return 'Heroes';
  if (sectionType.includes('grid') || normalizedLabel.includes('grid')) return 'Grids';
  if (sectionType.includes('gallery') || sectionType.includes('before_after') || sectionType.includes('project')) return 'Media';
  if (sectionType.includes('faq')) return 'FAQ';
  if (sectionType.includes('testimonial') || normalizedLabel.includes('testimonial')) return 'Testimonials';
  if (sectionType.includes('quote') || normalizedLabel.includes('quote')) return 'Testimonials';
  if (sectionType.includes('process')) return 'Process';
  if (sectionType.includes('contact')) return 'CTA';
  if (sectionType.includes('team') || normalizedLabel.includes('team') || normalizedLabel.includes('profile')) return 'Team';
  if (sectionType.includes('cta') || normalizedLabel.includes('cta')) return 'CTA';
  return 'Content';
}

const INSERTABLE_SECTION_GROUPS = INSERTABLE_SECTION_DEFS.reduce<Array<{ label: string; sections: typeof INSERTABLE_SECTION_DEFS }>>(
  (groups, sectionDef) => {
    const label = getSectionCategoryLabel(sectionDef.type, sectionDef.label);
    const existing = groups.find((group) => group.label === label);
    if (existing) {
      existing.sections.push(sectionDef);
      return groups;
    }

    groups.push({ label, sections: [sectionDef] });
    return groups;
  },
  [],
).sort((a, b) => {
  const order = ['Heroes', 'Content', 'Grids', 'Media', 'FAQ', 'Testimonials', 'Team', 'Process', 'CTA', 'Callouts'];
  return order.indexOf(a.label) - order.indexOf(b.label);
});

const BASE_DYNAMIC_TAGS = [
  '{{business}}',
  '{{city}}',
  '{{state}}',
  '{{state_code}}',
  '{{primary_area}}',
  '{{primary_service}}',
  '{{url}}',
  '{{site_url}}',
];

function getTemplateDynamicTags(templateKey: string) {
  const tags = [...BASE_DYNAMIC_TAGS];
  if (templateKey.includes('area')) tags.push('{{area}}', '{{location}}', '{{service}}');
  if (templateKey.includes('service')) tags.push('{{service}}');
  if (templateKey.includes('blog')) tags.push('{{post}}', '{{blog_post}}', '{{service}}');
  if (templateKey.includes('custom')) tags.push('{{entry}}', '{{page}}');
  if (templateKey.includes('page') || templateKey.includes('about') || templateKey.includes('contact') || templateKey.includes('home')) {
    tags.push('{{page}}');
  }
  return Array.from(new Set(tags));
}

function getDefaultFlexibleHeroDataForTemplate(templateKey: string) {
  if (templateKey === 'service-content-v1') {
    return {
      heading: '{{service}}',
      supportingKind: 'image',
      useContextFeaturedImage: true,
      useContextIcon: true,
    };
  }

  if (templateKey === 'area-content-v1') {
    return {
      heading: '{{area}}',
      supportingKind: 'image',
      useContextFeaturedImage: true,
      useContextIcon: true,
    };
  }

  if (templateKey === 'blog-post-content-v1') {
    return {
      heading: '{{post}}',
      supportingKind: 'image',
      useContextFeaturedImage: true,
      useContextIcon: false,
    };
  }

  return {
    heading: '{{page}}',
    supportingKind: 'none',
    useContextFeaturedImage: false,
    useContextIcon: false,
  };
}

function createCanonicalSectionData(sectionType: string, templateKey: string) {
  if (sectionType === 'canonical_content_block') {
    return {
      ...createExperimentalFlexibleSectionDefaults(templateKey, false),
      layout: 'block',
    };
  }

  if (sectionType === 'canonical_content_stack_2_text_top') {
    return {
      ...createExperimentalFlexibleSectionDefaults(templateKey, false),
      layout: 'stack_2_text_top',
    };
  }

  if (sectionType === 'canonical_content_stack_2_text_bottom') {
    return {
      ...createExperimentalFlexibleSectionDefaults(templateKey, false),
      layout: 'stack_2_text_bottom',
    };
  }

  if (sectionType === 'canonical_content_row_2_text_left') {
    return {
      ...createExperimentalFlexibleSectionDefaults(templateKey, false),
      layout: 'row_2_text_left',
    };
  }

  if (sectionType === 'canonical_content_row_2_text_right') {
    return {
      ...createExperimentalFlexibleSectionDefaults(templateKey, false),
      layout: 'row_2_text_right',
    };
  }

  if (sectionType === 'flexible_section') {
    return {
      ...createExperimentalFlexibleSectionDefaults(templateKey, false),
      layout: 'block',
    };
  }

  if (
    sectionType === 'flexible_hero_section' ||
    sectionType === 'flexible_cta_section' ||
    sectionType === 'flexible_form_section'
  ) {
    const nextData = createExperimentalFlexibleSectionDefaults(templateKey, sectionType === 'flexible_hero_section');
    if (sectionType === 'flexible_cta_section') {
      nextData.primaryButton = true;
    }
    if (sectionType === 'flexible_form_section') {
      nextData.supportingKind = 'form';
      nextData.primaryButton = false;
    }
    return nextData;
  }

  if (isCanonicalLockedSectionType(sectionType)) {
    return createExperimentalLockedSectionDefaults();
  }

  return null;
}

function createLegacySectionData(sectionType: string, templateKey: string) {
  if (sectionType === 'legacy_gl_hero') {
    return {
      ...(sectionRegistry.home_hero_section.createDefaultData() as Record<string, unknown>),
      layout: 'split',
      variant: 'default',
      heading: templateKey === 'home-page-v1' ? '{{business}}' : '{{page}}',
    };
  }

  if (sectionType === 'legacy_gl_cta') {
    return {
      ...(sectionRegistry.cta_band.createDefaultData() as Record<string, unknown>),
      layout: 'feature',
      variant: 'default',
      accent: 'contact',
    };
  }

  if (sectionType === 'legacy_gl_form') {
    return {
      ...(sectionRegistry.contact_form_section.createDefaultData() as Record<string, unknown>),
      heading: templateKey === 'home-page-v1' ? '{{business}}' : '{{page}}',
      lede: '',
    };
  }

  return null;
}

function getEditorFieldsForSection(
  sectionType: string,
  data: Record<string, unknown>,
  fallbackFields: TemplateFieldDef[],
) {
  if (isCanonicalSectionData(data)) {
    if (sectionType === 'flexible_section') return CANONICAL_CONTENT_SECTION_FIELDS;
    if (isCanonicalLockedSectionType(sectionType)) return CANONICAL_LOCKED_SECTION_FIELDS;
    return CANONICAL_SECTION_FIELDS;
  }
  return fallbackFields;
}

export default function TemplatePageEditor({
  value,
  sharedSections = [],
  currentFeaturedImageUrl = '',
  templateOptions = [],
  dynamicSelectOptions = {},
  onTemplateChange,
  onSharedSectionsChange,
  onChange,
}: TemplatePageEditorProps) {
  const template = pageTemplateRegistry[value.templateKey];
  const [showTemplateSections, setShowTemplateSections] = useState(false);
  const [newSectionType, setNewSectionType] = useState<string>(CONTENT_SECTION_INSERT_OPTIONS[0]?.type ?? INSERTABLE_SECTION_DEFS[0]?.type ?? '');
  const [showAddSectionPicker, setShowAddSectionPicker] = useState(false);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<string[]>(() => value.sections.map((section) => section.id));
  const [activeSectionId, setActiveSectionId] = useState<string>(value.sections[0]?.id ?? '');
  const previousSectionIdsRef = useRef<string[]>(value.sections.map((section) => section.id));

  useEffect(() => {
    const nextIds = value.sections.map((section) => section.id);
    const previousIds = previousSectionIdsRef.current;
    const previousIdSet = new Set(previousIds);
    const newlyAddedIds = nextIds.filter((id) => !previousIdSet.has(id));

    setCollapsedSectionIds((current) => {
      const currentSet = new Set(current);
      for (const id of newlyAddedIds) currentSet.add(id);
      return nextIds.filter((id) => currentSet.has(id));
    });
    previousSectionIdsRef.current = nextIds;
  }, [value.sections]);

  useEffect(() => {
    if (value.sections.length === 0) {
      setActiveSectionId('');
      return;
    }

    if (!activeSectionId || !value.sections.some((section) => section.id === activeSectionId)) {
      setActiveSectionId(value.sections[0].id);
    }
  }, [activeSectionId, value.sections]);

  if (!template) {
    return <p className="form-error">Unknown page template: {value.templateKey}</p>;
  }

  const editableSlotById = new Map(
    template.slots.filter((slot) => slot.clientCanEdit).map((slot) => [slot.slotId, slot] as const),
  );
  const showTemplateSelect = templateOptions.length > 0 && typeof onTemplateChange === 'function';
  const dynamicTags = getTemplateDynamicTags(value.templateKey);
  const collapsedSectionIdSet = new Set(collapsedSectionIds);
  const sharedSectionOptions = sharedSections.map((section) => ({
    value: `shared:${section.id}`,
    label: section.name,
    sectionType: section.sectionType,
  }));

  function updateSharedSection(sharedSectionId: string, updater: (section: SharedSectionComponent) => SharedSectionComponent) {
    if (!onSharedSectionsChange) return;
    onSharedSectionsChange(sharedSections.map((section) => (section.id === sharedSectionId ? updater(section) : section)));
  }

  function updateSections(
    updater: (sections: TemplatePageContent['sections']) => TemplatePageContent['sections'],
  ) {
    onChange({
      ...value,
      sections: updater(value.sections),
    });
  }

  function updateSectionData(sectionId: string, data: Record<string, unknown>) {
    setActiveSectionId(sectionId);
    const source = value.sections.find((section) => section.id === sectionId);
    const sharedSectionId = typeof source?.sharedSectionId === 'string' ? source.sharedSectionId.trim() : '';

    updateSections((sections) =>
      sections.map((section) => {
        if (sharedSectionId && section.sharedSectionId === sharedSectionId) {
          return { ...section, data };
        }
        return section.id === sectionId ? { ...section, data } : section;
      }),
    );

    if (sharedSectionId) {
      updateSharedSection(sharedSectionId, (section) => ({
        ...section,
        data: structuredClone(data),
        updatedAt: new Date().toISOString(),
      }));
    }
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    setActiveSectionId(sectionId);
    updateSections((sections) => {
      const index = sections.findIndex((section) => section.id === sectionId);
      if (index < 0) return sections;
      const nextIndex =
        direction === -1
          ? (index === 0 ? sections.length - 1 : index - 1)
          : (index === sections.length - 1 ? 0 : index + 1);
      const nextSections = [...sections];
      const [moved] = nextSections.splice(index, 1);
      nextSections.splice(nextIndex, 0, moved);
      return nextSections;
    });
  }

  function deleteSection(sectionId: string) {
    setActiveSectionId((current) => (current === sectionId ? '' : current));
    setCollapsedSectionIds((current) => current.filter((id) => id !== sectionId));
    updateSections((sections) => sections.filter((section) => section.id !== sectionId));
  }

  function duplicateSection(sectionId: string) {
    const duplicateId = createSectionId();
    setActiveSectionId(duplicateId);
    updateSections((sections) => {
      const index = sections.findIndex((section) => section.id === sectionId);
      if (index < 0) return sections;
      const source = sections[index];
      const duplicate = {
        ...source,
        id: duplicateId,
        data: structuredClone(source.data),
      };
      const next = [...sections];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
  }

  function toggleSectionCollapsed(sectionId: string) {
    setActiveSectionId(sectionId);
    setCollapsedSectionIds((current) =>
      current.includes(sectionId) ? current.filter((id) => id !== sectionId) : [...current, sectionId],
    );
  }

  function insertSection(sectionType: string) {
    if (sectionType.startsWith('shared:')) {
      const sharedSectionId = sectionType.slice('shared:'.length).trim();
      const sharedSection = sharedSections.find((section) => section.id === sharedSectionId);
      if (!sharedSection) return;
      const nextSectionId = createSectionId();

      updateSections((sections) => [
        {
          id: nextSectionId,
          slotId: `custom_${sharedSection.sectionType}_${sections.length + 1}`,
          type: sharedSection.sectionType,
          data: structuredClone(sharedSection.data),
          hidden: false,
          sharedSectionId: sharedSection.id,
          sharedSectionName: sharedSection.name,
        },
        ...sections,
      ]);
      setActiveSectionId(nextSectionId);
      setShowAddSectionPicker(false);
      return;
    }

    const resolvedSectionType =
      sectionType === 'legacy_gl_hero'
        ? 'home_hero_section'
        : sectionType === 'legacy_gl_cta'
        ? 'cta_band'
        : sectionType === 'legacy_gl_form'
        ? 'contact_form_section'
        :
      sectionType === 'canonical_content_block' ||
      sectionType === 'canonical_content_stack_2_text_top' ||
      sectionType === 'canonical_content_stack_2_text_bottom' ||
      sectionType === 'canonical_content_row_2_text_left' ||
      sectionType === 'canonical_content_row_2_text_right'
        ? 'flexible_section'
        : sectionType;

    const sectionDef = sectionRegistry[resolvedSectionType];
    if (!sectionDef || sectionDef.type === 'layout_marker') return;

    const nextSectionId = createSectionId();
    const nextData =
      createLegacySectionData(sectionType, value.templateKey) ??
      createCanonicalSectionData(sectionType, value.templateKey) ??
      (sectionDef.createDefaultData() as Record<string, unknown>);

    if (resolvedSectionType === 'flexible_hero_section') {
      Object.assign(nextData, getDefaultFlexibleHeroDataForTemplate(value.templateKey));
    }

    updateSections((sections) => [
      {
        id: nextSectionId,
        slotId: `custom_${sectionDef.type}_${sections.length + 1}`,
        type: resolvedSectionType,
        data: nextData,
        hidden: false,
      },
      ...sections,
    ]);
    setActiveSectionId(nextSectionId);
    setShowAddSectionPicker(false);
  }

  function saveSectionAsComponent(sectionId: string, fallbackName: string) {
    setActiveSectionId(sectionId);
    if (!onSharedSectionsChange) return;

    const source = value.sections.find((section) => section.id === sectionId);
    if (!source) return;

    const defaultName = source.sharedSectionName || fallbackName;
    const name = window.prompt('Component name', defaultName)?.trim();
    if (!name) return;

    const existingSharedSectionId = typeof source.sharedSectionId === 'string' ? source.sharedSectionId.trim() : '';
    if (existingSharedSectionId) {
      updateSharedSection(existingSharedSectionId, (section) => ({
        ...section,
        name,
        sectionType: source.type,
        data: structuredClone(source.data),
        updatedAt: new Date().toISOString(),
      }));
      updateSections((sections) =>
        sections.map((section) =>
          section.sharedSectionId === existingSharedSectionId
            ? { ...section, sharedSectionName: name }
            : section,
        ),
      );
      return;
    }

    const nextSharedSection: SharedSectionComponent = {
      id: createSectionId(),
      name,
      sectionType: source.type,
      data: structuredClone(source.data),
      updatedAt: new Date().toISOString(),
    };

    onSharedSectionsChange([...sharedSections, nextSharedSection]);
    updateSections((sections) =>
      sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              sharedSectionId: nextSharedSection.id,
              sharedSectionName: nextSharedSection.name,
            }
          : section,
      ),
    );
  }

  function detachSharedSection(sectionId: string) {
    setActiveSectionId(sectionId);
    updateSections((sections) =>
      sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              sharedSectionId: undefined,
              sharedSectionName: undefined,
            }
          : section,
      ),
    );
  }

  function openAddSectionPicker() {
    setShowTemplateSections(true);
    setShowAddSectionPicker(true);
  }

  function addSection() {
    if (!showAddSectionPicker) {
      openAddSectionPicker();
      return;
    }
    if (!newSectionType) return;
    insertSection(newSectionType);
  }

  function cancelAddSection() {
    setShowAddSectionPicker(false);
  }

  function toggleSectionsPanel() {
    setShowTemplateSections((current) => {
      const next = !current;
      if (!next) setShowAddSectionPicker(false);
      return next;
    });
  }

  return (
    <div className="block-editor">
      <div className="block-editor__top-actions">
        <div className="block-editor__top-left">
          <div className="block-editor__top-title">Page Structure</div>
          <div className="block-editor__top-meta">
            {value.sections.length} block{value.sections.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className={`block-editor__top-controls${showTemplateSelect ? ' block-editor__top-controls--with-template' : ''}`}>
          {showTemplateSelect ? (
            <label className="block-editor__toolbar-field block-editor__toolbar-field--compact">
              <span className="block-editor__toolbar-label">Page Template</span>
              <select
                className="block-editor__toolbar-select"
                value={value.templateKey}
                onChange={(event) => {
                  if (onTemplateChange) onTemplateChange(event.target.value);
                }}
              >
                {templateOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            ) : null}
          {showAddSectionPicker ? (
            <label className="block-editor__toolbar-field block-editor__toolbar-field--compact block-editor__toolbar-field--inline-add">
              <select
                className="block-editor__toolbar-select block-editor__toolbar-select--section"
                value={newSectionType}
                onChange={(event) => setNewSectionType(event.target.value)}
                aria-label="Select section to insert"
              >
                {sharedSectionOptions.length > 0 ? (
                  <optgroup label="Components">
                    {sharedSectionOptions.map((section) => (
                      <option key={section.value} value={section.value}>
                        {section.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {INSERTABLE_SECTION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.label === 'Content'
                      ? CONTENT_SECTION_INSERT_OPTIONS.map((sectionDef) => (
                      <option key={sectionDef.type} value={sectionDef.type}>
                        {sectionDef.label}
                      </option>
                    ))
                      : group.sections.map((sectionDef) => (
                      <option key={sectionDef.type} value={sectionDef.type}>
                        {sectionDef.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <optgroup label="Legacy">
                  {LEGACY_SECTION_INSERT_OPTIONS.map((sectionDef) => (
                    <option key={sectionDef.type} value={sectionDef.type}>
                      {sectionDef.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          ) : null}
          {showAddSectionPicker ? (
            <button
              type="button"
              className="media-picker__icon-btn media-picker__icon-btn--danger block-editor__inline-add-cancel"
              onClick={cancelAddSection}
              title="Cancel"
              aria-label="Cancel adding section"
            >
              <DeleteIcon />
            </button>
          ) : null}
          <Button
            type="button"
            variant={showAddSectionPicker ? 'btn--primary' : 'btn--secondary'}
            size="btn--sm"
            className="block-editor__toolbar-button block-editor__toolbar-button--add-section"
            onClick={addSection}
          >
            {showAddSectionPicker ? 'Insert Section' : '+ Section'}
          </Button>
        </div>
        <CollapseCaretToggle
          collapsed={!showTemplateSections}
          onClick={toggleSectionsPanel}
          expandedLabel="Collapse blocks"
          collapsedLabel="Expand blocks"
        />
      </div>

      {showTemplateSections && (
        <>
          <div className="block-editor__blocks">
            {value.sections.length === 0 && !showAddSectionPicker && (
              <p className="block-editor__empty">
                No blocks added yet. Click + Section to insert one.
              </p>
            )}

            {value.sections.map((section, index) => {
              const sectionDef = sectionRegistry[section.type];
              if (!sectionDef || section.type === 'layout_marker') return null;
              const matchingSlot = editableSlotById.get(section.slotId);
              const blockLabel = matchingSlot?.label || sectionDef.label;
              const isCollapsed = collapsedSectionIdSet.has(section.id);
              const sharedSectionId = typeof section.sharedSectionId === 'string' ? section.sharedSectionId.trim() : '';
              const isSharedSection = Boolean(sharedSectionId);
              const sharedSectionLabel = section.sharedSectionName?.trim() || 'Linked component';

              return (
                <div
                  key={section.id}
                  className={`block-editor__block block-editor__block--template block-editor__block--${section.type}${activeSectionId === section.id ? ' block-editor__block--active' : ''}`}
                  onMouseDown={() => setActiveSectionId(section.id)}
                >
                  <div className="block-editor__controls block-editor__controls--template">
                    <div className="block-editor__controls-main">
                      <strong>
                        {index + 1}. {blockLabel}
                      </strong>
                      {isSharedSection ? (
                        <span className="block-editor__shared-badge">{sharedSectionLabel}</span>
                      ) : null}
                    </div>
                    <div className="block-editor__controls-actions">
                      <button
                        type="button"
                        className="media-picker__icon-btn"
                        onClick={() => saveSectionAsComponent(section.id, blockLabel)}
                        title={isSharedSection ? 'Update shared component' : 'Save as component'}
                        aria-label={isSharedSection ? `Update shared component for ${blockLabel}` : `Save ${blockLabel} as component`}
                      >
                        <LinkIcon />
                      </button>
                      {isSharedSection ? (
                        <button
                          type="button"
                          className="media-picker__icon-btn"
                          onClick={() => detachSharedSection(section.id)}
                          title="Detach component"
                          aria-label={`Detach ${blockLabel} from linked component`}
                        >
                          <UnlinkIcon />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="media-picker__icon-btn"
                        onClick={() => moveSection(section.id, -1)}
                        title={index === 0 ? 'Move to bottom' : 'Move up'}
                        aria-label={`Move ${blockLabel} up`}
                      >
                        <UpIcon />
                      </button>
                      <button
                        type="button"
                        className="media-picker__icon-btn"
                        onClick={() => moveSection(section.id, 1)}
                        title={index === value.sections.length - 1 ? 'Move to top' : 'Move down'}
                        aria-label={`Move ${blockLabel} down`}
                      >
                        <DownIcon />
                      </button>
                      <button
                        type="button"
                        className="media-picker__icon-btn"
                        onClick={() => duplicateSection(section.id)}
                        title="Duplicate block"
                        aria-label={`Duplicate ${blockLabel}`}
                      >
                        <CopyIcon />
                      </button>
                      <button
                        type="button"
                        className="media-picker__icon-btn media-picker__icon-btn--danger"
                        onClick={() => deleteSection(section.id)}
                        title="Delete block"
                        aria-label={`Delete ${blockLabel}`}
                      >
                        <DeleteIcon />
                      </button>
                      <CollapseCaretToggle
                        collapsed={isCollapsed}
                        onClick={() => toggleSectionCollapsed(section.id)}
                        expandedLabel="Collapse block"
                        collapsedLabel="Expand block"
                      />
                    </div>
                  </div>
                  {!isCollapsed && (
                    <TemplateFieldList
                      sectionType={section.type}
                      fields={getEditorFieldsForSection(section.type, section.data, sectionDef.fields)}
                      data={section.data}
                      currentFeaturedImageUrl={currentFeaturedImageUrl}
                      dynamicTags={dynamicTags}
                      dynamicSelectOptions={dynamicSelectOptions}
                      onChange={(nextData) => updateSectionData(section.id, nextData)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function TemplateFieldList({
  sectionType,
  fields,
  data,
  currentFeaturedImageUrl,
  dynamicTags,
  dynamicSelectOptions,
  onChange,
}: {
  sectionType?: string;
  fields: TemplateFieldDef[];
  data: Record<string, unknown>;
  currentFeaturedImageUrl: string;
  dynamicTags: string[];
  dynamicSelectOptions: Record<string, Array<{ value: string; label: string }>>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  function setFieldValue(key: string, value: unknown) {
    onChange({ ...data, [key]: value });
  }

  function toggleVariantKey(key: string) {
    if (key === 'hasDarkBackground' || key === 'hasLightBackground') {
      const isActivating = data[key] !== true;
      onChange({
        ...data,
        hasDarkBackground: key === 'hasDarkBackground' ? isActivating : false,
        hasLightBackground: key === 'hasLightBackground' ? isActivating : false,
      });
      return;
    }

    if (key === 'hasBackgroundImage' || key === 'hasBackgroundVideo') {
      const isActivating = data[key] !== true;
      onChange({
        ...data,
        hasBackgroundImage: key === 'hasBackgroundImage' ? isActivating : false,
        hasBackgroundVideo: key === 'hasBackgroundVideo' ? isActivating : false,
      });
      return;
    }

    setFieldValue(key, data[key] === true ? false : true);
  }

  if (isCanonicalSectionData(data)) {
    return (
      <CanonicalSectionFieldList
        sectionType={sectionType ?? ''}
        data={data}
        currentFeaturedImageUrl={currentFeaturedImageUrl}
        dynamicTags={dynamicTags}
        dynamicSelectOptions={dynamicSelectOptions}
        onChange={onChange}
      />
    );
  }

  if (
    sectionType === 'flexible_section' ||
    sectionType === 'flexible_form_section' ||
    sectionType === 'flexible_cta_section' ||
    sectionType === 'flexible_hero_section'
  ) {
    return (
        <FlexibleSectionFieldList
          sectionType={sectionType}
          fields={fields}
          data={data}
          currentFeaturedImageUrl={currentFeaturedImageUrl}
          dynamicTags={dynamicTags}
          dynamicSelectOptions={dynamicSelectOptions}
          onChange={onChange}
      />
    );
  }

  return renderStandardTemplateFieldList(fields, data, dynamicTags, dynamicSelectOptions, setFieldValue);
}

function renderStandardTemplateFieldList(
  fields: TemplateFieldDef[],
  data: Record<string, unknown>,
  dynamicTags: string[],
  dynamicSelectOptions: Record<string, Array<{ value: string; label: string }>>,
  setFieldValue: (key: string, value: unknown) => void,
) {
  const isFlexibleSectionMetaField = (field: TemplateFieldDef) => ['layout', 'variant'].includes(field.key);
  const metaFields = fields.filter(isFlexibleSectionMetaField);
  const remainingFields = fields.filter((field) => !isFlexibleSectionMetaField(field));

  return (
    <div className="block-editor__fields block-editor__fields--template">
      {metaFields.length > 0 ? (
        <div className="template-field-row template-field-row--section-meta">
          {metaFields.map((field) => (
            <TemplateFieldInput
              key={field.key}
              field={field}
              value={data[field.key]}
              dynamicTags={dynamicTags}
              dynamicSelectOptions={dynamicSelectOptions}
              onChange={(nextValue) => setFieldValue(field.key, nextValue)}
            />
          ))}
        </div>
      ) : null}
      {remainingFields.map((field) => (
        <TemplateFieldInput
          key={field.key}
          field={field}
          value={data[field.key]}
          dynamicTags={dynamicTags}
          dynamicSelectOptions={dynamicSelectOptions}
          onChange={(nextValue) => setFieldValue(field.key, nextValue)}
        />
      ))}
    </div>
  );
}

function CanonicalSectionFieldList({
  sectionType,
  data,
  currentFeaturedImageUrl,
  dynamicTags,
  dynamicSelectOptions,
  onChange,
}: {
  sectionType: string;
  data: Record<string, unknown>;
  currentFeaturedImageUrl: string;
  dynamicTags: string[];
  dynamicSelectOptions: Record<string, Array<{ value: string; label: string }>>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const isLockedSection = isCanonicalLockedSectionType(sectionType);
  const isHeroSection = sectionType === 'flexible_hero_section';
  const isContentSection = sectionType === 'flexible_section';
  const sectionControlMatrix: Record<
    string,
    {
      layout: boolean;
      style: boolean;
      variant: boolean;
      elements: boolean;
      buttons: boolean;
    }
  > = {
    flexible_hero_section: { layout: true, style: true, variant: true, elements: true, buttons: true },
    service_grid_section: { layout: false, style: true, variant: true, elements: false, buttons: false },
    area_grid_section: { layout: false, style: true, variant: true, elements: false, buttons: false },
    blog_grid_section: { layout: false, style: true, variant: true, elements: false, buttons: false },
    testimonial_section: { layout: false, style: true, variant: true, elements: false, buttons: false },
    faq_section: { layout: false, style: true, variant: true, elements: false, buttons: false },
    process_section: { layout: false, style: true, variant: true, elements: false, buttons: false },
    flexible_cta_section: { layout: true, style: true, variant: true, elements: true, buttons: true },
    flexible_form_section: { layout: true, style: true, variant: true, elements: false, buttons: false },
    before_after_section: { layout: false, style: true, variant: true, elements: false, buttons: false },
    gallery_section: { layout: false, style: true, variant: true, elements: false, buttons: false },
    projects_section: { layout: false, style: true, variant: true, elements: false, buttons: false },
    flexible_section: { layout: true, style: true, variant: true, elements: true, buttons: true },
  };
  const controls =
    sectionControlMatrix[sectionType] ??
    (isLockedSection
      ? { layout: false, style: true, variant: true, elements: false, buttons: false }
      : { layout: true, style: true, variant: true, elements: true, buttons: true });
  const layout = isContentSection
    ? normalizeCanonicalContentLayout(typeof data.layout === 'string' ? data.layout : '')
    : (typeof data.layout === 'string' ? data.layout : 'stack');
  const isStack = isContentSection
    ? layout === 'block' || layout === 'stack_2_text_top' || layout === 'stack_2_text_bottom'
    : layout === 'stack';
  const isTextRight = isContentSection ? layout === 'row_2_text_right' : layout === 'two_column_text_right';
  const isTextBottom = isContentSection && layout === 'stack_2_text_bottom';
  const contentBlocks = Array.isArray(data.contentBlocks)
    ? data.contentBlocks.filter(
        (item): item is { type: string; data: Record<string, unknown> } =>
          !!item &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          typeof (item as { type?: unknown }).type === 'string' &&
          !!(item as { data?: unknown }).data &&
          typeof (item as { data?: unknown }).data === 'object' &&
          !Array.isArray((item as { data?: unknown }).data),
      )
    : [];
  const supportingKind = typeof data.supportingKind === 'string' ? data.supportingKind : 'none';
  const contentLayoutField = CANONICAL_CONTENT_SECTION_FIELDS.find((field) => field.key === 'layout');
  const styleFields = CANONICAL_CONTENT_SECTION_FIELDS.filter(
    (field) => field.key === 'backgroundTone' || field.key === 'backgroundPattern',
  );
  const variantFields = [
    { key: 'isCentered', label: 'Centered' },
    { key: 'hasBackgroundImage', label: 'BG Image' },
    { key: 'hasBackgroundVideo', label: 'BG Video' },
  ] as const;
  const textColumnTitle = isStack ? 'Content' : (isTextRight ? 'Right Column' : 'Left Column');
  const supportingColumnTitle = isStack ? 'Supporting' : (isTextRight ? 'Left Column' : 'Right Column');
  const formOptions = dynamicSelectOptions.contact_form_id ?? [];

  function mergeCanonicalData(next: Record<string, unknown>) {
    return {
      ...next,
      rendererVersion: CANONICAL_RENDERER_VERSION,
      ...(isContentSection
        ? { layout: normalizeCanonicalContentLayout(typeof next.layout === 'string' ? next.layout : '') }
        : {}),
    };
  }

  function setFieldValue(key: string, value: unknown) {
    onChange(mergeCanonicalData({ ...data, [key]: value }));
  }

  function toggleVariantKey(key: string) {
    if (key === 'hasBackgroundImage' || key === 'hasBackgroundVideo') {
      const isActivating = data[key] !== true;
      onChange(mergeCanonicalData({
        ...data,
        hasBackgroundImage: key === 'hasBackgroundImage' ? isActivating : false,
        hasBackgroundVideo: key === 'hasBackgroundVideo' ? isActivating : false,
      }));
      return;
    }

    setFieldValue(key, data[key] === true ? false : true);
  }

  function setSupportingKind(kind: 'none' | 'image' | 'video' | 'form' | 'paragraph' | 'icon') {
    onChange(mergeCanonicalData({
      ...data,
      supportingKind: kind,
      ...(kind === 'none'
        ? {
            supportingImage: '',
            supportingVideoUrl: '',
            supportingFormId: '',
            supportingParagraph: '',
            iconValue: '',
            useContextIcon: false,
          }
        : {}),
    }));
  }

  const leftColumn = (
    <div className="template-flex-section__column template-flex-section__column--content">
      <div className="template-flex-section__column-header">
        <strong className="template-flex-section__column-title">{textColumnTitle}</strong>
      </div>
      <div className="template-flex-section__text-fields">
        <TemplateFieldInput
          field={{ key: 'accent', label: 'Accent', kind: 'text' }}
          value={data.accent}
          dynamicTags={dynamicTags}
          dynamicSelectOptions={dynamicSelectOptions}
          onChange={(nextValue) => setFieldValue('accent', nextValue)}
        />
        <TemplateFieldInput
          field={{ key: 'heading', label: 'Heading', kind: 'text' }}
          value={data.heading}
          dynamicTags={dynamicTags}
          dynamicSelectOptions={dynamicSelectOptions}
          onChange={(nextValue) => setFieldValue('heading', nextValue)}
        />
        <TemplateFieldInput
          field={{ key: 'lede', label: 'Lede', kind: 'textarea' }}
          value={data.lede}
          dynamicTags={dynamicTags}
          dynamicSelectOptions={dynamicSelectOptions}
          onChange={(nextValue) => setFieldValue('lede', nextValue)}
        />
      </div>
      {!isLockedSection && controls.buttons ? (
        <div className="template-flex-section__supporting-actions template-flex-section__supporting-actions--content">
          <button
            type="button"
            className={`btn template-flex-section__supporting-btn${data.primaryButton === true ? ' template-flex-section__supporting-btn--active' : ''}`}
            onClick={() => setFieldValue('primaryButton', data.primaryButton === true ? false : true)}
          >
            Primary Btn
          </button>
          <button
            type="button"
            className={`btn template-flex-section__supporting-btn${data.secondaryButton === true ? ' template-flex-section__supporting-btn--active' : ''}`}
            onClick={() => setFieldValue('secondaryButton', data.secondaryButton === true ? false : true)}
          >
            Secondary Btn
          </button>
        </div>
      ) : null}
      {!isLockedSection && controls.elements ? (
        <BlockEditor
          blocks={contentBlocks}
          onChange={(nextBlocks) => setFieldValue('contentBlocks', nextBlocks)}
          embedded
          allowedBlockTypes={[]}
        />
      ) : null}
    </div>
  );

  const rightColumn = !isLockedSection && controls.elements ? (
    <div className="template-flex-section__column template-flex-section__column--supporting">
      {!isStack ? (
        <div className="template-flex-section__column-header">
          <strong className="template-flex-section__column-title">{supportingColumnTitle}</strong>
        </div>
      ) : null}
      <div className="template-flex-section__supporting-actions">
        <button
          type="button"
          className={`btn template-flex-section__supporting-btn${supportingKind === 'image' ? ' template-flex-section__supporting-btn--active' : ''}`}
          onClick={() => setSupportingKind('image')}
        >
          + Image
        </button>
        <button
          type="button"
          className={`btn template-flex-section__supporting-btn${supportingKind === 'video' ? ' template-flex-section__supporting-btn--active' : ''}`}
          onClick={() => setSupportingKind('video')}
        >
          + Video
        </button>
        {!isHeroSection ? (
          <button
            type="button"
            className={`btn template-flex-section__supporting-btn${supportingKind === 'form' ? ' template-flex-section__supporting-btn--active' : ''}`}
            onClick={() => setSupportingKind('form')}
          >
            + Form
          </button>
        ) : null}
        <button
          type="button"
          className={`btn template-flex-section__supporting-btn${supportingKind === 'icon' ? ' template-flex-section__supporting-btn--active' : ''}`}
          onClick={() => setSupportingKind('icon')}
        >
          + Icon
        </button>
        <button
          type="button"
          className={`btn template-flex-section__supporting-btn${supportingKind === 'paragraph' ? ' template-flex-section__supporting-btn--active' : ''}`}
          onClick={() => setSupportingKind('paragraph')}
        >
          + Paragraph
        </button>
        {supportingKind !== 'none' ? (
          <button
            type="button"
            className="btn template-flex-section__supporting-btn template-flex-section__supporting-btn--clear"
            onClick={() => setSupportingKind('none')}
          >
            Clear
          </button>
        ) : null}
      </div>
      {supportingKind === 'image' ? (
        <div className="template-flex-section__supporting-fields">
          <label className="template-field__control">
            <input
              type="checkbox"
              checked={data.useContextFeaturedImage === true}
              onChange={(event) => setFieldValue('useContextFeaturedImage', event.target.checked)}
            />{' '}
            Use Featured Image
          </label>
          {data.useContextFeaturedImage === true && currentFeaturedImageUrl.trim() ? (
            <div className="template-flex-section__featured-image-preview">
              <img src={currentFeaturedImageUrl} alt="" />
            </div>
          ) : null}
          <MediaPickerField
            className="template-flex-section__image-field"
            label="Image"
            value={typeof data.supportingImage === 'string' ? data.supportingImage : ''}
            onChange={(nextValue) => setFieldValue('supportingImage', nextValue)}
            allowUpload
            uploadRole="generic"
            hideLabel
            showChangeAction={false}
          />
        </div>
      ) : null}
      {supportingKind === 'video' ? (
        <div className="template-flex-section__supporting-fields">
          <TemplateFieldInput
            field={{ key: 'supportingVideoUrl', label: 'Video', kind: 'url' }}
            value={data.supportingVideoUrl}
            dynamicTags={dynamicTags}
            dynamicSelectOptions={dynamicSelectOptions}
            onChange={(nextValue) => setFieldValue('supportingVideoUrl', nextValue)}
          />
        </div>
      ) : null}
      {supportingKind === 'form' ? (
        <div className="template-flex-section__supporting-fields">
          {formOptions.length > 0 ? (
            <label className="template-field__control">
              <select
                value={typeof data.supportingFormId === 'string' ? data.supportingFormId : formOptions[0]?.value ?? ''}
                onChange={(event) => setFieldValue('supportingFormId', event.target.value)}
              >
                {formOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="template-flex-section__form-empty">No forms available yet.</p>
          )}
        </div>
      ) : null}
      {supportingKind === 'icon' ? (
        <div className="template-flex-section__supporting-fields">
          {isHeroSection ? (
            <label className="template-field__control">
              <input
                type="checkbox"
                checked={data.useContextIcon === true}
                onChange={(event) => setFieldValue('useContextIcon', event.target.checked)}
              />{' '}
              Use Current Icon
            </label>
          ) : null}
          <MediaPickerField
            className="template-flex-section__image-field"
            label="Icon"
            value={typeof data.iconValue === 'string' ? data.iconValue : ''}
            onChange={(nextValue) => setFieldValue('iconValue', nextValue)}
            allowUpload
            uploadRole="generic"
            hideLabel
            showChangeAction={false}
          />
        </div>
      ) : null}
      {supportingKind === 'paragraph' ? (
        <div className="template-flex-section__supporting-fields">
          <TemplateFieldInput
            field={{ key: 'supportingParagraph', label: 'Paragraph', kind: 'textarea' }}
            value={data.supportingParagraph}
            dynamicTags={dynamicTags}
            dynamicSelectOptions={dynamicSelectOptions}
            onChange={(nextValue) => setFieldValue('supportingParagraph', nextValue)}
          />
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="block-editor__fields block-editor__fields--template">
      {!isLockedSection ? (
        <div className="template-field-row template-field-row--section-meta">
          {controls.layout && contentLayoutField ? (
            <TemplateFieldInput
              field={isContentSection ? contentLayoutField : {
                key: 'layout',
                label: 'Layout',
                kind: 'select',
                options: [
                  { value: 'stack', label: 'Stack' },
                  { value: 'two_column_text_left', label: '2 Column - Text Left' },
                  { value: 'two_column_text_right', label: '2 Column - Text Right' },
                ],
              }}
              value={layout}
              dynamicTags={dynamicTags}
              dynamicSelectOptions={dynamicSelectOptions}
              onChange={(nextValue) => setFieldValue('layout', nextValue)}
            />
          ) : null}
          {controls.style ? styleFields.map((field) => (
            <TemplateFieldInput
              key={field.key}
              field={field}
              value={data[field.key]}
              dynamicTags={dynamicTags}
              dynamicSelectOptions={dynamicSelectOptions}
              onChange={(nextValue) => setFieldValue(field.key, nextValue)}
            />
          )) : null}
          {controls.variant ? (
            <div className="template-flex-section__supporting-actions">
              {variantFields.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  className={`btn template-flex-section__supporting-btn${data[field.key] === true ? ' template-flex-section__supporting-btn--active' : ''}`}
                  onClick={() => toggleVariantKey(field.key)}
                >
                  {field.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {isLockedSection ? (
        <div className="template-flex-section__column template-flex-section__column--content">
          {controls.style ? (
            <div className="template-field-row template-field-row--section-meta">
              {styleFields.map((field) => (
                <TemplateFieldInput
                  key={field.key}
                  field={field}
                  value={data[field.key]}
                  dynamicTags={dynamicTags}
                  dynamicSelectOptions={dynamicSelectOptions}
                  onChange={(nextValue) => setFieldValue(field.key, nextValue)}
                />
              ))}
            </div>
          ) : null}
          {controls.variant ? (
            <div className="template-flex-section__supporting-actions">
              {variantFields.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  className={`btn template-flex-section__supporting-btn${data[field.key] === true ? ' template-flex-section__supporting-btn--active' : ''}`}
                  onClick={() => toggleVariantKey(field.key)}
                >
                  {field.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="template-flex-section__text-fields">
            <TemplateFieldInput
              field={{ key: 'accent', label: 'Accent', kind: 'text' }}
              value={data.accent}
              dynamicTags={dynamicTags}
              dynamicSelectOptions={dynamicSelectOptions}
              onChange={(nextValue) => setFieldValue('accent', nextValue)}
            />
            <TemplateFieldInput
              field={{ key: 'heading', label: 'Heading', kind: 'text' }}
              value={data.heading}
              dynamicTags={dynamicTags}
              dynamicSelectOptions={dynamicSelectOptions}
              onChange={(nextValue) => setFieldValue('heading', nextValue)}
            />
            <TemplateFieldInput
              field={{ key: 'lede', label: 'Lede', kind: 'textarea' }}
              value={data.lede}
              dynamicTags={dynamicTags}
              dynamicSelectOptions={dynamicSelectOptions}
              onChange={(nextValue) => setFieldValue('lede', nextValue)}
            />
          </div>
        </div>
      ) : (
        <div className={`template-flex-section${isStack ? ' template-flex-section--one-column' : ''}`}>
          {isStack ? (
            <>
              {isTextBottom ? rightColumn : leftColumn}
              {isTextBottom ? leftColumn : rightColumn}
            </>
          ) : isTextRight ? (
            <>
              {rightColumn}
              {leftColumn}
            </>
          ) : (
            <>
              {leftColumn}
              {rightColumn}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FlexibleSectionFieldList({
  sectionType,
  fields,
  data,
  currentFeaturedImageUrl,
  dynamicTags,
  dynamicSelectOptions,
  onChange,
}: {
  sectionType: string;
  fields: TemplateFieldDef[];
  data: Record<string, unknown>;
  currentFeaturedImageUrl: string;
  dynamicTags: string[];
  dynamicSelectOptions: Record<string, Array<{ value: string; label: string }>>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const isFlexibleFormSection = sectionType === 'flexible_form_section';
  const isFlexibleHeroSection = sectionType === 'flexible_hero_section';
  const isFlexibleContentSection = sectionType === 'flexible_section';
  const isFlexibleCtaSection = sectionType === 'flexible_cta_section';
  const isFeaturedImageFlexibleSection = isFlexibleHeroSection || isFlexibleContentSection;
  const fieldByKey = new Map(fields.map((field) => [field.key, field] as const));
  const metaFieldKeys = [
    'layout',
    'variant',
    ...(isFlexibleCtaSection ? ['ctaType'] : []),
    ...(isFlexibleFormSection ? ['formColumn', 'mediaColumn'] : []),
  ];
  const metaFields = metaFieldKeys
    .map((key) => fieldByKey.get(key))
    .filter((field): field is TemplateFieldDef => Boolean(field));
  const introFields = ['accent', 'heading', 'lede']
    .map((key) => fieldByKey.get(key))
    .filter((field): field is TemplateFieldDef => Boolean(field));
  const useContextIconField = fieldByKey.get('useContextIcon');
  const primaryButtonFields = ['primaryButton']
    .map((key) => fieldByKey.get(key))
    .filter((field): field is TemplateFieldDef => Boolean(field));
  const secondaryButtonFields = ['secondaryButton']
    .map((key) => fieldByKey.get(key))
    .filter((field): field is TemplateFieldDef => Boolean(field));
  const contentBlocksField = fieldByKey.get('contentBlocks');
  const contactFormIdField = fieldByKey.get('contact_form_id');
  const supportingImageField = fieldByKey.get('supportingImage');
  const supportingVideoUrlField = fieldByKey.get('supportingVideoUrl');
  const supportingFormIdField = fieldByKey.get('supportingFormId');
  const useContextFeaturedImage = data.useContextFeaturedImage === true;
  const customSupportingImage =
    typeof data.supportingImage === 'string' ? data.supportingImage.trim() : '';

  const layout = typeof data.layout === 'string' ? data.layout : 'one_column';
  const explicitSupportingKind = typeof data.supportingKind === 'string' ? data.supportingKind : '';
  const inferredSupportingKind =
    explicitSupportingKind ||
    (useContextFeaturedImage ? 'image' : '') ||
    (typeof data.supportingImage === 'string' && data.supportingImage.trim() ? 'image' : '') ||
    (typeof data.supportingVideoUrl === 'string' && data.supportingVideoUrl.trim() ? 'video' : '') ||
    (!isFlexibleHeroSection && typeof data.supportingFormId === 'string' && data.supportingFormId.trim() ? 'form' : '') ||
    'none';
  const allowedSupportingKinds = isFlexibleHeroSection ? ['image', 'video'] : ['image', 'video', 'form'];
  const activeSupportingKind = allowedSupportingKinds.includes(inferredSupportingKind) ? inferredSupportingKind : 'none';
  const isOneColumn = layout === 'one_column';
  const isTextRight = layout === 'two_column_text_right';

  function setFieldValue(key: string, value: unknown) {
    onChange({ ...data, [key]: value });
  }

  function activateSupporting(kind: 'image' | 'video' | 'form') {
    onChange({
      ...data,
      supportingKind: kind,
      ...(kind === 'image' || isFlexibleHeroSection ? {} : { useContextFeaturedImage: false }),
    });
  }

  function clearSupporting() {
    onChange({
      ...data,
      supportingKind: 'none',
      supportingBlocks: [],
      supportingImage: '',
      useContextFeaturedImage: false,
      supportingVideoUrl: '',
      supportingFormId: '',
      supportingUnavailableText: '',
      logos: [],
    });
  }

  function activateFeaturedImage() {
    onChange({
      ...data,
      supportingKind: 'image',
      useContextFeaturedImage: true,
      supportingImage: '',
      supportingVideoUrl: '',
      supportingFormId: '',
      supportingUnavailableText: '',
    });
  }

  const contentColumn = (
    <div className="template-flex-section__column template-flex-section__column--content">
      <div className="template-flex-section__column-header">
        <strong className="template-flex-section__column-title">
          {isOneColumn ? 'Content' : (isTextRight ? 'Right Column' : 'Left Column')}
        </strong>
      </div>
      <div className="template-flex-section__text-fields">
        {introFields.map((field) => (
          <TemplateFieldInput
            key={field.key}
            field={field}
            value={data[field.key]}
            dynamicTags={dynamicTags}
            dynamicSelectOptions={dynamicSelectOptions}
            onChange={(nextValue) => setFieldValue(field.key, nextValue)}
          />
        ))}
      </div>
      {contentBlocksField ? (
        <TemplateFieldInput
          field={contentBlocksField}
          value={data[contentBlocksField.key]}
          dynamicTags={dynamicTags}
          dynamicSelectOptions={dynamicSelectOptions}
          onChange={(nextValue) => setFieldValue(contentBlocksField.key, nextValue)}
        />
      ) : null}
      {isFlexibleFormSection ? (
        <div className="template-flex-section__supporting-fields">
          {contactFormIdField ? (
            <TemplateFieldInput
              field={contactFormIdField}
              value={data[contactFormIdField.key]}
              dynamicTags={dynamicTags}
              dynamicSelectOptions={dynamicSelectOptions}
              onChange={(nextValue) => setFieldValue(contactFormIdField.key, nextValue)}
            />
          ) : null}
        </div>
      ) : null}
      {primaryButtonFields.length > 0 || secondaryButtonFields.length > 0 ? (
        <div className="template-flex-section__supporting-actions template-flex-section__supporting-actions--content">
          {primaryButtonFields.length > 0 ? (
            primaryButtonFields.map((field) => (
              <button
                key={field.key}
                type="button"
                className={`btn template-flex-section__supporting-btn${data[field.key] === true ? ' template-flex-section__supporting-btn--active' : ''}`}
                onClick={() => setFieldValue(field.key, data[field.key] === true ? false : true)}
              >
                {field.label}
              </button>
            ))
          ) : null}
          {secondaryButtonFields.length > 0 ? (
            secondaryButtonFields.map((field) => (
              <button
                key={field.key}
                type="button"
                className={`btn template-flex-section__supporting-btn${data[field.key] === true ? ' template-flex-section__supporting-btn--active' : ''}`}
                onClick={() => setFieldValue(field.key, data[field.key] === true ? false : true)}
              >
                {field.label}
              </button>
            ))
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const supportingColumn = !isOneColumn ? (
    <div className="template-flex-section__column template-flex-section__column--supporting">
      <div className="template-flex-section__column-header">
        <strong className="template-flex-section__column-title">
          {isTextRight ? 'Left Column' : 'Right Column'}
        </strong>
      </div>
      {isFlexibleFormSection ? (
        <div className="template-flex-section__supporting-fields">
          {supportingImageField ? (
            <MediaPickerField
              className="template-flex-section__image-field"
              label={supportingImageField.label}
              value={typeof data[supportingImageField.key] === 'string' ? (data[supportingImageField.key] as string) : ''}
              onChange={(nextValue) => setFieldValue(supportingImageField.key, nextValue)}
              allowUpload
              uploadRole="generic"
              hideLabel
              showChangeAction={false}
            />
          ) : null}
        </div>
      ) : (
        <>
          <div className="template-flex-section__supporting-actions">
            {isFlexibleHeroSection && useContextIconField ? (
              <button
                type="button"
                className={`btn template-flex-section__supporting-btn${data[useContextIconField.key] === true ? ' template-flex-section__supporting-btn--active' : ''}`}
                onClick={() => setFieldValue(useContextIconField.key, data[useContextIconField.key] === true ? false : true)}
              >
                Use Current Icon
              </button>
            ) : null}
            <button
              type="button"
              className={`btn template-flex-section__supporting-btn${activeSupportingKind === 'image' ? ' template-flex-section__supporting-btn--active' : ''}`}
              onClick={() => activateSupporting('image')}
            >
              Image
            </button>
            {isFeaturedImageFlexibleSection && !isFlexibleHeroSection ? (
              <button
                type="button"
                className={`btn template-flex-section__supporting-btn${useContextFeaturedImage ? ' template-flex-section__supporting-btn--active' : ''}`}
                onClick={activateFeaturedImage}
              >
                Featured Image
              </button>
            ) : null}
            <button
              type="button"
              className={`btn template-flex-section__supporting-btn${activeSupportingKind === 'video' ? ' template-flex-section__supporting-btn--active' : ''}`}
              onClick={() => activateSupporting('video')}
            >
              Video
            </button>
            {!isFlexibleHeroSection ? (
              <button
                type="button"
                className={`btn template-flex-section__supporting-btn${activeSupportingKind === 'form' ? ' template-flex-section__supporting-btn--active' : ''}`}
                onClick={() => activateSupporting('form')}
              >
                + Form
              </button>
            ) : null}
            {activeSupportingKind !== 'none' ? (
              <button
                type="button"
                className="btn template-flex-section__supporting-btn template-flex-section__supporting-btn--clear"
                onClick={clearSupporting}
              >
                Clear
              </button>
            ) : null}
          </div>
          {activeSupportingKind === 'none' ? (
            <p className="template-flex-section__supporting-empty">Pick what goes in this column.</p>
          ) : null}

          {activeSupportingKind === 'image' && supportingImageField ? (
            <div className="template-flex-section__supporting-fields">
              {!isFlexibleHeroSection && isFeaturedImageFlexibleSection && useContextFeaturedImage ? (
                <div className="template-flex-section__featured-image-note">
                  <strong>Using featured image</strong>
                  <p>
                    Shared components will use each page&apos;s own featured image.
                  </p>
                  {currentFeaturedImageUrl.trim() ? (
                    <div className="template-flex-section__featured-image-preview">
                      <img src={currentFeaturedImageUrl} alt="" />
                    </div>
                  ) : (
                    <p className="template-flex-section__featured-image-empty">This page doesn&apos;t have a featured image yet.</p>
                  )}
                </div>
              ) : null}
              <MediaPickerField
                className="template-flex-section__image-field"
                label={supportingImageField.label}
                value={
                  useContextFeaturedImage && isFlexibleHeroSection
                    ? currentFeaturedImageUrl
                    : !useContextFeaturedImage && typeof data[supportingImageField.key] === 'string'
                      ? (data[supportingImageField.key] as string)
                      : ''
                }
                onChange={(nextValue) =>
                  onChange(
                    nextValue
                      ? {
                          ...data,
                          supportingKind: 'image',
                          useContextFeaturedImage: currentFeaturedImageUrl.length > 0 && nextValue === currentFeaturedImageUrl,
                          [supportingImageField.key]:
                            currentFeaturedImageUrl.length > 0 && nextValue === currentFeaturedImageUrl ? '' : nextValue,
                        }
                      : {
                          ...data,
                          supportingKind: 'none',
                          useContextFeaturedImage: false,
                          [supportingImageField.key]: '',
                        },
                  )}
                allowUpload
                uploadRole="generic"
                hideLabel
                showChangeAction={false}
              />
            </div>
          ) : null}

          {activeSupportingKind === 'video' && supportingVideoUrlField ? (
            <div className="template-flex-section__supporting-fields">
              <TemplateFieldInput
                field={supportingVideoUrlField}
                value={data[supportingVideoUrlField.key]}
                dynamicTags={dynamicTags}
                dynamicSelectOptions={dynamicSelectOptions}
                onChange={(nextValue) => onChange({ ...data, supportingKind: 'video', [supportingVideoUrlField.key]: nextValue })}
              />
            </div>
          ) : null}

          {activeSupportingKind === 'form' && !isFlexibleHeroSection ? (
            <div className="template-flex-section__supporting-fields">
              {supportingFormIdField ? (
                <TemplateFieldInput
                  field={supportingFormIdField}
                  value={data[supportingFormIdField.key]}
                  dynamicTags={dynamicTags}
                  dynamicSelectOptions={dynamicSelectOptions}
                  onChange={(nextValue) => onChange({ ...data, supportingKind: 'form', [supportingFormIdField.key]: nextValue })}
                />
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  ) : null;

  const oneColumnBackgroundControls =
    isOneColumn && isFeaturedImageFlexibleSection && supportingImageField ? (
      <div className="template-flex-section__column template-flex-section__column--supporting">
        <div className="template-flex-section__column-header">
          <strong className="template-flex-section__column-title">Background Image</strong>
        </div>
        <div className="template-flex-section__supporting-actions">
          <button
            type="button"
            className={`btn template-flex-section__supporting-btn${activeSupportingKind === 'image' ? ' template-flex-section__supporting-btn--active' : ''}`}
            onClick={() => activateSupporting('image')}
          >
            Image
          </button>
          {!isFlexibleHeroSection ? (
            <button
              type="button"
              className={`btn template-flex-section__supporting-btn${useContextFeaturedImage ? ' template-flex-section__supporting-btn--active' : ''}`}
              onClick={activateFeaturedImage}
            >
              Featured Image
            </button>
          ) : null}
          {activeSupportingKind === 'image' ? (
            <button
              type="button"
              className="btn template-flex-section__supporting-btn template-flex-section__supporting-btn--clear"
              onClick={clearSupporting}
            >
              Clear
            </button>
          ) : null}
        </div>
        {!isFlexibleHeroSection && useContextFeaturedImage ? (
          <div className="template-flex-section__featured-image-note">
            <strong>Using featured image</strong>
            <p>Shared components will use each page&apos;s own featured image as the background.</p>
            {currentFeaturedImageUrl.trim() ? (
              <div className="template-flex-section__featured-image-preview">
                <img src={currentFeaturedImageUrl} alt="" />
              </div>
            ) : (
              <p className="template-flex-section__featured-image-empty">This page doesn&apos;t have a featured image yet.</p>
            )}
          </div>
        ) : null}
        {activeSupportingKind === 'image' ? (
          <div className="template-flex-section__supporting-fields">
            <MediaPickerField
              className="template-flex-section__image-field"
              label={supportingImageField.label}
              value={
                useContextFeaturedImage && isFlexibleHeroSection
                  ? currentFeaturedImageUrl
                  : !useContextFeaturedImage && typeof data[supportingImageField.key] === 'string'
                    ? (data[supportingImageField.key] as string)
                    : ''
              }
              onChange={(nextValue) =>
                onChange(
                  nextValue
                    ? {
                        ...data,
                        supportingKind: 'image',
                        useContextFeaturedImage: currentFeaturedImageUrl.length > 0 && nextValue === currentFeaturedImageUrl,
                        [supportingImageField.key]:
                          currentFeaturedImageUrl.length > 0 && nextValue === currentFeaturedImageUrl ? '' : nextValue,
                      }
                    : {
                        ...data,
                        supportingKind: 'none',
                        useContextFeaturedImage: false,
                        [supportingImageField.key]: '',
                      },
                )}
              allowUpload
              uploadRole="hero"
              hideLabel
              showChangeAction={false}
            />
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="block-editor__fields block-editor__fields--template">
      {metaFields.length > 0 ? (
        <div className="template-field-row template-field-row--section-meta">
          {metaFields.map((field) => (
            <TemplateFieldInput
              key={field.key}
              field={field}
              value={
                field.key === 'layout'
                  ? (typeof data.layout === 'string' ? data.layout : '')
                  : data[field.key]
              }
              dynamicTags={dynamicTags}
              dynamicSelectOptions={dynamicSelectOptions}
              onChange={(nextValue) => setFieldValue(field.key, nextValue)}
            />
          ))}
        </div>
      ) : null}

        <div className={`template-flex-section${isOneColumn ? ' template-flex-section--one-column' : ''}`}>
        {isTextRight ? supportingColumn : contentColumn}
        {oneColumnBackgroundControls}
        {isTextRight ? contentColumn : supportingColumn}
      </div>
    </div>
  );
}

function TemplateFieldInput({
  field,
  value,
  dynamicTags,
  dynamicSelectOptions,
  hideLabel = false,
  forceInline = false,
  onChange,
}: {
  field: TemplateFieldDef;
  value: unknown;
  dynamicTags: string[];
  dynamicSelectOptions: Record<string, Array<{ value: string; label: string }>>;
  hideLabel?: boolean;
  forceInline?: boolean;
  onChange: (value: unknown) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isInlineTokenField = forceInline || ['accent', 'heading', 'lede'].includes(field.key.toLowerCase());
  const showInlineTag = isInlineTokenField && (field.kind === 'text' || field.kind === 'url' || field.kind === 'textarea');
  const useVariantRadioGroup =
    field.kind === 'select' &&
    (field.key.toLowerCase() === 'variant' || field.label.toLowerCase().includes('variant'));

  function insertTagAtCursor(tag: string, element: HTMLInputElement | HTMLTextAreaElement | null) {
    const current = typeof value === 'string' ? value : '';
    if (!element) {
      onChange(`${current}${tag}`);
      return;
    }

    const start = element.selectionStart ?? current.length;
    const end = element.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${tag}${current.slice(end)}`;
    onChange(next);

    setTimeout(() => {
      const target = element;
      if (!target) return;
      target.focus();
      const cursor = start + tag.length;
      target.setSelectionRange(cursor, cursor);
    }, 0);
  }

  const wrap = (child: React.ReactNode, onInsertTag?: (tag: string) => void) => (
    <div
      className={`template-field${isInlineTokenField ? ' template-field--inline' : ''}${
        useVariantRadioGroup ? ' template-field--radio-inline' : ''
      }${hideLabel ? ' template-field--label-hidden' : ''}${
        field.key === 'layout' ? ' template-field--meta-inline' : ''
      }`}
    >
      {!hideLabel ? (
        <div className="template-field__header">
          <div className="template-field__label-row">
            <strong className="template-field__label">{field.label}</strong>
          </div>
        </div>
      ) : null}
      {child}
    </div>
  );

  if (field.kind === 'text' || field.kind === 'url') {
    return wrap(
      <div className={`template-field__control${isInlineTokenField ? ' template-field__control--inline' : ''}`}>
        <label className="template-field__input-wrap">
          <input
            ref={inputRef}
            type={field.kind === 'url' ? 'url' : 'text'}
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        {showInlineTag ? (
          <DynamicTagInsertMenu
            tags={dynamicTags}
            compact
            onInsert={(tag) => {
              insertTagAtCursor(tag, inputRef.current);
            }}
          />
        ) : null}
      </div>,
      (tag) => {
        insertTagAtCursor(tag, inputRef.current);
      },
    );
  }

  if (field.kind === 'select') {
    const configuredOptions = Array.isArray(field.options) ? field.options : [];
    const options =
      (field.optionsKey && Array.isArray(dynamicSelectOptions[field.optionsKey]) && dynamicSelectOptions[field.optionsKey].length > 0)
        ? dynamicSelectOptions[field.optionsKey]
        : configuredOptions;

    if (useVariantRadioGroup) {
      return wrap(
        <div className="template-field__radio-row" role="radiogroup" aria-label={field.label}>
          {options.map((option) => {
            const checked = (typeof value === 'string' ? value : '') === option.value;
            return (
              <label
                key={`${field.key}-${option.value}`}
                className={`template-field__radio-pill${checked ? ' template-field__radio-pill--active' : ''}`}
              >
                <input
                  type="radio"
                  name={field.key}
                  value={option.value}
                  checked={checked}
                  onChange={(event) => onChange(event.target.value)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>,
      );
    }

    return wrap(
      <label className="template-field__control">
        <select value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={`${field.key}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>,
    );
  }

  if (field.kind === 'textarea') {
    return wrap(
      <div className={`template-field__control${isInlineTokenField ? ' template-field__control--inline' : ''}`}>
        <label className="template-field__input-wrap">
          <textarea
            ref={textareaRef}
            rows={4}
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        {showInlineTag ? (
          <DynamicTagInsertMenu
            tags={dynamicTags}
            compact
            onInsert={(tag) => {
              insertTagAtCursor(tag, textareaRef.current);
            }}
          />
        ) : null}
      </div>,
      (tag) => {
        insertTagAtCursor(tag, textareaRef.current);
      },
    );
  }

  if (field.kind === 'markdown') {
    return wrap(
        <MarkdownFieldEditor
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          dynamicTags={dynamicTags}
          onChange={onChange}
        />,
      );
  }

  if (field.kind === 'blocks') {
    const blocks = Array.isArray(value)
      ? value.filter(
          (item): item is { type: string; data: Record<string, unknown> } =>
            !!item &&
            typeof item === 'object' &&
            !Array.isArray(item) &&
            typeof (item as { type?: unknown }).type === 'string' &&
            !!(item as { data?: unknown }).data &&
            typeof (item as { data?: unknown }).data === 'object' &&
            !Array.isArray((item as { data?: unknown }).data),
        )
      : [];

    return <BlockEditor blocks={blocks} onChange={(nextBlocks) => onChange(nextBlocks)} embedded />;
  }

  if (field.kind === 'image') {
    return wrap(
      <MediaPickerField
        label={field.label}
        value={typeof value === 'string' ? value : ''}
        onChange={onChange}
        allowUpload
        uploadRole="generic"
        hideLabel
      />,
    );
  }

  if (field.kind === 'boolean') {
    return wrap(
      <label className="template-field__control">
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />{' '}
        {field.label}
      </label>,
    );
  }

  if (field.kind === 'number') {
    return wrap(
      <label className="template-field__control">
        <input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={typeof value === 'number' && Number.isFinite(value) ? value : ''}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
        />
      </label>,
    );
  }

  if (field.kind === 'group') {
    const groupValue = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    return wrap(
      <fieldset className="template-field__group">
        <legend className="template-field__group-legend">{field.label}</legend>
        {field.fields.map((child) => (
          <TemplateFieldInput
            key={`${field.key}.${child.key}`}
            field={child}
            value={groupValue[child.key]}
            dynamicTags={dynamicTags}
            dynamicSelectOptions={dynamicSelectOptions}
            onChange={(nextValue) => onChange({ ...groupValue, [child.key]: nextValue })}
          />
        ))}
      </fieldset>,
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

    return wrap(
      <div className="template-list">
        <div className="template-list__header">
          <button type="button" className="btn" onClick={addItem}>
            + Add {listField.itemLabel}
          </button>
        </div>
        <div className="template-list__items">
          {items.map((item, index) => (
            <div
              key={index}
              className={`template-list__item${listField.itemSchema.kind === 'group' ? '' : ' template-list__item--compact'}`}
            >
              {listField.itemSchema.kind === 'group' ? (
                <>
                  <div className="template-list__item-header">
                    <strong>
                      {listField.itemLabel} {index + 1}
                    </strong>
                    <button
                      type="button"
                      className="template-list__icon-button"
                      aria-label={`Remove ${listField.itemLabel} ${index + 1}`}
                      title={`Remove ${listField.itemLabel} ${index + 1}`}
                      onClick={() => updateList(items.filter((_, i) => i !== index))}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                <div className="template-list__item-fields">
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
                        dynamicTags={dynamicTags}
                        dynamicSelectOptions={dynamicSelectOptions}
                        onChange={(nextValue) => {
                          const nextItem = { ...itemObj, [childField.key]: nextValue };
                          updateList(items.map((row, i) => (i === index ? nextItem : row)));
                        }}
                      />
                    );
                  })}
                </div>
                </>
              ) : (
                <>
                  <strong className="template-list__item-index">
                    {index + 1}
                  </strong>
                  <div className="template-list__item-compact-field">
                    <TemplateFieldInput
                      field={listField.itemSchema}
                      value={item}
                      dynamicTags={[]}
                      dynamicSelectOptions={dynamicSelectOptions}
                      hideLabel
                      forceInline
                      onChange={(nextValue) => updateList(items.map((row, i) => (i === index ? nextValue : row)))}
                    />
                  </div>
                  <button
                    type="button"
                    className="template-list__icon-button"
                    aria-label={`Remove ${listField.itemLabel} ${index + 1}`}
                    title={`Remove ${listField.itemLabel} ${index + 1}`}
                    onClick={() => updateList(items.filter((_, i) => i !== index))}
                  >
                    <DeleteIcon />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>,
    );
  }

  return null;
}

function MarkdownFieldEditor({
  value,
  placeholder,
  dynamicTags,
  onChange,
}: {
  value: string;
  placeholder?: string;
  dynamicTags: string[];
  onChange: (value: unknown) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  function insertSnippet(snippet: string, wrapSelection = false) {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(`${value}${value ? '\n' : ''}${snippet}`);
      return;
    }

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const selected = value.slice(start, end);

    let insertion = snippet;
    if (wrapSelection) {
      insertion = snippet.replace('{{selection}}', selected || 'text');
    }

    const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
    onChange(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + insertion.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="markdown-field-editor">
      <div className="markdown-field-editor__toolbar">
        <strong>Formatting Tools</strong>
        <div className="markdown-field-editor__actions">
          <button type="button" className="btn" onClick={() => insertSnippet('\n## Heading\n\n')}>
            H2
          </button>
          <button type="button" className="btn" onClick={() => insertSnippet('\n### Subheading\n\n')}>
            H3
          </button>
          <button type="button" className="btn" onClick={() => insertSnippet('\n- List item\n- List item\n\n')}>
            List
          </button>
          <button type="button" className="btn" onClick={() => insertSnippet('\n> Quote\n\n')}>
            Quote
          </button>
          <button type="button" className="btn" onClick={() => insertSnippet('**{{selection}}**', true)}>
            Bold
          </button>
          <button type="button" className="btn" onClick={() => insertSnippet('[{{selection}}](https://example.com)', true)}>
            Link
          </button>
          <DynamicTagInsertMenu tags={dynamicTags} compact onInsert={(tag) => insertSnippet(tag)} />
        </div>
      </div>

      <div className="markdown-field-editor__meta">
        <small className="markdown-field-editor__hint">
          Markdown supported: headings (`#`/`##`/`###`), paragraphs, bullet/numbered lists, blockquotes.
        </small>
        <label className="markdown-field-editor__toggle">
          <input type="checkbox" checked={showPreview} onChange={(event) => setShowPreview(event.target.checked)} />
          Live Preview
        </label>
      </div>

      <div
        className={`markdown-field-editor__layout${showPreview ? ' markdown-field-editor__layout--with-preview' : ''}`}
      >
        <label className="markdown-field-editor__editor">
          <span className="markdown-field-editor__editor-label">Editor</span>
          <textarea
            ref={textareaRef}
            rows={16}
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            className="markdown-field-editor__textarea"
          />
        </label>

        {showPreview && (
          <div className="markdown-field-editor__preview">
            <div className="markdown-field-editor__preview-title">
              Preview
            </div>
            <div className="markdown-field-editor__preview-body">
              {value.trim() ? (
                <MarkdownLite content={value} />
              ) : (
                <p className="markdown-field-editor__preview-empty">
                  Start typing to preview formatted content.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DynamicTagInsertMenu({
  tags,
  compact = false,
  onInsert,
}: {
  tags: string[];
  compact?: boolean;
  onInsert: (tag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const uniqueTags = Array.from(new Set(tags)).filter(Boolean);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!open) return;
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (uniqueTags.length === 0) return null;

  return (
    <div className={`seo-fields__token-menu${compact ? ' seo-fields__token-menu--compact' : ''}`} ref={menuRef}>
      <button
        type="button"
        className={`seo-fields__token-trigger${compact ? ' seo-fields__token-trigger--compact' : ''}`}
        aria-label="Insert dynamic tag"
        onPointerDown={(event) => event.preventDefault()}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        <BoltIcon />
      </button>
      {open && (
        <div className="seo-fields__token-dropdown">
          {uniqueTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="seo-fields__token-option"
              onPointerDown={(event) => event.preventDefault()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onInsert(tag);
                setOpen(false);
              }}
            >
              <code>{tag}</code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BoltIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l2.92-2.92a5 5 0 0 0-7.07-7.07L11.7 5.23" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-2.92 2.92a5 5 0 0 0 7.07 7.07l1.69-1.68" />
    </svg>
  );
}

function UnlinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l1.96-1.96" />
      <path d="M14 11a5 5 0 0 0-7.54-.54L4.5 12.43" />
      <path d="M3 3l18 18" />
    </svg>
  );
}


