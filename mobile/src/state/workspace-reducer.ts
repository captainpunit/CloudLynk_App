import type { Channel, ContentReport, DriveFile, Profile, Video, Workspace } from '@/domain/models';

export type WorkspaceAction =
  | { type: 'hydrate'; value: Workspace }
  | { type: 'identity'; profile: Profile | null; joinedIds?: string[] }
  | { type: 'catalogue'; channels: Channel[] }
  | { type: 'membership'; id: string; joined: boolean }
  | { type: 'bookmark'; id: string }
  | { type: 'bookmark-set'; id: string; saved: boolean }
  | { type: 'files-added'; files: DriveFile[] }
  | { type: 'file-renamed'; id: string; name: string }
  | { type: 'file-deleted'; id: string }
  | { type: 'channel-added'; channel: Channel }
  | {
      type: 'channel-updated';
      id: string;
      changes: Partial<Pick<Channel, 'visibility' | 'status'>>;
    }
  | { type: 'video-added'; video: Video }
  | { type: 'progress'; id: string; seconds: number; completed?: boolean }
  | { type: 'demo-plan'; id: string | null }
  | { type: 'notices-read' };
// Report actions stay local in preview; production needs the moderation API.
export type ReportAction =
  { type: 'report-added'; report: ContentReport } | { type: 'report-resolved'; id: string };

export function workspaceReducer(
  state: Workspace,
  action: WorkspaceAction | ReportAction,
): Workspace {
  switch (action.type) {
    case 'hydrate':
      return action.value;
    case 'identity':
      return { ...state, profile: action.profile, joinedIds: action.joinedIds ?? state.joinedIds };
    case 'catalogue':
      return { ...state, channels: action.channels };
    case 'membership':
      return {
        ...state,
        joinedIds: action.joined
          ? [...new Set([...state.joinedIds, action.id])]
          : state.joinedIds.filter((id) => id !== action.id),
      };
    case 'bookmark':
      return {
        ...state,
        savedIds: state.savedIds.includes(action.id)
          ? state.savedIds.filter((id) => id !== action.id)
          : [...state.savedIds, action.id],
      };
    case 'bookmark-set':
      return {
        ...state,
        savedIds: action.saved
          ? [...new Set([...state.savedIds, action.id])]
          : state.savedIds.filter((id) => id !== action.id),
      };
    case 'files-added':
      return { ...state, files: [...action.files, ...state.files] };
    case 'file-renamed':
      return {
        ...state,
        files: state.files.map((file) =>
          file.id === action.id ? { ...file, name: action.name } : file,
        ),
      };
    case 'file-deleted': {
      const removed = new Set([action.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const file of state.files) {
          if (file.parentId && removed.has(file.parentId) && !removed.has(file.id)) {
            removed.add(file.id);
            changed = true;
          }
        }
      }
      return { ...state, files: state.files.filter((file) => !removed.has(file.id)) };
    }
    case 'channel-added':
      return { ...state, channels: [action.channel, ...state.channels] };
    case 'channel-updated':
      return {
        ...state,
        channels: state.channels.map((channel) =>
          channel.id === action.id ? { ...channel, ...action.changes } : channel,
        ),
      };
    case 'video-added':
      return { ...state, videos: [action.video, ...state.videos] };
    case 'progress':
      return {
        ...state,
        progress: { ...state.progress, [action.id]: Math.max(0, action.seconds) },
        ...(action.completed === undefined
          ? {}
          : {
              completedIds: action.completed
                ? [...new Set([...(state.completedIds ?? []), action.id])]
                : (state.completedIds ?? []).filter((id) => id !== action.id),
            }),
      };
    case 'demo-plan':
      return { ...state, demoPlanId: action.id };
    case 'notices-read':
      return { ...state, noticesRead: true };
    case 'report-added':
      return { ...state, reports: [action.report, ...state.reports] };
    case 'report-resolved':
      return {
        ...state,
        reports: state.reports.map((report) =>
          report.id === action.id ? { ...report, resolved: true } : report,
        ),
      };
  }
}
