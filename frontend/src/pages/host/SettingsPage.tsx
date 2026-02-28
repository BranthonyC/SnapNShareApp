import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Image,
  Download,
  Video,
  Clock,
  Palette,
  Bell,
  ShieldCheck,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { useEvent } from '@/hooks/useEvent';
import { useAuthStore } from '@/stores/authStore';
import * as api from '@/services/api';
import type { ApiError, EventSettings } from '@/services/api';

// ---------------------------------------------------------------------------
// SettingsPage — /e/:eventId/admin/settings
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Toggle component
// ---------------------------------------------------------------------------
interface ToggleProps {
  label: string;
  description?: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  disabledMessage?: string;
}

function Toggle({
  label,
  description,
  icon,
  checked,
  onChange,
  disabled = false,
  disabledMessage,
}: ToggleProps) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-card bg-accent-green-light shrink-0 mt-0.5">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm font-medium text-primary">{label}</p>
        {description && (
          <p className="font-body text-xs text-secondary mt-0.5">{description}</p>
        )}
        {disabled && disabledMessage && (
          <p className="font-body text-xs text-accent-coral mt-0.5">{disabledMessage}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-in-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green focus-visible:ring-offset-2',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          checked ? 'bg-accent-green' : 'bg-border-strong',
        ].join(' ')}
      >
        <span
          className={[
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out',
            'translate-y-0.5',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color theme selector
// ---------------------------------------------------------------------------
const THEMES = [
  { id: 'green', color: 'bg-accent-green' },
  { id: 'blue', color: 'bg-blue-500' },
  { id: 'coral', color: 'bg-accent-coral' },
  { id: 'gold', color: 'bg-accent-gold' },
];

interface ColorSelectorProps {
  selected: string;
  onChange: (theme: string) => void;
}

function ColorSelector({ selected, onChange }: ColorSelectorProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-card bg-accent-green-light shrink-0">
        <Palette className="w-4 h-4 text-accent-green" aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm font-medium text-primary">Tema de color</p>
        <p className="font-body text-xs text-secondary mt-0.5">
          Personaliza el color principal de tu galería.
        </p>
        <div className="flex gap-3 mt-2">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChange(theme.id)}
              aria-label={`Tema ${theme.id}`}
              className={[
                'w-8 h-8 rounded-full transition-all',
                theme.color,
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-green',
                selected === theme.id
                  ? 'ring-2 ring-offset-2 ring-accent-green scale-110'
                  : 'hover:scale-105',
              ].join(' ')}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuthStore();

  // Auth guard: host only
  useEffect(() => {
    if (!isAuthenticated() || role !== 'host') {
      navigate('/auth/host', { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  const { data: event, isLoading: eventLoading } = useEvent(eventId);

  // Local settings state — initialized from event data
  const [settings, setSettings] = useState<EventSettings>({
    galleryPrivacy: false,
    allowDownloads: false,
    allowVideo: false,
    emailNotifications: true,
    autoApprove: true,
    colorTheme: 'green',
    showDateTime: true,
  });
  const [initialized, setInitialized] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync settings from event data once loaded
  useEffect(() => {
    if (event && !initialized) {
      setSettings({
        galleryPrivacy: false, // not on EventData, defaults to false
        allowDownloads: event.allowDownloads,
        allowVideo: event.allowVideo,
        emailNotifications: true, // default
        autoApprove: true, // default
        colorTheme: event.colorTheme || 'green',
        showDateTime: event.showDateTime,
      });
      setInitialized(true);
    }
  }, [event, initialized]);

  const tier = event?.tier ?? 'basic';
  const isPaidOrPremium = tier === 'paid' || tier === 'premium';
  const isPremium = tier === 'premium';

  // ---------------------------------------------------------------------------
  // Persist a single setting
  // ---------------------------------------------------------------------------
  const saveSetting = useCallback(
    async (key: keyof EventSettings, value: boolean | string) => {
      setSaveError('');
      try {
        await api.updateSettings(eventId!, { [key]: value });
      } catch (err) {
        const apiErr = err as ApiError;
        setSaveError(apiErr.message || 'No se pudo guardar la configuración.');
      }
    },
    [eventId],
  );

  function handleToggle(key: keyof EventSettings) {
    return (checked: boolean) => {
      setSettings((prev) => ({ ...prev, [key]: checked }));
      saveSetting(key, checked);
    };
  }

  function handleThemeChange(theme: string) {
    setSettings((prev) => ({ ...prev, colorTheme: theme }));
    saveSetting('colorTheme', theme);
  }

  // ---------------------------------------------------------------------------
  // Delete event
  // ---------------------------------------------------------------------------
  async function handleDeleteEvent() {
    setIsDeleting(true);
    setSaveError('');
    try {
      await api.deleteEvent(eventId!);
      navigate('/', { replace: true });
    } catch (err) {
      const apiErr = err as ApiError;
      setSaveError(apiErr.message || 'No se pudo eliminar el evento.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const headerTitle = eventLoading ? 'Cargando...' : 'Configuración';

  if (eventLoading) {
    return (
      <PageLayout
        title={headerTitle}
        showBack
        onBack={() => navigate(`/e/${eventId}/admin`)}
      >
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={headerTitle}
      showBack
      onBack={() => navigate(`/e/${eventId}/admin`)}
    >
      {/* Save error */}
      {saveError && (
        <div className="mb-4 p-3 rounded-card bg-red-50 border border-accent-coral" role="alert">
          <p className="font-body text-sm text-accent-coral">{saveError}</p>
        </div>
      )}

      {/* Galería */}
      <Card padding="md" className="mb-4">
        <h2 className="font-heading text-base font-semibold text-primary mb-1">
          Galería
        </h2>
        <div className="divide-y divide-border-subtle">
          <Toggle
            label="Galería privada"
            description="Solo invitados con contraseña pueden ver las fotos."
            icon={<Image className="w-4 h-4 text-accent-green" aria-hidden="true" />}
            checked={settings.galleryPrivacy}
            onChange={handleToggle('galleryPrivacy')}
          />
          <Toggle
            label="Permitir descargas"
            description="Los invitados pueden descargar fotos individuales."
            icon={<Download className="w-4 h-4 text-accent-green" aria-hidden="true" />}
            checked={settings.allowDownloads}
            onChange={handleToggle('allowDownloads')}
            disabled={!isPaidOrPremium}
            disabledMessage="Disponible en plan Estándar"
          />
          <Toggle
            label="Permitir video"
            description="Permite la subida de videos además de imágenes."
            icon={<Video className="w-4 h-4 text-accent-green" aria-hidden="true" />}
            checked={settings.allowVideo}
            onChange={handleToggle('allowVideo')}
            disabled={!isPaidOrPremium}
            disabledMessage="Disponible en plan Estándar"
          />
          <Toggle
            label="Mostrar fecha y hora"
            description="Muestra la fecha y hora de cada foto en la galería."
            icon={<Clock className="w-4 h-4 text-accent-green" aria-hidden="true" />}
            checked={settings.showDateTime}
            onChange={handleToggle('showDateTime')}
          />
        </div>
      </Card>

      {/* Apariencia */}
      <Card padding="md" className="mb-4">
        <h2 className="font-heading text-base font-semibold text-primary mb-1">
          Apariencia
        </h2>
        <ColorSelector
          selected={settings.colorTheme}
          onChange={handleThemeChange}
        />
      </Card>

      {/* Notificaciones */}
      <Card padding="md" className="mb-4">
        <h2 className="font-heading text-base font-semibold text-primary mb-1">
          Notificaciones
        </h2>
        <Toggle
          label="Notificaciones por email"
          description="Recibe un correo cuando se suban nuevas fotos."
          icon={<Bell className="w-4 h-4 text-accent-green" aria-hidden="true" />}
          checked={settings.emailNotifications}
          onChange={handleToggle('emailNotifications')}
        />
      </Card>

      {/* Moderación (premium only) */}
      <Card padding="md" className="mb-4">
        <h2 className="font-heading text-base font-semibold text-primary mb-1">
          Moderación
        </h2>
        <Toggle
          label="Auto-aprobar contenido"
          description="Las fotos se publican automáticamente sin revisión manual."
          icon={<ShieldCheck className="w-4 h-4 text-accent-green" aria-hidden="true" />}
          checked={settings.autoApprove}
          onChange={handleToggle('autoApprove')}
          disabled={!isPremium}
          disabledMessage="Disponible en plan Premium"
        />
      </Card>

      {/* Zona peligrosa */}
      <Card padding="md" className="border-2 border-accent-coral mb-4">
        <h2 className="font-heading text-base font-semibold text-accent-coral mb-1">
          Zona peligrosa
        </h2>
        <p className="font-body text-xs text-secondary mb-4">
          Estas acciones son irreversibles. Procede con precaución.
        </p>

        <div className="space-y-3">
          <Button
            variant="danger"
            size="md"
            fullWidth
            icon={<Trash2 className="w-4 h-4" />}
            disabled={isDeleting}
          >
            Eliminar todo el contenido
          </Button>

          {showDeleteConfirm ? (
            <div className="rounded-card border border-accent-coral bg-red-50 p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-accent-coral shrink-0 mt-0.5" aria-hidden="true" />
                <p className="font-body text-sm text-primary">
                  Esta acción eliminará permanentemente el evento y todo su contenido. No se puede deshacer.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  loading={isDeleting}
                  disabled={isDeleting}
                  onClick={handleDeleteEvent}
                >
                  {isDeleting ? 'Eliminando...' : 'Sí, eliminar evento'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="danger"
              size="md"
              fullWidth
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
            >
              Eliminar evento
            </Button>
          )}
        </div>
      </Card>
    </PageLayout>
  );
}
