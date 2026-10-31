import { goBackOrExplore } from '@/lib/navigation';
import { useState } from 'react';
import { View } from 'react-native';
import { Radio } from 'lucide-react-native';
import { Button, ErrorNote, Field, Label, Pill, Screen, Surface } from '@/components/ui';
import { validateChannel } from '@/domain/format';
import { useWorkspace } from '@/state/workspace-provider';
import { call } from '@/data/live/backend';
import { colors as c } from '@/theme/tokens';

export default function CreateChannelScreen() {
  const { state, requireIdentity, notify, refresh } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cover, setCover] = useState('');
  // Suggest categories already used in the catalogue; owners may also type a new one.
  const categories = [
    ...new Set(state.channels.map((channel) => channel.category).filter((item) => item !== 'All')),
  ];
  async function submit() {
    if (busy) return;
    const validation = validateChannel(name, description);
    if (validation) {
      setError(validation);
      return;
    }
    if (category.trim().length > 40) {
      setError('Keep the category under 40 characters.');
      return;
    }
    if (cover && !/^https:\/\/\S+$/.test(cover.trim())) {
      setError('The cover image must be an https:// URL.');
      return;
    }
    if (!requireIdentity() || !state.profile) return;
    setBusy(true);
    setError(null);
    try {
      await call('submit_channel', {
        p_name: name.trim(),
        p_description: description.trim(),
        ...(category.trim() ? { p_category: category.trim() } : {}),
        ...(cover.trim() ? { p_cover_url: cover.trim() } : {}),
      });
      await refresh();
      notify('Channel submitted for admin review');
      goBackOrExplore();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your channel.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="Make a little space."
      subtitle="Bring people together around what you love."
      back
    >
      <Surface style={{ backgroundColor: c.primarySoft, borderColor: c.primarySoft }}>
        <Radio size={28} color={c.primary} />
        <Label style={{ color: c.primary }}>Every great community starts with a first story.</Label>
      </Surface>
      <Field
        label="Channel name"
        placeholder="A name that feels like you"
        value={name}
        onChangeText={setName}
        maxLength={60}
      />
      <Field
        label="About your channel"
        placeholder="What will people discover here?"
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
        maxLength={500}
      />
      <Field
        label="Cover image URL (https, optional)"
        value={cover}
        onChangeText={setCover}
        autoCapitalize="none"
      />
      <Field
        label="Category (optional)"
        placeholder="What is it about?"
        value={category}
        onChangeText={setCategory}
        maxLength={40}
      />
      {categories.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((item) => (
            <Pill
              key={item}
              title={item}
              selected={category === item}
              onPress={() => setCategory(item)}
            />
          ))}
        </View>
      )}
      <Surface>
        <Label style={{ fontWeight: '700', fontSize: 13 }}>A quick review before you go live</Label>
        <Label style={{ color: c.muted, fontSize: 12 }}>
          Your channel starts private. An admin reviews it and decides whether it is public, private
          or part of Plus. Upload only content you own or have permission to share.
        </Label>
      </Surface>
      <ErrorNote message={error} />
      <Button title="Submit for review" loading={busy} onPress={() => void submit()} />
    </Screen>
  );
}
