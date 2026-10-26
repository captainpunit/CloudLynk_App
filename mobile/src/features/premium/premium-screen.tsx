import { goBackOrExplore } from '@/lib/navigation';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Check, Circle, Cloud, Radio, ShieldCheck, Sparkles } from 'lucide-react-native';
import { plans } from '@/data/demo/seed';
import { Button, ErrorNote, Heading, Label, Screen, Surface } from '@/components/ui';
import { colors as c } from '@/theme/tokens';
import { useWorkspace } from '@/state/workspace-provider';
import { unavailable } from '@/data/live/cloud-api';

export default function PremiumScreen() {
  const { state, demo, dispatch, requireIdentity, notify } = useWorkspace();
  const [selected, setSelected] = useState('annual');
  const [error, setError] = useState<string | null>(null);
  function activate() {
    if (!requireIdentity()) return;
    try {
      if (!demo) unavailable('Google Play plan catalogue and server-verified billing');
      dispatch({ type: 'demo-plan', id: selected });
      notify('Preview Plus enabled. No charge or real subscription.');
      goBackOrExplore();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load billing.');
    }
  }
  return (
    <Screen title="CloudLynk Plus" back>
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
      {demo ? (
        plans.map((plan) => (
          <Pressable
            key={plan.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected === plan.id }}
            onPress={() => setSelected(plan.id)}
            style={{
              borderWidth: selected === plan.id ? 2 : 1,
              borderColor: selected === plan.id ? c.primary : c.line,
              backgroundColor: selected === plan.id ? c.primarySoft : c.surface,
              borderRadius: 18,
              padding: 18,
              gap: 10,
            }}
          >
            {plan.featured && (
              <Label
                style={{
                  color: c.primary,
                  fontSize: 9,
                  lineHeight: 14,
                  letterSpacing: 1.4,
                  fontWeight: '800',
                }}
              >
                THE BEST VALUE · SAVE 44%
              </Label>
            )}
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              {selected === plan.id ? (
                <Check size={21} color={c.primary} />
              ) : (
                <Circle size={21} color={c.muted} />
              )}
              <View style={{ flex: 1 }}>
                <Label style={{ fontWeight: '700' }}>{plan.name}</Label>
                <Label style={{ color: c.muted, fontSize: 11 }}>
                  {plan.storageLabel} storage · All Plus channels
                </Label>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Label style={{ fontSize: 22, fontWeight: '700' }}>{plan.priceLabel}</Label>
                <Label style={{ color: c.muted, fontSize: 10 }}>{plan.period}</Label>
              </View>
            </View>
          </Pressable>
        ))
      ) : (
        <Surface>
          <Label>Live plans are not published yet.</Label>
          <Label style={{ color: c.muted }}>
            Prices must come from Google Play, and access must be granted by the server after
            verification.
          </Label>
        </Surface>
      )}
      <ErrorNote message={error} />
      <Button
        title={
          demo
            ? state.demoPlanId
              ? 'Update preview plan'
              : 'Try Plus in preview'
            : 'Check plan availability'
        }
        icon={Sparkles}
        onPress={activate}
      />
      <Button
        title={demo ? 'Restore preview plan' : 'Restore purchases'}
        variant="outline"
        onPress={() => {
          if (!requireIdentity()) return;
          if (demo)
            notify(
              state.demoPlanId
                ? 'Your preview plan is already active on this device.'
                : 'No preview plan found. Choose one above.',
            );
          else
            setError(
              'Purchase restoration needs the live Play Billing and receipt-verification integration.',
            );
        }}
      />
      <Label style={{ color: c.muted, fontSize: 11, textAlign: 'center' }}>
        {demo
          ? 'Illustrative prices. Preview activation is local and free; it does not start a paid subscription.'
          : 'Subscriptions are managed through Google Play. Published billing terms will be shown before purchase.'}
      </Label>
    </Screen>
  );
}
