begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create schema tests;
create table tests.ids(label text primary key, id uuid);
insert into auth.users(id,email) values
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','pr3-alice@test.local'),
 ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','pr3-bob@test.local');
insert into public.plans(product_id,name,billing_period,quota_bytes,active)
 values ('pr3-premium','Premium','P1M',123456789012,true), ('pr3-hidden','Hidden','P1Y',1,false);
select is(public.resolve_play_owner((select play_account_id from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'), null),
 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'::uuid, 'provider account hash resolves the owner');

insert into tests.ids values ('lease', public.claim_subscription_sync('pr3-token'));
select ok((select id is not null from tests.ids where label='lease'), 'first worker acquires token lease');
select is(public.claim_subscription_sync('pr3-token'), null::uuid, 'overlapping worker cannot acquire lease');
select throws_ok($$select public.apply_play_snapshot('pr3-token', gen_random_uuid(), 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '{}')$$,
 'P0001','sync_lease_lost','unleased writes rejected');
select public.apply_play_snapshot('pr3-token', (select id from tests.ids where label='lease'), 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
 jsonb_build_object('product_id','pr3-premium','status','active','paid_until',now()+interval '1 month','is_trial',false,'order_id','pr3-order'),
 '{"event_id":"pr3-event","event_name":"Subscribe","payload":{"orderId":"pr3-order"}}');
select is((select status from public.subscriptions where purchase_token='pr3-token'), 'active', 'verified snapshot grants entitlement');
select is(public.drive_quota_bytes('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'), 123456789012::bigint, 'quota follows purchased plan');
select public.apply_play_snapshot('pr3-token', (select id from tests.ids where label='lease'), 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
 jsonb_build_object('product_id','pr3-premium','status','active','paid_until',now()+interval '1 month','is_trial',false,'order_id','pr3-order'),
 '{"event_id":"pr3-event","event_name":"Subscribe","payload":{}}');
select is((select count(*) from public.meta_event_outbox where event_id='pr3-event'),1::bigint,'restore retries cannot duplicate conversion');
select throws_ok(format($$select public.apply_play_snapshot('pr3-token', %L, 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', '{}')$$,
 (select id from tests.ids where label='lease')), '42501','purchase_owner_mismatch','a token cannot transfer to another account');
select throws_ok($$select public.resolve_play_owner((select play_account_id from public.profiles where id='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'), 'pr3-token')$$,
 '42501','purchase_owner_mismatch','conflicting linked token and account hash rejected');

insert into tests.ids values ('replacement',public.claim_subscription_sync('pr3-new'));
select public.apply_play_snapshot('pr3-new',(select id from tests.ids where label='replacement'),'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
 jsonb_build_object('product_id','pr3-premium','status','pending','is_trial',false,'linked_token','pr3-token'));
select is((select status from public.subscriptions where purchase_token='pr3-token'),'active','pending replacement keeps previous entitlement');
select public.apply_play_snapshot('pr3-new',(select id from tests.ids where label='replacement'),'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
 jsonb_build_object('product_id','pr3-premium','status','active','paid_until',now()+interval '1 month','is_trial',false,'linked_token','pr3-token'));
select is((select status from public.subscriptions where purchase_token='pr3-token'),'expired','active replacement ends old entitlement');
select public.apply_play_snapshot('pr3-token',(select id from tests.ids where label='lease'),'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
 jsonb_build_object('product_id','pr3-premium','status','active','paid_until',now()+interval '1 month','is_trial',false));
select is((select status from public.subscriptions where purchase_token='pr3-token'),'expired','late old-token updates cannot regrant access');
select public.release_subscription_sync('pr3-token',gen_random_uuid());
select is(public.claim_subscription_sync('pr3-token'),null::uuid,'wrong lease cannot release another worker');
select public.release_subscription_sync('pr3-token',(select id from tests.ids where label='lease'));
select ok(public.claim_subscription_sync('pr3-token') is not null,'released token can sync again');

create temp table claimed as select * from public.claim_meta_events(100);
select is((select attempts from claimed where event_id='pr3-event'),1,'claim increments attempt count');
select is((select count(*) from public.claim_meta_events(100)),0::bigint,'leased events are not claimed twice');
select public.finish_meta_event((select id from claimed where event_id='pr3-event'),gen_random_uuid(),null);
select is((select status from public.meta_event_outbox where event_id='pr3-event'),'queued','stale worker cannot finish event');
select public.finish_meta_event((select id from claimed where event_id='pr3-event'),(select lease_id from claimed where event_id='pr3-event'),'failure');
select is((select status from public.meta_event_outbox where event_id='pr3-event'),'queued','failed delivery remains retryable');
select ok((select next_attempt_at>now() from public.meta_event_outbox where event_id='pr3-event'),'retry backs off');
update public.meta_event_outbox set attempts=9,next_attempt_at=now() where event_id='pr3-event';
create temp table last_attempt as select * from public.claim_meta_events(100);
select public.finish_meta_event((select id from last_attempt where event_id='pr3-event'),(select lease_id from last_attempt where event_id='pr3-event'),'failure');
select is((select status from public.meta_event_outbox where event_id='pr3-event'),'failed','ten failures enter dead letter state');

set local role anon;
select is((select count(*) from public.plans where product_id like 'pr3-%'),1::bigint,'guests see active plans only');
select throws_ok($$select public.claim_subscription_sync('stolen')$$,'42501',null,'guests cannot claim sync leases');
reset role;
set local role authenticated;
select throws_ok($$select public.apply_play_snapshot('stolen',gen_random_uuid(),'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','{}')$$,'42501',null,'clients cannot grant subscriptions');
select throws_ok($$select * from public.claim_meta_events(100)$$,'42501',null,'clients cannot claim conversions');
select throws_ok($$insert into public.plans(product_id,name,billing_period,quota_bytes) values ('forged','Forged','P1M',1)$$,'42501',null,'clients cannot create plans');
reset role;
select * from finish();
rollback;
