import Link from 'next/link';
import BackendTabs from '@/components/backend/BackendTabs';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import DataTable from '../../../../components/backend/DataTable';
import Button from '@/components/shared/Button';
import TemplateListSelect from '@/components/backend/TemplateListSelect';
import { deletePagesBulk, updatePageTemplateKeyAction } from '@/lib/actions';
import { getDashboardPages } from '@/lib/content/queries';
import { isPageKind, isProtectedPage } from '@/lib/content/pageConfig';
import { toTemplatePageContent } from '@/lib/sections/templatePages';
import {
  getRecommendedPageTemplateKeyForPageKind,
  getRecommendedPageTemplateKeyForSlug,
  PAGE_TEMPLATE_OPTIONS,
} from '@/lib/sections/templateOptions';

type PagesTab = 'required' | 'custom';

interface PagesManagePageProps {
  searchParams?: Promise<{
    tab?: string;
  }>;
}

const PAGES_TABS: Array<{ label: string; value: PagesTab }> = [
  { label: 'Required Pages', value: 'required' },
  { label: 'Custom Pages', value: 'custom' },
];

function getRequiredPageTypeLabel(pageKind: string | null, slug: string) {
  switch (pageKind ?? slug) {
    case 'home':
      return 'Home';
    case 'services_archive':
      return 'Service Archive';
    case 'areas_archive':
      return 'Areas Archive';
    case 'about':
      return 'About';
    case 'blog_archive':
      return 'Blog Archive';
    case 'contact':
      return 'Contact';
    default:
      return 'Required Page';
  }
}

function toTemplateCell(page: Awaited<ReturnType<typeof getDashboardPages>>[number]) {
  return (
    <TemplateListSelect
      ariaLabel={`Template for ${page.title}`}
      initialValue={
        toTemplatePageContent(page.content)?.templateKey ??
        getRecommendedPageTemplateKeyForPageKind(isPageKind(page.page_kind) ? page.page_kind : null) ??
        getRecommendedPageTemplateKeyForSlug(page.slug)
      }
      options={PAGE_TEMPLATE_OPTIONS}
      onChangeAction={updatePageTemplateKeyAction.bind(null, page.id)}
    />
  );
}

export default async function PagesManagePage({ searchParams }: PagesManagePageProps) {
  const query = (searchParams ? await searchParams : {}) ?? {};
  const activeTab: PagesTab = query.tab === 'custom' ? 'custom' : 'required';
  const pages = await getDashboardPages();
  const pageSortOrder: Record<string, number> = {
    home: 0,
    services_archive: 1,
    areas_archive: 2,
    about: 3,
    blog_archive: 4,
    contact: 5,
  };
  const orderedPages = [...pages].sort((a, b) => {
    const aRank = pageSortOrder[a.page_kind ?? a.slug] ?? Number.MAX_SAFE_INTEGER;
    const bRank = pageSortOrder[b.page_kind ?? b.slug] ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.title.localeCompare(b.title);
  });
  const requiredPages = orderedPages.filter((page) => isProtectedPage(page));
  const customPages = orderedPages.filter((page) => !isProtectedPage(page));
  return (
    <ModuleShell
      title="Pages"
      description="Manage static pages"
      toolbar={
        <BackendTabs
          ariaLabel="Pages tabs"
          activeValue={activeTab}
          items={PAGES_TABS.map((tab) => ({
            ...tab,
            href: `/dashboard/pages?tab=${tab.value}`,
          }))}
        />
      }
      actions={
        activeTab === 'custom' ? (
          <Button as="link" href="/dashboard/pages/new">
            New Page
          </Button>
        ) : undefined
      }
      footer={activeTab === 'custom' ? <div id="pages-list-bulk-controls" /> : undefined}
    >
      {activeTab === 'required' && (
        <DataTable
          columns={['Page Type', 'Title', 'Slug', 'Template', 'Last Updated']}
          rows={requiredPages.map((page) => ({
            'Page Type': getRequiredPageTypeLabel(page.page_kind, page.slug),
            Title: <Link href={`/dashboard/pages/${page.id}`}>{page.title}</Link>,
            Slug: page.slug,
            Template: toTemplateCell(page),
            'Last Updated': new Date(page.updated_at).toLocaleDateString(),
          }))}
          rowHrefs={requiredPages.map((page) => `/dashboard/pages/${page.id}`)}
          emptyMessage="No required pages found"
        />
      )}

      {activeTab === 'custom' && (
        <DataTable
          columns={['Title', 'Slug', 'Template', 'Last Updated']}
          rows={[
            ...customPages.map((page) => ({
              Title: <Link href={`/dashboard/pages/${page.id}`}>{page.title}</Link>,
              Slug: page.slug,
              Template: toTemplateCell(page),
              'Last Updated': new Date(page.updated_at).toLocaleDateString(),
            })),
          ]}
          rowHrefs={customPages.map((page) => `/dashboard/pages/${page.id}`)}
          bulkDelete={{
            rowIds: customPages.map((page) => page.id),
            onDeleteSelected: deletePagesBulk,
            itemLabel: 'pages',
          }}
          bulkDeletePortalTargetId="pages-list-bulk-controls"
          bulkDeleteSelectLabel={`${customPages.length} Total`}
          emptyMessage="No custom pages yet"
        />
      )}
    </ModuleShell>
  );
}
