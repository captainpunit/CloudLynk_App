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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { createDemoWorkspace } from '@/data/demo/seed';
import {
  checkLiveAccess,
  fetchLiveWorkspace,
  emptyLiveWorkspace,
  setLiveMembership,
} from '@/data/live/cloud-api';
import { accessMessages, demoAccess } from '@/domain/access';
import type { AccessDecision, Workspace } from '@/domain/models';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { call } from '@/data/live/backend';
import { AppState } from 'react-native';
import { parseWorkspace } from './persistence';
import { workspaceReducer, type ReportAction, type WorkspaceAction } from './workspace-reducer';

interface WorkspaceContextValue {
  state: Workspace;
  dispatch: Dispatch<WorkspaceAction | ReportAction>;
  ready: boolean;
  error: string | null;
  refreshing: boolean;
  demo: boolean;
  refresh: () => Promise<void>;
  requireIdentity: () => boolean;
  join: (id: string, joined: boolean) => Promise<void>;
  access: (id: string, action: 'join' | 'watch') => Promise<AccessDecision>;
  bookmark: (id: string) => Promise<void>;
  toast: string | null;
  notify: (message: string) => void;
}
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const storageKey = 'cloudlynk.demo-workspace.v1';
const liveSeed = emptyLiveWorkspace();

/** State is hydrated before persistence starts, so launch never overwrites saved data. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const demo = env.mode === 'demo';
  const [state, dispatch] = useReducer(workspaceReducer, demo ? createDemoWorkspace() : liveSeed);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const writeQueue = useRef(Promise.resolve());
  const generation = useRef(0);
  const identityId = useRef<string | null>(null);
  const pendingBookmarks = useRef(new Set<string>());
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setRefreshing(true);
    setError(null);
    try {
      if (!demo) {
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
      }
    } catch (cause) {
      if (request === generation.current)
        setError(
          cause instanceof Error ? cause.message : 'Could not load your workspace. Try again.',
        );
    } finally {
      if (request === generation.current) setRefreshing(false);
    }
  }, [demo]);
  useEffect(() => {
    if (demo) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
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
  }, [demo, refresh]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (demo) {
          const raw = await AsyncStorage.getItem(storageKey);
          if (raw && active) {
            const saved = parseWorkspace(raw);
            if (saved) dispatch({ type: 'hydrate', value: saved });
            else
              setError('Saved preview data could not be restored. A fresh workspace was opened.');
          }
        } else await refresh();
      } catch {
        if (active) setError('Could not restore saved data. Changes may not survive a restart.');
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [demo, refresh]);
  useEffect(() => {
    if (ready && demo)
      writeQueue.current = writeQueue.current
        .then(() => AsyncStorage.setItem(storageKey, JSON.stringify(state)))
        .catch(() => {
          setError('Changes could not be saved. Check available storage.');
        });
  }, [state, ready, demo]);
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
    return demo
      ? demoAccess(
          state.profile,
          state.channels.find((channel) => channel.id === id),
          !!state.demoPlanId,
          state.joinedIds.includes(id),
          action,
        )
      : checkLiveAccess(id, action);
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
    if (!demo) {
      const before = await supabase.auth.getSession();
      if (before.data.session?.user.id !== userId) return;
      await setLiveMembership(id, joined);
      const after = await supabase.auth.getSession();
      if (after.data.session?.user.id !== userId) return;
    }
    dispatch({ type: 'membership', id, joined });
    setToast(joined ? 'Channel added to your collection' : 'You left the channel');
  }
  async function bookmark(id: string) {
    if (!requireIdentity() || pendingBookmarks.current.has(id)) return;
    const saved = state.savedIds.includes(id);
    pendingBookmarks.current.add(id);
    const userId = state.profile?.id;
    try {
      if (!demo) {
        await call('set_saved_title', { p_title_id: id, p_saved: !saved });
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user.id !== userId) return;
      }
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
        demo,
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
