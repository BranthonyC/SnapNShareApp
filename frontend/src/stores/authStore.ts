import { create } from 'zustand';

interface AuthState {
  token: string | null;
  role: 'guest' | 'host' | null;
  nickname: string | null;
  eventId: string | null;
  verified: boolean;

  setGuestAuth: (token: string, eventId: string, nickname: string, verified: boolean) => void;
  setHostAuth: (token: string) => void;
  setVerified: (token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: sessionStorage.getItem('token'),
  role: sessionStorage.getItem('role') as AuthState['role'],
  nickname: sessionStorage.getItem('nickname'),
  eventId: sessionStorage.getItem('eventId'),
  verified: sessionStorage.getItem('verified') === 'true',

  setGuestAuth: (token, eventId, nickname, verified) => {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('role', 'guest');
    sessionStorage.setItem('nickname', nickname);
    sessionStorage.setItem('eventId', eventId);
    sessionStorage.setItem('verified', String(verified));
    set({ token, role: 'guest', nickname, eventId, verified });
  },

  setHostAuth: (token) => {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('role', 'host');
    sessionStorage.setItem('verified', 'true');
    set({ token, role: 'host', verified: true });
  },

  setVerified: (token) => {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('verified', 'true');
    set({ token, verified: true });
  },

  logout: () => {
    sessionStorage.clear();
    set({ token: null, role: null, nickname: null, eventId: null, verified: false });
  },

  isAuthenticated: () => !!get().token,
}));
