-- Techinance public blog and editor-only publishing.
--
-- This migration intentionally authorizes editors in the database instead of
-- trusting a browser-side list. The public site uses only the Supabase
-- publishable key; no service-role credential belongs in a static website.

begin;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug = lower(slug))
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  author_name text not null default 'Techinance'
    check (char_length(author_name) between 1 and 100),
  author_role text not null default '' check (char_length(author_role) <= 120),
  excerpt text not null default '' check (char_length(excerpt) <= 260),
  body text not null check (char_length(body) between 1 and 50000),
  -- A null value is an unpublished draft. Public readers never receive it.
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_published_at_index
  on public.blog_posts (published_at desc)
  where published_at is not null;

-- Resolve editor access against auth.users on every request. That avoids
-- granting an old JWT permanent access after a confirmed email is changed.
create or replace function public.is_blog_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and lower(u.email) in (
        'sav.krish01@gmail.com',
        'nabambaezi@gmail.com'
      )
  );
$$;

revoke all on function public.is_blog_editor() from public, anon, authenticated;
grant execute on function public.is_blog_editor() to authenticated;

-- Keep the timestamp reliable even when a post is edited through the dashboard
-- rather than through this website.
create or replace function public.set_blog_post_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_blog_post_updated_at on public.blog_posts;
create trigger set_blog_post_updated_at
  before update on public.blog_posts
  for each row execute function public.set_blog_post_updated_at();

revoke all on function public.set_blog_post_updated_at() from public, anon, authenticated;

alter table public.blog_posts enable row level security;

-- Published articles are public. Drafts and future-scheduled articles are not.
drop policy if exists "Public reads published blog posts" on public.blog_posts;
create policy "Public reads published blog posts"
  on public.blog_posts for select
  to anon, authenticated
  using (published_at is not null and published_at <= now());

-- Editors can see drafts and scheduled posts in their private console.
drop policy if exists "Editors read all blog posts" on public.blog_posts;
create policy "Editors read all blog posts"
  on public.blog_posts for select
  to authenticated
  using (public.is_blog_editor());

drop policy if exists "Editors insert blog posts" on public.blog_posts;
create policy "Editors insert blog posts"
  on public.blog_posts for insert
  to authenticated
  with check (public.is_blog_editor());

drop policy if exists "Editors update blog posts" on public.blog_posts;
create policy "Editors update blog posts"
  on public.blog_posts for update
  to authenticated
  using (public.is_blog_editor())
  with check (public.is_blog_editor());

drop policy if exists "Editors delete blog posts" on public.blog_posts;
create policy "Editors delete blog posts"
  on public.blog_posts for delete
  to authenticated
  using (public.is_blog_editor());

-- Explicit grants are a second boundary. RLS above still decides which rows
-- an authenticated request may touch.
revoke all on table public.blog_posts from public, anon, authenticated;
grant select on table public.blog_posts to anon, authenticated;
grant insert, update, delete on table public.blog_posts to authenticated;

commit;
