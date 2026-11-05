import {
  createContext,
  use,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import { router } from 'expo-router';
import {
  checkLiveAccess,
  fetchLiveWorkspace,
  emptyLiveWorkspace,
  setLiveMembership,
} from '@/data/live/cloud-api';
import { accessMessages } from '@/domain/access';
import type { AccessDecision, Workspace } from '@/domain/models';
import { supabase } from '@/lib/supabase';
import { call } from '@/data/live/backend';
import { AppState } from 'react-native';
import { workspaceReducer, type WorkspaceAction } from './workspace-reducer';

interface WorkspaceContextValue {
  state: Workspace;
  dispatch: Dispatch<WorkspaceAction>;
  ready: boolean;
  error: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
  requireIdentity: () => boolean;
  join: (id: string, joined: boolean) => Promise<void>;
  access: (id: string, action: 'join' | 'watch') => Promise<AccessDecision>;
  bookmark: (id: string) => Promise<void>;
  toast: string | null;
  notify: (message: string) => void;
}
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const initialWorkspace = emptyLiveWorkspace();

/** All state comes from the backend; nothing is persisted locally beyond the auth session. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspace);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const generation = useRef(0);
  const identityId = useRef<string | null>(null);
  const pendingBookmarks = useRef(new Set<string>());
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setRefreshing(true);
    setError(null);
    try {
      const snapshot = await fetchLiveWorkspace();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (
        request === generation.current &&
        (session?.user.id ?? null) === (snapshot.profile?.id ?? null)
      ) {
        identityId.current = snapshot.profile?.id ?? null;
        dispatch({ type: 'hydrate', value: snapshot });
      }
    } catch (cause) {
      if (request === generation.current)
        setError(
          cause instanceof Error ? cause.message : 'Could not load your workspace. Try again.',
        );
    } finally {
      if (request === generation.current) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // The launch refresh below already loads the restored session. Resetting here
      // would discard that request and mark the app ready before any data arrived.
      if (event === 'INITIAL_SESSION') return;
      const userId = session?.user.id ?? null;
      if (userId !== identityId.current || event === 'SIGNED_OUT') {
        ++generation.current;
        identityId.current = userId;
        dispatch({ type: 'hydrate', value: emptyLiveWorkspace() });
      }
      if (event !== 'TOKEN_REFRESHED') setTimeout(() => void refresh(), 0);
    });
    const foreground = AppState.addEventListener('change', (status) => {
      if (status === 'active') void refresh();
    });
    return () => {
      subscription.unsubscribe();
      foreground.remove();
      ++generation.current;
    };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await refresh();
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  function requireIdentity() {
    if (state.profile) return true;
    router.push('/auth');
    return false;
  }
  async function access(id: string, action: 'join' | 'watch') {
    return checkLiveAccess(id, action);
  }
  async function join(id: string, joined: boolean) {
    if (!requireIdentity()) return;
    const userId = state.profile?.id;
    if (joined) {
      const decision = await access(id, 'join');
      if (decision === 'subscription_required') {
        router.push('/premium');
        return;
      }
      if (decision !== 'allowed') throw new Error(accessMessages[decision]);
    }
    const before = await supabase.auth.getSession();
    if (before.data.session?.user.id !== userId) return;
    await setLiveMembership(id, joined);
    const after = await supabase.auth.getSession();
    if (after.data.session?.user.id !== userId) return;
    dispatch({ type: 'membership', id, joined });
    setToast(joined ? 'Channel added to your collection' : 'You left the channel');
  }
  async function bookmark(id: string) {
    if (!requireIdentity() || pendingBookmarks.current.has(id)) return;
    const saved = state.savedIds.includes(id);
    pendingBookmarks.current.add(id);
    const userId = state.profile?.id;
    try {
      await call('set_saved_title', { p_title_id: id, p_saved: !saved });
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user.id !== userId) return;
      dispatch({ type: 'bookmark-set', id, saved: !saved });
      setToast(saved ? 'Removed from saved videos' : 'Saved for a little later');
    } finally {
      pendingBookmarks.current.delete(id);
    }
  }
  return (
    <WorkspaceContext
      value={{
        state,
        dispatch,
        ready,
        error,
        refreshing,
        refresh,
        requireIdentity,
        join,
        access,
        bookmark,
        toast,
        notify: setToast,
      }}
    >
      {children}
    </WorkspaceContext>
  );
}
export function useWorkspace() {
  const value = use(WorkspaceContext);
  if (!value) throw new Error('WorkspaceProvider is missing');
  return value;
}
