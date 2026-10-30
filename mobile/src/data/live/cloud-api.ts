import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { AccessDecision, Channel, Profile, Workspace } from '@/domain/models';
import { mapChannel, mapFile, mapTitle, readPages } from './mapping';
import { checked } from './backend';

/** Adapter for the implemented PR1 contract. Never sends a service-role key. */
export function assertLiveConfiguration() {
  if (!env.supabaseUrl || !env.supabaseAnonKey || env.supabaseUrl.includes('YOUR-PROJECT')) {
    throw new Error(
      'Live mode needs your Supabase project URL and public anon key. See mobile/README.md.',
    );
  }
}
export async function fetchCatalogue(): Promise<Channel[]> {
  assertLiveConfiguration();
  return (
    await readPages((from, to) =>
      supabase
        .from('channels')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    )
  ).map(mapChannel);
}
export async function fetchIdentity(): Promise<{ profile: Profile | null; joinedIds: string[] }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { profile: null, joinedIds: [] };
  const [profileResult, memberResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,display_name,role,account_status,can_publish,birth_date')
      .eq('id', session.user.id)
      .single(),
    readPages((from, to) =>
      supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', session.user.id)
        .order('channel_id')
        .range(from, to),
    ),
  ]);
  if (profileResult.error) throw profileResult.error;
  const row = profileResult.data;
  return {
    profile: {
      id: row.id,
      name: row.display_name ?? 'CloudLynk member',
      email: session.user.email ?? '',
      role: row.role === 'admin' ? 'admin' : 'member',
      accountStatus: row.account_status === 'active' ? 'active' : 'restricted',
      canPublish: row.can_publish,
      birthDate: row.birth_date ?? undefined,
    },
    joinedIds: memberResult.map((member) => member.channel_id),
  };
}
export async function checkLiveAccess(
  channelId: string,
  action: 'join' | 'watch',
): Promise<AccessDecision> {
  const { data, error } = await supabase.rpc('my_access', {
    p_action: action,
    p_channel_id: channelId,
  });
  if (error) throw error;
  return data as AccessDecision;
}
export async function setLiveMembership(channelId: string, joined: boolean) {
  const { error } = await supabase.rpc(joined ? 'join_channel' : 'leave_channel', {
    p_channel_id: channelId,
  });
  if (error) throw error;
}
export function emptyLiveWorkspace(): Workspace {
  return {
    version: 1,
    profile: null,
    channels: [],
    videos: [],
    files: [],
    joinedIds: [],
    savedIds: [],
    progress: {},
    demoPlanId: null,
    noticesRead: true,
    reports: [],
    seasons: [],
    notices: [],
    subscribed: false,
  };
}

export async function fetchLiveWorkspace(): Promise<Workspace> {
  const identity = await fetchIdentity();
  const [channels, titles, seasons] = await Promise.all([
    fetchCatalogue(),
    readPages((from, to) =>
      supabase
        .from('titles')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .order('id')
        .range(from, to),
    ),
    readPages((from, to) => supabase.from('seasons').select('*').order('id').range(from, to)),
  ]);
  const snapshot = {
    ...emptyLiveWorkspace(),
    ...identity,
    channels,
    videos: titles.map(mapTitle),
    seasons: seasons.map((row) => ({
      id: row.id,
      seriesId: row.series_id,
      number: row.number,
      name: row.name,
    })),
  };
  if (!identity.profile) return snapshot;
  const userId = identity.profile.id;
  const [files, saved, progress, notices, usage, subscriptions] = await Promise.all([
    readPages((from, to) =>
      supabase
        .from('files')
        .select('*')
        .in('status', ['pending', 'ready'])
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    ),
    readPages((from, to) =>
      supabase
        .from('saved_titles')
        .select('*')
        .eq('user_id', userId)
        .order('title_id')
        .range(from, to),
    ),
    readPages((from, to) =>
      supabase
        .from('watch_progress')
        .select('*')
        .eq('user_id', userId)
        .order('title_id')
        .range(from, to),
    ),
    readPages((from, to) =>
      supabase
        .from('notices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    ),
    supabase.rpc('my_drive_usage').single(),
    supabase
      .from('subscriptions')
      .select('status,paid_until')
      .eq('user_id', userId)
      .is('superseded_by', null),
  ]);
  return {
    ...snapshot,
    files: files.map(mapFile),
    savedIds: saved.map((row) => row.title_id),
    progress: Object.fromEntries(progress.map((row) => [row.title_id, row.position_seconds])),
    completedIds: progress.filter((row) => row.completed).map((row) => row.title_id),
    notices: notices.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
    noticesRead: notices.every((row) => !!row.read_at),
    driveUsage: checked(usage) ?? undefined,
    subscribed: (checked(subscriptions) ?? []).some(
      (row) =>
        ['active', 'in_grace', 'cancelled'].includes(row.status) &&
        !!row.paid_until &&
        Date.parse(row.paid_until) > Date.now(),
    ),
  };
}
