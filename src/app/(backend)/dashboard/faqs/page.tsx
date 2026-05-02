import Link from 'next/link';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import DataTable from '@/components/backend/DataTable';
import Button from '@/components/shared/Button';
import { deleteFaqsBulk } from '@/lib/actions';
import { getDashboardFaqs, getDashboardLinkedFaqServiceIds } from '@/lib/content/queries';

export default async function FaqsManagePage() {
  const faqs = await getDashboardFaqs();
  const linkedCounts = await Promise.all(
    faqs.map(async (faq) => ({
      faqId: faq.id,
      count: (await getDashboardLinkedFaqServiceIds(faq.id)).length,
    }))
  );
  const linkedCountByFaqId = new Map(linkedCounts.map((item) => [item.faqId, item.count]));

  return (
    <ModuleShell
      title="FAQs"
      description="Manage frequently asked questions"
      footer={<div id="faqs-list-bulk-controls" />}
    >
      <DataTable
        headerAction={
          <Button as="link" href="/dashboard/faqs/new">
            New FAQ
          </Button>
        }
        columns={['Question', 'Global', 'Services']}
        rows={faqs.map((faq) => ({
          Question: <Link href={`/dashboard/faqs/${faq.id}`}>{faq.question}</Link>,
          Global: faq.is_global ? 'Yes' : 'No',
          Services: linkedCountByFaqId.get(faq.id) ?? 0,
        }))}
        rowHrefs={faqs.map((faq) => `/dashboard/faqs/${faq.id}`)}
        bulkDelete={{
          rowIds: faqs.map((faq) => faq.id),
          onDeleteSelected: deleteFaqsBulk,
          itemLabel: 'FAQs',
        }}
        bulkDeletePortalTargetId="faqs-list-bulk-controls"
        bulkDeleteSelectLabel={`${faqs.length} Total`}
        emptyMessage="No FAQs yet"
      />
    </ModuleShell>
  );
}
