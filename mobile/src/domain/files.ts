/** Slashes and control characters: what a file name on the phone cannot contain. */
// eslint-disable-next-line no-control-regex
const unsafe = /[/\\\u0000-\u001f]/g;

/**
 * A downloaded file's name on the phone: the original name, in any language, with only
 * the characters a file name cannot contain replaced.
 */
export function downloadName(name: string): string {
  return name.replace(unsafe, '_').trim() || 'file';
}
