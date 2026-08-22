-- Techinance: certificate storage and issuing.
--
-- Certificates are issued by the `generate-certificate` edge function, which
-- verifies the caller's token and reads `episode_progress` server-side before
-- it draws anything. Nothing here should let a browser write its own
-- certificate row, because a row is the record that one was earned.

-- 1. The certificates table -------------------------------------------------
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  student_name text not null,
  student_email text not null,
  course_id text not null,
  course_name text not null,
  pdf_path text,
  pdf_url text,
  -- issued: drawn and stored. delivered: also emailed. failed: kept for support.
  status text not null default 'issued'
    check (status in ('issued', 'delivered', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One certificate per learner per course. This is also what the edge function's
-- upsert conflict target relies on, so re-claiming replaces rather than piles up.
create unique index if not exists certificates_user_course_key
  on public.certificates (user_id, course_id);

alter table public.certificates enable row level security;

-- 2. Row access -------------------------------------------------------------
-- Learners may read their own certificates and nothing else. There is
-- deliberately no insert or update policy: only the edge function writes here,
-- using the service role, after it has checked completion. If the browser could
-- insert, "have you earned this" would again be the browser's opinion.
drop policy if exists "Users can view their own certificates" on public.certificates;
create policy "Users can view their own certificates"
  on public.certificates for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own certificates" on public.certificates;
drop policy if exists "Users can update their own certificates" on public.certificates;

revoke all on table public.certificates from public, anon, authenticated;
grant select on table public.certificates to authenticated;

-- 3. Storage ----------------------------------------------------------------
-- Private. Certificates carry a learner's real name, and many of these learners
-- are minors, so the files are not world-readable. The edge function hands back
-- a signed URL instead.
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do update set public = false;

-- Only the service role writes into this bucket. The previous policy let any
-- signed-in user upload anywhere in it, including over another learner's file.
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
