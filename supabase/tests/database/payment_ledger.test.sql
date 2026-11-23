begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.uid(p_name text) returns uuid language sql stable security definer as $$
  select id from auth.users where email=p_name||'@ledger.test';
$$;
create function tests.act(p_name text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',json_build_object('sub',tests.uid(p_name),'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
end; $$;
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users(id,email) select gen_random_uuid(),name||'@ledger.test' from unnest(array['payer','admin','member']) name;
update public.profiles set role='admin' where id=tests.uid('admin');
-- A confirmed UPI payment, an unpaid order, and a Google Play purchase.
insert into public.upi_orders(user_id,product_id,plan_name,billing_period,amount_paise,reference,payee_vpa,payee_name,pay_uri,status,utr,expires_at,decided_at)
values (tests.uid('payer'),'gold','Gold','P1M',25900,'CLLEDGER00000001','shop@okbank','Cloud Lynk Media','upi://pay','paid','123456789012',now(),now()),
       (tests.uid('payer'),'silver','Silver','P7D',12900,'CLLEDGER00000002','shop@okbank','Cloud Lynk Media','upi://pay','expired',null,now(),null);
insert into public.subscriptions(user_id,provider,product_id,purchase_token,status,paid_until,latest_order_id)
values (tests.uid('payer'),'google_play','platinum','ledger-play-token','active',now()+interval '30 days','GPA.3300-0000-0000-00001');

insert into auth.sessions(id,user_id,created_at,updated_at) values(gen_random_uuid(),tests.uid('payer'),now(),now());
select public.request_account_deletion(tests.uid('payer'),(select id from auth.sessions where user_id=tests.uid('payer')));
create temp table deletion as
  select * from public.claim_account_deletions(20) where user_id=tests.uid('payer');
select public.prepare_account_erasure(tests.uid('payer'),(select id from deletion),(select lease_id from deletion));

select is((select count(*) from public.payment_ledger where reference in ('123456789012','GPA.3300-0000-0000-00001')),
  2::bigint,'paid UPI and Play payments are kept when the account is erased');
select is((select amount_paise from public.payment_ledger where reference='123456789012'),25900,
  'the amount and plan are kept');
select is((select count(*) from public.payment_ledger where product_id='silver'),0::bigint,
  'unpaid orders are not kept');
select lives_ok($$select public.prepare_account_erasure(tests.uid('payer'),(select id from deletion),(select lease_id from deletion))$$,
  'erasure can be retried');
select is((select count(*) from public.payment_ledger where reference in ('123456789012','GPA.3300-0000-0000-00001')),
  2::bigint,'a retry copies nothing twice');
delete from auth.users where id=tests.uid('payer');
select is((select count(*) from public.payment_ledger where reference in ('123456789012','GPA.3300-0000-0000-00001')),
  2::bigint,'the records outlive the account');
select is((select count(*) from information_schema.columns where table_schema='public' and table_name='payment_ledger'
  and column_name in ('user_id','email','display_name','purchase_token')),0::bigint,
  'the ledger holds nothing that identifies the member');

select tests.act('member');
select is((select count(*) from public.payment_ledger),0::bigint,'members cannot read the ledger');
select tests.act('admin');
select ok((select count(*) from public.payment_ledger)>=2,'admins can read it for accounting');

select * from finish();
rollback;
