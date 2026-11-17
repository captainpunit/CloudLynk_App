/** Image types the 'covers' bucket accepts, with the file extension each is stored under. */
export const COVER_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Matches the 'covers' bucket's file size limit. */
export const MAX_COVER_BYTES = 5 * 1024 * 1024;

/**
 * Returns the cover's MIME type, or null when it is not a supported image.
 * Pickers do not always report a type, so this falls back to the file extension.
 */
export function coverMimeType(image: { uri: string; mimeType?: string | null }): string | null {
  const reported = image.mimeType?.toLowerCase();
  const type = reported
    ? reported === 'image/jpg'
      ? 'image/jpeg'
      : reported
    : extensionType(image.uri);
  return type && type in COVER_EXTENSIONS ? type : null;
}

function extensionType(uri: string): string | null {
  const extension = uri.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return null;
}
