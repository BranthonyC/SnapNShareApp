import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = String(++nextId);
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

/** Convenience hook for adding toasts */
export function useToast() {
  const addToast = useToastStore((s) => s.addToast);
  return {
    success: (message: string) => addToast(message, 'success'),
    error: (message: string) => addToast(message, 'error'),
    info: (message: string) => addToast(message, 'info'),
  };
}
