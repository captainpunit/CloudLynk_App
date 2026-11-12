begin;
create extension if not exists pgtap with schema extensions;
select plan(7);
create schema tests;
grant usage on schema tests to authenticated;
create table tests.ids(label text primary key,id uuid);
grant all on tests.ids to authenticated;
create function tests.uid(p_name text) returns uuid language sql stable security definer as $$
  select id from auth.users where email=p_name||'@harden.test';
$$;
create function tests.act(p_name text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',json_build_object('sub',tests.uid(p_name),'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
end; $$;

delete from public.upi_orders;
insert into auth.users(id,email) select gen_random_uuid(),name||'@harden.test' from unnest(array['admin','payer','other']) name;
update public.profiles set role='admin' where id=tests.uid('admin');
insert into public.plans(product_id,name,billing_period,quota_bytes,active,price_paise) values ('harden_week','Silver','P7D',0,true,11800);
select tests.act('admin');
select public.save_payment_settings('shop@okbank','CloudLynk');

-- A confirmed payment's UTR stays used after the paying account is deleted.
select tests.act('payer');
insert into tests.ids values('paid',(public.create_upi_order('harden_week')).id);
select public.submit_upi_payment((select id from tests.ids where label='paid'),'777777777777');
select tests.act('admin');
select public.decide_upi_order((select id from tests.ids where label='paid'),'approve');
reset role;
select is((select count(*) from public.used_utrs where utr='777777777777'),1::bigint,'a confirmed payment records its UTR');
delete from public.upi_orders where id=(select id from tests.ids where label='paid');
select tests.act('other');
insert into tests.ids values('reuse',(public.create_upi_order('harden_week')).id);
select throws_ok($$select public.submit_upi_payment((select id from tests.ids where label='reuse'),'777777777777')$$,'P0001','utr_already_used','the UTR cannot pay again once its order is gone');
select lives_ok($$select public.submit_upi_payment((select id from tests.ids where label='reuse'),'888888888888')$$,'a new UTR is accepted');
select is((select count(*) from public.used_utrs),0::bigint,'members cannot read used UTRs');

-- The audit trail survives the deletion of the account that acted.
reset role;
select is((select count(*) from pg_constraint where conrelid='public.audit_log'::regclass and contype='f'),0::bigint,'audit rows do not depend on the actor''s profile');
select isnt((select actor_id from public.audit_log where target_kind='upi_order' order by created_at desc limit 1),null,'the audit row names who decided the payment');
-- The tax split uses the rate from when the member was asked to pay.
delete from public.upi_orders where user_id=tests.uid('other');
select tests.act('other');
insert into tests.ids values('taxed',(public.create_upi_order('harden_week')).id);
select public.attach_play_choice((select id from tests.ids where label='taxed'),'tok-harden','GUJARAT');
select public.submit_upi_payment((select id from tests.ids where label='taxed'),'999999999999');
select tests.act('admin');
select public.set_payment_tax(0);
select public.decide_upi_order((select id from tests.ids where label='taxed'),'approve');
reset role;
select is((select array[pre_tax_paise,tax_paise] from public.play_external_reports where external_transaction_id='upi-'||(select id from tests.ids where label='taxed')),array[10000,1800],'a later change of the GST rate does not alter a payment already requested');
select * from finish();
rollback;
