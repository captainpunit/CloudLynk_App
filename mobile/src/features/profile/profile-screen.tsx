import { View } from 'react-native';
import { router } from 'expo-router';
import { Bell, Cloud, Library, Plus, Settings, ShieldCheck, Upload } from 'lucide-react-native';
import {
  Button,
  Caption,
  Heading,
  IconButton,
  Label,
  ListRow,
  PlusBadge,
  Screen,
  Section,
} from '@/components/ui';
import { ChannelRow } from '@/components/media-card';
import { PlusOffer } from '@/components/plus-offer';
import { useWorkspace } from '@/state/workspace-provider';
import { usePalette } from '@/theme/tone';
import { fileSize, plusSummary, shortDate } from '@/domain/format';
import type { Channel } from '@/domain/models';
import { count } from '@/features/explore/catalogue';

export default function ProfileScreen() {
  const { state } = useWorkspace();
  const profile = state.profile;
  const ownChannels = state.channels.filter((channel) => channel.ownerId === profile?.id);
  const creator = !!profile?.canPublish || profile?.role === 'admin';
  return (
    <Screen
      tone="dark"
      title="You"
      action={
        <IconButton icon={Settings} label="Settings" onPress={() => router.push('/settings')} />
      }
    >
      {profile ? <Identity name={profile.name} email={profile.email} /> : <SignedOut />}
      <PlusStatus />
      <View>
        <ListRow
          icon={Library}
          title="Library"
          detail="Continue watching, saved videos and your channels"
          onPress={() => router.push('/library')}
        />
        <ListRow
          icon={Bell}
          title="Notifications"
          marker={!state.noticesRead}
          onPress={() => router.push('/notifications')}
        />
        <ListRow
          icon={Cloud}
          title="My cloud"
          detail={
            state.driveUsage
              ? `${fileSize(state.driveUsage.used_bytes)} of ${fileSize(state.driveUsage.quota_bytes)} used`
              : count(state.files.length, 'file')
          }
          onPress={() => router.push('/cloud')}
        />
        {profile?.role === 'admin' && (
          <ListRow
            icon={ShieldCheck}
            title="Admin review"
            detail="Channels, titles, reports and payments"
            onPress={() => router.push('/admin')}
          />
        )}
      </View>
      {(creator || ownChannels.length > 0) && (
        <View style={{ gap: 16 }}>
          <Section
            title="Your channels"
            action={creator ? 'New channel' : undefined}
            onPress={() => router.push('/create-channel')}
          />
          {ownChannels.length ? (
            ownChannels.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                detail={channelStatus(channel)}
                trailing={
                  <Button
                    title="Add video"
                    icon={Upload}
                    variant="soft"
                    compact
                    label={`Add a video to ${channel.name}`}
                    onPress={() =>
                      router.push({ pathname: '/upload', params: { channelId: channel.id } })
                    }
                  />
                }
              />
            ))
          ) : (
            <View style={{ gap: 12, alignItems: 'flex-start' }}>
              <Caption>Start a channel. It goes live after an admin approves it.</Caption>
              <Button
                title="Create a channel"
                icon={Plus}
                variant="soft"
                compact
                onPress={() => router.push('/create-channel')}
              />
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

function channelStatus(channel: Channel) {
  if (channel.status === 'pending') return 'Waiting for admin review';
  if (channel.status === 'hidden') return 'Hidden by an admin';
  const access = { public: 'Free', premium: 'Plus', private: 'Private' }[channel.visibility];
  return `Live · ${access}`;
}

function Identity({ name, email }: { name: string; email: string }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: p.raised,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Label style={{ fontSize: 24, lineHeight: 30, fontWeight: '700' }}>
          {name.slice(0, 1).toUpperCase()}
        </Label>
      </View>
      <View style={{ flex: 1 }}>
        <Heading style={{ fontSize: 22, lineHeight: 28 }}>{name}</Heading>
        <Caption numberOfLines={1} selectable>
          {email}
        </Caption>
      </View>
    </View>
  );
}

function SignedOut() {
  return (
    <View style={{ gap: 14, alignItems: 'flex-start' }}>
      <Label>Sign in to join channels, save videos and subscribe to Plus.</Label>
      <Button title="Sign in or create an account" onPress={() => router.push('/auth')} />
    </View>
  );
}

/** Whether the member has Plus, until when, and the way to get or extend it. */
function PlusStatus() {
  const { state } = useWorkspace();
  const p = usePalette();
  if (!state.subscribed) return state.plans?.length ? <PlusOffer /> : null;
  const summary = plusSummary(state);
  return (
    <View style={{ backgroundColor: p.plusSoft, borderRadius: 16, padding: 18, gap: 10 }}>
      <View style={{ flexDirection: 'row' }}>
        <PlusBadge />
      </View>
      <Heading style={{ fontSize: 20, lineHeight: 27, letterSpacing: -0.4 }}>
        {state.subscribedUntil
          ? `Plus is active until ${shortDate(state.subscribedUntil)}`
          : 'Plus is active'}
      </Heading>
      {summary && (
        <Caption style={{ color: p.ink, fontSize: 14, lineHeight: 21 }}>{summary}</Caption>
      )}
      <Caption style={{ color: p.ink }}>
        Plus does not renew by itself. Add more time before it ends to keep watching.
      </Caption>
      <View style={{ flexDirection: 'row' }}>
        <Button title="Add more time" compact onPress={() => router.push('/premium')} />
      </View>
    </View>
  );
}
