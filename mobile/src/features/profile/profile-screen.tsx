import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Bookmark,
  ChevronRight,
  Cloud,
  Plus,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react-native';
import {
  Button,
  EmptyState,
  Heading,
  IconButton,
  Label,
  Screen,
  Section,
  Surface,
} from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { colors as c } from '@/theme/tokens';

export default function ProfileScreen() {
  const { state, demo, requireIdentity } = useWorkspace();
  const ownChannels = state.channels.filter((channel) => channel.ownerId === state.profile?.id);
  return (
    <Screen
      title="Your little corner."
      subtitle="Everything that makes this space yours."
      action={
        <IconButton icon={Settings} label="Settings" onPress={() => router.push('/settings')} />
      }
    >
      {state.profile ? (
        <Surface>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 17 }}>
            <View
              style={{
                width: 65,
                height: 65,
                borderRadius: 23,
                backgroundColor: c.primarySoft,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Heading style={{ color: c.primary }}>
                {state.profile.name.slice(0, 1).toUpperCase()}
              </Heading>
            </View>
            <View style={{ flex: 1 }}>
              <Heading style={{ fontSize: 23 }}>{state.profile.name}</Heading>
              <Label numberOfLines={1} selectable style={{ color: c.muted, fontSize: 12 }}>
                {state.profile.email}
              </Label>
              <Label style={{ color: c.primary, fontSize: 10, fontWeight: '700', marginTop: 4 }}>
                {(demo ? state.demoPlanId : state.subscribed)
                  ? demo
                    ? 'CLOUDLYNK PLUS · PREVIEW'
                    : 'CLOUDLYNK PLUS'
                  : demo
                    ? 'PREVIEW MEMBER'
                    : 'CLOUDLYNK MEMBER'}
              </Label>
            </View>
          </View>
        </Surface>
      ) : (
        <EmptyState
          icon={Cloud}
          title="Make this space yours"
          body="Keep your files, favourite videos and channels in one happy place."
          action="Sign in / get started"
          onPress={() => router.push('/auth')}
        />
      )}
      <Pressable
        onPress={() => router.push('/premium')}
        style={{ padding: 22, borderRadius: 22, backgroundColor: c.dark, gap: 10 }}
      >
        <Sparkles size={25} color={c.accent} />
        <Heading style={{ color: c.white, fontSize: 24 }}>
          {(demo ? state.demoPlanId : state.subscribed)
            ? 'A little more, all yours.'
            : 'Good things come with Plus.'}
        </Heading>
        <Label style={{ color: '#B9CBC4', fontSize: 12 }}>
          Exclusive channels and room for your biggest ideas. ↗
        </Label>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {[
          {
            value: state.joinedIds.length,
            label: 'Channels',
            href: '/channels' as const,
            icon: Radio,
          },
          {
            value: state.savedIds.length,
            label: 'Saved stories',
            href: '/feed' as const,
            icon: Bookmark,
          },
          { value: state.files.length, label: 'Files', href: '/cloud' as const, icon: Cloud },
        ].map(({ value, label, href, icon: Icon }) => (
          <Pressable
            key={label}
            onPress={() => router.push(href)}
            style={{
              flex: 1,
              padding: 15,
              gap: 5,
              backgroundColor: c.surface,
              borderRadius: 17,
              borderWidth: 1,
              borderColor: c.line,
            }}
          >
            <Icon size={20} color={c.primary} />
            <Heading style={{ fontSize: 24 }}>{value}</Heading>
            <Label style={{ color: c.muted, fontSize: 10 }}>{label}</Label>
          </Pressable>
        ))}
      </View>
      <Section
        title="Made by you"
        action="New channel"
        onPress={() => {
          if (requireIdentity()) router.push('/create-channel');
        }}
      />
      {!ownChannels.length ? (
        <Surface>
          <Radio size={25} color={c.primary} />
          <Heading style={{ fontSize: 19 }}>Your next idea belongs here.</Heading>
          <Label style={{ color: c.muted, fontSize: 13 }}>
            Create a channel, share your work, and find your people.
          </Label>
          <Button
            title="Create your first channel"
            icon={Plus}
            variant="soft"
            onPress={() => {
              if (requireIdentity()) router.push('/create-channel');
            }}
          />
        </Surface>
      ) : (
        ownChannels.map((channel) => (
          <Surface key={channel.id}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Image source={channel.cover} style={{ width: 54, height: 54, borderRadius: 13 }} />
              <View style={{ flex: 1 }}>
                <Label style={{ fontWeight: '700' }}>{channel.name}</Label>
                <Label style={{ color: c.primary, fontSize: 11 }}>
                  {channel.status === 'pending'
                    ? 'Waiting for admin review'
                    : `${channel.status} · ${channel.visibility}`}
                </Label>
              </View>
            </View>
            <Button
              title="Add a video"
              icon={Upload}
              variant="soft"
              onPress={() =>
                router.push({ pathname: '/upload', params: { channelId: channel.id } })
              }
            />
            {channel.status === 'published' && (
              <Button
                title="Open channel"
                variant="outline"
                onPress={() =>
                  router.push({ pathname: '/channel/[id]', params: { id: channel.id } })
                }
              />
            )}
          </Surface>
        ))
      )}
      {state.profile?.role === 'admin' && (
        <Button
          title="Admin review workspace"
          icon={ShieldCheck}
          variant="outline"
          onPress={() => router.push('/admin')}
        />
      )}
      <Pressable
        onPress={() => router.push('/settings')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 10,
        }}
      >
        <Label style={{ fontWeight: '600', fontSize: 13 }}>Settings & account</Label>
        <ChevronRight size={18} color={c.muted} />
      </Pressable>
      {demo && (
        <Label style={{ color: c.muted, textAlign: 'center', fontSize: 11 }}>
          Preview workspace. No real cloud account or purchases.
        </Label>
      )}
    </Screen>
  );
}
