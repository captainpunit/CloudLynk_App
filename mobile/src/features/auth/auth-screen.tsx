import { goBackOrExplore } from '@/lib/navigation';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Cloud, ShieldCheck } from 'lucide-react-native';
import { Button, ErrorNote, Field, Heading, Label, Pill, Screen } from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { assertLiveConfiguration } from '@/data/live/cloud-api';
import { supabase } from '@/lib/supabase';
import { colors as c } from '@/theme/tokens';

export default function AuthScreen() {
  const { demo, dispatch, refresh, notify } = useWorkspace();
  const [signUp, setSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (!demo && password.length < 8) {
      setError('Your password must have at least 8 characters.');
      return;
    }
    if ((signUp || demo) && name.trim().length < 2) {
      setError('Tell us your name (at least 2 characters).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (demo)
        dispatch({
          type: 'identity',
          profile: {
            id: 'demo-member',
            name: name.trim(),
            email: email.trim(),
            role: 'member',
            accountStatus: 'active',
          },
        });
      else {
        assertLiveConfiguration();
        const result = signUp
          ? await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: { data: { display_name: name.trim() } },
            })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
        if (signUp && !result.data.session) {
          notify('Check your email to confirm your account, then sign in.');
          setSignUp(false);
          return;
        }
        await refresh();
      }
      goBackOrExplore();
      notify(demo ? 'Your local preview workspace is ready' : 'Welcome to CloudLynk');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        title={
          demo ? 'Make yourself at home.' : signUp ? 'Your world starts here.' : 'Welcome back.'
        }
        subtitle="Good things are better when they’re yours."
        back
      >
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: c.primarySoft,
            padding: 22,
            borderRadius: 26,
          }}
        >
          <Cloud size={42} color={c.primary} />
        </View>
        <Heading style={{ fontSize: 32, lineHeight: 39 }}>
          A space for your files.{'\n'}A place for your people.
        </Heading>
        {demo ? (
          <Label style={{ color: c.muted }}>
            This is a local preview. Use any name and email to explore; no account is created and no
            password is collected.
          </Label>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pill title="Sign in" selected={!signUp} onPress={() => setSignUp(false)} />
            <Pill title="Create account" selected={signUp} onPress={() => setSignUp(true)} />
          </View>
        )}
        {(signUp || demo) && (
          <Field
            label="Your name"
            placeholder="Alex Morgan"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            maxLength={60}
          />
        )}
        <Field
          label="Email address"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        {!demo && (
          <Field
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={signUp ? 'new-password' : 'current-password'}
          />
        )}
        <ErrorNote message={error} />
        <Button
          title={demo ? 'Enter preview workspace' : signUp ? 'Create account' : 'Sign in'}
          loading={busy}
          onPress={() => void submit()}
        />
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          <ShieldCheck size={16} color={c.muted} />
          <Label style={{ fontSize: 11, color: c.muted }}>
            {demo
              ? 'Saved on this device. No real credentials needed.'
              : 'Your session is securely stored on your device.'}
          </Label>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
