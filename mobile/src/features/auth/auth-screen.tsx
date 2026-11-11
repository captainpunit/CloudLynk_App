import { goBackOrExplore } from '@/lib/navigation';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { Button, ErrorNote, Field, Label, Pill, Screen } from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { assertLiveConfiguration } from '@/data/live/cloud-api';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { LegalLinks } from '@/components/legal-links';
import { colors as c } from '@/theme/tokens';

/**
 * - `signIn` / `signUp`: email and password.
 * - `resetRequest`: ask for a reset code by email.
 * - `resetConfirm`: enter the emailed code and a new password.
 */
type Mode = 'signIn' | 'signUp' | 'resetRequest' | 'resetConfirm';

const titles: Record<Mode, string> = {
  signIn: 'Welcome back',
  signUp: 'Create your account',
  resetRequest: 'Reset your password',
  resetConfirm: 'Choose a new password',
};

/** Sign-in errors in plain words; the auth service's own wording is for developers. */
function authMessage(cause: unknown, mode: Mode): string {
  const message = cause instanceof Error ? cause.message.toLowerCase() : '';
  if (message.includes('invalid login')) return 'The email or password is incorrect.';
  if (message.includes('already registered'))
    return 'An account with this email already exists. Sign in instead.';
  if (message.includes('not confirmed'))
    return 'Confirm your email first. Check your inbox for our message.';
  if (mode === 'resetConfirm' && (message.includes('expired') || message.includes('invalid')))
    return 'That code is wrong or has expired. Ask for a new one.';
  if (message.includes('weak') || message.includes('password should'))
    return 'Choose a stronger password: at least 8 characters.';
  if (message.includes('rate limit') || message.includes('security purposes'))
    return 'Too many attempts. Wait a minute and try again.';
  if (message.includes('different from the old'))
    return 'Choose a password you have not used on this account before.';
  if (message.includes('network') || message.includes('fetch'))
    return 'No connection. Check your internet and try again.';
  return 'Something went wrong. Please try again.';
}

export default function AuthScreen() {
  const { refresh, notify } = useWorkspace();
  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A reset code works once. After it is accepted, a retry only sets the password.
  const codeAccepted = useRef(false);
  // Counts form changes, so a request that finishes after the form moved on can tell.
  const form = useRef(0);

  useEffect(
    () => () => {
      form.current += 1;
      // Closing the screen between the code and the new password ends that session too.
      if (codeAccepted.current)
        void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    },
    [],
  );

  function show(next: Mode) {
    form.current += 1;
    setError(null);
    setPassword('');
    setCode('');
    // Leaving a half-finished reset must not leave the account signed in.
    if (codeAccepted.current) void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    codeAccepted.current = false;
    setMode(next);
  }

  function changeEmail(value: string) {
    // An accepted code belongs to the address it was sent to. A different address
    // starts again, so the new password can never land on the earlier account.
    if (codeAccepted.current) {
      codeAccepted.current = false;
      void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
    setEmail(value);
  }

  /** The first problem with what was typed, or null when the form can be sent. */
  function problem(): string | null {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
    if (mode === 'resetRequest') return null;
    if (mode === 'resetConfirm' && !/^\d{6,8}$/.test(code.trim()))
      return 'Enter the code from our email.';
    if (password.length < 8) return 'Your password must have at least 8 characters.';
    if (mode === 'signUp' && name.trim().length < 2)
      return 'Tell us your name (at least 2 characters).';
    return null;
  }

  async function send(): Promise<void> {
    const address = email.trim();
    if (mode === 'resetRequest') {
      const sent = await supabase.auth.resetPasswordForEmail(address);
      if (sent.error) throw sent.error;
      // The same message whether or not the address has an account.
      notify('If that email has an account, we sent it a code.');
      show('resetConfirm');
      return;
    }
    if (mode === 'resetConfirm') {
      const started = form.current;
      if (!codeAccepted.current) {
        const verified = await supabase.auth.verifyOtp({
          email: address,
          token: code.trim(),
          type: 'recovery',
        });
        if (verified.error) throw verified.error;
        // The member left the form while the code was checked: do not stay signed in.
        if (started !== form.current) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
          return;
        }
        codeAccepted.current = true;
      }
      const updated = await supabase.auth.updateUser({ password });
      if (updated.error) throw updated.error;
      codeAccepted.current = false;
    } else {
      const result =
        mode === 'signUp'
          ? await supabase.auth.signUp({
              email: address,
              password,
              options: { data: { full_name: name.trim() } },
            })
          : await supabase.auth.signInWithPassword({ email: address, password });
      if (result.error) throw result.error;
      if (mode === 'signUp' && !result.data.session) {
        notify('Check your email to confirm your account, then sign in.');
        show('signIn');
        return;
      }
    }
    await refresh();
    goBackOrExplore();
    notify(
      mode === 'resetConfirm'
        ? 'Password changed. You are signed in.'
        : `Welcome to ${env.appName}`,
    );
  }

  async function submit() {
    if (busy) return;
    const invalid = problem();
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    try {
      assertLiveConfiguration();
      await send();
    } catch (cause) {
      setError(authMessage(cause, mode));
    } finally {
      setBusy(false);
    }
  }

  const resetting = mode === 'resetRequest' || mode === 'resetConfirm';
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        title={titles[mode]}
        subtitle={
          resetting
            ? 'We email you a code. Enter it here with a new password.'
            : 'Join channels, save videos and subscribe to Plus.'
        }
        back
      >
        {!resetting && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pill title="Sign in" selected={mode === 'signIn'} onPress={() => show('signIn')} />
            <Pill
              title="Create account"
              selected={mode === 'signUp'}
              onPress={() => show('signUp')}
            />
          </View>
        )}
        {mode === 'signUp' && (
          <Field
            label="Your name"
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
          onChangeText={changeEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        {mode === 'resetConfirm' && (
          <Field
            label="Code from our email"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={8}
          />
        )}
        {mode !== 'resetRequest' && (
          <Field
            label={mode === 'resetConfirm' ? 'New password' : 'Password'}
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            onSubmitEditing={() => void submit()}
          />
        )}
        <ErrorNote message={error} />
        <Button
          title={
            {
              signIn: 'Sign in',
              signUp: 'Create account',
              resetRequest: 'Email me a code',
              resetConfirm: 'Change password',
            }[mode]
          }
          loading={busy}
          onPress={() => void submit()}
        />
        {mode === 'signIn' && (
          <TextLink title="Forgot password?" onPress={() => show('resetRequest')} />
        )}
        {mode === 'resetRequest' && (
          <TextLink title="I already have a code" onPress={() => show('resetConfirm')} />
        )}
        {resetting && <TextLink title="Back to sign in" onPress={() => show('signIn')} />}
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          <ShieldCheck size={16} color={c.muted} />
          <Label style={{ fontSize: 11, color: c.muted }}>
            Your session is securely stored on your device.
          </Label>
        </View>
        <LegalLinks />
      </Screen>
    </KeyboardAvoidingView>
  );
}

function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      hitSlop={10}
      onPress={onPress}
      style={{ alignSelf: 'center' }}
    >
      <Label style={{ color: c.primary, fontWeight: '600' }}>{title}</Label>
    </Pressable>
  );
}
