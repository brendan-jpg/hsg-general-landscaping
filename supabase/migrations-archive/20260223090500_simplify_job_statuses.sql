-- Keep job statuses focused on operational execution.
-- Lead/prospect/customer lifecycle is already tracked on contacts.status.

do $$
declare
  dashboard_stats_view_sql text;
  upcoming_schedule_view_sql text;
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'job_status'
  ) then
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'dashboard_stats'
        and c.relkind = 'v'
    ) then
      select pg_get_viewdef('public.dashboard_stats'::regclass, true)
      into dashboard_stats_view_sql;

      execute 'drop view public.dashboard_stats';
    end if;

    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'upcoming_schedule'
        and c.relkind = 'v'
    ) then
      select pg_get_viewdef('public.upcoming_schedule'::regclass, true)
      into upcoming_schedule_view_sql;

      execute 'drop view public.upcoming_schedule';
    end if;

    update public.jobs
    set status = 'scheduled'::public.job_status
    where status::text not in ('scheduled', 'in_progress', 'completed');

    create type public.job_status_new as enum ('scheduled', 'in_progress', 'completed');

    alter table public.jobs
      alter column status drop default;

    alter table public.jobs
      alter column status type public.job_status_new
      using (
        case
          when status::text in ('scheduled', 'in_progress', 'completed') then status::text
          else 'scheduled'
        end
      )::public.job_status_new;

    drop type public.job_status;
    alter type public.job_status_new rename to job_status;

    alter table public.jobs
      alter column status set default 'scheduled'::public.job_status;

    if dashboard_stats_view_sql is not null then
      execute $view$
        create view public.dashboard_stats as
        select
          b.id as business_id,
          (
            select count(*)
            from public.jobs j
            where j.business_id = b.id
              and j.status in ('scheduled'::public.job_status, 'in_progress'::public.job_status)
          ) as active_jobs,
          (
            select count(*)
            from public.jobs j
            where j.business_id = b.id
              and j.status = 'scheduled'::public.job_status
              and j.scheduled_start >= now()
              and j.scheduled_start < (now() + interval '7 days')
          ) as jobs_this_week,
          (
            select count(*)
            from public.contacts c
            where c.business_id = b.id
              and c.status = 'lead'::public.contact_status
          ) as open_leads,
          (
            select count(*)
            from public.form_submissions fs
            where fs.business_id = b.id
              and fs.status = 'new'::public.form_submission_status
          ) as unread_submissions,
          (
            select count(*)
            from public.invoices i
            where i.business_id = b.id
              and i.status = 'overdue'::public.invoice_status
          ) as overdue_invoices,
          (
            select coalesce(sum(i.total), 0::numeric)
            from public.invoices i
            where i.business_id = b.id
              and i.status = 'overdue'::public.invoice_status
          ) as overdue_amount,
          (
            select coalesce(sum(p.amount), 0::numeric)
            from public.payments p
            where p.business_id = b.id
              and p.paid_at >= date_trunc('month', now())
          ) as revenue_this_month,
          (
            select coalesce(sum(p.amount), 0::numeric)
            from public.payments p
            where p.business_id = b.id
              and p.paid_at >= date_trunc('year', now())
          ) as revenue_this_year
        from public.businesses b
      $view$;
    end if;

    if upcoming_schedule_view_sql is not null then
      execute format(
        'create view public.upcoming_schedule as %s',
        upcoming_schedule_view_sql
      );
    end if;
  end if;
end $$;
