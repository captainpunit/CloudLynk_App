import { useState } from 'react';
import { router } from 'expo-router';
import {
  Button,
  EmptyState,
  ErrorNote,
  Label,
  Pill,
  Screen,
  SearchField,
  Surface,
} from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { fileSize } from '@/domain/format';
import { call } from '@/data/live/backend';

export default function DriveScreen() {
  const { state, refresh, refreshing, error: loadError, requireIdentity } = useWorkspace();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const usage = state.driveUsage;
  const files = state.files.filter(
    (file) =>
      file.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'All' || file.kind === filter.toLowerCase()),
  );
  return (
    <Screen title="Your cloud files" subtitle="Private files stored in your account.">
      {!state.profile ? (
        <Button title="Sign in to open your cloud" onPress={requireIdentity} />
      ) : (
        <>
          {usage && (
            <Surface>
              <Label>
                {fileSize(usage.used_bytes)} of {fileSize(usage.quota_bytes)} used
              </Label>
              <Label>{fileSize(usage.reserved_bytes)} reserved for unfinished uploads</Label>
              <Label>Maximum file size: {fileSize(usage.max_file_bytes)}</Label>
              {!usage.can_upload && (
                <Label>New uploads are unavailable. Free space or review your plan.</Label>
              )}
            </Surface>
          )}
          <Button
            title="Upload files"
            disabled={!usage?.can_upload}
            onPress={() => router.push('/upload')}
          />
          <SearchField value={query} onChangeText={setQuery} placeholder="Search your files" />
          {['All', 'Image', 'Video', 'Document'].map((value) => (
            <Pill
              key={value}
              title={value}
              selected={filter === value}
              onPress={() => setFilter(value)}
            />
          ))}
          <Button
            title="Refresh files"
            variant="outline"
            loading={refreshing}
            onPress={() => void refresh()}
          />
          <ErrorNote message={error ?? loadError} />
          {!files.length && (
            <EmptyState title="No files found" body="Upload a file or try another search." />
          )}
          {files.map((file) => (
            <Surface key={file.id}>
              <Label>{file.name}</Label>
              <Label>
                {fileSize(file.bytes)} ·{' '}
                {file.status === 'pending' ? 'Unfinished upload' : file.kind}
              </Label>
              {file.status === 'pending' ? (
                <>
                  <Label>
                    Select the same file in Upload files to resume. Expired uploads must be
                    canceled.
                  </Label>
                  <Button
                    title="Cancel unfinished upload"
                    variant="outline"
                    disabled={busy}
                    onPress={() => {
                      setBusy(true);
                      setError(null);
                      void call('delete_drive_file', { p_file_id: file.id })
                        .then(refresh)
                        .catch((cause: Error) => setError(cause.message))
                        .finally(() => setBusy(false));
                    }}
                  />
                </>
              ) : (
                <Button
                  title="Open file"
                  variant="soft"
                  onPress={() => router.push({ pathname: '/file/[id]', params: { id: file.id } })}
                />
              )}
            </Surface>
          ))}
        </>
      )}
    </Screen>
  );
}
