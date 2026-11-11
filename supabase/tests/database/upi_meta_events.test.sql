begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
create schema tests;
grant usage on schema tests to authenticated;
create function tests.uid(p_name text) returns uuid language sql stable security definer as $$
  select id from auth.users where email=p_name||'@meta.test';
$$;
create function tests.act(p_name text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',json_build_object('sub',tests.uid(p_name),'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
end; $$;
-- Pays for a plan as p_name and has the administrator confirm it.
create function tests.pay(p_name text,p_utr text) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  perform tests.act(p_name);
  v_id := (public.create_upi_order('meta_week')).id;
  perform public.submit_upi_payment(v_id,p_utr);
  perform tests.act('admin');
  perform public.decide_upi_order(v_id,'approve');
  reset role;
  return v_id;
end; $$;

delete from public.upi_orders;
delete from public.meta_event_outbox;
insert into auth.users(id,email) select gen_random_uuid(),name||'@meta.test' from unnest(array['admin','agreed','declined','unknown']) name;
update public.profiles set role='admin' where id=tests.uid('admin');
insert into public.plans(product_id,name,billing_period,quota_bytes,active,price_paise) values ('meta_week','Silver','P7D',0,true,12900);
insert into public.app_installs(user_id,installation_id,tracking_consent,meta_anon_id,extinfo) values
  (tests.uid('agreed'),gen_random_uuid(),true,'anon-1','["a2"]'),
  (tests.uid('declined'),gen_random_uuid(),false,null,null);
select tests.act('admin');
select public.save_payment_settings('shop@okbank','CloudLynk');
reset role;

select tests.pay('agreed','111111111111');
select is((select count(*) from public.meta_event_outbox),1::bigint,'a confirmed payment queues one event');
select is((select event_name from public.meta_event_outbox),'Subscribe','the first paid period is a Subscribe');
select is((select value from public.meta_event_outbox),129.00,'the value is the amount on the order, in rupees');
select is((select currency from public.meta_event_outbox),'INR','the currency is INR');
select is((select payload->>'metaAnonId' from public.meta_event_outbox),'anon-1','the event carries the install identifiers');
select is((select event_id from public.meta_event_outbox),'upi-order-'||(select id from public.upi_orders where status='paid'),'the event id is derived from the order, so it cannot repeat');

select tests.pay('agreed','222222222222');
select is((select event_name from public.meta_event_outbox order by created_at desc, event_name limit 1),'Purchase','later periods are a Purchase');

select tests.pay('declined','333333333333');
select tests.pay('unknown','444444444444');
select is((select count(*) from public.meta_event_outbox where user_id in (tests.uid('declined'),tests.uid('unknown'))),0::bigint,'nothing is queued without tracking consent');

-- A rejected payment is not a conversion.
select tests.act('agreed');
select public.submit_upi_payment((public.create_upi_order('meta_week')).id,'555555555555');
select tests.act('admin');
select public.decide_upi_order((select id from public.upi_orders where status='submitted'),'reject','Not found in the statement');
reset role;
select is((select count(*) from public.meta_event_outbox),2::bigint,'a rejected payment queues nothing');
select * from finish();
rollback;
