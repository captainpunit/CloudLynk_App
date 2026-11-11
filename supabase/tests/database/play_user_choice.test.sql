begin;
create extension if not exists pgtap with schema extensions;
select plan(25);
create schema tests;
grant usage on schema tests to authenticated;
create table tests.ids(label text primary key,id uuid);
grant all on tests.ids to authenticated;
create function tests.uid(p_name text) returns uuid language sql stable security definer as $$
  select id from auth.users where email=p_name||'@choice.test';
$$;
create function tests.id(p_label text) returns uuid language sql stable as $$
  select id from tests.ids where label=p_label;
$$;
create function tests.act(p_name text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',json_build_object('sub',tests.uid(p_name),'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
end; $$;
create function tests.subscribed(p_name text) returns boolean language sql security definer as $$
  select public.has_active_subscription(tests.uid(p_name));
$$;

delete from public.upi_orders;
delete from public.play_external_reports;
insert into auth.users(id,email) select gen_random_uuid(),name||'@choice.test' from unnest(array['admin','payer','other','buyer']) name;
update public.profiles set role='admin' where id=tests.uid('admin');
insert into public.plans(product_id,name,billing_period,quota_bytes,active,price_paise) values
  ('choice_week','Silver','P7D',0,true,11800),('choice_off','Retired','P7D',0,false,11800);
select tests.act('admin');
select public.save_payment_settings('shop@okbank','CloudLynk');

-- Tax setting.
select is((select tax_percent from public.payment_settings),18.00,'GST defaults to 18 percent');
select throws_ok($$select public.set_payment_tax(51)$$,'P0001','invalid_tax_percent','tax percent is bounded');
select tests.act('payer');
select throws_ok($$select public.set_payment_tax(5)$$,'42501','admin_required','members cannot change tax');

-- Recording Google's choice on an order.
insert into tests.ids values('first',(public.create_upi_order('choice_week')).id);
select throws_ok($$select public.attach_play_choice(tests.id('first'),'tok-1','Gujarat')$$,'P0001','invalid_state','the state must be one Google accepts');
select throws_ok($$select public.attach_play_choice(tests.id('first'),'','GUJARAT')$$,'P0001','invalid_play_token','a token is required');
select is((public.attach_play_choice(tests.id('first'),'tok-1','GUJARAT')).tax_state,'GUJARAT','the choice is stored on the order');
select is((public.attach_play_choice(tests.id('first'),'tok-1','GUJARAT')).external_transaction_token,'tok-1','repeating the same choice is harmless');
select throws_ok($$select public.attach_play_choice(tests.id('first'),'tok-2','GUJARAT')$$,'P0001','order_closed','a token cannot be replaced');
select tests.act('other');
select throws_ok($$select public.attach_play_choice(tests.id('first'),'tok-1','GUJARAT')$$,'P0001','order_not_found','members cannot touch another member''s order');
insert into tests.ids values('second',(public.create_upi_order('choice_week')).id);
select throws_ok($$select public.attach_play_choice(tests.id('second'),'tok-1','KERALA')$$,'P0001','play_token_already_used','one token authorises one order');
select throws_ok($$select external_transaction_token from public.play_external_reports$$,'42501',null,'nobody reads report tokens through the API');

-- Confirmation queues exactly one report with the tax split.
select tests.act('payer');
select public.submit_upi_payment(tests.id('first'),'111111111111');
reset role;
select is((select count(*) from public.play_external_reports),0::bigint,'nothing is reported before confirmation');
select tests.act('admin');
select public.decide_upi_order(tests.id('first'),'approve');
select is((select count(*) from public.play_external_reports),1::bigint,'a confirmed order with a token is queued for Google');
select tests.act('payer');
select is((select count(*) from public.play_external_reports),0::bigint,'members cannot see the report queue');
reset role;
select is((select external_transaction_id from public.play_external_reports),'upi-'||tests.id('first'),'the report id is derived from the order');
select is((select array[pre_tax_paise,tax_paise] from public.play_external_reports),array[10000,1800],'the price is split into pre-tax and GST');
select is((select tax_state from public.play_external_reports),'GUJARAT','the report carries the state');

-- An order made without Google's screen (direct APK) is not reported.
select tests.act('other');
select public.submit_upi_payment(tests.id('second'),'222222222222');
select tests.act('admin');
select public.decide_upi_order(tests.id('second'),'approve');
reset role;
select is((select count(*) from public.play_external_reports),1::bigint,'orders without a token are not reported');

-- Worker leases.
select is((select count(*) from public.claim_play_reports(5)),1::bigint,'the worker claims due reports');
select is((select count(*) from public.claim_play_reports(5)),0::bigint,'a leased report is not claimed twice');
select public.finish_play_report(id,lease_id,'google_play_500') from public.play_external_reports;
select is((select status from public.play_external_reports),'queued','a failed report is retried');
update public.play_external_reports set next_attempt_at=now();
select public.finish_play_report(id,lease_id) from public.claim_play_reports(5);
select is((select status from public.play_external_reports),'sent','a delivered report is closed');

-- Google Play one-time product grant.
select is(public.grant_play_product(tests.uid('buyer'),'choice_week','play-token-1','GPA.1')::date,(now()+interval '7 days')::date,'a verified Play purchase grants the plan period');
select is(public.grant_play_product(tests.uid('buyer'),'choice_week','play-token-1','GPA.1')::date,(now()+interval '7 days')::date,'repeating the same purchase grants nothing more');
select throws_ok($$select public.grant_play_product(tests.uid('buyer'),'choice_off','play-token-2','GPA.2')$$,'P0001','plan_unavailable','retired plans cannot be granted');
select * from finish();
rollback;
