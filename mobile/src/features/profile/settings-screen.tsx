import { useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { LogOut, ShieldCheck } from 'lucide-react-native';
import { Button, ErrorNote, Field, Label, Screen, Surface } from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { colors as c } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { createDemoWorkspace } from '@/data/demo/seed';
import { unavailable } from '@/data/live/cloud-api';

export default function SettingsScreen() {
  const { state, demo, dispatch, notify } = useWorkspace();
  const [name, setName] = useState(state.profile?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  async function saveName() {
    if (!state.profile || name.trim().length < 2) {
      setError('Use a name with at least 2 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!demo) {
        const { error: failure } = await supabase
          .from('profiles')
          .update({ display_name: name.trim() })
          .eq('id', state.profile.id);
        if (failure) throw failure;
      }
      dispatch({ type: 'identity', profile: { ...state.profile, name: name.trim() } });
      notify('Profile updated');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    try {
      if (!demo) {
        const { error: failure } = await supabase.auth.signOut();
        if (failure) throw failure;
      }
      dispatch({ type: 'identity', profile: null, joinedIds: demo ? state.joinedIds : [] });
      router.replace('/');
      notify('You’re signed out');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out.');
    }
  }
  function deleteAccount() {
    try {
      if (!demo) unavailable('Account deletion');
      dispatch({ type: 'hydrate', value: createDemoWorkspace() });
      router.replace('/');
      notify('Local preview workspace reset');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete account.');
    }
  }
  return (
    <Screen title="Make it your own." subtitle="Your account, your preferences." back>
      {state.profile && (
        <Surface>
          <Field label="Display name" value={name} onChangeText={setName} maxLength={60} />
          <Button title="Save profile" onPress={() => void saveName()} loading={busy} />
        </Surface>
      )}
      <Surface>
        <Label style={{ fontWeight: '700' }}>Your membership</Label>
        <Label style={{ color: c.muted }}>
          {demo
            ? state.demoPlanId
              ? 'Preview Plus is active on this device.'
              : 'You’re exploring the free preview.'
            : 'Manage paid subscriptions securely in Google Play.'}
        </Label>
        <Button
          title={demo ? 'Manage preview plan' : 'Manage Google Play subscription'}
          variant="soft"
          onPress={() =>
            demo
              ? router.push('/premium')
              : void Linking.openURL('https://play.google.com/store/account/subscriptions').catch(
                  () => setError('Google Play could not open.'),
                )
          }
        />
        {demo && state.demoPlanId && (
          <Button
            title="End preview Plus"
            variant="outline"
            onPress={() => {
              dispatch({ type: 'demo-plan', id: null });
              notify('Preview Plus ended. Premium access is locked again.');
            }}
          />
        )}
      </Surface>
      <Surface>
        <ShieldCheck color={c.primary} size={24} />
        <Label style={{ fontWeight: '700' }}>Privacy comes first.</Label>
        <Label style={{ color: c.muted, fontSize: 13 }}>
          Advertising tracking is off in this frontend. No advertising SDK is initialized at launch.
          Production analytics must be connected to an explicit consent flow.
        </Label>
      </Surface>
      {demo && state.profile && (
        <Surface>
          <Label style={{ fontWeight: '700' }}>Preview role</Label>
          <Label style={{ fontSize: 12, color: c.muted }}>
            Test the admin review flow locally. This switch never changes a real server role.
          </Label>
          <Button
            title={state.profile.role === 'admin' ? 'Use member preview' : 'Use admin preview'}
            variant="soft"
            onPress={() => {
              dispatch({
                type: 'identity',
                profile: {
                  ...state.profile!,
                  role: state.profile?.role === 'admin' ? 'member' : 'admin',
                },
              });
              notify('Preview role updated');
            }}
          />
        </Surface>
      )}
      <ErrorNote message={error} />
      {state.profile && (
        <Button title="Sign out" icon={LogOut} variant="outline" onPress={() => void signOut()} />
      )}
      <Button
        title={demo ? 'Reset local preview workspace' : 'Delete account'}
        variant="outline"
        onPress={() => setDeleteConfirm(!deleteConfirm)}
      />
      {deleteConfirm && (
        <Surface>
          <Label style={{ fontWeight: '700' }}>
            {demo ? 'Reset this preview?' : 'Delete your account?'}
          </Label>
          <Label style={{ color: c.muted, fontSize: 12 }}>
            {demo
              ? 'Your local library, memberships and preview plan will be cleared. Your original device files are not changed.'
              : 'Account deletion requires the secure server deletion endpoint, which is not deployed in this repository.'}
          </Label>
          <View style={{ gap: 8 }}>
            <Button
              title={demo ? 'Yes, reset preview' : 'Request account deletion'}
              variant="danger"
              onPress={deleteAccount}
            />
            <Button
              title="Keep my workspace"
              variant="soft"
              onPress={() => setDeleteConfirm(false)}
            />
          </View>
        </Surface>
      )}
      <Label style={{ color: c.muted, textAlign: 'center', fontSize: 10 }}>
        CloudLynk · Android · Frontend preview 1.0
      </Label>
    </Screen>
  );
}
