import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { COVER_EXTENSIONS, MAX_COVER_BYTES, coverMimeType } from '@/domain/cover-image';
import { supabase } from '@/lib/supabase';

/**
 * Uploads a cover image to the public 'covers' bucket and returns its https URL,
 * ready to store as a channel or title cover. Only publishers and admins may upload.
 */
export async function uploadCoverImage(image: {
  uri: string;
  mimeType?: string | null;
}): Promise<string> {
  const mimeType = coverMimeType(image);
  if (!mimeType) throw new Error('Choose a JPEG, PNG or WebP image.');
  const extension = COVER_EXTENSIONS[mimeType];

  const body =
    Platform.OS === 'web'
      ? await (await fetch(image.uri)).arrayBuffer()
      : await new File(image.uri).arrayBuffer();
  if (body.byteLength === 0) throw new Error('That image is empty. Choose another one.');
  if (body.byteLength > MAX_COVER_BYTES) throw new Error('Choose an image under 5 MB.');

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in before adding a cover image.');

  const path = `${session.user.id}/${randomUUID()}.${extension}`;
  const covers = supabase.storage.from('covers');
  const { error } = await covers.upload(path, body, { contentType: mimeType });
  if (error) {
    if (/bucket not found/i.test(error.message))
      throw new Error('Cover uploads are not set up on the server yet.');
    if (/row-level security|unauthorized|403/i.test(error.message))
      throw new Error('Only publishers and admins can add cover images.');
    throw new Error('The image could not be uploaded. Please try again.');
  }
  return covers.getPublicUrl(path).data.publicUrl;
}
