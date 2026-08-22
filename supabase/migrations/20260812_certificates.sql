-- Techinance: certificate storage and issuing.
--
-- Certificates are issued by the `generate-certificate` edge function, which
-- verifies the caller's token and reads `episode_progress` server-side before
-- it draws anything. Nothing here should let a browser write its own
-- certificate row, because a row is the record that one was earned.
--
-- Safe to run more than once, and safe to run over the earlier draft of this
-- table. `create table if not exists` will not alter a table that already
-- exists, so the sections below bring an existing one up to spec explicitly
-- rather than assuming a clean database.

begin;

-- 1. The table ---------------------------------------------------------------
create table if not exists public.certificates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  student_name  text not null,
  student_email text not null,
  course_id     text not null,
  course_name   text not null,
  pdf_path      text,
  pdf_url       text,
  -- issued: drawn and stored. delivered: also emailed. failed: kept for support.
  status        text not null default 'issued'
    check (status in ('issued', 'delivered', 'failed')),
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. Bring an existing table up to spec --------------------------------------
do $$
declare
  orphans bigint;
  dupes bigint;
begin
  -- The earlier draft allowed a null user_id, which would mean a certificate
  -- belonging to nobody and readable by nobody.
  select count(*) into orphans from public.certificates where user_id is null;
  if orphans > 0 then
    raise exception
      'certificates: % row(s) have a null user_id. Decide what they belong to, then re-run.', orphans;
  end if;
  alter table public.certificates alter column user_id set not null;

  -- The earlier draft's statuses were pending/generating/delivered/failed.
  -- Map the two that no longer exist before constraining the column.
  update public.certificates set status = 'issued'
   where status in ('pending', 'generating', 'generated');

  if not exists (
    select 1 from pg_constraint where conname = 'certificates_status_check'
  ) then
    alter table public.certificates
      add constraint certificates_status_check
      check (status in ('issued', 'delivered', 'failed'));
  end if;

  alter table public.certificates alter column status set default 'issued';
  alter table public.certificates alter column course_name drop default;

  -- One certificate per learner per course. The unique index below cannot be
  -- built while duplicates exist, so say so plainly rather than failing on a
  -- constraint violation the reader has to decode.
  select count(*) into dupes from (
    select user_id, course_id from public.certificates
    group by user_id, course_id having count(*) > 1
  ) d;
  if dupes > 0 then
    raise exception
      'certificates: % (user, course) pair(s) appear more than once. Keep one row each, then re-run.', dupes;
  end if;
end $$;

-- The conflict target the edge function upserts on.
create unique index if not exists certificates_user_course_key
  on public.certificates (user_id, course_id);

-- The earlier draft's plain index is redundant once the unique one exists.
drop index if exists public.idx_certificates_user_course;

alter table public.certificates enable row level security;

-- 3. Row access --------------------------------------------------------------
-- Learners may read their own certificates and nothing else. There is
-- deliberately no insert or update policy: only the edge function writes here,
-- using the service role, after it has checked completion. The earlier draft
-- granted insert and update to `authenticated`, which let any signed-in learner
-- award themselves a certificate straight through the REST API and skip the
-- completion check entirely.
drop policy if exists "Users can view their own certificates" on public.certificates;
create policy "Users can view their own certificates"
  on public.certificates for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own certificates" on public.certificates;
drop policy if exists "Users can update their own certificates" on public.certificates;

revoke all on table public.certificates from public, anon, authenticated;
grant select on table public.certificates to authenticated;

-- 4. Storage -----------------------------------------------------------------
-- Private. Certificates carry a learner's real name and many of these learners
-- are minors, so the files are not world-readable. The edge function returns a
-- signed URL instead.
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do update set public = false;

-- Only the service role writes here. The earlier draft let any signed-in user
-- upload anywhere in the bucket, including over another learner's file.
drop policy if exists "Authenticated users can upload certificates" on storage.objects;
drop policy if exists "Public access to certificates" on storage.objects;

-- A learner may read the files in their own folder, which is how a signed URL
-- for their own certificate resolves.
drop policy if exists "Learners read their own certificates" on storage.objects;
create policy "Learners read their own certificates"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
