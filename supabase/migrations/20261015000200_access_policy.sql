-- One access rule for purchase, join and watch (PRD PR1).
--
-- access_decision() is the single place that decides who may buy, join a
-- channel or watch it. Server code (edge functions) calls it directly; the app
-- calls my_access() to show locked / unlocked states and join_channel() to join.
-- There is no approval gate: a signed-in user in good standing can buy at once,
-- and a verified subscription unlocks premium channels immediately.
--
-- Decisions (stable strings, part of the API contract in docs/api/access-policy.md):
--   allowed              the action may go ahead
--   sign_in_required     no signed-in user
--   account_restricted   account is suspended or banned
--   channel_unavailable  channel does not exist or is not published
--   subscription_required  premium channel and no paid, unexpired subscription
--   membership_required  watch only: the user has not joined the channel
--
-- Title-level checks (publication state, age rating) are added on top of this
-- when titles exist (PRD PR4/PR5); they must call access_decision(), not copy it.

-- True while the user has a verified subscription that is paid for right now.
-- cancelled means auto-renew is off: access continues until paid_until.
-- in_grace is Google Play's payment grace period, during which access continues.
create function public.has_active_subscription(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.status in ('active', 'in_grace', 'cancelled')
      and s.paid_until > now()
  );
$$;

create function public.access_decision(
  p_user_id    uuid,
  p_action     text,
  p_channel_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account_status text;
  v_channel        public.channels;
begin
  if p_action not in ('purchase', 'join', 'watch') then
    raise exception 'unknown access action: %', p_action using errcode = '22023';
  end if;

  if p_user_id is null then
    return 'sign_in_required';
  end if;

  select account_status into v_account_status
  from public.profiles
  where id = p_user_id;

  if v_account_status is distinct from 'active' then
    return 'account_restricted';
  end if;

  if p_action = 'purchase' then
    return 'allowed';
  end if;

  select * into v_channel
  from public.channels
  where id = p_channel_id;

  if not found or v_channel.status <> 'published' then
    return 'channel_unavailable';
  end if;

  if v_channel.requires_subscription and not public.has_active_subscription(p_user_id) then
    return 'subscription_required';
  end if;

  if p_action = 'watch' and not exists (
    select 1
    from public.channel_members m
    where m.channel_id = p_channel_id
      and m.user_id = p_user_id
  ) then
    return 'membership_required';
  end if;

  return 'allowed';
end;
$$;

-- The app's view of the rule, always for the signed-in caller.
create function public.my_access(p_action text, p_channel_id uuid default null)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.access_decision(auth.uid(), p_action, p_channel_id);
$$;

-- Joins a channel if the access rule allows it. Joining twice is a no-op.
-- When denied, raises with the decision as the message (HTTP 403 from the API).
create function public.join_channel(p_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_decision text := public.access_decision(auth.uid(), 'join', p_channel_id);
begin
  if v_decision <> 'allowed' then
    raise exception '%', v_decision using errcode = '42501';
  end if;

  insert into public.channel_members (channel_id, user_id)
  values (p_channel_id, auth.uid())
  on conflict (channel_id, user_id) do nothing;
end;
$$;

-- Leaving is always allowed, even for a restricted account. Leaving twice is a no-op.
create function public.leave_channel(p_channel_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.channel_members
  where channel_id = p_channel_id
    and user_id = auth.uid();
$$;

-- Access ---------------------------------------------------------------------

-- access_decision() takes any user id, so only server code may call it.
revoke all on function public.has_active_subscription(uuid) from public, anon, authenticated;
revoke all on function public.access_decision(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.has_active_subscription(uuid) to service_role;
grant execute on function public.access_decision(uuid, text, uuid) to service_role;

revoke all on function public.my_access(text, uuid) from public;
revoke all on function public.join_channel(uuid) from public, anon;
revoke all on function public.leave_channel(uuid) from public, anon;
grant execute on function public.my_access(text, uuid) to anon, authenticated;
grant execute on function public.join_channel(uuid) to authenticated;
grant execute on function public.leave_channel(uuid) to authenticated;

-- The rule trusts subscriptions, so only server code may write them.
-- RLS already has no write policy; removing the privileges makes that explicit.
revoke insert, update, delete, truncate on public.subscriptions from anon, authenticated;
