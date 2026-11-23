import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import {
  Button,
  EmptyState,
  ErrorNote,
  Field,
  Label,
  Pill,
  Screen,
  Surface,
} from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { call, checked } from '@/data/live/backend';
import { readPages } from '@/data/live/mapping';
import AdminPayments from './admin-payments';

type Person = Pick<
  Tables<'profiles'>,
  'id' | 'display_name' | 'role' | 'account_status' | 'can_publish' | 'audience'
>;

/** Who a channel is shown to. Members who came from an advert see every channel. */
const audiences = [
  { value: 'organic', label: 'Organic users' },
  { value: 'ads', label: 'Ads users' },
  { value: 'both', label: 'Both' },
] as const;
export default function AdminScreen() {
  const { state, refresh, notify } = useWorkspace();
  const [tab, setTab] = useState('Channels');
  const [titles, setTitles] = useState<Tables<'titles'>[]>([]);
  const [reports, setReports] = useState<Tables<'content_reports'>[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [requests, setRequests] = useState<Tables<'creator_applications'>[]>([]);
  const [audit, setAudit] = useState<Tables<'audit_log'>[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [auditPage, setAuditPage] = useState(0);
  const [recipientIds, setRecipientIds] = useState('');
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [campaignId, setCampaignId] = useState(() => randomUUID());
  const [campaignLocked, setCampaignLocked] = useState(false);
  const load = useCallback(async () => {
    if (state.profile?.role !== 'admin') return;
    const [titleRows, reportRows, users, auditRows, requestRows] = await Promise.all([
      readPages((from, to) =>
        supabase.from('titles').select('*').order('created_at').order('id').range(from, to),
      ),
      readPages((from, to) =>
        supabase
          .from('content_reports')
          .select('*')
          .order('created_at')
          .order('id')
          .range(from, to),
      ),
      readPages((from, to) =>
        supabase
          .from('profiles')
          .select('id,display_name,role,account_status,can_publish,audience')
          .order('id')
          .range(from, to),
      ),
      supabase
        .from('audit_log')
        .select('*')
        .order('id', { ascending: false })
        .range(auditPage * 100, auditPage * 100 + 99),
      supabase
        .from('creator_applications')
        .select('*')
        .eq('status', 'pending')
        .order('created_at')
        .limit(200),
    ]);
    setTitles(titleRows);
    setReports(reportRows);
    setPeople(users);
    setAudit(checked(auditRows) ?? []);
    setRequests(checked(requestRows) ?? []);
  }, [state.profile?.id, state.profile?.role, auditPage]);
  useEffect(() => {
    void load().catch(() => setError('Admin records could not load. Please refresh.'));
  }, [load]);
  async function run(
    work: () => Promise<unknown>,
    message: string | (() => string) = 'Administrative action saved.',
  ) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
      // A reason belongs to one decision; it must not ride along with the next one.
      setReason('');
      await refresh();
      await load();
      notify(typeof message === 'function' ? message() : message);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  /** Which channel and account a title belongs to, so a moderator can act on the owner. */
  function ownerLine(channelId: string, ownerId: string) {
    const channel = state.channels.find((item) => item.id === channelId)?.name ?? 'Unknown channel';
    const owner = people.find((person) => person.id === ownerId);
    return `${channel} · by ${owner?.display_name ?? 'a member'} (${ownerId})`;
  }
  function moderate(kind: string, id: string, action: string, visibility?: string) {
    void run(() =>
      call('moderate_content', {
        p_kind: kind,
        p_id: id,
        p_action: action,
        ...(reason.trim() ? { p_reason: reason.trim() } : {}),
        ...(visibility ? { p_visibility: visibility } : {}),
      }),
    );
  }
  if (state.profile?.role !== 'admin')
    return (
      <Screen title="Admin" back>
        <EmptyState title="Admin access required" body="Sign in with an administrator account." />
      </Screen>
    );
  return (
    <Screen title="Admin workspace" back>
      <Label>Changes affect live accounts and content. All actions are audited.</Label>
      <Button
        title="Refresh records"
        variant="outline"
        loading={busy}
        onPress={() => void run(load, 'Admin records refreshed.')}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[
          'Channels',
          'Titles',
          'Reports',
          requests.length ? `Creators (${requests.length})` : 'Creators',
          'People',
          'Payments',
          'Messages',
          'Audit',
        ].map((value) => (
          <Pill
            key={value}
            title={value}
            selected={tab === value.replace(/ \(\d+\)$/, '')}
            onPress={() => setTab(value.replace(/ \(\d+\)$/, ''))}
          />
        ))}
      </View>
      <ErrorNote message={error} />
      {['Channels', 'Titles', 'Reports', 'Creators', 'People'].includes(tab) && (
        <Field
          label="Reason (required for rejection, restrictions and report decisions)"
          value={reason}
          onChangeText={setReason}
          multiline
          maxLength={1000}
        />
      )}
      {tab === 'Channels' &&
        state.channels.map((channel) => (
          <Surface key={channel.id}>
            <Label>
              {channel.name} · {channel.status} · {channel.visibility}
            </Label>
            <Label>{channel.description}</Label>
            <Label variant="callout">Shown to</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {audiences.map(({ value, label }) => (
                <Pill
                  key={value}
                  title={label}
                  label={`Show ${channel.name} to ${label.toLowerCase()}`}
                  selected={channel.audience === value}
                  onPress={() =>
                    channel.audience !== value &&
                    void run(
                      () =>
                        call('set_channel_audience', {
                          p_channel_id: channel.id,
                          p_audience: value,
                        }),
                      `${channel.name} is now shown to ${label.toLowerCase()}.`,
                    )
                  }
                />
              ))}
            </View>
            {(['public', 'premium', 'private'] as const).map((visibility) => (
              <Button
                key={visibility}
                title={`Publish as ${visibility}`}
                variant="soft"
                disabled={busy}
                onPress={() => moderate('channel', channel.id, 'publish', visibility)}
              />
            ))}
            <Button
              title="Hide channel"
              variant="outline"
              disabled={busy}
              onPress={() => moderate('channel', channel.id, 'hide')}
            />
          </Surface>
        ))}
      {tab === 'Titles' &&
        titles.map((title) => (
          <Surface key={title.id}>
            <Label>
              {title.name} · {title.kind} · {title.status}
            </Label>
            <Label variant="callout">{ownerLine(title.channel_id, title.owner_id)}</Label>
            <Label>{title.description}</Label>
            <Label>
              Minimum age: {title.min_age} · Countries:{' '}
              {title.allowed_countries.join(', ') || 'Worldwide'}
            </Label>
            {title.kind !== 'series' && (
              <Button
                title="Preview video"
                variant="soft"
                onPress={() =>
                  router.push({
                    pathname: '/preview/[id]',
                    params: { id: title.id, name: title.name },
                  })
                }
              />
            )}
            <Button
              title="Approve and publish"
              disabled={busy || title.status !== 'pending_review'}
              onPress={() => moderate('title', title.id, 'publish')}
            />
            <Button
              title="Reject title"
              variant="outline"
              disabled={busy || !reason.trim()}
              onPress={() => moderate('title', title.id, 'reject')}
            />
            <Button
              title="Hide title"
              variant="outline"
              disabled={busy}
              onPress={() => moderate('title', title.id, 'hide')}
            />
          </Surface>
        ))}
      {tab === 'Reports' &&
        reports.map((report) => (
          <Surface key={report.id}>
            <Label>
              {report.reason} · {report.status}
            </Label>
            <Label>{report.details}</Label>
            <Label>
              {titles.find((title) => title.id === report.title_id)?.name ?? 'Unavailable title'}
            </Label>
            {(() => {
              const reported = titles.find((title) => title.id === report.title_id);
              if (!reported) return null;
              return (
                <>
                  <Label variant="callout">
                    {ownerLine(reported.channel_id, reported.owner_id)}
                  </Label>
                  <Button
                    title="Hide video"
                    variant="outline"
                    disabled={busy || !reason.trim() || reported.status === 'archived'}
                    onPress={() => moderate('title', reported.id, 'hide')}
                  />
                  <Button
                    title="Suspend owner"
                    variant="danger"
                    disabled={busy || !reason.trim() || reported.owner_id === state.profile?.id}
                    onPress={() => moderate('account', reported.owner_id, 'suspend')}
                  />
                </>
              );
            })()}
            {['resolve', 'dismiss'].map((action) => (
              <Button
                key={action}
                title={action === 'resolve' ? 'Resolve report' : 'Dismiss report'}
                variant="outline"
                disabled={busy || !reason.trim() || report.status !== 'open'}
                onPress={() => moderate('report', report.id, action)}
              />
            ))}
          </Surface>
        ))}
      {tab === 'Creators' &&
        (requests.length ? (
          requests.map((request) => (
            <Surface key={request.id}>
              <Label style={{ fontWeight: '700' }}>
                {people.find((person) => person.id === request.user_id)?.display_name ?? 'Member'}
              </Label>
              <Label>{request.message}</Label>
              <Label variant="callout" selectable>
                {request.user_id}
              </Label>
              <Button
                title="Approve creator"
                disabled={busy}
                onPress={() => moderate('publisher', request.user_id, 'grant')}
              />
              <Button
                title="Decline request"
                variant="outline"
                disabled={busy || !reason.trim()}
                onPress={() => moderate('publisher', request.user_id, 'revoke')}
              />
            </Surface>
          ))
        ) : (
          <EmptyState title="No creator requests" body="Requests from members appear here." />
        ))}
      {tab === 'People' &&
        people.map((person) => (
          <Surface key={person.id}>
            <Label>
              {person.display_name ?? 'Member'} · {person.role} · {person.account_status}
            </Label>
            <Label selectable>{person.id}</Label>
            <Label variant="callout">
              {person.audience === 'ads'
                ? 'Came from an advert: sees every channel.'
                : 'Organic: does not see channels meant for ads users.'}
            </Label>
            <Button
              title={person.audience === 'ads' ? 'Move to organic users' : 'Move to ads users'}
              variant="outline"
              disabled={busy}
              onPress={() =>
                void run(
                  () =>
                    call('set_member_audience', {
                      p_user_id: person.id,
                      p_audience: person.audience === 'ads' ? 'organic' : 'ads',
                    }),
                  'Group changed.',
                )
              }
            />
            <Button
              title={
                person.can_publish ? 'Revoke publishing permission' : 'Grant publishing permission'
              }
              variant="soft"
              disabled={busy || (person.can_publish && !reason.trim())}
              onPress={() =>
                moderate('publisher', person.id, person.can_publish ? 'revoke' : 'grant')
              }
            />
            {['suspend', 'ban', 'restore'].map((action) => (
              <Button
                key={action}
                title={`${action} account`}
                variant="outline"
                disabled={
                  busy ||
                  person.id === state.profile?.id ||
                  (action !== 'restore' && !reason.trim())
                }
                onPress={() => moderate('account', person.id, action)}
              />
            ))}
          </Surface>
        ))}
      {tab === 'Payments' && <AdminPayments />}
      {tab === 'Messages' && (
        <Surface>
          <Label>Send an inbox notice and device push to selected live users.</Label>
          <Field
            label="Recipient user IDs (comma separated, maximum 500)"
            value={recipientIds}
            onChangeText={setRecipientIds}
            multiline
            editable={!campaignLocked}
          />
          <Field
            label="Notice title"
            value={noticeTitle}
            onChangeText={setNoticeTitle}
            maxLength={100}
            editable={!campaignLocked}
          />
          <Field
            label="Notice body"
            value={noticeBody}
            onChangeText={setNoticeBody}
            multiline
            maxLength={1000}
            editable={!campaignLocked}
          />
          <Button
            title={campaignLocked ? 'Retry sending this notice' : 'Send notice to selected users'}
            disabled={busy || !noticeTitle.trim() || !noticeBody.trim() || !recipientIds.trim()}
            onPress={() => {
              let sent = 'Notice queued.';
              void run(
                async () => {
                  const ids = [
                    ...new Set(
                      recipientIds
                        .split(',')
                        .map((id) => id.trim())
                        .filter(Boolean),
                    ),
                  ];
                  if (
                    !ids.length ||
                    ids.length > 500 ||
                    ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))
                  )
                    throw new Error('Enter valid user IDs, up to 500 recipients.');
                  setCampaignLocked(true);
                  const queued = await call('send_notice', {
                    p_campaign_id: campaignId,
                    p_user_ids: ids,
                    p_title: noticeTitle.trim(),
                    p_body: noticeBody.trim(),
                  });
                  if (!queued)
                    throw new Error(
                      'Nobody received this notice: check the user IDs, or it was already sent to them.',
                    );
                  sent = `Notice queued for ${queued} of ${ids.length} members.`;
                },
                () => sent,
              );
            }}
          />
          <Button
            title="Compose a new notice"
            variant="outline"
            disabled={busy}
            onPress={() => {
              setCampaignId(randomUUID());
              setCampaignLocked(false);
              setNoticeTitle('');
              setNoticeBody('');
              setRecipientIds('');
            }}
          />
        </Surface>
      )}
      {tab === 'Audit' && (
        <>
          <Button
            title="Newer audit records"
            disabled={busy || auditPage === 0}
            onPress={() => setAuditPage((value) => value - 1)}
          />
          {audit.map((row) => (
            <Surface key={row.id}>
              <Label>
                {row.action} · {row.target_kind}
              </Label>
              <Label>{row.reason}</Label>
              <Label>{new Date(row.created_at).toLocaleString()}</Label>
              <Label selectable>{row.target_id}</Label>
            </Surface>
          ))}
          <Button
            title="Older audit records"
            disabled={busy || audit.length < 100}
            onPress={() => setAuditPage((value) => value + 1)}
          />
        </>
      )}
    </Screen>
  );
}
