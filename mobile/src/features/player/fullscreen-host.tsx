import { createContext, use, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { colors as c } from '@/theme/tokens';

type Show = (content: ReactNode | null) => void;
const FullscreenContext = createContext<Show | null>(null);

/**
 * A layer over the whole app for the full-screen player. It lives in the app's own window,
 * so it follows the rotation to landscape and the hidden system bars. A React Native Modal
 * is a separate Android window that keeps its portrait size and its status bar.
 */
export function FullscreenHost({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null);
  return (
    <FullscreenContext value={setContent}>
      {children}
      {content !== null && (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1000,
            elevation: 1000,
            backgroundColor: c.player,
          }}
        >
          {content}
        </View>
      )}
    </FullscreenContext>
  );
}

/** Puts content in the full-screen layer, or clears it with null. Null outside a host. */
export function useFullscreenLayer() {
  return use(FullscreenContext);
}
