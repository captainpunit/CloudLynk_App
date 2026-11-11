import { Linking, Pressable, View } from 'react-native';
import { Label } from './ui';
import { colors as c } from '@/theme/tokens';
import { env } from '@/lib/env';

const links = [
  { title: 'Privacy policy', url: env.privacyUrl },
  { title: 'Terms', url: env.termsUrl },
].filter((link) => link.url);

/** Links to the legal pages. Renders nothing until their URLs are configured. */
export function LegalLinks() {
  if (!links.length) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 }}>
      {links.map((link) => (
        <Pressable
          key={link.title}
          accessibilityRole="link"
          hitSlop={12}
          onPress={() => void Linking.openURL(link.url).catch(() => {})}
        >
          <Label
            style={{
              color: c.primary,
              fontSize: 12,
              fontWeight: '600',
              textDecorationLine: 'underline',
            }}
          >
            {link.title}
          </Label>
        </Pressable>
      ))}
    </View>
  );
}
