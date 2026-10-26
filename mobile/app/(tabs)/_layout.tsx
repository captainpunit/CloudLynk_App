import { Tabs } from 'expo-router';
import { Compass, Cloud, Radio, UserRound, PanelsTopLeft } from 'lucide-react-native';
import { colors as c } from '@/theme/tokens';

export default function MainTabs() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 3 },
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.line,
          paddingTop: 10,
          height: 78,
        },
        tabBarItemStyle: { paddingBottom: 5 },
        sceneStyle: { backgroundColor: c.canvas },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <Compass size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'My feed',
          tabBarIcon: ({ color }) => <PanelsTopLeft size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="channels"
        options={{
          title: 'Channels',
          tabBarIcon: ({ color }) => <Radio size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cloud"
        options={{
          title: 'My cloud',
          tabBarIcon: ({ color }) => <Cloud size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'You', tabBarIcon: ({ color }) => <UserRound size={23} color={color} /> }}
      />
    </Tabs>
  );
}
