import type { Workspace } from '@/domain/models';

type Row = Record<string, unknown>;
function isRow(value: unknown): value is Row {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function rows(value: unknown, valid: (row: Row) => boolean): boolean {
  return Array.isArray(value) && value.every((item) => isRow(item) && valid(item));
}
const text = (row: Row, key: string) => typeof row[key] === 'string';
const number = (row: Row, key: string) => typeof row[key] === 'number' && Number.isFinite(row[key]);
const strings = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** Treat saved JSON as untrusted input. An invalid snapshot never crashes a route. */
export function parseWorkspace(raw: string): Workspace | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRow(value) || value.version !== 1) return null;
    if (
      value.profile !== null &&
      (!isRow(value.profile) ||
        !text(value.profile, 'id') ||
        !text(value.profile, 'name') ||
        !text(value.profile, 'email') ||
        !['member', 'admin'].includes(String(value.profile.role)) ||
        !['active', 'restricted'].includes(String(value.profile.accountStatus)))
    )
      return null;
    if (
      !rows(
        value.channels,
        (row) =>
          ['id', 'name', 'description', 'cover', 'ownerId'].every((key) => text(row, key)) &&
          number(row, 'members') &&
          ['All', 'Travel', 'Films', 'Design', 'Music', 'Lifestyle'].includes(
            String(row.category),
          ) &&
          ['public', 'premium', 'private'].includes(String(row.visibility)) &&
          ['published', 'pending', 'hidden'].includes(String(row.status)),
      )
    )
      return null;
    if (
      !rows(
        value.videos,
        (row) =>
          ['id', 'channelId', 'title', 'description', 'cover', 'duration', 'publishedAt'].every(
            (key) => text(row, key),
          ) &&
          number(row, 'views') &&
          (row.demoUri === undefined || text(row, 'demoUri')),
      )
    )
      return null;
    if (
      !rows(
        value.files,
        (row) =>
          ['id', 'name', 'createdAt'].every((key) => text(row, key)) &&
          number(row, 'bytes') &&
          Number(row.bytes) >= 0 &&
          ['folder', 'image', 'video', 'document'].includes(String(row.kind)) &&
          (row.uri === undefined || text(row, 'uri')) &&
          (row.parentId === undefined || text(row, 'parentId')),
      )
    )
      return null;
    if (
      !strings(value.joinedIds) ||
      !strings(value.savedIds) ||
      !isRow(value.progress) ||
      !Object.values(value.progress).every(
        (seconds) => typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0,
      )
    )
      return null;
    if (value.demoPlanId !== null && !['monthly', 'annual'].includes(String(value.demoPlanId)))
      return null;
    if (typeof value.noticesRead !== 'boolean') return null;
    // Additive migration for snapshots created before preview reporting shipped.
    value.reports ??= [];
    if (
      !rows(
        value.reports,
        (row) =>
          ['id', 'videoId', 'reason', 'details', 'createdAt'].every((key) => text(row, key)) &&
          typeof row.resolved === 'boolean',
      )
    )
      return null;
    return value as unknown as Workspace;
  } catch {
    return null;
  }
}
