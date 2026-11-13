-- ============================================================================
-- OWASP LLM Learning Lab - additive platform migration
-- ----------------------------------------------------------------------------
-- Run this once in the Supabase SQL Editor (or with `supabase db push`) on a
-- project that already has supabase/schema.sql applied. It is additive and
-- idempotent: existing profiles, progress, attempts and lab IDs are untouched.
--
-- What it changes:
--   1. Browser clients can no longer insert/update/delete progress. Achievements
--      are written only by the backend after it verifies a flag or Fix-It run.
--      Existing progress rows and RLS read access are preserved.
--   2. Adds Markdown course storage (courses, course_lessons, course_progress).
--   3. Adds backend-owned refresh sessions and an auth audit log. Those tables
--      have no browser policies and no browser grants; the service role owns
--      them.
--
-- Safe to re-run: every CREATE is IF NOT EXISTS, every policy is dropped before
-- being recreated, and grants/revokes are idempotent.
-- ============================================================================

-- 1. Progress becomes read-only for browsers --------------------------------

-- The historical policy let a signed-in browser set its own flag/fixit bits.
-- Remove those write paths. The authenticated role keeps SELECT only.
drop policy if exists "insert progress" on public.progress;
drop policy if exists "update progress" on public.progress;
drop policy if exists "delete progress" on public.progress;

revoke insert, update, delete on public.progress from anon, authenticated;
grant select on public.progress to authenticated;
grant all on public.progress to service_role;

-- Keep the admin/read policy in place (created by schema.sql). Recreate it for
-- deployments that started from an earlier revision.
drop policy if exists "read progress" on public.progress;
create policy "read progress" on public.progress
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- 2. Courses ----------------------------------------------------------------

create table if not exists public.courses (
  id                uuid primary key,
  slug              text not null unique,
  title             text not null,
  description       text not null,
  category          text not null,
  difficulty        text not null check (difficulty in ('Beginner', 'Intermediate', 'Advanced', 'Expert')),
  estimated_minutes integer not null check (estimated_minutes between 1 and 600),
  thumbnail_url     text,
  status            text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  source_markdown   text not null,
  checksum          text not null,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz,
  deleted_at        timestamptz,
  version           integer not null default 1
);

create index if not exists courses_status_idx on public.courses (status, published_at desc);
create index if not exists courses_slug_idx on public.courses (slug);

create table if not exists public.course_lessons (
  id         uuid primary key,
  course_id  uuid not null references public.courses (id) on delete cascade,
  position   integer not null,
  title      text not null,
  slug       text not null,
  markdown   text not null,
  unique (course_id, position)
);

create index if not exists course_lessons_course_idx on public.course_lessons (course_id, position);

create table if not exists public.course_progress (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  course_id    uuid not null references public.courses (id) on delete cascade,
  completed    boolean not null default false,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, course_id)
);

create index if not exists course_progress_user_idx on public.course_progress (user_id);

-- 3. Backend sessions and auth audit log ------------------------------------

create table if not exists public.auth_sessions (
  id           uuid primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  refresh_hash text not null unique,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  replaced_by  uuid,
  user_agent   text,
  ip_hash      text
);

create index if not exists auth_sessions_user_idx on public.auth_sessions (user_id);
create index if not exists auth_sessions_expiry_idx on public.auth_sessions (expires_at);
create index if not exists auth_sessions_refresh_idx on public.auth_sessions (refresh_hash);

create table if not exists public.auth_events (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles (id) on delete set null,
  kind       text not null,
  detail     text,
  created_at timestamptz not null default now()
);

create index if not exists auth_events_created_idx on public.auth_events (created_at desc);
create index if not exists auth_events_user_idx on public.auth_events (user_id, created_at desc);

-- 4. Row Level Security ------------------------------------------------------

alter table public.courses         enable row level security;
alter table public.course_lessons  enable row level security;
alter table public.course_progress enable row level security;
alter table public.auth_sessions   enable row level security;
alter table public.auth_events     enable row level security;

-- Published course metadata is public; drafts and archived courses are visible
-- only to administrators. Writes are service-role only (the admin API).
drop policy if exists "read published courses" on public.courses;
create policy "read published courses" on public.courses
  for select to anon, authenticated
  using ((status = 'published' and deleted_at is null) or public.is_admin());

drop policy if exists "read published lessons" on public.course_lessons;
create policy "read published lessons" on public.course_lessons
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.courses c
       where c.id = course_lessons.course_id
         and ((c.status = 'published' and c.deleted_at is null) or public.is_admin())
    )
  );

-- Learners may read their own course completion. The backend writes it after a
-- lesson is actually completed; no browser INSERT/UPDATE policy exists.
drop policy if exists "read own course progress" on public.course_progress;
create policy "read own course progress" on public.course_progress
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- No policies at all on auth_sessions/auth_events: only the service role
-- (which bypasses RLS) can read or write them. Explicit revokes keep the
-- Supabase default grants from opening them to the browser roles.

-- 5. Grants ------------------------------------------------------------------

grant select on public.courses        to anon, authenticated;
grant select on public.course_lessons to anon, authenticated;
grant select on public.course_progress to authenticated;

revoke insert, update, delete on public.courses from anon, authenticated;
revoke insert, update, delete on public.course_lessons from anon, authenticated;
revoke insert, update, delete on public.course_progress from anon, authenticated;

revoke all on public.auth_sessions from anon, authenticated;
revoke all on public.auth_events from anon, authenticated;

grant all on public.courses to service_role;
grant all on public.course_lessons to service_role;
grant all on public.course_progress to service_role;
grant all on public.auth_sessions to service_role;
grant all on public.auth_events to service_role;

grant usage, select on all sequences in schema public to service_role;

-- 6. Verification ------------------------------------------------------------

do $$
begin
  if exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'progress'
       and cmd in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'progress still has browser write policies';
  end if;
end
$$;

-- Expected after this migration:
--   * progress: SELECT policy only, no INSERT/UPDATE/DELETE policy
--   * courses/course_lessons: published rows readable, writes service-role only
--   * course_progress: own rows readable, writes service-role only
--   * auth_sessions/auth_events: no anon/authenticated grants or policies
