import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { createPublicKey, randomUUID, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/database.types';
import { mapChannel, mapFile, mapTitle } from '../src/data/live/mapping';
import { transferTus } from '../src/services/uploads/tus';

// This harness accepts ONLY the local CLI stack, never environment production
// credentials. It creates disposable accounts and removes its own fixtures.
const config = JSON.parse(
  execSync('npx --no-install supabase status --output json', {
    cwd: '..',
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
);
const url = config.API_URL as string;
assert.equal(new URL(url).hostname, '127.0.0.1', 'Only local Supabase is permitted');
const admin = createClient<Database>(url, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const fixtures: string[] = [];
const paths: string[] = [];
const channels: string[] = [];
const fakeUid = randomUUID().replaceAll('-', '');
const campaign = randomUUID();
const planId = `api_fixture_${fakeUid.slice(0, 12)}`;
let previousPayee: Database['public']['Tables']['payment_settings']['Row'] | null = null;
let assertions = 0;
function ok<T extends { data: unknown; error: { message: string } | null }>(
  result: T,
): NonNullable<T['data']> {
  if (result.error) throw new Error(result.error.message);
  assert.notEqual(result.data, null);
  return result.data as NonNullable<T['data']>;
}
function check(value: unknown, message: string) {
  assert.ok(value, message);
  assertions++;
}
async function user(label: string) {
  const email = `api-${label}-${randomUUID()}@cloudlynk-local.test`;
  const password = randomUUID() + 'aA1!';
  const created = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  assert.ok(created.user);
  fixtures.push(created.user.id);
  const client = createClient<Database>(url, config.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  ok(await client.auth.signInWithPassword({ email, password }));
  return { id: created.user.id, client };
}
async function expectDenied(work: PromiseLike<{ error: unknown }>, label: string) {
  check(!!(await work).error, label);
}

async function main() {
  try {
    const owner = await user('owner'),
      viewer = await user('viewer'),
      moderator = await user('admin');
    ok(await admin.from('profiles').update({ can_publish: true }).eq('id', owner.id).select());
    ok(await admin.from('profiles').update({ role: 'admin' }).eq('id', moderator.id).select());
    const channel = ok(
      await owner.client.rpc('submit_channel', {
        p_name: 'API fixture',
        p_description: 'Disposable local integration fixture',
        p_category: 'Films',
      }),
    );
    channels.push(channel.id);
    check(mapChannel(channel).status === 'pending', 'draft channel maps correctly');
    check(mapChannel(channel).visibility === 'private', 'private channel maps correctly');
    await expectDenied(
      viewer.client.rpc('moderate_content', {
        p_kind: 'channel',
        p_id: channel.id,
        p_action: 'publish',
        p_visibility: 'public',
      }),
      'members cannot publish',
    );
    assert.equal(
      (
        await moderator.client.rpc('moderate_content', {
          p_kind: 'channel',
          p_id: channel.id,
          p_action: 'publish',
          p_visibility: 'private',
        })
      ).error,
      null,
    );
    check(
      ok(await viewer.client.from('channels').select('*').eq('id', channel.id)).length === 0,
      'private channel hidden before invitation',
    );
    assert.equal(
      (
        await owner.client.rpc('invite_channel_member', {
          p_channel_id: channel.id,
          p_user_id: viewer.id,
        })
      ).error,
      null,
    );
    check(
      ok(await viewer.client.from('channels').select('*').eq('id', channel.id)).length === 1,
      'invited channel readable',
    );
    assert.equal(
      (await viewer.client.rpc('join_channel', { p_channel_id: channel.id })).error,
      null,
    );
    check(
      ok(await viewer.client.rpc('my_access', { p_action: 'watch', p_channel_id: channel.id })) ===
        'allowed',
      'member can access private channel',
    );
    const movie = ok(
      await owner.client.rpc('save_title', {
        p_channel_id: channel.id,
        p_kind: 'movie',
        p_name: 'Fixture movie',
        p_description: 'Local mock media',
        p_min_age: 0,
      }),
    );
    assert.equal(
      (
        await admin.from('stream_assets').insert({
          title_id: movie.id,
          owner_id: owner.id,
          stream_uid: fakeUid,
          state: 'ready',
          signed_only: true,
          duration_seconds: 100,
        })
      ).error,
      null,
    );
    assert.equal(
      (await owner.client.rpc('submit_title_review', { p_title_id: movie.id })).error,
      null,
    );
    assert.equal(
      (
        await moderator.client.rpc('moderate_content', {
          p_kind: 'title',
          p_id: movie.id,
          p_action: 'publish',
        })
      ).error,
      null,
    );
    assert.equal(
      (await viewer.client.rpc('set_saved_title', { p_title_id: movie.id, p_saved: true })).error,
      null,
    );
    check(
      ok(await viewer.client.from('saved_titles').select('*').eq('title_id', movie.id)).length ===
        1,
      'bookmark persists',
    );
    assert.equal(
      (
        await viewer.client.rpc('save_watch_progress', {
          p_title_id: movie.id,
          p_position_seconds: 30,
        })
      ).error,
      null,
    );
    check(
      ok(await viewer.client.from('watch_progress').select('*').eq('title_id', movie.id))[0]
        .position_seconds === 30,
      'progress persists',
    );
    if (process.argv.includes('--edge')) {
      const grant = ok(
        await viewer.client.functions.invoke('stream-playback-token', {
          body: { titleId: movie.id },
        }),
      );
      const token = new URL(grant.hlsUrl).pathname.split('/')[1];
      const [header, body, signature] = token.split('.');
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
      const publicKey = createPublicKey({
        key: JSON.parse(readFileSync('.expo/integration-edge/public-key.json', 'utf8')),
        format: 'jwk',
      });
      check(
        verify(
          'RSA-SHA256',
          Buffer.from(`${header}.${body}`),
          publicKey,
          Buffer.from(signature, 'base64url'),
        ),
        'Edge playback token has the configured RSA signature',
      );
      check(
        payload.sub === fakeUid &&
          payload.exp > Date.now() / 1000 &&
          payload.exp <= Date.now() / 1000 + 600,
        'Edge playback subject and expiry match the server grant',
      );
      const unauthenticated = await fetch(`${url}/functions/v1/stream-playback-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.ANON_KEY },
        body: JSON.stringify({ titleId: movie.id }),
      });
      check(unauthenticated.status === 401, 'unsigned playback request rejected');
      const invalidUpload = await owner.client.functions.invoke('generate-stream-upload', {
        body: { titleId: movie.id, sizeBytes: 0 },
      });
      check(!!invalidUpload.error, 'invalid video size rejected before provider allocation');
      const tracked = ok(
        await viewer.client.functions.invoke('track-install', {
          body: { trackingConsent: false, platform: 'android', installationId: randomUUID() },
        }),
      );
      check(tracked.recorded === true, 'tracking consent endpoint stores explicit withdrawal');
    }
    const report = ok(
      await viewer.client.rpc('report_title', {
        p_title_id: movie.id,
        p_reason: 'Fixture concern',
        p_details: 'Local test',
      }),
    );
    assert.equal(
      (
        await moderator.client.rpc('moderate_content', {
          p_kind: 'report',
          p_id: report,
          p_action: 'resolve',
          p_reason: 'Local fixture resolved',
        })
      ).error,
      null,
    );
    check(
      ok(await moderator.client.from('content_reports').select('*').eq('id', report))[0].status ===
        'resolved',
      'report moderation persists',
    );
    const series = ok(
      await owner.client.rpc('save_title', {
        p_channel_id: channel.id,
        p_kind: 'series',
        p_name: 'Fixture series',
        p_description: '',
        p_min_age: 0,
      }),
    );
    const season = ok(
      await owner.client.rpc('save_season', {
        p_series_id: series.id,
        p_number: 1,
        p_name: 'Season one',
      }),
    );
    const episode = ok(
      await owner.client.rpc('save_title', {
        p_channel_id: channel.id,
        p_kind: 'episode',
        p_name: 'Episode one',
        p_description: '',
        p_min_age: 0,
        p_season_id: season.id,
        p_episode_number: 1,
      }),
    );
    check(mapTitle(episode).seasonId === season.id, 'episode hierarchy maps correctly');
    const installation = randomUUID();
    assert.equal(
      (
        await viewer.client.rpc('register_push_token', {
          p_installation_id: installation,
          p_token: `ExpoPushToken[${randomUUID().replaceAll('-', '')}]`,
        })
      ).error,
      null,
    );
    const sendArgs = {
      p_campaign_id: campaign,
      p_user_ids: [viewer.id],
      p_title: 'Local test',
      p_body: 'Inbox fixture',
    };
    check(
      ok(await moderator.client.rpc('send_notice', sendArgs)) === 1,
      'notice delivered to inbox',
    );
    check(
      ok(await moderator.client.rpc('send_notice', sendArgs)) === 0,
      'campaign retries are idempotent',
    );
    const notice = ok(
      await viewer.client.from('notices').select('*').eq('campaign_id', campaign),
    )[0];
    assert.equal(
      (await viewer.client.rpc('mark_notice_read', { p_notice_id: notice.id })).error,
      null,
    );
    check(
      !!ok(await viewer.client.from('notices').select('*').eq('id', notice.id))[0].read_at,
      'notice read status persists',
    );
    assert.equal(
      (await viewer.client.rpc('unregister_push_token', { p_installation_id: installation })).error,
      null,
    );
    check(
      ok(await viewer.client.from('push_tokens').select('*')).length === 0,
      'push registration removed',
    );
    const usage = ok(await viewer.client.rpc('my_drive_usage').single());
    check(usage.quota_bytes > 0, 'real drive quota returned');
    const bytes = new Blob(['CloudLynk integration file']);
    const reserve = ok(
      await viewer.client
        .rpc('reserve_drive_upload', {
          p_name: 'integration.txt',
          p_mime_type: 'text/plain',
          p_size_bytes: bytes.size,
        })
        .single(),
    );
    paths.push(reserve.storage_path);
    const session = ok(await viewer.client.auth.getSession()).session!;
    const headers = {
      authorization: `Bearer ${session.access_token}`,
      apikey: config.ANON_KEY,
      'x-upsert': 'true',
    };
    const endpoint = `${url}/storage/v1/upload/resumable`;
    const created = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(bytes.size),
        'Upload-Metadata': `bucketName ${btoa(reserve.bucket)},objectName ${btoa(reserve.storage_path)},contentType ${btoa('text/plain')}`,
      },
    });
    check(created.ok, `TUS resource creation succeeds (${created.status})`);
    const location = new URL(created.headers.get('Location')!, endpoint);
    check(
      location.origin === new URL(url).origin,
      'Storage TUS destination matches the configured API origin',
    );
    const transferUrl = location.href;
    await transferTus(bytes, transferUrl, headers, () => {});
    const file = ok(
      await viewer.client.rpc('finalize_drive_upload', { p_file_id: reserve.file_id }),
    );
    check(mapFile(file).status === 'ready', 'TUS upload finalizes and maps as ready');
    const signed = ok(
      await viewer.client.storage.from('user-files').createSignedUrl(reserve.storage_path, 60),
    );
    check((await fetch(signed.signedUrl)).ok, 'private file downloads through a signed URL');
    check(
      ok(await owner.client.from('files').select('*').eq('id', reserve.file_id)).length === 0,
      'another account cannot list the file',
    );
    await expectDenied(
      owner.client.storage.from('user-files').createSignedUrl(reserve.storage_path, 60),
      'another account cannot sign a download',
    );
    assert.equal(
      (await viewer.client.rpc('delete_drive_file', { p_file_id: reserve.file_id })).error,
      null,
    );
    check(
      ok(await viewer.client.from('files').select('*').eq('id', reserve.file_id)).length === 0,
      'deleted files leave the owner list',
    );
    assert.equal(
      (await viewer.client.rpc('leave_channel', { p_channel_id: channel.id })).error,
      null,
    );
    check(
      ok(await viewer.client.rpc('my_access', { p_action: 'watch', p_channel_id: channel.id })) ===
        'membership_required',
      'leaving revokes watch access',
    );
    // UPI subscription: order -> reported UTR -> administrator confirmation -> access.
    previousPayee = ok(await admin.from('payment_settings').select('*').single());
    ok(
      await moderator.client.rpc('save_payment_settings', {
        p_upi_vpa: 'fixture@okbank',
        p_payee_name: 'API Fixture',
        p_merchant_code: '5815',
      }),
    );
    ok(
      await moderator.client.rpc('save_plan', {
        p_product_id: planId,
        p_name: 'API Plus',
        p_billing_period: 'P1M',
        p_price_paise: 4900,
        p_quota_bytes: 1024 ** 3,
        p_active: true,
      }),
    );
    await expectDenied(
      viewer.client.rpc('save_plan', {
        p_product_id: planId,
        p_name: 'Free',
        p_billing_period: 'P1M',
        p_price_paise: 100,
        p_quota_bytes: 0,
        p_active: true,
      }),
      'members cannot change plan prices',
    );
    check(
      ok(await viewer.client.from('plans').select('price_paise').eq('product_id', planId).single())
        .price_paise === 4900,
      'members read the plan price from the backend',
    );
    check(
      !ok(await viewer.client.from('payment_settings').select('*')).length,
      'payee settings are hidden from members',
    );
    const order = ok(await viewer.client.rpc('create_upi_order', { p_product_id: planId }));
    check(
      order.pay_uri ===
        `upi://pay?pa=fixture@okbank&pn=API%20Fixture&mc=5815&tr=${order.reference}&tn=API%20Plus&am=49.00&cu=INR`,
      'order returns a complete UPI payment link',
    );
    check(
      ok(await viewer.client.rpc('create_upi_order', { p_product_id: planId })).id === order.id,
      'repeating the request returns the same order',
    );
    await expectDenied(
      viewer.client.from('upi_orders').update({ status: 'paid' }).eq('id', order.id).select(),
      'members cannot mark their own order paid',
    );
    check(
      !ok(await owner.client.from('upi_orders').select('id').eq('id', order.id)).length,
      'another member cannot read the order',
    );
    await expectDenied(
      viewer.client.rpc('submit_upi_payment', { p_order_id: order.id, p_utr: '123' }),
      'malformed UTR rejected',
    );
    const utr = String(Math.floor(1e11 + Math.random() * 9e11));
    check(
      ok(await viewer.client.rpc('submit_upi_payment', { p_order_id: order.id, p_utr: utr }))
        .status === 'submitted',
      'member reports the payment reference',
    );
    await expectDenied(
      viewer.client.rpc('decide_upi_order', { p_order_id: order.id, p_action: 'approve' }),
      'members cannot confirm their own payment',
    );
    check(
      !ok(await viewer.client.from('subscriptions').select('id').eq('user_id', viewer.id)).length,
      'a reported payment grants nothing by itself',
    );
    const queued = ok(
      await moderator.client
        .from('upi_orders')
        .select('*, profiles(display_name)')
        .eq('status', 'submitted')
        .eq('id', order.id),
    );
    check(queued.length === 1 && queued[0].utr === utr, 'administrator sees the reported payment');
    check(
      ok(
        await moderator.client.rpc('decide_upi_order', {
          p_order_id: order.id,
          p_action: 'approve',
        }),
      ).status === 'paid',
      'administrator confirms the payment',
    );
    const granted = ok(
      await viewer.client
        .from('subscriptions')
        .select('provider,status,paid_until')
        .eq('user_id', viewer.id),
    );
    check(
      granted.length === 1 &&
        granted[0].provider === 'upi' &&
        granted[0].status === 'active' &&
        Date.parse(granted[0].paid_until ?? '') > Date.now() + 27 * 86400000,
      'confirmation grants one billing period of Plus',
    );
    check(
      ok(
        await viewer.client
          .from('notices')
          .select('title')
          .eq('user_id', viewer.id)
          .eq('title', 'Payment confirmed'),
      ).length === 1,
      'member is notified of the confirmation',
    );
    if (process.argv.includes('--edge')) {
      await expectDenied(
        viewer.client.functions.invoke('stream-playback-token', { body: { titleId: movie.id } }),
        'Edge playback denied after leaving',
      );
      const request = ok(
        await viewer.client.functions.invoke('delete-account', {
          body: { confirmation: 'DELETE' },
        }),
      );
      check(
        request.status === 'queued' && !!request.requestId,
        'dedicated test-account deletion request accepted',
      );
      check(
        ok(await admin.from('profiles').select('account_status').eq('id', viewer.id).single())
          .account_status === 'suspended',
        'deletion request restricts the account immediately',
      );
    }
    console.log(
      `PASS: ${assertions} local HTTP/API integration assertions, including a real local Storage TUS upload.`,
    );
  } finally {
    if (paths.length) await admin.storage.from('user-files').remove(paths);
    if (channels.length) await admin.from('channels').delete().in('id', channels);
    await admin.from('stream_deletion_queue').delete().eq('stream_uid', fakeUid);
    await admin.from('audit_log').delete().in('actor_id', fixtures);
    await admin.from('audit_log').delete().eq('target_id', campaign);
    await admin.from('audit_log').delete().in('target_id', fixtures);
    await admin.from('account_deletion_requests').delete().in('user_id', fixtures);
    for (const id of fixtures) await admin.auth.admin.deleteUser(id);
    // Orders go with their accounts; the fixture plan and payee settings are restored after.
    await admin.from('plans').delete().eq('product_id', planId);
    if (previousPayee) {
      const { id: _id, updated_at: _updated, ...payee } = previousPayee;
      await admin.from('payment_settings').update(payee).eq('id', true);
    }
  }
}
void main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
