'use client';

import type { RefObject } from 'react';
import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveAreaContentDefaultsAction, saveServiceContentDefaultsAction } from '@/lib/actions';
import DynamicTagInsertMenu from '@/components/backend/DynamicTagInsertMenu';
import InlineEntityIconPicker from '@/components/backend/InlineEntityIconPicker';

interface ContentDefaultsSettingsTableProps {
  serviceDefaults: {
    icon: string;
    metaTitle: string;
    metaDescription: string;
    h1: string;
    url: string;
    urlBase: string;
    showCardExcerpts: boolean;
  };
  areaDefaults: {
    icon: string;
    metaTitle: string;
    metaDescription: string;
    h1: string;
    url: string;
    urlBase: string;
    showCardExcerpts: boolean;
  };
}

interface ContentDefaultsRowProps {
  kind: 'service' | 'area';
  label: string;
  defaults: {
    icon: string;
    metaTitle: string;
    metaDescription: string;
    h1: string;
    url: string;
    urlBase: string;
    showCardExcerpts: boolean;
  };
}

const BASE_CONTENT_TEMPLATE_TAGS = [
  '{{service}}',
  '{{area}}',
  '{{service_area}}',
  '{{business}}',
  '{{city}}',
  '{{state}}',
  '{{state_code}}',
  '{{primary_area}}',
  '{{primary_service}}',
  '{{url}}',
  '{{site_url}}',
];

function ContentDefaultsRow({
  kind,
  label,
  defaults,
}: ContentDefaultsRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [icon, setIcon] = useState(defaults.icon);
  const [metaTitle, setMetaTitle] = useState(defaults.metaTitle);
  const [metaDescription, setMetaDescription] = useState(defaults.metaDescription);
  const [h1, setH1] = useState(defaults.h1);
  const [url, setUrl] = useState(defaults.url);
  const [urlBase, setUrlBase] = useState(defaults.urlBase);
  const [showCardExcerpts, setShowCardExcerpts] = useState(defaults.showCardExcerpts);
  const [error, setError] = useState<string | null>(null);
  const metaTitleInputRef = useRef<HTMLInputElement | null>(null);
  const metaDescriptionInputRef = useRef<HTMLInputElement | null>(null);
  const h1InputRef = useRef<HTMLInputElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);

  const isDirty = useMemo(
    () =>
      icon !== defaults.icon ||
      metaTitle !== defaults.metaTitle ||
      metaDescription !== defaults.metaDescription ||
      h1 !== defaults.h1 ||
      url !== defaults.url ||
      urlBase !== defaults.urlBase ||
      showCardExcerpts !== defaults.showCardExcerpts,
    [defaults, h1, icon, metaDescription, metaTitle, showCardExcerpts, url, urlBase],
  );

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set(`${kind}_default_icon`, icon);
        formData.set(`${kind}_default_title_template`, metaTitle);
        formData.set(`${kind}_default_meta_description_template`, metaDescription);
        formData.set(`${kind}_default_h1_template`, h1);
        formData.set(`${kind}_default_url_template`, url);
        formData.set(`${kind}_detail_base_path`, urlBase);
        if (showCardExcerpts) formData.set(`${kind}_card_show_excerpts`, 'on');

        if (kind === 'service') {
          await saveServiceContentDefaultsAction(formData);
        } else {
          await saveAreaContentDefaultsAction(formData);
        }

        router.refresh();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unable to save content defaults');
      }
    });
  }

  function insertTag(
    tag: string,
    value: string,
    setter: (value: string) => void,
    input: HTMLInputElement | null,
  ) {
    if (!input) {
      setter(`${value}${tag}`);
      return;
    }

    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, start)}${tag}${value.slice(end)}`;
    setter(nextValue);

    requestAnimationFrame(() => {
      input.focus();
      const cursor = start + tag.length;
      input.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <tr className="data-table__row">
      <td className="data-table__td">
        <InlineEntityIconPicker value={icon} onChange={setIcon} ariaLabel={`Choose ${label.toLowerCase()} icon`} />
      </td>
      <td className="data-table__td">
        <strong>{label}</strong>
      </td>
      <td className="data-table__td">
        <span className="custom-content-settings__static-value">Built-in</span>
      </td>
      <td className="data-table__td">
        <input
          className="custom-content-settings__input"
          type="text"
          value={urlBase}
          disabled={isPending}
          onChange={(event) => setUrlBase(event.target.value)}
          aria-label={`${label} URL base`}
        />
      </td>
      <td className="data-table__td">
        <DynamicTemplateInput
          inputRef={metaTitleInputRef}
          value={metaTitle}
          disabled={isPending}
          ariaLabel={`${label} default title`}
          onChange={setMetaTitle}
          onInsertTag={(tag, input) => insertTag(tag, metaTitle, setMetaTitle, input)}
        />
      </td>
      <td className="data-table__td">
        <DynamicTemplateInput
          inputRef={metaDescriptionInputRef}
          value={metaDescription}
          disabled={isPending}
          ariaLabel={`${label} default meta description`}
          placeholder="Meta description template"
          onChange={setMetaDescription}
          onInsertTag={(tag, input) => insertTag(tag, metaDescription, setMetaDescription, input)}
        />
      </td>
      <td className="data-table__td">
        <DynamicTemplateInput
          inputRef={h1InputRef}
          value={h1}
          disabled={isPending}
          ariaLabel={`${label} default H1`}
          placeholder="H1 template"
          onChange={setH1}
          onInsertTag={(tag, input) => insertTag(tag, h1, setH1, input)}
        />
      </td>
      <td className="data-table__td">
        <DynamicTemplateInput
          inputRef={urlInputRef}
          value={url}
          disabled={isPending}
          ariaLabel={`${label} default URL slug`}
          placeholder="URL template"
          onChange={setUrl}
          onInsertTag={(tag, input) => insertTag(tag, url, setUrl, input)}
        />
      </td>
      <td className="data-table__td">
        <input
          type="checkbox"
          checked={showCardExcerpts}
          disabled={isPending}
          aria-label={`${label} excerpt`}
          onChange={(event) => setShowCardExcerpts(event.target.checked)}
        />
      </td>
      <td className="data-table__td">
        <button
          type="button"
          className="btn btn--secondary"
          disabled={isPending || !isDirty}
          onClick={handleSave}
        >
          {isPending ? 'Saving...' : 'Save'}
        </button>
        {error ? <p className="custom-content-settings__error">{error}</p> : null}
      </td>
    </tr>
  );
}

export default function ContentDefaultsSettingsTable({
  serviceDefaults,
  areaDefaults,
}: ContentDefaultsSettingsTableProps) {
  return (
    <div className="data-table__stack">
      <div className="settings-card__head settings-panel__head">
        <div className="settings-panel__title-group">
          <span className="settings-panel__eyebrow">Base Content Defaults</span>
        </div>
      </div>

      <div className="data-table__surface content-defaults-settings__surface">
        <div className="data-table__wrapper content-defaults-settings__wrapper">
          <table className="data-table content-defaults-settings__table content-defaults-settings__table--compact">
            <thead className="data-table__head">
              <tr>
                <th className="data-table__th">Icon</th>
                <th className="data-table__th">Type</th>
                <th className="data-table__th">Template</th>
                <th className="data-table__th">URL Base</th>
                <th className="data-table__th">Meta Title</th>
                <th className="data-table__th">Meta Description</th>
                <th className="data-table__th">H1</th>
                <th className="data-table__th">Slug</th>
                <th className="data-table__th">Excerpt</th>
                <th className="data-table__th">Actions</th>
              </tr>
            </thead>
            <tbody className="data-table__body">
              <ContentDefaultsRow kind="service" label="Services" defaults={serviceDefaults} />
              <ContentDefaultsRow kind="area" label="Areas" defaults={areaDefaults} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DynamicTemplateInput({
  inputRef,
  value,
  disabled,
  ariaLabel,
  placeholder,
  onChange,
  onInsertTag,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  disabled: boolean;
  ariaLabel: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onInsertTag: (tag: string, input: HTMLInputElement | null) => void;
}) {
  return (
    <div className="custom-content-settings__token-input">
      <input
        ref={inputRef}
        className="custom-content-settings__input"
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        placeholder={placeholder}
      />
      <DynamicTagInsertMenu
        tags={BASE_CONTENT_TEMPLATE_TAGS}
        compact
        ariaLabel={`Insert dynamic tag into ${ariaLabel}`}
        onInsert={(tag) => onInsertTag(tag, inputRef.current)}
      />
    </div>
  );
}
