import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, FileMode, type FileHandle } from 'expo-file-system';
import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { allocateVideo, checked } from '@/data/live/backend';
import { blobSource, transferTus, type UploadSource } from './tus';

interface Intent {
  fileId?: string;
  url?: string;
  bucket?: string;
  path?: string;
  expiresAt: string;
}
export async function pickedSource(asset: DocumentPickerAsset): Promise<UploadSource> {
  const source =
    Platform.OS === 'web'
      ? blobSource(asset.file ?? (await (await fetch(asset.uri)).blob()))
      : nativeSource(new File(asset.uri));
  if (!Number.isSafeInteger(source.size) || source.size <= 0)
    throw new Error('Choose a nonempty file with a readable size.');
  return source;
}

/** Reads each chunk straight from the file on the phone, never the whole file. */
function nativeSource(file: File): UploadSource {
  let handle: FileHandle | null = null;
  return {
    size: file.size,
    async read(start, end) {
      handle ??= file.open(FileMode.ReadOnly);
      handle.offset = start;
      const bytes = await handle.readBytes(end - start);
      if (bytes.length !== end - start)
        throw new Error('The file could not be read. Choose it again.');
      return bytes;
    },
    close() {
      handle?.close();
      handle = null;
    },
  };
}
/**
 * The picker copies each chosen file into the app's cache so it can be read. A video
 * can be several gigabytes, so the copy is removed as soon as it is no longer needed.
 */
export function discardPickedCopy(asset: DocumentPickerAsset) {
  if (Platform.OS === 'web') return;
  try {
    new File(asset.uri).delete();
  } catch {
    // Already gone, or not ours to delete; the system clears the cache when space is short.
  }
}
export async function uploadLiveFile(
  asset: DocumentPickerAsset,
  titleId: string | undefined,
  progress: (fraction: number) => void,
  signal: AbortSignal,
) {
  const source = await pickedSource(asset);
  try {
    await uploadPicked(asset, source, titleId, progress, signal);
  } finally {
    source.close?.();
  }
}

async function uploadPicked(
  asset: DocumentPickerAsset,
  source: UploadSource,
  titleId: string | undefined,
  progress: (fraction: number) => void,
  signal: AbortSignal,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in before uploading.');
  const key = `cloudlynk.upload.v1:${session.user.id}:${titleId ?? 'drive'}:${asset.name}:${source.size}:${asset.lastModified ?? 0}`;
  const raw = await AsyncStorage.getItem(key);
  let intent: Intent | null = null;
  try {
    intent = raw ? (JSON.parse(raw) as Intent) : null;
  } catch {
    /* Start a fresh reservation. */
  }
  if (!intent || Date.parse(intent.expiresAt) <= Date.now()) {
    if (titleId) {
      const allocation = await allocateVideo(titleId, source.size);
      intent = { url: allocation.uploadURL, expiresAt: allocation.expiresAt };
    } else {
      const reservation = checked(
        await supabase
          .rpc('reserve_drive_upload', {
            p_name: asset.name,
            p_mime_type: asset.mimeType ?? 'application/octet-stream',
            p_size_bytes: source.size,
          })
          .single(),
      );
      if (!reservation) throw new Error('Upload reservation failed.');
      intent = {
        fileId: reservation.file_id,
        bucket: reservation.bucket,
        path: reservation.storage_path,
        expiresAt: reservation.expires_at,
      };
    }
    await AsyncStorage.setItem(key, JSON.stringify(intent));
  }
  // Read the sign-in token for every request: a large upload outlives the one it started with.
  const headers = async (): Promise<Record<string, string>> => {
    if (titleId) return {};
    const fresh = (await supabase.auth.getSession()).data.session;
    return {
      authorization: `Bearer ${fresh?.access_token ?? session.access_token}`,
      apikey: env.supabaseAnonKey,
      'x-upsert': 'true',
    };
  };
  const reauth = titleId
    ? undefined
    : async () => {
        const { error } = await supabase.auth.refreshSession();
        if (error) throw new Error('Your session ended. Sign in again, then retry the upload.');
      };
  if (!titleId && intent.fileId) {
    const row = checked(
      await supabase
        .from('files')
        .select('status,storage_path,expires_at')
        .eq('id', intent.fileId)
        .maybeSingle(),
    );
    if (!row || !['pending', 'ready'].includes(row.status)) {
      // The earlier upload of this file was cancelled: forget it and start a new one.
      await AsyncStorage.removeItem(key);
      return uploadPicked(asset, source, titleId, progress, signal);
    }
    if (row.status === 'ready') {
      await AsyncStorage.removeItem(key);
      progress(1);
      return;
    }
    if (intent.path !== row.storage_path)
      throw new Error('The reservation does not match this file. Cancel it and start again.');
  }
  if (!titleId && intent.fileId && intent.bucket !== 'user-files')
    throw new Error('The upload bucket was rejected.');
  if (!intent.url) {
    const endpoint = `${env.supabaseUrl.replace(/\/$/, '')}/storage/v1/upload/resumable`;
    const response = await expoFetch(endpoint, {
      method: 'POST',
      headers: {
        ...(await headers()),
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(source.size),
        'Upload-Metadata': `bucketName ${btoa(intent.bucket!)},objectName ${btoa(intent.path!)},contentType ${btoa(asset.mimeType ?? 'application/octet-stream')}`,
      },
      signal,
    });
    const location = response.headers.get('Location');
    if (!response.ok || !location)
      throw new Error('Could not start the file transfer. Please retry.');
    const url = new URL(location, endpoint);
    if (url.origin !== new URL(env.supabaseUrl).origin)
      throw new Error('The upload destination was rejected.');
    intent.url = url.href;
    await AsyncStorage.setItem(key, JSON.stringify(intent));
  }
  const destination = new URL(intent.url);
  if (titleId) {
    if (
      destination.protocol !== 'https:' ||
      !['upload.videodelivery.net', 'upload.cloudflarestream.com'].includes(destination.hostname)
    ) {
      throw new Error('The video upload destination was rejected.');
    }
  } else if (
    destination.origin !== new URL(env.supabaseUrl).origin ||
    !destination.pathname.startsWith('/storage/v1/upload/resumable/')
  ) {
    throw new Error('The file upload destination was rejected.');
  }
  await transferTus(
    source,
    intent.url,
    headers,
    progress,
    signal,
    expoFetch as typeof fetch,
    reauth,
  );
  if (intent.fileId)
    checked(await supabase.rpc('finalize_drive_upload', { p_file_id: intent.fileId }));
  await AsyncStorage.removeItem(key);
}
