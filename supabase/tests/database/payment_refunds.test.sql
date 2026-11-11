begin;
create extension if not exists pgtap with schema extensions;
select plan(36);
create schema tests;
grant usage on schema tests to authenticated;
create table tests.ids(label text primary key,id uuid);
grant all on tests.ids to authenticated;
create function tests.uid(p_name text) returns uuid language sql stable security definer as $$
  select id from auth.users where email=p_name||'@refund.test';
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
-- Days of Plus the member has left, rounded.
create function tests.days_left(p_name text) returns integer language sql security definer as $$
  select round(extract(epoch from max(paid_until)-now())/86400)::integer from public.subscriptions
    where user_id=tests.uid(p_name) and status='active';
$$;

delete from public.upi_orders;
delete from public.play_external_reports;
delete from public.meta_event_outbox;
insert into auth.users(id,email) select gen_random_uuid(),name||'@refund.test' from unnest(array['admin','payer','other','buyer','tester']) name;
update public.profiles set role='admin' where id=tests.uid('admin');
insert into public.plans(product_id,name,billing_period,quota_bytes,active,price_paise) values ('refund_week','Silver','P7D',0,true,11800);
insert into public.app_installs(user_id,installation_id,tracking_consent,meta_anon_id) values
  (tests.uid('payer'),gen_random_uuid(),true,'anon-payer'),
  (tests.uid('buyer'),gen_random_uuid(),true,'anon-buyer'),
  (tests.uid('tester'),gen_random_uuid(),true,'anon-tester');
select tests.act('admin');
select public.save_payment_settings('shop@okbank','CloudLynk');

-- Two confirmed payments from one member: the first through Google's choice screen.
select tests.act('payer');
insert into tests.ids values('first',(public.create_upi_order('refund_week')).id);
select public.attach_play_choice(tests.id('first'),'tok-refund','GUJARAT');
select public.submit_upi_payment(tests.id('first'),'333333333333');
select tests.act('admin');
select public.decide_upi_order(tests.id('first'),'approve');
select tests.act('payer');
insert into tests.ids values('second',(public.create_upi_order('refund_week')).id);
select public.submit_upi_payment(tests.id('second'),'444444444444');
select tests.act('admin');
select public.decide_upi_order(tests.id('second'),'approve');
select is(tests.days_left('payer'),14,'two payments stack to fourteen days');
reset role;
select is((select count(*) from public.subscriptions where user_id=tests.uid('payer') and period_start is not null),2::bigint,'each payment records where its period starts');

-- Who can refund what.
select tests.act('payer');
select throws_ok($$select public.refund_upi_order(tests.id('first'),'Paid twice')$$,'42501','admin_required','members cannot refund');
insert into tests.ids values('open',(public.create_upi_order('refund_week')).id);
select tests.act('admin');
select throws_ok($$select public.refund_upi_order(tests.id('first'),'  ')$$,'P0001','reason_required','a refund needs a reason');
select throws_ok($$select public.refund_upi_order(tests.id('open'),'Paid twice')$$,'P0001','order_not_paid','only a confirmed payment can be refunded');
select throws_ok($$select public.refund_upi_order(gen_random_uuid(),'Paid twice')$$,'P0001','order_not_found','the order must exist');

-- Refunding the earlier payment.
select is((public.refund_upi_order(tests.id('first'),'Paid twice')).status,'refunded','the order is marked refunded');
reset role;
select isnt((select refunded_at from public.upi_orders where id=tests.id('first')),null,'the refund time is recorded');
select is((select decision_reason from public.upi_orders where id=tests.id('first')),'Paid twice','the member sees the reason');
select is((select s.status from public.subscriptions s join public.upi_orders o on o.subscription_id=s.id where o.id=tests.id('first')),'refunded','that payment''s period ends');
select is(tests.days_left('payer'),7,'the later payment moves earlier by the refunded days');
select ok(tests.subscribed('payer'),'time bought by the other payment remains');
select is((select count(*) from public.meta_event_outbox where event_id='upi-order-'||tests.id('first')),0::bigint,'an unsent Meta event for the refunded payment is dropped');
select is((select count(*) from public.meta_event_outbox where event_id='upi-order-'||tests.id('second')),1::bigint,'the other payment''s event stays');
select tests.act('admin');
select throws_ok($$select public.refund_upi_order(tests.id('first'),'Again')$$,'P0001','order_not_paid','a payment is refunded once');
select tests.act('other');
insert into tests.ids values('reuse',(public.create_upi_order('refund_week')).id);
select throws_ok($$select public.submit_upi_payment(tests.id('reuse'),'333333333333')$$,'P0001','utr_already_used','a refunded payment''s UTR stays used');

-- Google hears about the refund, but only after the payment itself.
reset role;
select is((select count(*) from public.play_external_reports where kind='refund'),1::bigint,'a reported payment queues one refund report');
select is((select array_agg(kind) from public.claim_play_reports(5)),array['create'],'the refund waits for the payment report');
select public.finish_play_report(id,lease_id) from public.play_external_reports where kind='create';
select is((select array_agg(kind) from public.claim_play_reports(5)),array['refund'],'the refund is sent once Google holds the payment');
select public.finish_play_report(id,lease_id) from public.play_external_reports where kind='refund';
select is((select count(*) from public.play_external_reports where status='sent'),2::bigint,'both reports close');

-- A payment Google never saw is refunded without a report.
select tests.act('admin');
select public.refund_upi_order(tests.id('second'),'Member asked');
reset role;
select is((select count(*) from public.play_external_reports where kind='refund'),1::bigint,'direct payments are not reported to Google');
select ok(not tests.subscribed('payer'),'refunding every payment ends Plus');
select is((select count(*) from public.audit_log where action='refund' and target_kind='upi_order'),2::bigint,'each refund is audited');

-- Google Play purchases: Meta event, then a refund made by Google.
select public.grant_play_product(tests.uid('buyer'),'refund_week','play-a','GPA.1');
select public.grant_play_product(tests.uid('buyer'),'refund_week','play-b','GPA.2');
select is((select array_agg(event_name order by created_at,event_name desc) from public.meta_event_outbox where user_id=tests.uid('buyer')),array['Subscribe','Purchase'],'Play purchases are sent to Meta, first as Subscribe');
select is((select value from public.meta_event_outbox where user_id=tests.uid('buyer') limit 1),118.00,'the value is the plan price');
select public.grant_play_product(tests.uid('buyer'),'refund_week','play-a','GPA.1');
select is((select count(*) from public.meta_event_outbox where user_id=tests.uid('buyer')),2::bigint,'a repeated purchase is not sent twice');
select public.grant_play_product(tests.uid('tester'),'refund_week','play-test','GPA.3',true);
select is((select count(*) from public.meta_event_outbox where user_id=tests.uid('tester')),0::bigint,'licence-tester purchases are not sent to Meta');
select ok(public.void_play_purchase('play-a'),'a purchase Google refunded is ended');
select is(tests.days_left('buyer'),7,'the other purchase moves earlier');
select is((select count(*) from public.meta_event_outbox where user_id=tests.uid('buyer')),1::bigint,'the refunded purchase''s unsent Meta event is dropped');
select ok(not public.void_play_purchase('play-a'),'ending it again changes nothing');
select ok(not public.void_play_purchase('unknown-token'),'unknown purchases are ignored');
select tests.act('buyer');
select throws_ok($$select public.void_play_purchase('play-b')$$,'42501',null,'members cannot end purchases');

-- Monitoring.
reset role;
update public.play_external_reports set status='queued',created_at=now()-interval '2 hours' where kind='refund';
select is((public.backend_health()->>'overdue_play_reports')::int,1,'a report stuck for an hour is flagged');
update public.play_external_reports set status='failed' where kind='create';
select is((select count(*) from public.claim_play_reports(5)),0::bigint,'a refund whose payment report failed is not sent');
select is((public.backend_health()->>'failed_play_reports')::int,2,'reports Google refused are flagged, with the refund that depended on one');
select * from finish();
rollback;
