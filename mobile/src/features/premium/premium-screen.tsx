import { View } from 'react-native';
import { Cloud, Radio, ShieldCheck, Sparkles } from 'lucide-react-native';
import { Heading, Label, Screen } from '@/components/ui';
import { colors as c } from '@/theme/tokens';
import { env } from '@/lib/env';
import LiveBilling from './live-billing';

/** Plans, prices and storage come from the backend `plans` table joined to Google Play offers. */
export default function PremiumScreen() {
  return (
    <Screen title={`${env.appName} Plus`} back>
      <View
        style={{
          backgroundColor: c.dark,
          borderRadius: 27,
          padding: 28,
          gap: 16,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            alignSelf: 'flex-start',
            borderRadius: 16,
            padding: 12,
            backgroundColor: '#FFFFFF12',
          }}
        >
          <Sparkles size={29} color={c.accent} />
        </View>
        <Label style={{ color: c.accent, fontWeight: '700', fontSize: 10, letterSpacing: 2 }}>
          A LITTLE MORE POSSIBILITY
        </Label>
        <Heading style={{ color: c.white, fontSize: 35, lineHeight: 41 }}>
          More stories.{'\n'}More space.{'\n'}More you.
        </Heading>
        <Label style={{ color: '#B7CAC4', fontSize: 13 }}>
          Your favourite creators. Your biggest ideas.{'\n'}Room for everything that matters.
        </Label>
      </View>
      <View style={{ gap: 18 }}>
        {[
          {
            icon: Radio,
            title: 'Get closer to great creators',
            body: 'Unlock every published Plus channel.',
          },
          {
            icon: Cloud,
            title: 'A bigger home for your files',
            body: 'Keep your photos, videos and documents together.',
          },
          {
            icon: ShieldCheck,
            title: 'Made for peace of mind',
            body: 'Private storage and control over your membership.',
          },
        ].map(({ icon: Icon, title, body }) => (
          <View key={title} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ padding: 12, backgroundColor: c.primarySoft, borderRadius: 15 }}>
              <Icon size={21} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Label style={{ fontWeight: '700', fontSize: 14 }}>{title}</Label>
              <Label style={{ color: c.muted, fontSize: 12 }}>{body}</Label>
            </View>
          </View>
        ))}
      </View>
      <Heading style={{ fontSize: 22 }}>Find your kind of Plus.</Heading>
      <LiveBilling />
      <Label style={{ color: c.muted, fontSize: 11, textAlign: 'center' }}>
        Subscriptions are managed through Google Play. Published billing terms will be shown before
        purchase.
      </Label>
    </Screen>
  );
}
