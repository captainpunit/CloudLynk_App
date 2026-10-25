import { goBackOrExplore } from '@/lib/navigation';
import { useState } from 'react';
import { View } from 'react-native';
import { Radio } from 'lucide-react-native';
import { Button, ErrorNote, Field, Label, Pill, Screen, Surface } from '@/components/ui';
import { categories, covers } from '@/data/demo/seed';
import { createId, validateChannel } from '@/domain/format';
import type { Category } from '@/domain/models';
import { useWorkspace } from '@/state/workspace-provider';
import { unavailable } from '@/data/live/cloud-api';
import { colors as c } from '@/theme/tokens';

export default function CreateChannelScreen() {
  const { state, demo, dispatch, requireIdentity, notify } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Travel');
  const [error, setError] = useState<string | null>(null);
  function submit() {
    const validation = validateChannel(name, description);
    if (validation) {
      setError(validation);
      return;
    }
    if (!requireIdentity() || !state.profile) return;
    try {
      if (!demo) unavailable('Creator channel submission');
      dispatch({
        type: 'channel-added',
        channel: {
          id: createId('channel'),
          name: name.trim(),
          description: description.trim(),
          category,
          cover: covers.forest,
          ownerId: state.profile.id,
          status: 'pending',
          visibility: 'private',
          members: 0,
        },
      });
      notify('Channel submitted for admin review');
      goBackOrExplore();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your channel.');
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
      <Label style={{ fontWeight: '700' }}>Choose a category</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {categories
          .filter((item) => item !== 'All')
          .map((item) => (
            <Pill
              key={item}
              title={item}
              selected={category === item}
              onPress={() => setCategory(item)}
            />
          ))}
      </View>
      <Surface>
        <Label style={{ fontWeight: '700', fontSize: 13 }}>A quick review before you go live</Label>
        <Label style={{ color: c.muted, fontSize: 12 }}>
          Your channel starts private. An admin reviews it and decides whether it is public, private
          or part of Plus. Upload only content you own or have permission to share.
        </Label>
      </Surface>
      <ErrorNote message={error} />
      <Button title="Submit for review" onPress={submit} />
    </Screen>
  );
}
