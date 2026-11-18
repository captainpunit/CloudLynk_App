import { View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Cloud, Play, Plus, Radio, UserRound, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/ui';
import { selectHaptic } from '@/lib/haptics';
import { colors as c, fonts, night } from '@/theme/tokens';

function tab(title: string, Icon: LucideIcon) {
  return {
    title,
    tabBarAccessibilityLabel: title,
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <Icon size={24} color={focused ? night.ink : night.muted} strokeWidth={focused ? 2.2 : 1.7} />
    ),
  };
}

/** The add button in the middle of the bar. */
function AddButton() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Upload"
        hitSlop={8}
        haptic="tap"
        scaleTo={0.92}
        onPress={() => router.push('/upload')}
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.upload,
        }}
      >
        <Plus size={26} color={c.white} strokeWidth={2.4} />
      </PressableScale>
    </View>
  );
}

export default function MainTabs() {
  // Room for the icon and its label above the system navigation area.
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      backBehavior="history"
      screenListeners={{ tabPress: () => selectHaptic() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: night.ink,
        tabBarInactiveTintColor: night.muted,
        // An explicit line height; without it the label box is shorter than the font and
        // the bottom of the letters is cut off.
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
        tabBarStyle: {
          backgroundColor: night.canvas,
          borderTopColor: night.line,
          // The icon takes 38 of the item's height; the label needs its full 16 below it.
          height: 64 + bottom,
          paddingTop: 4,
          paddingBottom: bottom + 4,
        },
        sceneStyle: { backgroundColor: night.canvas },
      }}
    >
      <Tabs.Screen name="index" options={tab('Watch', Play)} />
      <Tabs.Screen name="channels" options={tab('Channels', Radio)} />
      {/* The middle slot is the add button. Library keeps the tab bar and opens from You. */}
      <Tabs.Screen name="library" options={{ title: 'Library', tabBarButton: AddButton }} />
      <Tabs.Screen name="cloud" options={tab('Cloud', Cloud)} />
      <Tabs.Screen name="profile" options={tab('You', UserRound)} />
    </Tabs>
  );
}
