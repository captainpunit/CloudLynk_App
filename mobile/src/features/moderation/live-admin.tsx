import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { randomUUID } from 'expo-crypto';
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

type Person = Pick<
  Tables<'profiles'>,
  'id' | 'display_name' | 'role' | 'account_status' | 'can_publish'
>;
export default function LiveAdmin() {
  const { state, refresh, notify } = useWorkspace();
  const [tab, setTab] = useState('Channels');
  const [titles, setTitles] = useState<Tables<'titles'>[]>([]);
  const [reports, setReports] = useState<Tables<'content_reports'>[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
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
    const [titleRows, reportRows, users, auditRows] = await Promise.all([
      readPages((from, to) => supabase.from('titles').select('*').order('id').range(from, to)),
      readPages((from, to) =>
        supabase.from('content_reports').select('*').order('id').range(from, to),
      ),
      readPages((from, to) =>
        supabase
          .from('profiles')
          .select('id,display_name,role,account_status,can_publish')
          .order('id')
          .range(from, to),
      ),
      supabase
        .from('audit_log')
        .select('*')
        .order('id', { ascending: false })
        .range(auditPage * 100, auditPage * 100 + 99),
    ]);
    setTitles(titleRows);
    setReports(reportRows);
    setPeople(users);
    setAudit(checked(auditRows) ?? []);
  }, [state.profile?.id, state.profile?.role, auditPage]);
  useEffect(() => {
    void load().catch(() => setError('Admin records could not load. Please refresh.'));
  }, [load]);
  async function run(work: () => Promise<unknown>, message = 'Administrative action saved.') {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
      await refresh();
      await load();
      notify(message);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
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
        {['Channels', 'Titles', 'Reports', 'People', 'Messages', 'Audit'].map((value) => (
          <Pill key={value} title={value} selected={tab === value} onPress={() => setTab(value)} />
        ))}
      </View>
      <ErrorNote message={error} />
      {['Titles', 'Reports', 'People'].includes(tab) && (
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
            <Label>{title.description}</Label>
            <Label>
              Minimum age: {title.min_age} · Countries:{' '}
              {title.allowed_countries.join(', ') || 'Worldwide'}
            </Label>
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
      {tab === 'People' &&
        people.map((person) => (
          <Surface key={person.id}>
            <Label>
              {person.display_name ?? 'Member'} · {person.role} · {person.account_status}
            </Label>
            <Label selectable>{person.id}</Label>
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
            onPress={() =>
              void run(async () => {
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
                await call('send_notice', {
                  p_campaign_id: campaignId,
                  p_user_ids: ids,
                  p_title: noticeTitle.trim(),
                  p_body: noticeBody.trim(),
                });
              }, 'Notice queued. Retrying this notice will not duplicate inbox entries.')
            }
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
