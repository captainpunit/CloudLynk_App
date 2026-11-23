begin;
create extension if not exists pgtap with schema extensions;
select plan(5);
create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.uid(p_name text) returns uuid language sql stable security definer as $$
  select id from auth.users where email=p_name||'@push.test';
$$;
create function tests.act(p_name text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',json_build_object('sub',tests.uid(p_name),'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
end; $$;
grant execute on all functions in schema tests to anon, authenticated;
insert into auth.users(id,email) select gen_random_uuid(),name||'@push.test' from unnest(array['first','second']) name;

-- The first account registers this phone, then signs out without unregistering.
select tests.act('first');
select public.register_push_token('11111111-1111-1111-1111-111111111111','ExponentPushToken[first-phone]');
-- The second account opens the app on the same phone.
select tests.act('second');
select public.claim_installation('11111111-1111-1111-1111-111111111111');
reset role;
select is((select count(*) from public.push_tokens where user_id=tests.uid('first')),0::bigint,
  'the previous account no longer receives on this phone');

-- Ten old, disabled registrations no longer block a new one.
insert into public.push_tokens(user_id,installation_id,token,enabled)
  select tests.uid('second'),gen_random_uuid(),'ExponentPushToken[old-device-'||n||']',false from generate_series(1,10) n;
select tests.act('second');
select lives_ok($$select public.register_push_token('22222222-2222-2222-2222-222222222222','ExponentPushToken[new-phone-1]')$$,
  'devices with notifications off do not count against the limit');
-- Ten devices with notifications on still do.
reset role;
update public.push_tokens set enabled=true where user_id=tests.uid('second');
select tests.act('second');
select throws_ok($$select public.register_push_token('33333333-3333-3333-3333-333333333333','ExponentPushToken[eleventh-phone]')$$,
  'P0001','too_many_devices','ten active devices is still the limit');
-- Registrations unused for two months are cleared to make room.
reset role;
update public.push_tokens set updated_at=now()-interval '90 days' where user_id=tests.uid('second') and token like '%old-%';
select tests.act('second');
select lives_ok($$select public.register_push_token('33333333-3333-3333-3333-333333333333','ExponentPushToken[eleventh-phone]')$$,
  'stale registrations make room');
select tests.act('first');
select throws_ok($$select public.claim_installation(null)$$,'P0001','invalid_push_token','an installation is required');

select * from finish();
rollback;
