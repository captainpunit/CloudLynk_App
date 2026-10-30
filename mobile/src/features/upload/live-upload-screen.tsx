import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  Button,
  EmptyState,
  ErrorNote,
  Field,
  Label,
  Pill,
  Screen,
  Section,
  Surface,
} from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import { call } from '@/data/live/backend';
import { readPages } from '@/data/live/mapping';
import { uploadLiveFile } from '@/services/uploads/live-upload';

type Title = Tables<'titles'>;
type Asset = { title_id: string | null; state: string | null; error_code: string | null };

export default function LiveUploadScreen({ channelId }: { channelId?: string }) {
  const { state, requireIdentity, refresh, notify } = useWorkspace();
  const channel = state.channels.find((item) => item.id === channelId);
  const [titles, setTitles] = useState<Title[]>([]);
  const [seasons, setSeasons] = useState<Tables<'seasons'>[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [titleId, setTitleId] = useState('');
  const [kind, setKind] = useState<'movie' | 'series' | 'episode'>('movie');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState('');
  const [minAge, setMinAge] = useState('0');
  const [countries, setCountries] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('1');
  const [seriesId, setSeriesId] = useState('');
  const [seasonName, setSeasonName] = useState('');
  const [seasonNumber, setSeasonNumber] = useState('1');
  const [selected, setSelected] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const current = titles.find((item) => item.id === titleId);
  const asset = assets.find((item) => item.title_id === titleId);
  const canPublish =
    state.profile?.role === 'admin' ||
    (state.profile?.canPublish && channel?.ownerId === state.profile.id);
  const load = useCallback(async () => {
    if (!channelId) return;
    const [rows, seasonRows, uploads] = await Promise.all([
      readPages((from, to) =>
        supabase.from('titles').select('*').eq('channel_id', channelId).order('id').range(from, to),
      ),
      readPages((from, to) => supabase.from('seasons').select('*').order('id').range(from, to)),
      readPages((from, to) =>
        supabase.from('my_stream_uploads').select('*').order('id').range(from, to),
      ),
    ]);
    setTitles(rows);
    setSeasons(seasonRows);
    setAssets(uploads);
  }, [channelId]);
  useEffect(() => {
    void load().catch(() => setError('Publishing data could not load. Please refresh.'));
    const timer = setInterval(() => {
      void load().catch(() => {});
    }, 15000);
    return () => {
      clearInterval(timer);
      abort.current?.abort();
    };
  }, [load]);

  async function action(work: () => Promise<unknown>, message: string) {
    if (busy || !requireIdentity()) return;
    setBusy(true);
    setError(null);
    try {
      await work();
      await load();
      await refresh();
      notify(message);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(title?: Title) {
    setTitleId(title?.id ?? '');
    setKind((title?.kind as typeof kind) ?? 'movie');
    setName(title?.name ?? '');
    setDescription(title?.description ?? '');
    setCover(title?.cover_url ?? '');
    setMinAge(String(title?.min_age ?? 0));
    setCountries(title?.allowed_countries.join(', ') ?? '');
    setSeasonId(title?.season_id ?? '');
    setEpisodeNumber(String(title?.episode_number ?? 1));
    setSelected([]);
    setConfirmReset(false);
    setProgress(0);
    setError(null);
  }
  async function save() {
    if (!channelId) return;
    if (!/^\d+$/.test(minAge) || +minAge > 21 || !name.trim())
      throw new Error('Enter a title and a minimum age from 0 to 21.');
    if (kind === 'episode' && (!seasonId || !/^[1-9]\d*$/.test(episodeNumber)))
      throw new Error('Choose a season and a positive episode number.');
    const territory = countries
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    if (territory.some((value) => !/^[A-Z]{2}$/.test(value)))
      throw new Error('Enter country codes such as IN, US, or leave the list empty.');
    const row = await call('save_title', {
      p_channel_id: channelId,
      p_kind: kind,
      p_name: name.trim(),
      p_description: description,
      p_min_age: +minAge,
      p_countries: territory,
      ...(titleId ? { p_title_id: titleId } : {}),
      ...(cover ? { p_cover_url: cover } : {}),
      ...(kind === 'episode' ? { p_season_id: seasonId, p_episode_number: +episodeNumber } : {}),
    });
    // The RPC returns the canonical draft. Retrying an upload reuses this title.
    if (!row || Array.isArray(row) || typeof row !== 'object' || !('id' in row))
      throw new Error('The draft could not be confirmed. Refresh before retrying.');
    setTitleId(String(row.id));
  }
  async function pick() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: channelId ? 'video/*' : '*/*',
        multiple: !channelId,
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        setSelected(result.assets);
        setProgress(0);
      }
    } catch {
      setError('The file picker could not open.');
    }
  }
  async function upload() {
    if (channelId && (!current || current.kind === 'series'))
      throw new Error('Save and select a movie or episode draft before uploading.');
    if (!selected.length) throw new Error('Choose a file first.');
    const controller = new AbortController();
    abort.current = controller;
    for (let index = 0; index < selected.length; index++) {
      await uploadLiveFile(
        selected[index],
        channelId ? titleId : undefined,
        (fraction) => setProgress(Math.round(((index + fraction) / selected.length) * 100)),
        controller.signal,
      );
    }
    setSelected([]);
  }
  if (!state.profile)
    return (
      <Screen title="Upload" back>
        <Button title="Sign in to upload" onPress={requireIdentity} />
      </Screen>
    );
  if (channelId && (!channel || !canPublish))
    return (
      <Screen title="Publishing" back>
        <EmptyState
          title="Publishing access required"
          body="Choose a channel you own and ask an administrator for publishing permission."
        />
      </Screen>
    );
  return (
    <Screen title={channelId ? `Publish to ${channel?.name}` : 'Upload to your cloud'} back>
      <ErrorNote message={error} />
      {channelId && (
        <>
          <Section title="Your titles" />
          <Button title="New title" variant="outline" disabled={busy} onPress={() => edit()} />
          {titles.map((title) => (
            <Button
              key={title.id}
              title={`${title.name} · ${title.kind} · ${title.status}`}
              variant={titleId === title.id ? 'soft' : 'outline'}
              disabled={busy}
              onPress={() => edit(title)}
            />
          ))}
          <Surface>
            <Label>{current ? `Editing ${current.status}` : 'New draft'}</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(['movie', 'series', 'episode'] as const).map((value) => (
                <Pill
                  key={value}
                  title={value}
                  selected={kind === value}
                  onPress={() => {
                    if (!titleId && !busy) setKind(value);
                  }}
                />
              ))}
            </View>
            <Field label="Title" value={name} onChangeText={setName} maxLength={200} />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={10000}
            />
            <Field
              label="Cover image URL (https, optional)"
              value={cover}
              onChangeText={setCover}
              autoCapitalize="none"
            />
            <Field
              label="Minimum age (0–21)"
              value={minAge}
              onChangeText={setMinAge}
              keyboardType="number-pad"
            />
            <Field
              label="Allowed countries (comma-separated codes; empty means worldwide)"
              value={countries}
              onChangeText={setCountries}
              autoCapitalize="characters"
            />
            {kind === 'episode' && (
              <>
                <Label>Choose a season</Label>
                {seasons
                  .filter((season) => titles.some((title) => title.id === season.series_id))
                  .map((season) => (
                    <Button
                      key={season.id}
                      title={`${titles.find((title) => title.id === season.series_id)?.name}: ${season.name}`}
                      variant={seasonId === season.id ? 'soft' : 'outline'}
                      disabled={busy}
                      onPress={() => setSeasonId(season.id)}
                    />
                  ))}
                <Field
                  label="Episode number"
                  value={episodeNumber}
                  onChangeText={setEpisodeNumber}
                  keyboardType="number-pad"
                />
              </>
            )}
            <Button
              title="Save draft"
              disabled={!!current && !['draft', 'rejected'].includes(current.status)}
              loading={busy}
              onPress={() => void action(save, 'Draft saved.')}
            />
            {current && (
              <>
                <Label>
                  Video:{' '}
                  {asset?.state ??
                    (current.kind === 'series' ? 'Series container' : 'No upload yet')}
                </Label>
                {asset?.error_code && (
                  <Label>Processing failed. Replace the upload and try again.</Label>
                )}
                <Button
                  title="Submit for review"
                  disabled={busy || !['draft', 'rejected'].includes(current.status)}
                  onPress={() =>
                    void action(
                      () => call('submit_title_review', { p_title_id: titleId }),
                      'Submitted for admin review.',
                    )
                  }
                />
                {['archived', 'rejected'].includes(current.status) && (
                  <Button
                    title="Reopen as draft"
                    variant="outline"
                    disabled={busy}
                    onPress={() =>
                      void action(
                        () => call('reopen_title', { p_title_id: titleId }),
                        'Title reopened.',
                      )
                    }
                  />
                )}
                {current.kind !== 'series' &&
                  asset &&
                  ['draft', 'rejected'].includes(current.status) && (
                    <>
                      <Button
                        title="Replace / reset video"
                        variant="outline"
                        disabled={busy}
                        onPress={() => setConfirmReset(true)}
                      />
                      {confirmReset && (
                        <>
                          <Label>This removes the current video and queues it for deletion.</Label>
                          <Button
                            title="Confirm video removal"
                            variant="danger"
                            disabled={busy}
                            onPress={() =>
                              void action(async () => {
                                await call('reset_stream_upload', { p_title_id: titleId });
                                await clearUploadRetry(titleId);
                                setConfirmReset(false);
                              }, 'Video removed. You can upload a replacement.')
                            }
                          />
                        </>
                      )}
                    </>
                  )}
              </>
            )}
          </Surface>
          <Surface>
            <Label>Create or update a season</Label>
            {titles
              .filter((title) => title.kind === 'series')
              .map((series) => (
                <Button
                  key={series.id}
                  title={series.name}
                  variant={seriesId === series.id ? 'soft' : 'outline'}
                  disabled={busy}
                  onPress={() => setSeriesId(series.id)}
                />
              ))}
            <Field
              label="Season number"
              value={seasonNumber}
              onChangeText={setSeasonNumber}
              keyboardType="number-pad"
            />
            <Field
              label="Season name"
              value={seasonName}
              onChangeText={setSeasonName}
              maxLength={200}
            />
            <Button
              title="Save season"
              disabled={busy || !seriesId}
              onPress={() =>
                void action(async () => {
                  if (!/^[1-9]\d*$/.test(seasonNumber) || !seasonName.trim())
                    throw new Error('Enter a season name and a positive number.');
                  await call('save_season', {
                    p_series_id: seriesId,
                    p_number: +seasonNumber,
                    p_name: seasonName.trim(),
                  });
                }, 'Season saved.')
              }
            />
          </Surface>
        </>
      )}
      {(!channelId ||
        (current &&
          current.kind !== 'series' &&
          ['draft', 'rejected'].includes(current.status))) && (
        <Surface>
          <Button title="Choose files" disabled={busy} onPress={() => void pick()} />
          {selected.map((file, index) => (
            <Label key={index}>{file.name}</Label>
          ))}
          <Label>Reselect the same file after an interruption to resume its upload.</Label>
          <Label>{progress}% uploaded</Label>
          <Button
            title="Upload selected files"
            loading={busy}
            disabled={!selected.length}
            onPress={() =>
              void action(
                upload,
                channelId
                  ? 'Upload received. Wait for processing, then submit the title for review.'
                  : 'Files uploaded to your cloud.',
              )
            }
          />
          {busy && (
            <Button title="Pause upload" variant="outline" onPress={() => abort.current?.abort()} />
          )}
        </Surface>
      )}
      {channelId && (
        <Button
          title="Refresh processing status"
          variant="outline"
          disabled={busy}
          onPress={() => void action(load, 'Processing status refreshed.')}
        />
      )}
    </Screen>
  );
}

async function clearUploadRetry(titleId: string) {
  const { default: storage } = await import('@react-native-async-storage/async-storage');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  const prefix = `cloudlynk.upload.v1:${session.user.id}:${titleId}:`;
  const keys = (await storage.getAllKeys()).filter((key) => key.startsWith(prefix));
  if (keys.length) await storage.multiRemove(keys);
}
