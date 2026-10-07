import { create } from 'zustand';
import type { SessionUser } from '@dispatch/contracts';
import { ApiError } from '../api/client';
import { api, setOnSessionExpired } from '../api/instance';

export type SessionStatus = 'loading' | 'anon' | 'authed' | 'error';

interface SessionState {
  status: SessionStatus;
  /** Always what the BACKEND returned for this token (GET /auth/me or the login response). Never a client flag. */
  user: SessionUser | null;
  error: string | null;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  error: null,

  async bootstrap() {
    set({ status: 'loading', error: null });
    if (!(await api.hasSession())) return set({ status: 'anon', user: null });
    try {
      const me = await api.get<SessionUser>('auth/me');
      set({ status: 'authed', user: { id: me.id, name: me.name, role: me.role } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return set({ status: 'anon', user: null });
      set({
        status: 'error',
        error:
          e instanceof ApiError && e.isNetwork ? 'You appear to be offline.' : 'Could not reach the server.',
      });
    }
  },

  async signIn(email, password) {
    const pair = await api.login(email, password);
    set({ status: 'authed', user: pair.user, error: null });
  },

  async signOut() {
    await api.logout();
    set({ status: 'anon', user: null });
  },
}));

setOnSessionExpired(() => useSession.setState({ status: 'anon', user: null }));
