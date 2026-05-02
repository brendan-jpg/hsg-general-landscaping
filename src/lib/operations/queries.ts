import { createClient } from '@/lib/supabase/server';
import { getCurrentDashboardBusinessId } from '@/lib/authz/dashboard';
import type { Tables } from '@/lib/types/database';

type Job = Tables<'jobs'>;
type UpcomingScheduleRow = Tables<'upcoming_schedule'>;
type Estimate = Tables<'estimates'>;
type Invoice = Tables<'invoices'>;
type Contact = Tables<'contacts'>;
type Service = Tables<'services'>;
type TeamMember = Tables<'team_members'>;
type TeamMemberEmployment = Tables<'team_member_employment'>;
type JobTeamMember = Tables<'job_team_members'>;
type ScheduleItem = Tables<'schedule_items'>;
type Profile = Tables<'profiles'>;

function teamDisplayName(person: { first_name: string | null; last_name: string | null } | null | undefined) {
  if (!person) return null;
  const full = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
  return full || null;
}

async function getDashboardBusinessId() {
  return await getCurrentDashboardBusinessId();
}

export async function getDashboardContactsForSelection() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .eq('business_id', businessId)
    .order('first_name', { ascending: true })
    .order('last_name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<Contact, 'id' | 'first_name' | 'last_name'>[];
}

export async function getDashboardTeamMembersForJobAssignment() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const [{ data: members, error: membersError }, { data: employmentRows, error: employmentError }] = await Promise.all([
    supabase
      .from('team_members')
      .select('id, first_name, last_name, title, sort_order')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true })
      .order('first_name', { ascending: true })
      .order('last_name', { ascending: true }),
    supabase
      .from('team_member_employment')
      .select('team_member_id, profile_id, login_status, employment_status')
      .eq('business_id', businessId),
  ]);
  if (membersError) throw new Error(membersError.message);
  if (employmentError) throw new Error(employmentError.message);

  const employmentByTeamMemberId = new Map(
    ((employmentRows ?? []) as Array<
      Pick<TeamMemberEmployment, 'team_member_id' | 'profile_id' | 'login_status' | 'employment_status'>
    >).map((row) => [row.team_member_id, row]),
  );

  return ((members ?? []) as Array<Pick<TeamMember, 'id' | 'first_name' | 'last_name' | 'title'>>).map((member) => {
    const employment = employmentByTeamMemberId.get(member.id);
    return {
      team_member_id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      title: member.title,
      profile_id: employment?.profile_id ?? null,
      login_status: employment?.login_status ?? 'not_created',
      employment_status: employment?.employment_status ?? 'full_time',
    };
  });
}

export async function getDashboardJobsForSelection() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, scheduled_start, status')
    .eq('business_id', businessId)
    .order('scheduled_start', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Array<Pick<Job, 'id' | 'title' | 'scheduled_start' | 'status'>>;
}

export async function getDashboardScheduleJobs() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .select(
      'id, business_id, title, status, priority, scheduled_start, scheduled_end, address_line1, city, state, contacts(first_name,last_name,phone), services(title), assigned_team_member:team_members!jobs_assigned_team_member_id_fkey(first_name,last_name), assigned_profile:profiles!jobs_assigned_to_fkey(first_name,last_name)'
    )
    .eq('business_id', businessId)
    .order('scheduled_start', { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<
    Pick<Job, 'id' | 'business_id' | 'title' | 'status' | 'priority' | 'scheduled_start' | 'scheduled_end' | 'address_line1' | 'city' | 'state'> & {
      contacts: Pick<Contact, 'first_name' | 'last_name' | 'phone'> | null;
      services: Pick<Service, 'title'> | null;
      assigned_team_member: Pick<TeamMember, 'first_name' | 'last_name'> | null;
      assigned_profile: Pick<Profile, 'first_name' | 'last_name'> | null;
    }
  >).map((row) => ({
    id: row.id,
    business_id: row.business_id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    scheduled_start: row.scheduled_start,
    scheduled_end: row.scheduled_end,
    address_line1: row.address_line1,
    city: row.city,
    state: row.state,
    customer_name: teamDisplayName(row.contacts) ?? null,
    customer_phone: row.contacts?.phone ?? null,
    service_name: row.services?.title ?? null,
    assigned_to_name: teamDisplayName(row.assigned_team_member) ?? teamDisplayName(row.assigned_profile) ?? null,
  })) as UpcomingScheduleRow[];
}

export async function getDashboardScheduleJobsForDay(day: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];

  const start = new Date(`${day}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .select(
      'id, business_id, title, status, priority, scheduled_start, scheduled_end, address_line1, city, state, contacts(first_name,last_name,phone), services(title), assigned_team_member:team_members!jobs_assigned_team_member_id_fkey(first_name,last_name), assigned_profile:profiles!jobs_assigned_to_fkey(first_name,last_name)'
    )
    .eq('business_id', businessId)
    .gte('scheduled_start', start.toISOString())
    .lt('scheduled_start', end.toISOString())
    .order('scheduled_start', { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<
    Pick<Job, 'id' | 'business_id' | 'title' | 'status' | 'priority' | 'scheduled_start' | 'scheduled_end' | 'address_line1' | 'city' | 'state'> & {
      contacts: Pick<Contact, 'first_name' | 'last_name' | 'phone'> | null;
      services: Pick<Service, 'title'> | null;
      assigned_team_member: Pick<TeamMember, 'first_name' | 'last_name'> | null;
      assigned_profile: Pick<Profile, 'first_name' | 'last_name'> | null;
    }
  >).map((row) => ({
    id: row.id,
    business_id: row.business_id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    scheduled_start: row.scheduled_start,
    scheduled_end: row.scheduled_end,
    address_line1: row.address_line1,
    city: row.city,
    state: row.state,
    customer_name: teamDisplayName(row.contacts) ?? null,
    customer_phone: row.contacts?.phone ?? null,
    service_name: row.services?.title ?? null,
    assigned_to_name: teamDisplayName(row.assigned_team_member) ?? teamDisplayName(row.assigned_profile) ?? null,
  })) as UpcomingScheduleRow[];
}

export async function getDashboardScheduleItems() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('schedule_items')
    .select(
      '*, assigned_profile:profiles!schedule_items_assigned_to_fkey(first_name,last_name), assigned_team_member:team_members!schedule_items_assigned_team_member_id_fkey(first_name,last_name), related_job:jobs!schedule_items_related_job_id_fkey(id,title,status,scheduled_start)'
    )
    .eq('business_id', businessId)
    .order('starts_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Array<
    ScheduleItem & {
      assigned_profile: Pick<Profile, 'first_name' | 'last_name'> | null;
      assigned_team_member: Pick<TeamMember, 'first_name' | 'last_name'> | null;
      related_job: Pick<Job, 'id' | 'title' | 'status' | 'scheduled_start'> | null;
    }
  >;
}

export async function getDashboardScheduleItemsForDay(day: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];

  const start = new Date(`${day}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('schedule_items')
    .select(
      '*, assigned_profile:profiles!schedule_items_assigned_to_fkey(first_name,last_name), assigned_team_member:team_members!schedule_items_assigned_team_member_id_fkey(first_name,last_name), related_job:jobs!schedule_items_related_job_id_fkey(id,title,status,scheduled_start)'
    )
    .eq('business_id', businessId)
    .gte('starts_at', start.toISOString())
    .lt('starts_at', end.toISOString())
    .order('starts_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Array<
    ScheduleItem & {
      assigned_profile: Pick<Profile, 'first_name' | 'last_name'> | null;
      assigned_team_member: Pick<TeamMember, 'first_name' | 'last_name'> | null;
      related_job: Pick<Job, 'id' | 'title' | 'status' | 'scheduled_start'> | null;
    }
  >;
}

export async function getDashboardScheduleItemById(id: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('schedule_items')
    .select(
      '*, assigned_profile:profiles!schedule_items_assigned_to_fkey(first_name,last_name), assigned_team_member:team_members!schedule_items_assigned_team_member_id_fkey(first_name,last_name), related_job:jobs!schedule_items_related_job_id_fkey(id,title,status,scheduled_start)'
    )
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as (ScheduleItem & {
    assigned_profile: Pick<Profile, 'first_name' | 'last_name'> | null;
    assigned_team_member: Pick<TeamMember, 'first_name' | 'last_name'> | null;
    related_job: Pick<Job, 'id' | 'title' | 'status' | 'scheduled_start'> | null;
  }) | null);
}

export async function getDashboardJobs(status?: Job['status'] | 'all') {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  let query = supabase
    .from('jobs')
    .select('*, contacts(first_name,last_name)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<Job & { contacts: Pick<Contact, 'first_name' | 'last_name'> | null }>;
}

export async function getDashboardJobById(id: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Job | null;
}

export async function getDashboardJobTeamAssignments(jobId: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('job_team_members')
    .select('id, job_id, team_member_id, hours_worked')
    .eq('business_id', businessId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Array<Pick<JobTeamMember, 'id' | 'job_id' | 'team_member_id' | 'hours_worked'>>;
}

export async function getDashboardTeamMemberJobHistory(teamMemberId: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('job_team_members')
    .select(
      'id, team_member_id, job_id, hours_worked, created_at, jobs!job_team_members_job_id_fkey(id,title,status,priority,scheduled_start,scheduled_end,created_at)'
    )
    .eq('business_id', businessId)
    .eq('team_member_id', teamMemberId);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<
    Pick<JobTeamMember, 'id' | 'team_member_id' | 'job_id' | 'hours_worked' | 'created_at'> & {
      jobs:
        | Pick<Job, 'id' | 'title' | 'status' | 'priority' | 'scheduled_start' | 'scheduled_end' | 'created_at'>
        | null;
    }
  >;

  return rows.sort((a, b) => {
    const aKey = a.jobs?.scheduled_start ?? a.jobs?.created_at ?? a.created_at;
    const bKey = b.jobs?.scheduled_start ?? b.jobs?.created_at ?? b.created_at;
    return bKey.localeCompare(aKey);
  });
}

export async function getDashboardEstimates(status?: Estimate['status'] | 'all') {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  let query = supabase
    .from('estimates')
    .select('*, contacts(first_name,last_name)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<Estimate & { contacts: Pick<Contact, 'first_name' | 'last_name'> | null }>;
}

export async function getDashboardEstimateById(id: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Estimate | null;
}

export async function getDashboardInvoices(status?: Invoice['status'] | 'all') {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  let query = supabase
    .from('invoices')
    .select('*, contacts(first_name,last_name)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<Invoice & { contacts: Pick<Contact, 'first_name' | 'last_name'> | null }>;
}

export async function getDashboardInvoiceById(id: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Invoice | null;
}
