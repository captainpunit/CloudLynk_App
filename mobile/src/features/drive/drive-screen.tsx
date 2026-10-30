import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Cloud, FileText, Folder, FolderPlus, ImageIcon, Plus, Video } from 'lucide-react-native';
import {
  Button,
  EmptyState,
  ErrorNote,
  Field,
  IconButton,
  Label,
  Pill,
  Screen,
  SearchField,
  Section,
  Surface,
} from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { colors as c } from '@/theme/tokens';
import { createId, fileSize } from '@/domain/format';
import LiveDrive from './live-drive';

const fileIcons = { image: ImageIcon, video: Video, document: FileText, folder: Folder };
export default function DriveScreen() {
  const { parentId } = useLocalSearchParams<{ parentId?: string }>();
  const { state, demo, dispatch, requireIdentity } = useWorkspace();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [folderForm, setFolderForm] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const total = state.files.reduce((sum, file) => sum + file.bytes, 0);
  const quota = (state.demoPlanId ? 2 * 1024 : 10) * 1024 ** 3;
  const files = state.files.filter(
    (file) =>
      file.parentId === parentId &&
      file.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'All' || `${file.kind}s` === filter.toLowerCase()),
  );
  function addFolder() {
    if (!requireIdentity()) return;
    if (!folderName.trim()) {
      setError('Give your folder a name.');
      return;
    }
    try {
      if (
        state.files.some(
          (file) =>
            file.parentId === parentId &&
            file.name.toLowerCase() === folderName.trim().toLowerCase(),
        )
      )
        throw new Error('A file or folder with that name already exists here.');
      dispatch({
        type: 'files-added',
        files: [
          {
            id: createId('folder'),
            name: folderName.trim(),
            kind: 'folder',
            bytes: 0,
            createdAt: new Date().toISOString(),
            parentId,
          },
        ],
      });
      setFolderForm(false);
      setFolderName('');
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create folder.');
    }
  }
  if (!demo) return <LiveDrive />;
  return (
    <Screen
      title={
        parentId
          ? (state.files.find((file) => file.id === parentId)?.name ?? 'Folder')
          : 'A home for your files.'
      }
      subtitle="Your memories. Your projects. Your space."
      back={!!parentId}
      action={
        <IconButton
          icon={Plus}
          label="Upload files"
          onPress={() => {
            if (requireIdentity()) router.push({ pathname: '/upload', params: { parentId } });
          }}
        />
      }
    >
      <View style={{ backgroundColor: c.dark, borderRadius: 23, padding: 23, gap: 18 }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Cloud size={29} color="#A7D4C5" />
          <Label style={{ color: c.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1.3 }}>
            {state.demoPlanId ? 'PLUS SPACE' : 'YOUR PERSONAL SPACE'}
          </Label>
        </View>
        <View>
          <Label style={{ fontSize: 30, lineHeight: 37, fontWeight: '700', color: c.white }}>
            {fileSize(total)}
            <Label style={{ color: '#99B6AD', fontSize: 13 }}> / {fileSize(quota)}</Label>
          </Label>
          <Label style={{ color: '#ABC3BA', fontSize: 11 }}>
            Local preview storage · not backed up to cloud
          </Label>
        </View>
        <View style={{ height: 5, backgroundColor: '#FFFFFF20', borderRadius: 5 }}>
          <View
            style={{
              width: `${Math.min(100, Math.max(1, (total / quota) * 100))}%`,
              height: 5,
              backgroundColor: c.accent,
              borderRadius: 5,
            }}
          />
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/premium')}>
          <Label style={{ color: '#DCEAE3', fontSize: 12 }}>
            Need a little more room? Explore Plus ↗
          </Label>
        </Pressable>
      </View>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search your files" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {['All', 'Images', 'Videos', 'Documents', 'Folders'].map((item) => (
          <Pill
            key={item}
            title={item}
            selected={filter === item}
            onPress={() => setFilter(item)}
          />
        ))}
      </View>
      <Section
        title="Your files"
        action="New folder"
        onPress={() => {
          if (requireIdentity()) setFolderForm(!folderForm);
        }}
      />
      {folderForm && (
        <Surface>
          <Field
            label="Folder name"
            value={folderName}
            onChangeText={setFolderName}
            maxLength={80}
          />
          <Button title="Create folder" icon={FolderPlus} onPress={addFolder} />
        </Surface>
      )}
      <ErrorNote message={error} />
      {!files.length ? (
        <EmptyState
          icon={Cloud}
          title={query ? 'No files match your search' : 'A fresh start for your space'}
          body={
            query
              ? 'Try a different name or file category.'
              : 'Add your first photo, video or document. Everything has a place here.'
          }
          action="Add your first file"
          onPress={() => {
            if (requireIdentity()) router.push({ pathname: '/upload', params: { parentId } });
          }}
        />
      ) : (
        <View style={{ gap: 10 }}>
          {files.map((file) => {
            const Icon = fileIcons[file.kind];
            return (
              <Pressable
                key={file.id}
                accessibilityLabel={`Open ${file.name}`}
                accessibilityRole="button"
                accessibilityHint="Long press to rename or remove"
                onLongPress={() => router.push({ pathname: '/file/[id]', params: { id: file.id } })}
                onPress={() =>
                  file.kind === 'folder'
                    ? router.push({ pathname: '/cloud', params: { parentId: file.id } })
                    : router.push({ pathname: '/file/[id]', params: { id: file.id } })
                }
                style={{
                  backgroundColor: c.surface,
                  borderRadius: 16,
                  padding: 15,
                  borderWidth: 1,
                  borderColor: c.line,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 13,
                }}
              >
                <View style={{ backgroundColor: c.primarySoft, padding: 13, borderRadius: 13 }}>
                  <Icon size={23} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Label numberOfLines={1} style={{ fontWeight: '600', fontSize: 13 }}>
                    {file.name}
                  </Label>
                  <Label style={{ fontSize: 11, color: c.muted }}>
                    {file.kind === 'folder' ? 'Folder' : fileSize(file.bytes)} ·{' '}
                    {new Date(file.createdAt).toLocaleDateString()}
                  </Label>
                </View>
                <Label style={{ color: c.muted }}>↗</Label>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
