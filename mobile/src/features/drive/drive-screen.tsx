import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  Cloud,
  File as FileIcon,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  type LucideIcon,
} from 'lucide-react-native';
import {
  Button,
  Caption,
  EmptyState,
  ErrorNote,
  Label,
  ListRow,
  Pill,
  Rail,
  Screen,
  SearchField,
  StatusBadge,
  Surface,
} from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { fileSize } from '@/domain/format';
import { call } from '@/data/live/backend';
import { usePalette } from '@/theme/tone';
import { radius } from '@/theme/tokens';

const FILTERS = ['All', 'Image', 'Video', 'Audio', 'Document'] as const;
const KIND_ICON: Record<string, LucideIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
};
const KIND_NAME: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
};

export default function DriveScreen() {
  const { state, refresh, refreshing, error: loadError, requireIdentity } = useWorkspace();
  const p = usePalette();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const usage = state.driveUsage;
  const files = state.files.filter(
    (file) =>
      file.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (filter === 'All' || file.kind === filter.toLowerCase()),
  );
  const hasFiles = state.files.length > 0;
  const usedShare =
    usage && usage.quota_bytes > 0 ? Math.min(1, usage.used_bytes / usage.quota_bytes) : 0;

  if (!state.profile) {
    return (
      <Screen title="My cloud" subtitle="Private storage that only you can see.">
        <EmptyState
          icon={Cloud}
          title="Sign in to open your cloud"
          body="Keep photos, videos and documents in your account and open them on any phone."
          action="Sign in"
          onPress={requireIdentity}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="My cloud"
      subtitle="Private storage that only you can see."
      refreshing={refreshing}
      onRefresh={() => void refresh()}
    >
      {usage && (
        <Surface style={{ gap: 8 }}>
          <Label variant="subhead">
            {fileSize(usage.used_bytes)} of {fileSize(usage.quota_bytes)} used
          </Label>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Storage used"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(usedShare * 100) }}
            style={{
              height: 6,
              borderRadius: radius.pill,
              backgroundColor: p.raised,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${usedShare * 100}%`,
                height: '100%',
                backgroundColor: usedShare > 0.9 ? p.danger : p.action,
              }}
            />
          </View>
          <Caption>
            Files up to {fileSize(usage.max_file_bytes)} each
            {usage.reserved_bytes > 0
              ? ` · ${fileSize(usage.reserved_bytes)} held for unfinished uploads`
              : ''}
          </Caption>
          {!usage.can_upload && (
            <Label variant="callout" tone="warning">
              Your cloud is full. Delete files to upload more.
            </Label>
          )}
        </Surface>
      )}
      <Button
        title="Upload files"
        disabled={!usage?.can_upload}
        onPress={() => router.push('/upload')}
      />
      <ErrorNote message={error ?? loadError} />
      {hasFiles && (
        <>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search your files" />
          <Rail gap={8}>
            {FILTERS.map((value) => (
              <Pill
                key={value}
                title={value}
                selected={filter === value}
                onPress={() => setFilter(value)}
              />
            ))}
          </Rail>
        </>
      )}
      {!hasFiles ? (
        <EmptyState
          icon={Cloud}
          title="Your cloud is empty"
          body="Upload photos, videos and documents. Only you can see them."
        />
      ) : !files.length ? (
        <EmptyState title="No matching files" body="Try another name or file type." />
      ) : (
        <View>
          {files.map((file) =>
            file.status === 'pending' ? (
              <Surface key={file.id} style={{ gap: 8, marginVertical: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Label numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>
                    {file.name}
                  </Label>
                  <StatusBadge label="Unfinished" tone="warning" />
                </View>
                <Caption>
                  {fileSize(file.bytes)}. Choose the same file on the upload screen to carry on.
                </Caption>
                <Button
                  compact
                  title="Cancel upload"
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
              </Surface>
            ) : (
              <ListRow
                key={file.id}
                icon={KIND_ICON[file.kind] ?? FileIcon}
                title={file.name}
                detail={`${fileSize(file.bytes)} · ${KIND_NAME[file.kind] ?? 'File'}`}
                onPress={() => router.push({ pathname: '/file/[id]', params: { id: file.id } })}
              />
            ),
          )}
        </View>
      )}
    </Screen>
  );
}
