import { Tabs } from 'expo-router';
import { House, Library, MonitorPlay, UserRound, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { night } from '@/theme/tokens';

function tab(title: string, Icon: LucideIcon) {
  return {
    title,
    tabBarAccessibilityLabel: title,
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <Icon size={24} color={focused ? night.ink : night.muted} strokeWidth={focused ? 2.2 : 1.7} />
    ),
  };
}

export default function MainTabs() {
  // Room for the icon and its label above the system navigation area.
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      initialRouteName="index"
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: night.ink,
        tabBarInactiveTintColor: night.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: night.canvas,
          borderTopColor: night.line,
          height: 62 + bottom,
          paddingTop: 6,
          paddingBottom: bottom + 6,
        },
        sceneStyle: { backgroundColor: night.canvas },
      }}
    >
      <Tabs.Screen name="index" options={tab('Home', House)} />
      <Tabs.Screen name="channels" options={tab('Channels', MonitorPlay)} />
      <Tabs.Screen name="library" options={tab('Library', Library)} />
      <Tabs.Screen name="profile" options={tab('You', UserRound)} />
      {/* My cloud opens from Library and You; it keeps the tab bar but has no tab of its own. */}
      <Tabs.Screen name="cloud" options={{ title: 'My cloud', href: null }} />
    </Tabs>
  );
}
