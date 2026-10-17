-- Channels and channel membership (PRD FR05).
--
-- Published channels are public metadata, so guests can browse the catalogue.
-- requires_subscription marks a premium channel. Users join and leave through
-- join_channel() / leave_channel() (see the access policy migration), so the
-- app has no direct write access to channel_members.

create table public.channels (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (char_length(name) between 1 and 80),
  description           text check (char_length(description) <= 2000),
  requires_subscription boolean not null default true,
  status                text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by            uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger channels_set_updated_at
  before update on public.channels
  for each row execute function public.set_updated_at();

-- Membership and subscription are separate (PRD): a member whose subscription
-- lapses keeps this row but is denied premium playback by the access rule.
create table public.channel_members (
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index channel_members_user_idx on public.channel_members (user_id);

-- Access ---------------------------------------------------------------------

alter table public.channels enable row level security;
alter table public.channel_members enable row level security;

create policy "anyone reads published channels" on public.channels
  for select to anon, authenticated
  using (status = 'published');

create policy "admins manage channels" on public.channels
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "users read own memberships" on public.channel_members
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.channels from anon, authenticated;
grant select on public.channels to anon, authenticated;
grant insert, update, delete on public.channels to authenticated; -- limited to admins by RLS

revoke all on public.channel_members from anon, authenticated;
grant select on public.channel_members to authenticated;
