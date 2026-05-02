import ModuleShell from '@/components/backend/shell/ModuleShell';
import BackendTabs from '@/components/backend/BackendTabs';
import DataTable from '@/components/backend/DataTable';
import Button from '@/components/shared/Button';
import CommunicationTriggerEventSelect from '@/components/backend/CommunicationTriggerEventSelect';
import CommunicationTriggerRecipientSelect from '@/components/backend/CommunicationTriggerRecipientSelect';
import CommunicationTriggerTemplateSelect from '@/components/backend/CommunicationTriggerTemplateSelect';
import CommunicationTriggerActiveCheckbox from '@/components/backend/CommunicationTriggerActiveCheckbox';
import StatusBadge from '@/components/shared/StatusBadge';
import { requireAdminDashboardPage } from '@/lib/authz/dashboard';
import { PLATFORM_AUTOMATION_TRIGGER_OPTIONS, formatAutomationTriggerLabel } from '@/lib/email/automationTriggers';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeBusinessTimezone } from '@/lib/timezones';
import { addAutomationRuleRowAction, deleteAutomationRulesBulk } from '@/lib/actions';

const COMMUNICATION_TABS = [
  { label: 'Triggers & Templates', value: 'triggers_templates' },
  { label: 'Logs', value: 'logs' },
] as const;

type CommunicationTab = (typeof COMMUNICATION_TABS)[number]['value'];

function formatDateTime(value: string | null | undefined, timeZone: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

function getTemplateMediumCell() {
  return <span>Email</span>;
}

function formatContactName(contact: { first_name?: string | null; last_name?: string | null } | null | undefined) {
  const fullName = [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim();
  return fullName || '-';
}

function parseRecipientTargets(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const query = (searchParams ? await searchParams : {}) ?? {};
  const requestedTab = typeof query.tab === 'string' ? query.tab.toLowerCase() : '';
  const activeTab: CommunicationTab = COMMUNICATION_TABS.some((tab) => tab.value === requestedTab)
    ? (requestedTab as CommunicationTab)
    : 'triggers_templates';
  const profile = await requireAdminDashboardPage();
  const businessId = profile.business_id;
  const admin = createAdminClient();

  let templates: Array<{
    id: string;
    name: string;
    subject: string | null;
    is_active: boolean;
  }> = [];
  let automationRules: Array<{
    id: string;
    name: string;
    template_id: string;
    trigger_event: string;
    is_active: boolean;
    recipient_targets?: unknown;
    email_templates?: {
      id?: string | null;
      name?: string | null;
      subject?: string | null;
      is_active?: boolean | null;
    } | null;
  }> = [];
  let emailLogs: Array<{
    id: string;
    subject: string;
    to_email: string;
    status: string;
    sent_at: string | null;
    created_at: string;
    contacts?: { first_name?: string | null; last_name?: string | null } | null;
    email_templates?: { id?: string | null; name?: string | null } | null;
  }> = [];
  let scheduledEmails: Array<{
    id: string;
    status: string;
    scheduled_for: string;
    sent_at: string | null;
    related_type: string | null;
    contacts?: { first_name?: string | null; last_name?: string | null } | null;
    automation_rules?: { name?: string | null; trigger_event?: string | null } | null;
  }> = [];
  let businessTimeZone = 'America/New_York';

  if (businessId) {
      const [
        { data: templateRows, error: templatesError },
        { data: automationRuleRows, error: automationRulesError },
        { data: emailLogRows, error: emailLogError },
        { data: scheduledEmailRows, error: scheduledEmailsError },
        { data: businessRow, error: businessError },
      ] =
        await Promise.all([
          admin
            .from('email_templates')
            .select('id, name, subject, is_active')
            .eq('business_id', businessId)
            .order('name', { ascending: true }),
          admin
            .from('automation_rules')
            .select('id, name, template_id, trigger_event, is_active, recipient_targets, email_templates(id, name, subject, is_active)')
            .eq('business_id', businessId)
            .order('created_at', { ascending: true }),
          admin
            .from('email_log')
            .select('id, subject, to_email, status, sent_at, created_at, contacts(first_name, last_name), email_templates(id, name)')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })
            .limit(50),
          admin
            .from('scheduled_emails')
            .select('id, status, scheduled_for, sent_at, related_type, contacts!inner(business_id, first_name, last_name), automation_rules(name, trigger_event)')
            .eq('contacts.business_id', businessId)
            .order('created_at', { ascending: false })
            .limit(50),
          admin
            .from('businesses')
            .select('timezone')
            .eq('id', businessId)
            .maybeSingle(),
        ]);

      if (templatesError) throw new Error(templatesError.message);
      if (automationRulesError) throw new Error(automationRulesError.message);
      if (emailLogError) throw new Error(emailLogError.message);
      if (scheduledEmailsError) throw new Error(scheduledEmailsError.message);
      if (businessError) throw new Error(businessError.message);

      templates = (templateRows ?? []) as typeof templates;
      automationRules = (automationRuleRows ?? []) as typeof automationRules;
      emailLogs = (emailLogRows ?? []) as typeof emailLogs;
      scheduledEmails = (scheduledEmailRows ?? []) as typeof scheduledEmails;
      businessTimeZone = normalizeBusinessTimezone(businessRow?.timezone);
  }

  const tabItems = COMMUNICATION_TABS.map((tab) => ({
    ...tab,
    href: tab.value === 'triggers_templates' ? '/dashboard/automations' : `/dashboard/automations?tab=${tab.value}`,
  }));
  const templateOptions = templates.map((template) => ({
    value: template.id,
    label: template.name,
  }));
  const flowRows = automationRules
    .filter((rule) => rule.template_id)
    .map((rule) => ({
      id: rule.id,
      triggerEvent: rule.trigger_event,
      type: getTemplateMediumCell(),
      templateId: rule.template_id,
      templateName: rule.email_templates?.name?.trim() || templates.find((template) => template.id === rule.template_id)?.name || 'Template',
      subjectLine:
        rule.email_templates?.subject?.trim() ||
        templates.find((template) => template.id === rule.template_id)?.subject?.trim() ||
        '-',
      recipientTargets: parseRecipientTargets(rule.recipient_targets),
      isActive: rule.is_active,
    }));
  const triggerMetadataByTemplateId = new Map(
    flowRows.map((row) => [
      row.templateId,
      {
        triggerEvent: formatAutomationTriggerLabel(row.triggerEvent),
        type: 'Email',
      },
    ]),
  );

  return (
    <ModuleShell
      title="Communication"
      description="Manage tenant email flows and outbound email history"
      footer={activeTab === 'triggers_templates' ? <div id="communications-trigger-bulk-controls" /> : undefined}
      toolbar={<BackendTabs items={tabItems} activeValue={activeTab} ariaLabel="Communication sections" />}
      actions={
        activeTab === 'triggers_templates' ? (
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <form action={addAutomationRuleRowAction}>
              <button type="submit" className="btn btn--secondary">
                + Trigger
              </button>
            </form>
            <Button as="link" href="/dashboard/automations/templates/new">
              + Template
            </Button>
          </div>
        ) : undefined
      }
    >
      {activeTab === 'triggers_templates' ? (
        <DataTable
          columns={['Trigger Event', 'Type', 'Template', 'Subject line', 'Recipient', 'Active']}
          rows={flowRows.map((row) => ({
            'Trigger Event': (
              <CommunicationTriggerEventSelect
                ruleId={row.id}
                value={row.triggerEvent}
                options={[...PLATFORM_AUTOMATION_TRIGGER_OPTIONS]}
              />
            ),
            Type: row.type,
            Template: (
              <div className="communication-template-cell">
                <CommunicationTriggerTemplateSelect
                  ruleId={row.id}
                  value={row.templateId}
                  options={templateOptions}
                />
                <a
                  className="communication-template-cell__edit"
                  href={`/dashboard/automations/templates/${row.templateId}`}
                >
                  Edit
                </a>
              </div>
            ),
            'Subject line': row.subjectLine,
            Recipient: (
              <CommunicationTriggerRecipientSelect
                ruleId={row.id}
                values={row.recipientTargets}
                triggerEvent={row.triggerEvent}
              />
            ),
            Active: <CommunicationTriggerActiveCheckbox ruleId={row.id} isActive={row.isActive} />,
          }))}
          bulkDelete={{
            rowIds: flowRows.map((row) => row.id),
            onDeleteSelected: deleteAutomationRulesBulk,
            itemLabel: 'flows',
          }}
          bulkDeletePortalTargetId="communications-trigger-bulk-controls"
          bulkDeleteSelectLabel={`${flowRows.length} Total`}
          emptyMessage="No flows yet"
        />
      ) : null}

      {activeTab === 'logs' ? (
        <div className="platform-page">
          <section className="google-tools__card">
            <h3 className="google-tools__title">Email Delivery Log</h3>
            <DataTable
              columns={['Sent', 'Trigger Event', 'Type', 'Template', 'Subject line', 'Recipient', 'Status']}
              rows={emailLogs.map((entry) => ({
                Sent: formatDateTime(entry.sent_at ?? entry.created_at, businessTimeZone),
                'Trigger Event': entry.email_templates?.id
                  ? (triggerMetadataByTemplateId.get(entry.email_templates.id)?.triggerEvent ?? '-')
                  : '-',
                Type: entry.email_templates?.id
                  ? (triggerMetadataByTemplateId.get(entry.email_templates.id)?.type ?? 'Email')
                  : 'Email',
                Template: entry.email_templates?.name || '-',
                'Subject line': entry.subject,
                Recipient: entry.to_email || formatContactName(entry.contacts),
                Status: <StatusBadge status={entry.status} />,
              }))}
              emptyMessage="No email delivery logs yet"
            />
          </section>

          <section className="google-tools__card">
            <h3 className="google-tools__title">Scheduled Emails</h3>
            <DataTable
              columns={['Scheduled For', 'Trigger Event', 'Automation', 'Recipient', 'Status']}
              rows={scheduledEmails.map((entry) => ({
                'Scheduled For': formatDateTime(entry.sent_at ?? entry.scheduled_for, businessTimeZone),
                'Trigger Event': formatAutomationTriggerLabel(entry.automation_rules?.trigger_event ?? ''),
                Automation: entry.automation_rules?.name || '-',
                Recipient: formatContactName(entry.contacts),
                Status: <StatusBadge status={entry.status} />,
              }))}
              emptyMessage="No scheduled emails yet"
            />
          </section>
        </div>
      ) : null}
    </ModuleShell>
  );
}
