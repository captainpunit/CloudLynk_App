import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Clapperboard } from 'lucide-react-native';
import { Button, Caption, ErrorNote, Field, Label, Section, Surface } from '@/components/ui';
import { call, checked } from '@/data/live/backend';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/state/workspace-provider';
import { usePalette } from '@/theme/tone';

type Request = { status: string; decision_reason: string | null };

/**
 * For members who do not publish yet: ask an administrator for creator access. Approval
 * arrives as a notification; once granted, this card gives way to "Your channels".
 */
export function CreatorRequest() {
  const { state, notify } = useWorkspace();
  const p = usePalette();
  const userId = state.profile?.id;
  const [latest, setLatest] = useState<Request | null | undefined>(undefined);
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void supabase
      .from('creator_applications')
      .select('status,decision_reason')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then((result) => {
        if (active) setLatest(checked(result)?.[0] ?? null);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (!userId || latest === undefined) return null;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await call('request_creator_access', { p_message: message.trim() });
      setLatest({ status: 'pending', decision_reason: null });
      setWriting(false);
      notify('Request sent. We will let you know.');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Section title="Publish on CloudLynk" />
      <Surface>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <Clapperboard size={22} color={p.ink} strokeWidth={1.8} />
          <View style={{ flex: 1, gap: 4 }}>
            {latest?.status === 'pending' ? (
              <>
                <Label style={{ fontWeight: '700' }}>Creator request sent</Label>
                <Caption>An administrator will review it. You will get a notification.</Caption>
              </>
            ) : (
              <>
                <Label style={{ fontWeight: '700' }}>Have videos to share?</Label>
                <Caption>
                  Creators run their own channels. Tell us what you would publish and an
                  administrator will review your request.
                </Caption>
                {latest?.status === 'declined' && (
                  <Caption>
                    Your last request was not approved
                    {latest.decision_reason ? `: ${latest.decision_reason}` : '.'}
                  </Caption>
                )}
              </>
            )}
          </View>
        </View>
        {latest?.status !== 'pending' &&
          (writing ? (
            <View style={{ gap: 10 }}>
              <Field
                label="What will you publish?"
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={1000}
                helper="For example: weekly cooking videos in Hindi."
              />
              <ErrorNote message={error} />
              <Button
                title="Send request"
                loading={busy}
                disabled={message.trim().length < 10}
                onPress={() => void send()}
              />
            </View>
          ) : (
            <Button title="Apply to be a creator" variant="soft" onPress={() => setWriting(true)} />
          ))}
      </Surface>
    </View>
  );
}
