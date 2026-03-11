import { create } from 'zustand';

interface AuthState {
  token: string | null;
  role: 'guest' | 'host' | null;
  nickname: string | null;
  eventId: string | null;
  verified: boolean;

  setGuestAuth: (token: string, eventId: string, nickname: string, verified: boolean) => void;
  setHostAuth: (token: string, eventId?: string) => void;
  setVerified: (token: string) => void;
  loadEventSession: (eventId: string) => boolean;
  logout: () => void;
  isAuthenticated: () => boolean;
}

// Per-event localStorage keys — so sessions survive tab closes
// and different events don't interfere with each other.
function guestKey(eventId: string, field: string) {
  return `ea:${eventId}:${field}`;
}

// Host keys are global (hosts manage multiple events via a single login)
const HOST_KEYS = {
  token: 'ea:host:token',
  eventId: 'ea:host:eventId',
};

function loadInitialState(): Pick<AuthState, 'token' | 'role' | 'nickname' | 'eventId' | 'verified'> {
  // Check host session first
  const hostToken = localStorage.getItem(HOST_KEYS.token);
  if (hostToken) {
    return {
      token: hostToken,
      role: 'host',
      nickname: null,
      eventId: localStorage.getItem(HOST_KEYS.eventId),
      verified: true,
    };
  }
  // Check if we're on a guest event route — hydrate from localStorage
  const match = window.location.pathname.match(/^\/e\/([^/]+)/);
  const eventId = match?.[1];
  if (eventId) {
    const token = localStorage.getItem(guestKey(eventId, 'token'));
    if (token) {
      const nickname = localStorage.getItem(guestKey(eventId, 'nickname')) || 'Invitado';
      const verified = localStorage.getItem(guestKey(eventId, 'verified')) === 'true';
      return { token, role: 'guest', nickname, eventId, verified };
    }
  }
  return { token: null, role: null, nickname: null, eventId: null, verified: false };
}

const initial = loadInitialState();

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initial,

  // Restore a guest session for a specific event from localStorage.
  // Called by EventEntryPage on mount. Returns true if a valid session was found.
  loadEventSession: (eventId) => {
    const token = localStorage.getItem(guestKey(eventId, 'token'));
    if (!token) return false;

    const nickname = localStorage.getItem(guestKey(eventId, 'nickname')) || 'Invitado';
    const verified = localStorage.getItem(guestKey(eventId, 'verified')) === 'true';
    set({ token, role: 'guest', nickname, eventId, verified });
    return true;
  },

  setGuestAuth: (token, eventId, nickname, verified) => {
    // Persist per-event so the session survives tab closes
    localStorage.setItem(guestKey(eventId, 'token'), token);
    localStorage.setItem(guestKey(eventId, 'nickname'), nickname);
    localStorage.setItem(guestKey(eventId, 'verified'), String(verified));
    set({ token, role: 'guest', nickname, eventId, verified });
  },

  setHostAuth: (token, eventId?) => {
    localStorage.setItem(HOST_KEYS.token, token);
    if (eventId) localStorage.setItem(HOST_KEYS.eventId, eventId);
    set({ token, role: 'host', verified: true, ...(eventId ? { eventId } : {}) });
  },

  setVerified: (token) => {
    const { eventId } = get();
    if (eventId) {
      localStorage.setItem(guestKey(eventId, 'token'), token);
      localStorage.setItem(guestKey(eventId, 'verified'), 'true');
    }
    set({ token, verified: true });
  },

  logout: () => {
    const { role, eventId } = get();
    if (role === 'guest' && eventId) {
      localStorage.removeItem(guestKey(eventId, 'token'));
      localStorage.removeItem(guestKey(eventId, 'nickname'));
      localStorage.removeItem(guestKey(eventId, 'verified'));
    } else if (role === 'host') {
      localStorage.removeItem(HOST_KEYS.token);
      localStorage.removeItem(HOST_KEYS.eventId);
    }
    set({ token: null, role: null, nickname: null, eventId: null, verified: false });
  },

  isAuthenticated: () => !!get().token,
}));
