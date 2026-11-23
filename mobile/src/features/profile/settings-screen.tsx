import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { router } from 'expo-router';
import { LogOut, ShieldCheck } from 'lucide-react-native';
import {
  Button,
  Caption,
  ErrorNote,
  Field,
  Heading,
  Label,
  Screen,
  Surface,
} from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { colors as c } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { shortDate } from '@/domain/format';
import { LegalLinks } from '@/components/legal-links';
import { invokeBackend } from '@/data/live/invoke-backend';
import { measurementChoice, type MeasurementChoice } from '@/services/meta/measurement';
import { requestVerifiedDeletion } from '@/services/account/deletion-flow';
import { unregisterPush } from '@/services/notifications/push';
import { captureInstallAttribution } from '@/services/attribution/installReferrer';

export default function SettingsScreen() {
  const { state, dispatch, notify } = useWorkspace();
  const [name, setName] = useState(state.profile?.name ?? '');
  const [birthDate, setBirthDate] = useState(state.profile?.birthDate ?? '');
  const [adChoice, setAdChoice] = useState<MeasurementChoice | null>(null);
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
      if (failure) throw new Error('Your profile could not be saved. Please try again.');
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
      // Best effort: a device that cannot be unregistered now stops receiving
      // notifications when its token is next rejected.
      await unregisterPush().catch(() => undefined);
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      // Offline, the server is not told but this phone is still signed out; that is success.
      if ((await supabase.auth.getSession()).data.session) throw new Error('still signed in');
      dispatch({ type: 'identity', profile: null, joinedIds: [] });
      router.replace('/');
      notify('You’re signed out');
    } catch {
      setError('Could not sign out. Check your connection and try again.');
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
  const profileId = state.profile?.id;
  useEffect(() => {
    if (!profileId) return;
    let live = true;
    void measurementChoice(profileId).then((choice) => live && setAdChoice(choice));
    return () => {
      live = false;
    };
  }, [profileId]);
  return (
    <Screen title="Settings" back>
      {state.profile && (
        <Surface>
          <Heading level="subhead">Profile</Heading>
          <Field label="Display name" value={name} onChangeText={setName} maxLength={60} />
          <Field
            label="Date of birth"
            helper="Needed for age-rated videos. Write it as YYYY-MM-DD."
            value={birthDate}
            onChangeText={setBirthDate}
            maxLength={10}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            autoComplete="birthdate-full"
          />
          <Button title="Save profile" onPress={() => void saveName()} loading={busy} />
        </Surface>
      )}
      <Surface>
        <Heading level="subhead">Plus</Heading>
        <Label style={{ color: c.muted }}>
          {state.subscribedUntil
            ? `Plus is active until ${shortDate(state.subscribedUntil)}. It does not renew by itself.`
            : 'You do not have Plus.'}
        </Label>
        <Button
          title={state.subscribed ? 'Add more time' : 'See Plus plans'}
          variant="soft"
          onPress={() => router.push('/premium')}
        />
      </Surface>
      <Surface>
        <ShieldCheck color={c.primary} size={24} />
        <Heading level="subhead">Advertising measurement</Heading>
        <Label style={{ color: c.muted, fontSize: 13 }}>
          Advertising measurement is optional. If you allow it, CloudLynk shares with Meta your
          device&apos;s advertising ID, basic device details, when you open the app, view plans or
          start a checkout, and when a Plus payment is confirmed, so we can tell which adverts work.
          We never share what you watch.
        </Label>
        {state.profile && (
          <>
            <Caption>
              {adChoice === 'allowed'
                ? 'On for this phone.'
                : adChoice === 'declined'
                  ? 'Off for this phone.'
                  : adChoice === 'unanswered'
                    ? 'You have not chosen yet, so it is off.'
                    : 'Checking…'}
            </Caption>
            <Button
              title={adChoice === 'allowed' ? 'Turn off' : 'Allow'}
              variant="outline"
              disabled={busy || deleting || adChoice === null}
              onPress={() => {
                const allow = adChoice !== 'allowed';
                setBusy(true);
                setError(null);
                void captureInstallAttribution(allow)
                  .then(() => {
                    setAdChoice(allow ? 'allowed' : 'declined');
                    notify(
                      allow ? 'Advertising measurement is on.' : 'Advertising measurement is off.',
                    );
                  })
                  .catch((cause: Error) => setError(cause.message))
                  .finally(() => setBusy(false));
              }}
            />
          </>
        )}
      </Surface>
      {state.profile && (
        <Surface>
          <Heading level="subhead">Private channel invitations</Heading>
          <Caption>
            To join a private channel, send this ID to its owner. They use it to invite you.
          </Caption>
          <Label selectable variant="callout">
            {state.profile.id}
          </Label>
          <Button
            title="Share ID"
            variant="soft"
            compact
            onPress={() =>
              void Share.share({ message: `My CloudLynk invitation ID: ${state.profile!.id}` })
            }
          />
        </Surface>
      )}
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
            background. Any Plus time you have left ends with the account.
          </Label>
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
      <LegalLinks />
      <Label style={{ color: c.muted, textAlign: 'center', fontSize: 10 }}>
        {env.appName} · {env.appVersion}
      </Label>
    </Screen>
  );
}
