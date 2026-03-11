import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import type { ToastType } from '@/stores/toastStore';

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-accent shrink-0" aria-hidden="true" />,
  error: <AlertCircle className="w-5 h-5 text-accent-coral shrink-0" aria-hidden="true" />,
  info: <Info className="w-5 h-5 text-blue-500 shrink-0" aria-hidden="true" />,
};

const borderColorMap: Record<ToastType, string> = {
  success: 'border-l-accent',
  error: 'border-l-accent-coral',
  info: 'border-l-blue-500',
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            'pointer-events-auto flex items-start gap-3 rounded-card bg-card shadow-modal border border-border-subtle border-l-4 p-4',
            borderColorMap[toast.type],
          ].join(' ')}
          role="alert"
        >
          {iconMap[toast.type]}
          <p className="font-body text-sm text-primary flex-1">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-tertiary hover:text-primary transition-colors"
            aria-label="Cerrar notificacion"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
