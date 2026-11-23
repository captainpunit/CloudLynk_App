begin;
create extension if not exists pgtap with schema extensions;
select plan(2);
create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.uid(p_name text) returns uuid language sql stable security definer as $$
  select id from auth.users where email=p_name||'@utr.test';
$$;
create function tests.act(p_name text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',json_build_object('sub',tests.uid(p_name),'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
end; $$;
create table tests.ids(label text primary key, id uuid);
grant all on tests.ids to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users(id,email) values (gen_random_uuid(),'member@utr.test');
-- An order rejected while carrying a UTR; that UTR has since paid for another order.
with o as (
  insert into public.upi_orders(user_id,product_id,plan_name,billing_period,amount_paise,reference,payee_vpa,payee_name,pay_uri,status,utr,expires_at,decided_at,decision_reason)
  values (tests.uid('member'),'gold','Gold','P1M',25900,'CLUTRTEST0000001','shop@okbank','Cloud Lynk Media','upi://pay','rejected','987654321098',now()+interval '1 day',now(),'No match yet')
  returning id)
insert into tests.ids select 'order', id from o;
insert into public.used_utrs(utr) values ('987654321098');

select tests.act('member');
select throws_ok($$select public.submit_upi_payment((select id from tests.ids where label='order'),'987654321098')$$,
  'P0001','utr_already_used','a rejected order cannot be resubmitted with a UTR that has paid since');
reset role;
delete from public.used_utrs where utr='987654321098';
select tests.act('member');
select is((public.submit_upi_payment((select id from tests.ids where label='order'),'987654321098')).status,'submitted',
  'an unused UTR can still be resubmitted after a rejection');

select * from finish();
rollback;
