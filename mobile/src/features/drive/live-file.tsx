import { useState } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Button, EmptyState, ErrorNote, Label, Screen, Surface } from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { call, checked } from '@/data/live/backend';
import { supabase } from '@/lib/supabase';
import { fileSize } from '@/domain/format';

export default function LiveFile({ id }: { id: string }) {
  const { state, refresh, refreshing, error: loadError, notify } = useWorkspace();
  const file = state.files.find((item) => item.id === id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  async function download() {
    if (!file?.storagePath) return;
    setBusy(true);
    setError(null);
    try {
      const signed = checked(
        await supabase.storage
          .from('user-files')
          .createSignedUrl(file.storagePath, 60, { download: file.name }),
      );
      if (!signed) throw new Error('The file is unavailable.');
      if (Platform.OS === 'web') await Linking.openURL(signed.signedUrl);
      else {
        const target = new File(
          Paths.cache,
          `${file.id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
        );
        const local = await File.downloadFileAsync(signed.signedUrl, target, { idempotent: true });
        try {
          await Sharing.shareAsync(local.uri, { mimeType: file.mimeType });
        } finally {
          if (local.exists) local.delete();
        }
      }
    } catch {
      setError('The file could not be downloaded. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await call('delete_drive_file', { p_file_id: id });
      await refresh();
      router.replace('/cloud');
      notify('File removed from your cloud.');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="File details" back>
      <ErrorNote message={error ?? loadError} />
      {!file ? (
        <>
          <EmptyState
            title="File unavailable"
            body="Refresh your cloud to check its current state."
          />
          <Button title="Refresh" loading={refreshing} onPress={() => void refresh()} />
        </>
      ) : (
        <Surface>
          <Label>{file.name}</Label>
          <Label>
            {fileSize(file.bytes)} · {file.mimeType}
          </Label>
          <Button
            title="Download / export"
            loading={busy}
            disabled={file.status !== 'ready'}
            onPress={() => void download()}
          />
          <Button
            title="Delete from cloud"
            variant="outline"
            disabled={busy}
            onPress={() => setConfirm(true)}
          />
          {confirm && (
            <>
              <Label>Delete this cloud copy? Your original device file is unchanged.</Label>
              <Button
                title="Confirm deletion"
                variant="danger"
                loading={busy}
                onPress={() => void remove()}
              />
              <Button
                title="Keep file"
                variant="soft"
                disabled={busy}
                onPress={() => setConfirm(false)}
              />
            </>
          )}
        </Surface>
      )}
    </Screen>
  );
}
