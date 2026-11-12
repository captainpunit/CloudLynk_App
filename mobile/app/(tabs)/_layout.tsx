import { Pressable, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Cloud, Play, Plus, Radio, UserRound, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { night } from '@/theme/tokens';

/** The add button in the middle of the bar. */
const addBlue = '#3D5AFE';

function tab(title: string, Icon: LucideIcon) {
  return {
    title,
    tabBarAccessibilityLabel: title,
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <Icon size={24} color={focused ? night.ink : night.muted} strokeWidth={focused ? 2.2 : 1.7} />
    ),
  };
}

function AddButton() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Upload"
        hitSlop={8}
        onPress={() => router.push('/upload')}
        style={({ pressed }) => ({
          width: 50,
          height: 50,
          borderRadius: 25,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: addBlue,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Plus size={26} color="#FFFFFF" strokeWidth={2.4} />
      </Pressable>
    </View>
  );
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
      <Tabs.Screen name="index" options={tab('Watch', Play)} />
      <Tabs.Screen name="channels" options={tab('Channels', Radio)} />
      {/* The middle slot is the add button. Library keeps the tab bar and opens from You. */}
      <Tabs.Screen name="library" options={{ title: 'Library', tabBarButton: AddButton }} />
      <Tabs.Screen name="cloud" options={tab('Cloud', Cloud)} />
      <Tabs.Screen name="profile" options={tab('You', UserRound)} />
    </Tabs>
  );
}
