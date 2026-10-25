import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { AccessDecision, Channel, Profile } from '@/domain/models';
import { covers } from '@/data/demo/seed';

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
  const { data, error } = await supabase
    .from('channels')
    .select('id,name,description,requires_subscription,status')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    visibility: row.requires_subscription ? 'premium' : 'public',
    status: 'published',
    category: 'All',
    cover: covers.mountain,
    members: 0,
    ownerId: '',
  }));
}
export async function fetchIdentity(): Promise<{ profile: Profile | null; joinedIds: string[] }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { profile: null, joinedIds: [] };
  const [profileResult, memberResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,display_name,role,account_status')
      .eq('id', session.user.id)
      .single(),
    supabase.from('channel_members').select('channel_id'),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (memberResult.error) throw memberResult.error;
  const row = profileResult.data;
  return {
    profile: {
      id: row.id,
      name: row.display_name ?? 'CloudLynk member',
      email: session.user.email ?? '',
      role: row.role === 'admin' ? 'admin' : 'member',
      accountStatus: row.account_status === 'active' ? 'active' : 'restricted',
    },
    joinedIds: (memberResult.data ?? []).map((member) => member.channel_id),
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
export function unavailable(feature: string): never {
  throw new Error(
    `${feature} is not available from the current backend yet. Your data and access have not been changed.`,
  );
}
