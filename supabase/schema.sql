-- ============================================================================
-- OWASP LLM Learning Lab - Supabase schema
-- ----------------------------------------------------------------------------
-- HOW TO RUN (no SQL knowledge needed):
--   1. Supabase dashboard -> your project -> left menu "SQL Editor"
--   2. Click "New query", paste this whole file, click "Run" (Ctrl+Enter)
--   3. Done. You should see "Success. No rows returned".
--
-- What this creates:
--   * profiles  - one row per signed-up user (email, name, student/admin role)
--   * progress  - per-user per-lab completion (explored / flag / fix-it)
--   * attempts  - audit log of flag submissions and fix attempts (backend-written)
--   * Row Level Security: students only see their own data; admins see everything
--   * A trigger that creates a profile automatically at sign-up and makes
--     owaspsiliguri@gmail.com an administrator
-- ============================================================================

-- 1. Profiles ----------------------------------------------------------------

create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  full_name      text,
  role           text not null default 'student' check (role in ('student', 'admin')),
  created_at     timestamptz not null default now(),
  last_sign_in_at timestamptz
);

-- 2. Progress (explored / flag / fix-it per lab) ------------------------------

create table if not exists public.progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  module_id  text not null,
  explored   boolean not null default false,
  flag       boolean not null default false,
  fixit      boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

-- 3. Attempts: audit trail written only by the backend (service role key) -----

create table if not exists public.attempts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  module_id  text not null,
  kind       text not null check (kind in ('flag', 'fixit')),
  correct    boolean not null default false,
  detail     text,
  created_at timestamptz not null default now()
);

create index if not exists attempts_user_created_idx on public.attempts (user_id, created_at desc);
create index if not exists attempts_created_idx on public.attempts (created_at desc);
create index if not exists progress_module_idx on public.progress (module_id);

-- 4. Helper functions ---------------------------------------------------------

-- True when the caller is an administrator. SECURITY DEFINER so policies can
-- read profiles without recursing through row level security.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.id = auth.uid()), false);
$$;

-- A signed-in user may update their own display name (never their role).
create or replace function public.save_profile(p_full_name text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set full_name = nullif(trim(coalesce(p_full_name, '')), '')
   where id = auth.uid();
$$;

-- 5. Triggers -----------------------------------------------------------------

-- 5a. Every new auth user automatically gets a profile.
--     owaspsiliguri@gmail.com is promoted to admin (case-insensitive).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, created_at, last_sign_in_at)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    case when lower(new.email) = 'owaspsiliguri@gmail.com' then 'admin' else 'student' end,
    coalesce(new.created_at, now()),
    new.last_sign_in_at
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5b. Keep profiles.last_sign_in_at in sync with GoTrue.
create or replace function public.handle_user_signin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set last_sign_in_at = new.last_sign_in_at
   where id = new.id
     and new.last_sign_in_at is distinct from old.last_sign_in_at;
  return new;
end;
$$;

drop trigger if exists on_auth_user_signin on auth.users;
create trigger on_auth_user_signin
  after update on auth.users
  for each row execute function public.handle_user_signin();

-- 5c. Nobody except an admin may change a role.
create or replace function public.protect_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only administrators can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update of role on public.profiles
  for each row execute function public.protect_role();

-- 6. Row Level Security --------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.progress  enable row level security;
alter table public.attempts  enable row level security;

-- profiles: read own (admins read all), update own (role protected by trigger).
-- No INSERT policy on purpose: profiles are created by the trigger above.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "admin updates profiles" on public.profiles;
create policy "admin updates profiles" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- progress: own rows read/write; admins read all.
drop policy if exists "read progress" on public.progress;
create policy "read progress" on public.progress
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "insert progress" on public.progress;
create policy "insert progress" on public.progress
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "update progress" on public.progress;
create policy "update progress" on public.progress
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "delete progress" on public.progress;
create policy "delete progress" on public.progress
  for delete to authenticated
  using (user_id = auth.uid());

-- attempts: read only (own rows, or all rows for admins). Writes come from the
-- backend with the service role key, which bypasses RLS.
drop policy if exists "read attempts" on public.attempts;
create policy "read attempts" on public.attempts
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- 7. Grants (explicit, defence in depth) ---------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant select on public.profiles  to authenticated;
grant select, insert, update, delete on public.progress to authenticated;
grant select on public.attempts to authenticated;
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.save_profile(text) to authenticated;

revoke insert, update, delete on public.attempts  from anon, authenticated;
revoke insert, delete on public.profiles          from anon, authenticated;

grant all on public.profiles to service_role;
grant all on public.progress to service_role;
grant all on public.attempts to service_role;

-- 8. Promote the administrator if the account already existed ------------------

update public.profiles
   set role = 'admin'
 where lower(email) = 'owaspsiliguri@gmail.com';

-- ============================================================================
-- OPTIONAL: promote any other account to admin later, e.g.
--   update public.profiles set role = 'admin' where lower(email) = 'someone@x.org';
-- ============================================================================
