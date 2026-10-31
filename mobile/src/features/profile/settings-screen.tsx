import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { LogOut, ShieldCheck } from 'lucide-react-native';
import { Button, ErrorNote, Field, Label, Screen, Surface } from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { colors as c } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { invokeBackend } from '@/data/live/invoke-backend';
import { requestVerifiedDeletion } from '@/services/account/deletion-flow';
import { unregisterPush } from '@/services/notifications/push';
import { captureInstallAttribution } from '@/services/attribution/installReferrer';

export default function SettingsScreen() {
  const { state, dispatch, notify } = useWorkspace();
  const [name, setName] = useState(state.profile?.name ?? '');
  const [birthDate, setBirthDate] = useState(state.profile?.birthDate ?? '');
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  // The profile can arrive after this screen mounts (sign-in, refresh); show its saved values.
  useEffect(() => {
    setName(state.profile?.name ?? '');
    setBirthDate(state.profile?.birthDate ?? '');
  }, [state.profile?.id, state.profile?.name, state.profile?.birthDate]);
  function openSubscriptions() {
    void Linking.openURL(env.subscriptionsUrl).catch(() => setError('Google Play could not open.'));
  }
  async function saveName() {
    if (!state.profile || name.trim().length < 2) {
      setError('Use a name with at least 2 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (
        birthDate &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
          Number.isNaN(Date.parse(birthDate)) ||
          new Date(birthDate).toISOString().slice(0, 10) !== birthDate ||
          Date.parse(birthDate) > Date.now())
      )
        throw new Error('Enter a valid date of birth as YYYY-MM-DD.');
      const { error: failure } = await supabase
        .from('profiles')
        .update({ display_name: name.trim(), birth_date: birthDate || null })
        .eq('id', state.profile.id);
      if (failure) throw failure;
      const current = await supabase.auth.getSession();
      if (current.data.session?.user.id !== state.profile.id) return;
      dispatch({
        type: 'identity',
        profile: { ...state.profile, name: name.trim(), birthDate: birthDate || undefined },
      });
      notify('Profile updated');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    try {
      await unregisterPush();
      const { error: failure } = await supabase.auth.signOut();
      if (failure) throw failure;
      dispatch({ type: 'identity', profile: null, joinedIds: [] });
      router.replace('/');
      notify('You’re signed out');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out.');
    }
  }
  async function deleteAccount() {
    if (deleting) return;
    setError(null);
    setDeleting(true);
    try {
      if (!state.profile?.email || confirmation !== 'DELETE' || !password) {
        throw new Error('Enter your password and type DELETE to confirm.');
      }
      const email = state.profile.email;
      await requestVerifiedDeletion(state.profile.id, confirmation, {
        reauthenticate: async () => {
          const signedIn = await supabase.auth.signInWithPassword({ email, password });
          setPassword('');
          if (signedIn.error) throw new Error('Password verification failed. Please try again.');
          return signedIn.data.user.id;
        },
        request: (value) => invokeBackend('delete-account', { confirmation: value }),
        signOut: async () => {
          try {
            await unregisterPush();
          } finally {
            await supabase.auth.signOut({ scope: 'local' });
          }
        },
      });
      dispatch({ type: 'identity', profile: null, joinedIds: [] });
      router.replace('/');
      notify('Account deletion requested. Your account is restricted while deletion completes.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete account.');
    } finally {
      setPassword('');
      setDeleting(false);
    }
  }
  return (
    <Screen title="Make it your own." subtitle="Your account, your preferences." back>
      {state.profile && (
        <Surface>
          <Label>Share your invitation ID with a channel owner for a private invitation.</Label>
          <Label selectable>{state.profile.id}</Label>
          <Field label="Display name" value={name} onChangeText={setName} maxLength={60} />
          <Field
            label="Date of birth (YYYY-MM-DD, for age-rated content)"
            value={birthDate}
            onChangeText={setBirthDate}
            maxLength={10}
            placeholder="YYYY-MM-DD"
          />
          <Button title="Save profile" onPress={() => void saveName()} loading={busy} />
        </Surface>
      )}
      <Surface>
        <Label style={{ fontWeight: '700' }}>Your membership</Label>
        <Label style={{ color: c.muted }}>Manage paid subscriptions securely in Google Play.</Label>
        <Button
          title="Manage Google Play subscription"
          variant="soft"
          onPress={openSubscriptions}
        />
      </Surface>
      <Surface>
        <ShieldCheck color={c.primary} size={24} />
        <Label style={{ fontWeight: '700' }}>Privacy comes first.</Label>
        <Label style={{ color: c.muted, fontSize: 13 }}>
          Advertising measurement is optional. Enabling it shares Google Play install attribution
          and verified subscription events for advertising measurement. Advertising SDKs do not
          start automatically.
        </Label>
        {state.profile && (
          <>
            <Button
              title="Allow advertising measurement"
              variant="outline"
              disabled={busy || deleting}
              onPress={() => {
                setBusy(true);
                setError(null);
                void captureInstallAttribution(true)
                  .then(() => notify('Advertising measurement enabled for this installation.'))
                  .catch((cause: Error) => setError(cause.message))
                  .finally(() => setBusy(false));
              }}
            />
            <Button
              title="Turn off advertising measurement"
              variant="outline"
              disabled={busy || deleting}
              onPress={() => {
                setBusy(true);
                setError(null);
                void captureInstallAttribution(false)
                  .then(() => notify('Advertising measurement disabled.'))
                  .catch((cause: Error) => setError(cause.message))
                  .finally(() => setBusy(false));
              }}
            />
          </>
        )}
      </Surface>
      <ErrorNote message={error} />
      {state.profile && (
        <Button
          title="Sign out"
          icon={LogOut}
          variant="outline"
          disabled={deleting}
          onPress={() => void signOut()}
        />
      )}
      <Button
        title="Delete account"
        variant="outline"
        disabled={deleting || !state.profile}
        onPress={() => setDeleteConfirm(!deleteConfirm)}
      />
      {deleteConfirm && (
        <Surface>
          <Label style={{ fontWeight: '700' }}>Delete your account?</Label>
          <Label style={{ color: c.muted, fontSize: 12 }}>
            This permanently removes your account, files and uploaded videos. Deletion runs in the
            background. It does not cancel Google Play billing. Cancel your subscription in Google
            Play first to stop future charges.
          </Label>
          <Button
            title="Manage Google Play subscription"
            variant="outline"
            disabled={deleting}
            onPress={openSubscriptions}
          />
          <Field
            label="Confirm your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            editable={!deleting}
          />
          <Field
            label="Type DELETE to confirm"
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!deleting}
          />
          <View style={{ gap: 8 }}>
            <Button
              title="Request account deletion"
              variant="danger"
              loading={deleting}
              disabled={confirmation !== 'DELETE' || !password}
              onPress={() => void deleteAccount()}
            />
            <Button
              title="Keep my workspace"
              variant="soft"
              disabled={deleting}
              onPress={() => {
                setDeleteConfirm(false);
                setPassword('');
                setConfirmation('');
              }}
            />
          </View>
        </Surface>
      )}
      <Label style={{ color: c.muted, textAlign: 'center', fontSize: 10 }}>
        {env.appName} · Android · {env.appVersion}
      </Label>
    </Screen>
  );
}
