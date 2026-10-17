-- PR1 completion gate: the PRD role / state matrix, checked against
-- access_decision() and again through the API roles the app uses.
-- Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(53);

-- Helpers --------------------------------------------------------------------
-- Test users are named; their email is <name>@test.local.

create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.create_user(p_name text, p_metadata jsonb default '{}')
returns uuid
language sql
as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (gen_random_uuid(), p_name || '@test.local', p_metadata)
  returning id;
$$;

create function tests.user_id(p_name text)
returns uuid
language sql
stable
security definer
as $$
  select id from auth.users where email = p_name || '@test.local';
$$;

create function tests.channel_id(p_name text)
returns uuid
language sql
stable
security definer
as $$
  select id from public.channels where name = p_name;
$$;

create function tests.subscribe(p_name text, p_status text, p_paid_until timestamptz)
returns void
language sql
as $$
  insert into public.subscriptions (user_id, product_id, purchase_token, status, paid_until)
  values (tests.user_id(p_name), 'premium_monthly', 'token-' || p_name, p_status, p_paid_until);
$$;

create function tests.decision(p_user text, p_action text, p_channel text)
returns text
language sql
as $$
  select public.access_decision(tests.user_id(p_user), p_action, tests.channel_id(p_channel));
$$;

-- Switches to the API role the app would use: anon for 'guest', else authenticated as that user.
create function tests.act_as(p_name text)
returns void
language plpgsql
as $$
begin
  reset role;
  if p_name = 'guest' then
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    perform set_config('role', 'anon', true);
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', tests.user_id(p_name), 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end;
$$;

-- Fixtures -------------------------------------------------------------------
-- One user per state in the PRD access matrix, and one channel per channel state.

do $$
begin
  perform tests.create_user(name)
  from unnest(array[
    'free', 'free_member', 'subscriber', 'member', 'cancelled_paid', 'in_grace', 'lapsed',
    'expired', 'expired_member', 'refunded', 'on_hold', 'pending', 'suspended', 'banned',
    'admin', 'suspended_admin'
  ]) as name;
  perform tests.create_user('google_user', '{"name": "Asha"}');

  perform tests.subscribe('subscriber',     'active',    now() + interval '30 days');
  perform tests.subscribe('member',         'active',    now() + interval '30 days');
  perform tests.subscribe('cancelled_paid', 'cancelled', now() + interval '5 days');
  perform tests.subscribe('in_grace',       'in_grace',  now() + interval '2 days');
  perform tests.subscribe('lapsed',         'active',    now() - interval '1 day'); -- renewal not reconciled yet
  perform tests.subscribe('expired',        'expired',   now() - interval '1 day');
  perform tests.subscribe('expired_member', 'expired',   now() - interval '1 day');
  perform tests.subscribe('refunded',       'refunded',  now() + interval '20 days');
  perform tests.subscribe('on_hold',        'on_hold',   now() + interval '10 days');
  perform tests.subscribe('pending',        'pending',   now() + interval '30 days');
  perform tests.subscribe('suspended',      'active',    now() + interval '30 days');
  perform tests.subscribe('banned',         'active',    now() + interval '30 days');

  update public.profiles set role = 'admin'
  where id in (tests.user_id('admin'), tests.user_id('suspended_admin'));
  update public.profiles set account_status = 'suspended'
  where id in (tests.user_id('suspended'), tests.user_id('suspended_admin'));
  update public.profiles set account_status = 'banned'
  where id = tests.user_id('banned');

  insert into public.channels (name, requires_subscription, status) values
    ('Premium',  true,  'published'),
    ('Free',     false, 'published'),
    ('Draft',    true,  'draft'),
    ('Archived', true,  'archived');

  insert into public.channel_members (channel_id, user_id) values
    (tests.channel_id('Premium'), tests.user_id('member')),
    (tests.channel_id('Premium'), tests.user_id('expired_member')),
    (tests.channel_id('Free'),    tests.user_id('free_member'));
end;
$$;

-- Sign up --------------------------------------------------------------------

select is(
  (select display_name from public.profiles where id = tests.user_id('google_user')),
  'Asha',
  'sign up creates a profile named from the auth metadata'
);

-- Access matrix --------------------------------------------------------------
-- 'guest' has no user id; 'Missing' has no channel id.

select is(
  tests.decision(c.who, c.action, c.channel),
  c.expected,
  format('%s %s %s -> %s', c.who, c.action, coalesce(c.channel, ''), c.expected)
)
from (values
  -- Purchase needs only a signed-in account in good standing (no approval gate).
  ('guest',          'purchase', null,       'sign_in_required'),
  ('free',           'purchase', null,       'allowed'),
  ('suspended',      'purchase', null,       'account_restricted'),
  ('banned',         'purchase', null,       'account_restricted'),

  -- Joining a premium channel needs a paid, unexpired subscription.
  ('guest',          'join',     'Premium',  'sign_in_required'),
  ('free',           'join',     'Premium',  'subscription_required'),
  ('subscriber',     'join',     'Premium',  'allowed'),
  ('cancelled_paid', 'join',     'Premium',  'allowed'),
  ('in_grace',       'join',     'Premium',  'allowed'),
  ('lapsed',         'join',     'Premium',  'subscription_required'),
  ('expired',        'join',     'Premium',  'subscription_required'),
  ('refunded',       'join',     'Premium',  'subscription_required'),
  ('on_hold',        'join',     'Premium',  'subscription_required'),
  ('pending',        'join',     'Premium',  'subscription_required'),
  ('suspended',      'join',     'Premium',  'account_restricted'),
  ('banned',         'join',     'Premium',  'account_restricted'),
  ('admin',          'join',     'Premium',  'subscription_required'), -- no viewing bypass

  -- Free channels are open to any account in good standing.
  ('free',           'join',     'Free',     'allowed'),
  ('suspended',      'join',     'Free',     'account_restricted'),

  -- Only published channels can be joined.
  ('subscriber',     'join',     'Draft',    'channel_unavailable'),
  ('subscriber',     'join',     'Archived', 'channel_unavailable'),
  ('subscriber',     'join',     'Missing',  'channel_unavailable'),

  -- Watching also needs membership; membership alone is not enough.
  ('guest',          'watch',    'Premium',  'sign_in_required'),
  ('subscriber',     'watch',    'Premium',  'membership_required'),
  ('member',         'watch',    'Premium',  'allowed'),
  ('expired_member', 'watch',    'Premium',  'subscription_required'),
  ('free',           'watch',    'Free',     'membership_required'),
  ('free_member',    'watch',    'Free',     'allowed')
) as c(who, action, channel, expected);

select throws_ok(
  $$ select public.access_decision(null, 'download', null) $$,
  '22023', 'unknown access action: download',
  'unknown actions are rejected'
);

-- Guest (anon API role) ------------------------------------------------------

select tests.act_as('guest');

select is(public.my_access('purchase'), 'sign_in_required', 'guest: my_access asks to sign in');
select is((select count(*) from public.channels), 2::bigint, 'guest: sees published channels only');
select throws_ok(
  format('select public.join_channel(%L)', tests.channel_id('Free')),
  '42501', null, 'guest: cannot join'
);

-- Free user ------------------------------------------------------------------

select tests.act_as('free');

select is(public.my_access('join', tests.channel_id('Premium')), 'subscription_required',
  'free: my_access reports subscription_required for a premium channel');
select throws_ok(
  format('select public.join_channel(%L)', tests.channel_id('Premium')),
  '42501', 'subscription_required', 'free: join premium is denied with the decision'
);
select lives_ok(
  $$ update public.profiles set display_name = 'New name' where id = auth.uid() $$,
  'free: can edit own display name'
);
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = auth.uid() $$,
  '42501', null, 'free: cannot make self admin'
);
select throws_ok(
  $$ update public.profiles set account_status = 'active' where id = auth.uid() $$,
  '42501', null, 'free: cannot change own account status'
);
select is((select count(*) from public.profiles), 1::bigint, 'free: sees only own profile');
select throws_ok(
  $$ insert into public.subscriptions (user_id, product_id, purchase_token, status, paid_until)
     values (auth.uid(), 'premium_monthly', 'forged', 'active', now() + interval '1 year') $$,
  '42501', null, 'free: cannot forge a subscription'
);
select throws_ok(
  format('insert into public.channel_members (channel_id, user_id) values (%L, auth.uid())',
    tests.channel_id('Premium')),
  '42501', null, 'free: cannot add self to a channel directly'
);
select throws_ok(
  $$ select public.access_decision(auth.uid(), 'purchase') $$,
  '42501', null, 'free: cannot call access_decision for arbitrary users'
);
select throws_ok(
  $$ insert into public.channels (name) values ('Not allowed') $$,
  '42501', null, 'free: cannot create channels'
);

-- Subscriber -----------------------------------------------------------------

select tests.act_as('subscriber');

select lives_ok(
  format('select public.join_channel(%L)', tests.channel_id('Premium')),
  'subscriber: joins a premium channel'
);
select lives_ok(
  format('select public.join_channel(%L)', tests.channel_id('Premium')),
  'subscriber: joining twice is a no-op'
);
select is((select count(*) from public.channel_members), 1::bigint, 'subscriber: sees own membership');
select is(public.my_access('watch', tests.channel_id('Premium')), 'allowed',
  'subscriber: may watch after joining');
select is((select count(*) from public.subscriptions), 1::bigint, 'subscriber: sees only own subscription');
select lives_ok(
  format('select public.leave_channel(%L)', tests.channel_id('Premium')),
  'subscriber: leaves the channel'
);
select is((select count(*) from public.channel_members), 0::bigint, 'subscriber: membership removed');

-- Admin ----------------------------------------------------------------------

select tests.act_as('admin');

select lives_ok(
  $$ insert into public.channels (name, status) values ('New channel', 'draft') $$,
  'admin: creates a channel'
);
select is((select count(*) from public.channels), 5::bigint, 'admin: sees draft and archived channels too');

select tests.act_as('suspended_admin');

select throws_ok(
  $$ insert into public.channels (name) values ('Not allowed') $$,
  '42501', null, 'suspended admin: loses admin rights'
);

select * from finish();
rollback;
