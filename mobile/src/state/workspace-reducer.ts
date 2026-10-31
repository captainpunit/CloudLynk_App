import type { Profile, Workspace } from '@/domain/models';

/** Local mirror of server state. Every action follows a successful backend call or refresh. */
export type WorkspaceAction =
  | { type: 'hydrate'; value: Workspace }
  | { type: 'identity'; profile: Profile | null; joinedIds?: string[] }
  | { type: 'membership'; id: string; joined: boolean }
  | { type: 'bookmark-set'; id: string; saved: boolean }
  | { type: 'progress'; id: string; seconds: number; completed?: boolean };

export function workspaceReducer(state: Workspace, action: WorkspaceAction): Workspace {
  switch (action.type) {
    case 'hydrate':
      return action.value;
    case 'identity':
      return { ...state, profile: action.profile, joinedIds: action.joinedIds ?? state.joinedIds };
    case 'membership':
      return {
        ...state,
        joinedIds: action.joined
          ? [...new Set([...state.joinedIds, action.id])]
          : state.joinedIds.filter((id) => id !== action.id),
      };
    case 'bookmark-set':
      return {
        ...state,
        savedIds: action.saved
          ? [...new Set([...state.savedIds, action.id])]
          : state.savedIds.filter((id) => id !== action.id),
      };
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
  }
}
