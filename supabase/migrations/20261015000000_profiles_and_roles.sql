-- Profiles, roles and account standing (PRD FR01, FR09).
--
-- One profile per auth user, created by a trigger at sign up.
-- Users may edit only their display fields. role and account_status are
-- protected by column privileges, so no request from the app can change them.

-- Keeps updated_at current on any table that has the column.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text check (char_length(display_name) <= 80),
  avatar_url     text,
  role           text not null default 'user' check (role in ('user', 'admin')),
  account_status text not null default 'active' check (account_status in ('active', 'suspended', 'banned')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creates the profile when Supabase Auth creates the user (email or Google).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- True when the caller is an admin in good standing. A suspended admin has no admin rights.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and account_status = 'active'
  );
$$;

-- Access ---------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "users read own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Rows are created by the trigger and removed with the auth user,
-- so the app gets read access and can edit display fields only.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
