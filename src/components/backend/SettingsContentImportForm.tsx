'use client';

import { ChangeEvent, FormEvent, useMemo, useState, useTransition } from 'react';
import { bulkImportContentAction } from '@/lib/actions';

interface ImportOption {
  id: string;
  label: string;
}

type ImportTable = 'blog_posts' | 'pages' | 'services' | 'areas' | 'testimonials';

interface SettingsContentImportFormProps {
  blogPostOptions: ImportOption[];
  pageOptions: ImportOption[];
  serviceOptions: ImportOption[];
  AreaOptions: ImportOption[];
  testimonialOptions: ImportOption[];
}

const TABLE_LABELS: Record<ImportTable, string> = {
  blog_posts: 'Blog Posts',
  pages: 'Pages',
  services: 'Services',
  areas: 'Areas',
  testimonials: 'Testimonials',
};

const TABLE_SINGULAR_LABELS: Record<ImportTable, string> = {
  blog_posts: 'Blog Post',
  pages: 'Page',
  services: 'Service',
  areas: 'Area',
  testimonials: 'Testimonial',
};

export default function SettingsContentImportForm({
  blogPostOptions,
  pageOptions,
  serviceOptions,
  AreaOptions,
  testimonialOptions,
}: SettingsContentImportFormProps) {
  const [table, setTable] = useState<ImportTable>('blog_posts');
  const [recordId, setRecordId] = useState('');
  const [mode, setMode] = useState<'replace' | 'create'>('replace');
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const optionsByTable = useMemo<Record<ImportTable, ImportOption[]>>(
    () => ({
      blog_posts: blogPostOptions,
      pages: pageOptions,
      services: serviceOptions,
      areas: AreaOptions,
      testimonials: testimonialOptions,
    }),
    [blogPostOptions, pageOptions, AreaOptions, serviceOptions, testimonialOptions],
  );

  const activeOptions = optionsByTable[table];

  function handleTableChange(nextTable: ImportTable) {
    setTable(nextTable);
    setRecordId('');
    setXmlFile(null);
    setMessage(null);
    setError(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setMessage(null);
    setError(null);
    setXmlFile(event.target.files?.[0] ?? null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const form = event.currentTarget;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('table', table);
        formData.set('record_id', recordId);
        formData.set('mode', mode);
        if (!xmlFile) throw new Error('Choose an XML file to import');
        formData.set('xml_file', xmlFile);
        const result = await bulkImportContentAction(formData);
        setMessage(
          result.mode === 'create'
            ? table === 'testimonials'
              ? `Created ${result.importedRecords ?? 1} ${TABLE_LABELS[table].toLowerCase()}.`
              : `Created ${result.importedRecords ?? 1} ${TABLE_LABELS[table].toLowerCase()} with ${result.importedBlocks} imported blocks.`
            : table === 'testimonials'
              ? `Updated ${TABLE_SINGULAR_LABELS[table].toLowerCase()}.`
              : `Updated ${TABLE_SINGULAR_LABELS[table].toLowerCase()} with ${result.importedBlocks} imported blocks.`,
        );
        setXmlFile(null);
        const fileInput = form.querySelector('input[name="xml_file"]') as HTMLInputElement | null;
        if (fileInput) fileInput.value = '';
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Unable to import content');
      }
    });
  }

  return (
    <form className="settings__section settings-import" onSubmit={handleSubmit}>
      <div className="settings-import__title">
        <span className="settings-import__eyebrow">Bulk XML Import</span>
      </div>
      <div className="settings-import__grid">
        <label className="settings-import__field">
          <span className="settings-import__label">Content Type</span>
          <select value={table} onChange={(event) => handleTableChange(event.target.value as ImportTable)}>
            <option value="blog_posts">Blog Posts</option>
            <option value="pages">Pages</option>
            <option value="services">Services</option>
            <option value="areas">Areas</option>
            <option value="testimonials">Testimonials</option>
          </select>
        </label>
        <label className="settings-import__field">
          <span className="settings-import__label">Import Mode</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as 'replace' | 'create')}>
            <option value="replace">Replace Existing</option>
            <option value="create">Add New</option>
          </select>
        </label>
        {mode === 'replace' && (
          <label className="settings-import__field">
            <span className="settings-import__label">Destination</span>
            <select
              value={recordId}
              onChange={(event) => setRecordId(event.target.value)}
              required
            >
              <option value="">Select {TABLE_SINGULAR_LABELS[table]}</option>
              {activeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="settings-import__field settings-import__field--file">
          <span className="settings-import__label">XML File</span>
          <input
            name="xml_file"
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={handleFileChange}
            required
          />
        </label>
        <div className="settings-import__actions">
          <button type="submit" className="btn" disabled={isPending}>
            {isPending ? 'Importing...' : 'Import Content'}
          </button>
        </div>
      </div>
      {xmlFile && (
        <div className="settings-import__selected-file">
          <span className="settings-import__selected-label">Selected file</span>
          <strong>{xmlFile.name}</strong>
        </div>
      )}
      {message && <p className="settings-import__message">{message}</p>}
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
