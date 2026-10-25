import { goBackOrExplore } from '@/lib/navigation';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { CheckCircle2, UploadCloud } from 'lucide-react-native';
import { Button, ErrorNote, Field, Label, Screen, Surface } from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { createId, fileSize } from '@/domain/format';
import type { DriveFile } from '@/domain/models';
import { unavailable } from '@/data/live/cloud-api';
import { colors as c } from '@/theme/tokens';
import { covers } from '@/data/demo/seed';

const maxFileBytes = 250 * 1024 ** 2;
export default function UploadScreen() {
  const { parentId, channelId } = useLocalSearchParams<{ parentId?: string; channelId?: string }>();
  const { state, demo, dispatch, requireIdentity, notify } = useWorkspace();
  const [assets, setAssets] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const channel = state.channels.find(
    (item) => item.id === channelId && item.ownerId === state.profile?.id,
  );
  async function pick() {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: channelId ? 'video/*' : '*/*',
        multiple: !channelId,
        copyToCacheDirectory: true,
      });
      if (!result.canceled) setAssets(result.assets);
    } catch {
      setError('The file picker could not open. Check device access and try again.');
    }
  }
  async function submit() {
    if (!requireIdentity()) return;
    if (!assets.length) {
      setError('Choose at least one file first.');
      return;
    }
    if (channelId && (!channel || !caption.trim())) {
      setError('Choose one of your own channels and add a video title.');
      return;
    }
    if (assets.some((asset) => (asset.size ?? 0) > maxFileBytes)) {
      setError('Each preview file must be smaller than 250 MB.');
      return;
    }
    const quota = (state.demoPlanId ? 2 * 1024 : 10) * 1024 ** 3;
    if (
      state.files.reduce((sum, file) => sum + file.bytes, 0) +
        assets.reduce((sum, asset) => sum + (asset.size ?? 0), 0) >
      quota
    ) {
      setError('There is not enough space for these files. Free up space or explore Plus.');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      if (!demo)
        unavailable(
          channelId
            ? 'Publisher upload URLs and processing'
            : 'Quota reservation and cloud uploads',
        );
      const files: DriveFile[] = [];
      for (const [index, asset] of assets.entries()) {
        const id = createId('file');
        let uri = asset.uri;
        if (Platform.OS !== 'web') {
          const destination = new File(
            Paths.document,
            `${id}-${asset.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
          );
          new File(asset.uri).copy(destination);
          uri = destination.uri;
        }
        files.push({
          id,
          name: asset.name,
          bytes: asset.size ?? 0,
          createdAt: new Date().toISOString(),
          uri,
          parentId,
          kind: asset.mimeType?.startsWith('video/')
            ? 'video'
            : asset.mimeType?.startsWith('image/')
              ? 'image'
              : 'document',
        });
        setProgress(Math.round(((index + 1) / assets.length) * 100));
      }
      dispatch({ type: 'files-added', files });
      if (channel && files[0])
        dispatch({
          type: 'video-added',
          video: {
            id: createId('video'),
            channelId: channel.id,
            title: caption.trim(),
            description: 'Uploaded in the local preview workspace.',
            cover: channel.cover || covers.forest,
            duration: 'NEW',
            views: 0,
            publishedAt: new Date().toISOString(),
            demoUri: files[0].uri,
          },
        });
      notify(
        channelId ? 'Video added to your preview channel' : 'Files saved to your local preview',
      );
      goBackOrExplore();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Files could not be saved. Your selection is ready to retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title={channelId ? 'Your next story.' : 'Bring your files home.'}
      subtitle={
        channel ? `Upload to ${channel.name}` : 'Photos, videos, documents. Keep them together.'
      }
      back
    >
      <Surface
        style={{ alignItems: 'center', paddingVertical: 35, borderStyle: 'dashed', gap: 17 }}
      >
        <View style={{ padding: 20, backgroundColor: c.primarySoft, borderRadius: 25 }}>
          <UploadCloud size={35} color={c.primary} />
        </View>
        <Label style={{ fontWeight: '700', fontSize: 18 }}>A little room for everything.</Label>
        <Label style={{ color: c.muted, fontSize: 12 }}>
          Choose files from your device · Up to 250 MB each
        </Label>
        <Button
          title={assets.length ? 'Change selection' : 'Choose files'}
          variant="soft"
          onPress={() => void pick()}
          disabled={busy}
        />
      </Surface>
      {assets.map((asset, index) => (
        <Surface
          key={`${asset.name}-${index}`}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <CheckCircle2 size={20} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Label numberOfLines={1} style={{ fontWeight: '600', fontSize: 13 }}>
              {asset.name}
            </Label>
            <Label style={{ fontSize: 11, color: c.muted }}>{fileSize(asset.size ?? 0)}</Label>
          </View>
        </Surface>
      ))}
      {channelId && (
        <Field
          label="Video title"
          placeholder="Give your story a title"
          value={caption}
          onChangeText={setCaption}
          maxLength={120}
        />
      )}
      <ErrorNote message={error} />
      {busy && <Label accessibilityLiveRegion="polite">Saving files… {progress}%</Label>}
      <Button
        title={demo ? 'Save to preview workspace' : 'Upload securely'}
        icon={UploadCloud}
        loading={busy}
        onPress={() => void submit()}
        disabled={!assets.length}
      />
      <Label style={{ color: c.muted, fontSize: 11 }}>
        {demo
          ? Platform.OS === 'web'
            ? 'Web preview uses browser-local file references. Use Android for durable file copies. No files are sent to a server.'
            : 'Preview mode copies files into this app’s storage on your device. Cloud backup will require the storage API.'
          : 'Uploads require a signed server URL and server-side quota checks.'}
      </Label>
    </Screen>
  );
}
