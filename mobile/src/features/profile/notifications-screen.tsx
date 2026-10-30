import { useEffect } from 'react';
import { Bell, CheckCircle2, ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';
import { Label, Screen, Surface } from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { colors as c } from '@/theme/tokens';
import LiveNotifications from './live-notifications';

export default function NotificationsScreen() {
  const { state, dispatch, demo } = useWorkspace();
  useEffect(() => {
    if (demo) dispatch({ type: 'notices-read' });
  }, [dispatch, demo]);
  if (!demo) return <LiveNotifications />;
  const notices = [
    {
      icon: Bell,
      title: 'A new place for your favourite things',
      body: 'Explore creators, join a channel, and make a little space for your files.',
    },
    ...(state.demoPlanId
      ? [
          {
            icon: CheckCircle2,
            title: 'Your preview Plus is active',
            body: 'Plus channels are unlocked in this local workspace. No real subscription was purchased.',
          },
        ]
      : []),
    {
      icon: ShieldCheck,
      title: 'You decide what you share',
      body: demo
        ? 'Preview files stay on your device. Cloud backup is not enabled in preview mode.'
        : 'Private access is checked by the server before joining or watching.',
    },
  ];
  return (
    <Screen title="A little update." subtitle="The things you’ll want to know." back>
      {notices.map(({ icon: Icon, title, body }) => (
        <Surface key={title}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon color={c.primary} size={22} />
            <Label style={{ fontWeight: '700', flex: 1 }}>{title}</Label>
          </View>
          <Label style={{ color: c.muted, fontSize: 13 }}>{body}</Label>
        </Surface>
      ))}
    </Screen>
  );
}
