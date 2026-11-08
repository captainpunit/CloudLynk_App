import { useEffect } from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import {
  Cloud,
  Compass,
  PanelsTopLeft,
  Radio,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { selectHaptic } from '@/lib/haptics';
import { colors as c, fonts, radius } from '@/theme/tokens';

/** Tab icon with an active-indicator pill that springs in behind it. */
function TabIcon({ icon: Icon, focused }: { icon: LucideIcon; focused: boolean }) {
  const color = focused ? c.primary : c.muted;
  const active = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    active.value = withSpring(focused ? 1 : 0, { damping: 18, stiffness: 260 });
  }, [active, focused]);
  const indicator = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ scaleX: 0.6 + 0.4 * active.value }],
  }));
  return (
    <View style={{ width: 52, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            inset: 0,
            borderRadius: radius.pill,
            backgroundColor: c.primarySoft,
          },
          indicator,
        ]}
      />
      {/* A View keeps the icon above the indicator on web, where positioned boxes paint last. */}
      <View>
        <Icon size={20} color={color} strokeWidth={focused ? 2.1 : 1.8} />
      </View>
    </View>
  );
}

const tabs: { name: string; title: string; icon: LucideIcon }[] = [
  { name: 'index', title: 'Explore', icon: Compass },
  { name: 'feed', title: 'My feed', icon: PanelsTopLeft },
  { name: 'channels', title: 'Channels', icon: Radio },
  { name: 'cloud', title: 'My cloud', icon: Cloud },
  { name: 'profile', title: 'You', icon: UserRound },
];

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenListeners={{ tabPress: () => selectHaptic() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, marginTop: 2 },
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.line,
          height: 68 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 8,
        },
        sceneStyle: { backgroundColor: c.canvas },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => <TabIcon icon={tab.icon} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}
