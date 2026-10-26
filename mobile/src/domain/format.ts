export function compactNumber(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(value);
}
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const unit = bytes >= 1024 ** 3 ? 3 : bytes >= 1024 ** 2 ? 2 : 1;
  return `${(bytes / 1024 ** unit).toFixed(1)} ${['B', 'KB', 'MB', 'GB'][unit]}`;
}
export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
export function validateChannel(name: string, description: string): string | null {
  if (name.trim().length < 3) return 'Use at least 3 characters for your channel name.';
  if (name.trim().length > 60) return 'Keep your channel name under 60 characters.';
  if (description.trim().length < 12) return 'Add a description of at least 12 characters.';
  return null;
}
