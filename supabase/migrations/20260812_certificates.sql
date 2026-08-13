-- Techinance: Automated Certificate Generation Schema
-- 
-- Run this in the Supabase SQL Editor to enable certificate storage and tracking.

-- 1. Create certificates table
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  student_name text not null,
  student_email text not null,
  course_id text not null,
  course_name text not null default 'Financial Literacy',
  pdf_path text,
  pdf_url text,
  status text not null default 'pending', -- pending, generating, delivered, failed
  resend_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for user lookup
create index if not exists idx_certificates_user_course on public.certificates(user_id, course_id);

-- Enable RLS
alter table public.certificates enable row level security;

-- RLS Policies
drop policy if exists "Users can view their own certificates" on public.certificates;
create policy "Users can view their own certificates"
  on public.certificates for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own certificates" on public.certificates;
create policy "Users can insert their own certificates"
  on public.certificates for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own certificates" on public.certificates;
create policy "Users can update their own certificates"
  on public.certificates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Revoke & Grant explicit privileges
revoke all on table public.certificates from public, anon;
grant select, insert, update on table public.certificates to authenticated;

-- Storage Bucket Setup for Certificates
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', true)
on conflict (id) do update set public = true;

-- Storage RLS Policies
drop policy if exists "Authenticated users can upload certificates" on storage.objects;
create policy "Authenticated users can upload certificates"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'certificates');

drop policy if exists "Public access to certificates" on storage.objects;
create policy "Public access to certificates"
  on storage.objects for select
  to public
  using (bucket_id = 'certificates');
