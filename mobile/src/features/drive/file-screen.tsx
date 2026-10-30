import { goBackOrExplore } from '@/lib/navigation';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { FileText, Share2, Trash2 } from 'lucide-react-native';
import { Button, EmptyState, ErrorNote, Field, Label, Screen, Surface } from '@/components/ui';
import { fileSize } from '@/domain/format';
import { useWorkspace } from '@/state/workspace-provider';
import { colors as c } from '@/theme/tokens';
import LiveFile from './live-file';

export default function FileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, demo, dispatch, notify } = useWorkspace();
  const file = state.files.find((item) => item.id === id);
  const [name, setName] = useState(file?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!demo) return <LiveFile id={id} />;
  if (!file)
    return (
      <Screen title="File" back>
        <EmptyState
          title="This file is no longer here"
          body="Return to your cloud to see your current files."
          action="Open my cloud"
          onPress={() => router.replace('/cloud')}
        />
      </Screen>
    );
  async function share() {
    try {
      if (!file?.uri || !(await Sharing.isAvailableAsync()))
        throw new Error('This file cannot be exported from this device. Try the Android app.');
      await Sharing.shareAsync(file.uri);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not share this file.');
    }
  }
  function rename() {
    try {
      if (!name.trim()) throw new Error('The name cannot be empty.');
      dispatch({ type: 'file-renamed', id, name: name.trim() });
      notify('File renamed');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not rename file.');
    }
  }
  function remove() {
    dispatch({ type: 'file-deleted', id });
    goBackOrExplore();
    notify('Removed from your preview workspace');
  }
  function askDelete() {
    if (Platform.OS === 'web') setConfirmDelete(true);
    else
      Alert.alert(
        'Remove this file?',
        'It will be removed from your preview library. Your original device file is unchanged.',
        [
          { text: 'Keep file', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: remove },
        ],
      );
  }
  return (
    <Screen title="File details" back>
      {file.kind === 'image' && file.uri ? (
        <Image
          source={file.uri}
          style={{ height: 300, borderRadius: 20, backgroundColor: c.line }}
          contentFit="contain"
        />
      ) : (
        <Surface style={{ alignItems: 'center', paddingVertical: 45 }}>
          <FileText size={65} color={c.primary} />
          <Label>{file.kind === 'folder' ? 'Folder' : fileSize(file.bytes)}</Label>
        </Surface>
      )}
      <Surface>
        <Label selectable style={{ fontWeight: '700' }}>
          {file.name}
        </Label>
        <Label style={{ color: c.muted, fontSize: 12 }}>
          {file.kind} · {fileSize(file.bytes)} · Added{' '}
          {new Date(file.createdAt).toLocaleDateString()}
        </Label>
      </Surface>
      <Field label="File name" value={name} onChangeText={setName} maxLength={120} />
      <Button title="Save name" variant="soft" onPress={rename} />
      {file.kind !== 'folder' && (
        <Button
          title="Export / share file"
          icon={Share2}
          onPress={() => void share()}
          variant="outline"
        />
      )}
      <Button title="Remove from library" icon={Trash2} onPress={askDelete} variant="outline" />
      {confirmDelete && (
        <Surface>
          <Label>Remove this file from your preview library?</Label>
          <View style={{ gap: 8 }}>
            <Button title="Yes, remove file" variant="danger" onPress={remove} />
            <Button title="Keep file" variant="outline" onPress={() => setConfirmDelete(false)} />
          </View>
        </Surface>
      )}
      <ErrorNote message={error} />
    </Screen>
  );
}
