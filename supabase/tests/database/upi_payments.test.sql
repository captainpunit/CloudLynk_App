begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create schema tests;
grant usage on schema tests to anon,authenticated;
create table tests.ids(label text primary key,id uuid);
grant all on tests.ids to anon,authenticated;
create function tests.uid(p_name text) returns uuid language sql stable security definer as $$
  select id from auth.users where email=p_name||'@upi.test';
$$;
create function tests.id(p_label text) returns uuid language sql stable as $$
  select id from tests.ids where label=p_label;
$$;
create function tests.subscribed(p_name text) returns boolean language sql security definer as $$
  select public.has_active_subscription(tests.uid(p_name));
$$;
create function tests.quota(p_name text) returns bigint language sql security definer as $$
  select public.drive_quota_bytes(tests.uid(p_name));
$$;
create function tests.act(p_name text) returns void language plpgsql as $$
begin
  reset role;
  if p_name='guest' then perform set_config('request.jwt.claims','{"role":"anon"}',true);perform set_config('role','anon',true);
  else perform set_config('request.jwt.claims',json_build_object('sub',tests.uid(p_name),'role','authenticated')::text,true);perform set_config('role','authenticated',true);
  end if;
end; $$;
-- Start from a known state whatever the local database holds (rolled back at the end).
delete from public.upi_orders;
delete from public.audit_log where target_kind in ('payment_settings','upi_order','plan');
update public.payment_settings set upi_vpa=null,payee_name=null,merchant_code=null,upi_enabled=false;
insert into auth.users(id,email) select gen_random_uuid(),name||'@upi.test' from unnest(array['admin','payer','other','suspended','busy']) name;
update public.profiles set role='admin' where id=tests.uid('admin');
update public.profiles set account_status='suspended' where id=tests.uid('suspended');
insert into public.plans(product_id,name,billing_period,quota_bytes,active,price_paise) values
  ('upi_month','Plus Monthly','P1M',107374182400,true,9900),
  ('upi_year','Plus Yearly','P1Y',2147483648,true,99900),
  ('upi_retired','Retired','P1M',0,false,5000),
  ('upi_unpriced','Unpriced','P1M',0,true,null);

-- Payee details: admin only, validated, and required before any order.
select tests.act('payer');
select throws_ok($$select public.create_upi_order('upi_month')$$,'P0001','payments_unavailable','no orders before a payee is configured');
select throws_ok($$select public.save_payment_settings('shop@okbank','CloudLynk')$$,'42501','admin_required','subscribers cannot set the payee');
select is((select count(*) from public.payment_settings),0::bigint,'subscribers cannot read payee settings');
select throws_ok($$update public.payment_settings set upi_vpa='thief@okbank'$$,'42501',null,'payee settings are not directly writable');
select tests.act('admin');
select throws_ok($$select public.save_payment_settings('not a vpa','CloudLynk')$$,'P0001','invalid_upi_address','malformed UPI address rejected');
select throws_ok($$select public.save_payment_settings('shop@okbank','Bad&Name=1')$$,'P0001','invalid_payee_name','payee names that would break the link are rejected');
select throws_ok($$select public.save_payment_settings('shop@okbank','CloudLynk','12')$$,'P0001','invalid_merchant_code','merchant code must be four digits');
select is((public.save_payment_settings(' shop@okbank ','Cloud  Lynk Media','5815')).payee_name,'Cloud Lynk Media','payee saved with tidy spacing');
select is((select count(*) from public.audit_log where target_kind='payment_settings'),1::bigint,'payee change is audited');

-- Plans: admin managed, public sees only active ones.
select tests.act('payer');
select throws_ok($$select public.save_plan('upi_month','Cheap','P1M',100,0,true)$$,'42501','admin_required','subscribers cannot edit plans');
select is((select count(*) from public.plans where product_id like 'upi_%'),3::bigint,'subscribers see active plans only');
select tests.act('admin');
select throws_ok($$select public.save_plan('upi_new','New plan','P1M',50,0,true)$$,'P0001','invalid_price','prices below one rupee rejected');
select throws_ok($$select public.save_plan('Bad Id','New plan','P1M',5000,0,true)$$,'P0001','invalid_plan_id','plan ids are restricted');
select throws_ok($$select public.save_plan('upi_new','New plan','P2M',5000,0,true)$$,'P0001','invalid_billing_period','unknown periods rejected');
select is((public.save_plan('upi_new','Plus Quarterly','P3M',27900,1073741824,false)).price_paise,27900,'admin creates a plan');
select is((public.save_plan('upi_new','Plus Quarterly','P3M',25900,1073741824,false)).price_paise,25900,'admin reprices a plan');
select is((select count(*) from public.plans where product_id like 'upi_%'),5::bigint,'admins see inactive plans');

-- Creating an order.
select tests.act('guest');
select throws_ok($$select public.create_upi_order('upi_month')$$,'42501',null,'guests cannot start a payment');
select tests.act('suspended');
select throws_ok($$select public.create_upi_order('upi_month')$$,'42501','account_restricted','restricted accounts cannot start a payment');
select tests.act('payer');
select throws_ok($$select public.create_upi_order('upi_retired')$$,'P0001','plan_unavailable','inactive plans cannot be bought');
select throws_ok($$select public.create_upi_order('upi_unpriced')$$,'P0001','plan_unavailable','unpriced plans cannot be bought');
select throws_ok($$select public.create_upi_order('missing')$$,'P0001','plan_unavailable','unknown plans cannot be bought');
insert into tests.ids values('first',(public.create_upi_order('upi_month')).id);
select is((select pay_uri from public.upi_orders where id=tests.id('first')),
  'upi://pay?pa=shop@okbank&pn=Cloud%20Lynk%20Media&mc=5815&tr='||(select reference from public.upi_orders where id=tests.id('first'))||'&tn=Plus%20Monthly&am=99.00&cu=INR',
  'payment link carries payee, reference and exact amount');
select matches((select reference from public.upi_orders where id=tests.id('first')),'^CL[0-9A-F]{20}$','reference is unguessable and UPI safe');
select is((public.create_upi_order('upi_month')).id,tests.id('first'),'asking again returns the same open order');
insert into tests.ids values('switched',(public.create_upi_order('upi_year')).id);
select is((select status from public.upi_orders where id=tests.id('first')),'expired','choosing another plan closes the previous open order');
select is((select count(*) from public.upi_orders where status='created'),1::bigint,'only one open order per subscriber');
select throws_ok($$update public.upi_orders set status='paid',utr='111111111111'$$,'42501',null,'subscribers cannot mark orders paid');
select throws_ok($$insert into public.subscriptions(user_id,provider,product_id,purchase_token,status,paid_until) values(auth.uid(),'upi','upi_month','forged','active',now()+interval '1 year')$$,'42501',null,'subscribers cannot grant themselves access');
select tests.act('other');
select is((select count(*) from public.upi_orders),0::bigint,'orders are private to their owner');
select throws_ok($$select public.submit_upi_payment(tests.id('switched'),'123456789012')$$,'P0001','order_not_found','another subscriber cannot report on this order');

-- Reporting the payment.
select tests.act('payer');
select throws_ok($$select public.submit_upi_payment(tests.id('switched'),'12345')$$,'P0001','invalid_utr','UTR must be twelve digits');
select is((public.submit_upi_payment(tests.id('first'),'1234 5678 9012')).status,'submitted','a payment on a just-replaced order can still be reported');
select is((select utr from public.upi_orders where id=tests.id('first')),'123456789012','UTR is stored without spaces');
select is((public.submit_upi_payment(tests.id('first'),'123456789012')).attempts,1::smallint,'repeating the same report is not a new attempt');
select throws_ok($$select public.submit_upi_payment(tests.id('switched'),'222222222222')$$,'P0001','payment_in_review','one payment in review at a time');
select throws_ok($$select public.create_upi_order('upi_month')$$,'P0001','payment_in_review','no new order while a payment is in review');
select is(tests.subscribed('payer'),false,'reporting a payment grants nothing');
select tests.act('other');
insert into tests.ids values('other',(public.create_upi_order('upi_month')).id);
select throws_ok($$select public.submit_upi_payment(tests.id('other'),'123456789012')$$,'P0001','utr_already_used','one bank reference cannot pay for two orders');

-- Admin decision.
select throws_ok($$select public.decide_upi_order(tests.id('first'),'approve')$$,'42501','admin_required','subscribers cannot confirm payments');
select tests.act('admin');
select is((select count(*) from public.upi_orders where status='submitted'),1::bigint,'admins see the review queue');
select throws_ok($$select public.decide_upi_order(tests.id('first'),'refund')$$,'P0001','invalid_action','unknown decisions rejected');
select throws_ok($$select public.decide_upi_order(tests.id('first'),'reject','  ')$$,'P0001','reason_required','rejection needs a reason');
select throws_ok($$select public.decide_upi_order(tests.id('other'),'approve')$$,'P0001','order_not_pending','unreported orders cannot be confirmed');
select throws_ok($$select public.decide_upi_order(gen_random_uuid(),'approve')$$,'P0001','order_not_found','unknown orders rejected');
select is((public.decide_upi_order(tests.id('first'),'reject','No such credit in the statement')).status,'rejected','admin rejects an unmatched payment');
select is(tests.subscribed('payer'),false,'a rejected payment grants nothing');
reset role;
select is((select count(*) from public.notices where user_id=tests.uid('payer') and title='Payment not confirmed'),1::bigint,'subscriber is told about the rejection');
select tests.act('payer');
select is((public.submit_upi_payment(tests.id('first'),'123456789013')).status,'submitted','a rejected order can be corrected');
select tests.act('admin');
select is((public.decide_upi_order(tests.id('first'),'approve')).status,'paid','admin confirms the payment');
select is(tests.subscribed('payer'),true,'confirmation grants access');
reset role;
select is((select paid_until from public.subscriptions where user_id=tests.uid('payer')),now()+interval '1 month','access lasts one billing period');
select is((select provider||'/'||product_id||'/'||status||'/'||next_check_at::text from public.subscriptions where user_id=tests.uid('payer')),
  'upi/upi_month/active/infinity','grant is a normal subscription the Play reconciler never picks up');
select is((select subscription_id from public.upi_orders where id=tests.id('first')),(select id from public.subscriptions where user_id=tests.uid('payer')),'order links to the subscription it paid for');
select is((select count(*) from public.audit_log where target_kind='upi_order' and target_id=tests.id('first')),2::bigint,'both decisions are audited');
select is((select count(*) from public.notices where user_id=tests.uid('payer') and title='Payment confirmed'),1::bigint,'subscriber is told about the confirmation');
select tests.act('admin');
select throws_ok($$select public.decide_upi_order(tests.id('first'),'approve')$$,'P0001','order_not_pending','a payment cannot be confirmed twice');
select tests.act('payer');
select throws_ok($$select public.submit_upi_payment(tests.id('first'),'123456789014')$$,'P0001','order_closed','a paid order is closed');
select is(tests.quota('payer'),107374182400::bigint,'plan storage applies to UPI subscribers');

-- Renewal: paying early extends from the current end date.
select is((public.submit_upi_payment(tests.id('switched'),'333333333333')).status,'submitted','subscriber renews with a yearly plan');
select tests.act('admin');
select public.decide_upi_order(tests.id('switched'),'approve');
reset role;
select is((select max(paid_until) from public.subscriptions where user_id=tests.uid('payer')),now()+interval '1 month'+interval '1 year','renewal stacks on the remaining time');

-- Limits.
select tests.act('other');
select public.submit_upi_payment(tests.id('other'),'444444444441');
select tests.act('admin');
select public.decide_upi_order(tests.id('other'),'reject','Wrong amount');
select tests.act('other');
select public.submit_upi_payment(tests.id('other'),'444444444442');
select tests.act('admin');
select public.decide_upi_order(tests.id('other'),'reject','Wrong amount');
select tests.act('other');
select public.submit_upi_payment(tests.id('other'),'444444444443');
select tests.act('admin');
select public.decide_upi_order(tests.id('other'),'reject','Wrong amount');
select tests.act('other');
select throws_ok($$select public.submit_upi_payment(tests.id('other'),'444444444444')$$,'P0001','too_many_attempts','an order accepts three reports');
reset role;
insert into public.upi_orders(user_id,product_id,plan_name,billing_period,amount_paise,reference,payee_vpa,payee_name,pay_uri,status,expires_at)
  select tests.uid('busy'),'upi_month','Plus Monthly','P1M',9900,'CLTEST0000000'||n,'shop@okbank','Cloud Lynk Media','upi://pay','expired',now()
  from generate_series(0,9) n;
select tests.act('busy');
select throws_ok($$select public.create_upi_order('upi_month')$$,'P0001','too_many_orders','daily order limit');

-- Housekeeping and monitoring.
reset role;
select is((public.backend_health()->>'unreviewed_upi_payments')::int,0,'no stale payments reported when the queue is fresh');
update public.upi_orders set status='submitted',utr='555555555555',submitted_at=now()-interval '2 days' where reference='CLTEST00000000';
select is((public.backend_health()->>'unreviewed_upi_payments')::int,1,'payments waiting over a day are reported');
update public.upi_orders set status='created',expires_at=now()-interval '1 minute' where reference='CLTEST00000001';
update public.upi_orders set created_at=now()-interval '31 days' where reference='CLTEST00000002';
select public.prune_operational_records();
select is((select status from public.upi_orders where reference='CLTEST00000001'),'expired','lapsed open orders are closed');
select is((select count(*) from public.upi_orders where reference='CLTEST00000002'),0::bigint,'old unpaid orders are removed');
select is((select count(*) from public.upi_orders where status='paid'),2::bigint,'paid orders are kept');
select is((select count(*) from public.subscriptions where provider='upi' and superseded_by is null and next_check_at<=now()+interval '100 years'),0::bigint,'UPI subscriptions are never due for Play reconciliation');

-- Erasing an account removes its orders.
delete from auth.users where id=tests.uid('payer');
select is((select count(*) from public.upi_orders where reference like 'CL%' and user_id not in (select id from public.profiles)),0::bigint,'orders are erased with the account');
select * from finish();
rollback;
