import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Touch feedback. Used sparingly: a light tap for primary actions, a selection
 * tick for tabs, pills and toggles. Never on web, and a failure never reaches the UI.
 */
export function tapHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function selectHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}
