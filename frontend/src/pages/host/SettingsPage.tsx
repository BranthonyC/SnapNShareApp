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
  Smartphone,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import PaymentGate from '@/components/admin/PaymentGate';
import SectionCard from '@/components/ui/SectionCard';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import StorageCard from '@/components/admin/StorageCard';
import AccountCard from '@/components/admin/AccountCard';
import { useEvent } from '@/hooks/useEvent';
import { useAuthStore } from '@/stores/authStore';
import * as api from '@/services/api';
import type { ApiError, EventSettings } from '@/services/api';

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
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-card bg-accent-light shrink-0 mt-0.5">
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
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          checked ? 'bg-accent' : 'bg-border-strong',
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
  { id: 'green', label: 'Indigo', color: 'bg-accent' },
  { id: 'blue', label: 'Azul', color: 'bg-blue-500' },
  { id: 'coral', label: 'Coral', color: 'bg-accent-coral' },
  { id: 'gold', label: 'Dorado', color: 'bg-accent-gold' },
];

interface ColorSelectorProps {
  selected: string;
  onChange: (theme: string) => void;
}

function ColorSelector({ selected, onChange }: ColorSelectorProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-card bg-accent-light shrink-0">
        <Palette className="w-4 h-4 text-accent" aria-hidden="true" />
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
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent',
                selected === theme.id
                  ? 'ring-2 ring-offset-2 ring-accent scale-110'
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
// Settings toggles content (shared between mobile and desktop)
// ---------------------------------------------------------------------------
interface SettingsTogglesProps {
  settings: EventSettings;
  handleToggle: (key: keyof EventSettings) => (checked: boolean) => void;
  handleThemeChange: (theme: string) => void;
  isPaidOrPremium: boolean;
  isPremium: boolean;
}

function SettingsToggles({ settings, handleToggle, handleThemeChange, isPaidOrPremium, isPremium }: SettingsTogglesProps) {
  return (
    <>
      {/* Galería */}
      <SectionCard className="mb-4 lg:mb-0">
        <SectionCard.Header title="Galería" />
        <SectionCard.Body>
          <div className="divide-y divide-border-subtle">
            <Toggle
              label="Galería privada"
              description="Solo invitados con el enlace o código QR pueden ver las fotos."
              icon={<Image className="w-4 h-4 text-accent" aria-hidden="true" />}
              checked={settings.galleryPrivacy}
              onChange={handleToggle('galleryPrivacy')}
            />
            <Toggle
              label="Permitir descargas"
              description="Los invitados pueden descargar fotos individuales."
              icon={<Download className="w-4 h-4 text-accent" aria-hidden="true" />}
              checked={settings.allowDownloads}
              onChange={handleToggle('allowDownloads')}
              disabled={!isPaidOrPremium}
              disabledMessage="Disponible en plan Estándar"
            />
            <Toggle
              label="Permitir video"
              description="Permite la subida de videos además de imágenes."
              icon={<Video className="w-4 h-4 text-accent" aria-hidden="true" />}
              checked={settings.allowVideo}
              onChange={handleToggle('allowVideo')}
              disabled={!isPaidOrPremium}
              disabledMessage="Disponible en plan Estándar"
            />
            <Toggle
              label="Mostrar fecha y hora"
              description="Muestra la fecha y hora de cada foto en la galería."
              icon={<Clock className="w-4 h-4 text-accent" aria-hidden="true" />}
              checked={settings.showDateTime}
              onChange={handleToggle('showDateTime')}
            />
          </div>
        </SectionCard.Body>
      </SectionCard>

      {/* Apariencia */}
      <SectionCard className="mb-4 lg:mb-0">
        <SectionCard.Header title="Apariencia" />
        <SectionCard.Body>
          <ColorSelector
            selected={settings.colorTheme}
            onChange={handleThemeChange}
          />
        </SectionCard.Body>
      </SectionCard>

      {/* Notificaciones */}
      <SectionCard className="mb-4 lg:mb-0">
        <SectionCard.Header title="Notificaciones" />
        <SectionCard.Body>
          <Toggle
            label="Notificaciones por email"
            description="Recibe un correo cuando se suban nuevas fotos."
            icon={<Bell className="w-4 h-4 text-accent" aria-hidden="true" />}
            checked={settings.emailNotifications}
            onChange={handleToggle('emailNotifications')}
          />
        </SectionCard.Body>
      </SectionCard>

      {/* Verificación */}
      <SectionCard className="mb-4 lg:mb-0">
        <SectionCard.Header title="Verificación de invitados" />
        <SectionCard.Body>
          <div className="divide-y divide-border-subtle">
            <Toggle
              label="Verificación por SMS"
              description="Permite a los invitados verificarse por SMS además de email."
              icon={<Smartphone className="w-4 h-4 text-accent" aria-hidden="true" />}
              checked={settings.smsOtp}
              onChange={handleToggle('smsOtp')}
              disabled={!isPremium}
              disabledMessage="Disponible en plan Premium"
            />
          </div>
        </SectionCard.Body>
      </SectionCard>

      {/* Moderación (premium only) */}
      <SectionCard className="mb-4 lg:mb-0">
        <SectionCard.Header title="Moderación" />
        <SectionCard.Body>
          <Toggle
            label="Auto-aprobar contenido"
            description="Las fotos se publican automáticamente sin revisión manual."
            icon={<ShieldCheck className="w-4 h-4 text-accent" aria-hidden="true" />}
            checked={settings.autoApprove}
            onChange={handleToggle('autoApprove')}
            disabled={!isPremium}
            disabledMessage="Disponible en plan Premium"
          />
        </SectionCard.Body>
      </SectionCard>
    </>
  );
}

// ---------------------------------------------------------------------------
// Danger zone content (shared between mobile and desktop)
// ---------------------------------------------------------------------------
interface DangerZoneProps {
  showClearConfirm: boolean;
  setShowClearConfirm: (v: boolean) => void;
  isClearing: boolean;
  handleClearAllMedia: () => void;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (v: boolean) => void;
  isDeleting: boolean;
  handleDeleteEvent: () => void;
}

function DangerZone({
  showClearConfirm,
  setShowClearConfirm,
  isClearing,
  handleClearAllMedia,
  showDeleteConfirm,
  setShowDeleteConfirm,
  isDeleting,
  handleDeleteEvent,
}: DangerZoneProps) {
  return (
    <SectionCard variant="danger">
      <SectionCard.Header title="Zona peligrosa" />
      <SectionCard.Body>
        <p className="font-body text-xs text-secondary mb-4">
          Estas acciones son irreversibles. Procede con precaución.
        </p>

        <div className="space-y-3">
          {showClearConfirm ? (
            <div className="rounded-card border border-accent-coral bg-red-50 p-4">
              <p className="font-body text-sm text-primary mb-3">
                Esto eliminará todas las fotos y videos del evento. No se puede deshacer.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowClearConfirm(false)} disabled={isClearing}>
                  Cancelar
                </Button>
                <Button variant="danger" size="sm" loading={isClearing} disabled={isClearing} onClick={handleClearAllMedia}>
                  {isClearing ? 'Eliminando...' : 'Sí, eliminar todo'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="danger"
              size="md"
              fullWidth
              icon={<Trash2 className="w-4 h-4" />}
              disabled={isDeleting}
              onClick={() => setShowClearConfirm(true)}
            >
              Eliminar todo el contenido
            </Button>
          )}

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
      </SectionCard.Body>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, role, logout } = useAuthStore();

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
    smsOtp: false,
  });
  const [initialized, setInitialized] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Sync settings from event data once loaded
  useEffect(() => {
    if (event && !initialized) {
      setSettings({
        galleryPrivacy: event.galleryPrivacy ?? false,
        allowDownloads: event.allowDownloads,
        allowVideo: event.allowVideo,
        emailNotifications: event.emailNotifications ?? true,
        autoApprove: event.autoApprove ?? (event.tier === 'premium'),
        colorTheme: event.colorTheme || 'green',
        showDateTime: event.showDateTime,
        smsOtp: (event as any).smsOtp ?? false,
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
  // Clear all media
  // ---------------------------------------------------------------------------
  async function handleClearAllMedia() {
    setIsClearing(true);
    setSaveError('');
    try {
      await api.clearAllMedia(eventId!);
      setShowClearConfirm(false);
    } catch (err) {
      const apiErr = err as ApiError;
      setSaveError(apiErr.message || 'No se pudo eliminar el contenido.');
    } finally {
      setIsClearing(false);
    }
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

  function handleSignOut() {
    logout();
    navigate('/auth/host', { replace: true });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const headerTitle = eventLoading ? 'Cargando...' : 'Configuración';

  if (eventLoading) {
    return (
      <AdminLayout
        title={headerTitle}
        onBack={() => navigate(`/e/${eventId}/admin`)}
      >
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={headerTitle}
      subtitle="Administra tu evento"
      onBack={() => navigate(`/e/${eventId}/admin`)}
      tier={event?.tier}
    >
      <PaymentGate eventId={eventId!} paymentStatus={event?.paymentStatus} tier={event?.tier ?? 'basic'}>
      {/* Save error */}
      {saveError && (
        <div className="mb-4 p-3 rounded-card bg-red-50 border border-accent-coral" role="alert">
          <p className="font-body text-sm text-accent-coral">{saveError}</p>
        </div>
      )}

      {/* Mobile: stacked layout (unchanged) */}
      <AdminLayout.Mobile>
        <SettingsToggles
          settings={settings}
          handleToggle={handleToggle}
          handleThemeChange={handleThemeChange}
          isPaidOrPremium={isPaidOrPremium}
          isPremium={isPremium}
        />
        <DangerZone
          showClearConfirm={showClearConfirm}
          setShowClearConfirm={setShowClearConfirm}
          isClearing={isClearing}
          handleClearAllMedia={handleClearAllMedia}
          showDeleteConfirm={showDeleteConfirm}
          setShowDeleteConfirm={setShowDeleteConfirm}
          isDeleting={isDeleting}
          handleDeleteEvent={handleDeleteEvent}
        />
      </AdminLayout.Mobile>

      {/* Desktop: two-column layout */}
      <AdminLayout.Desktop cols={5} gap={8}>
        <AdminLayout.Column span={3}>
          <SettingsToggles
            settings={settings}
            handleToggle={handleToggle}
            handleThemeChange={handleThemeChange}
            isPaidOrPremium={isPaidOrPremium}
            isPremium={isPremium}
          />
          <DangerZone
            showClearConfirm={showClearConfirm}
            setShowClearConfirm={setShowClearConfirm}
            isClearing={isClearing}
            handleClearAllMedia={handleClearAllMedia}
            showDeleteConfirm={showDeleteConfirm}
            setShowDeleteConfirm={setShowDeleteConfirm}
            isDeleting={isDeleting}
            handleDeleteEvent={handleDeleteEvent}
          />
        </AdminLayout.Column>
        <AdminLayout.Column span={2}>
          <StorageCard eventId={eventId!} uploadLimit={event?.uploadLimit} />
          {event && <AccountCard event={event} onSignOut={handleSignOut} />}
        </AdminLayout.Column>
      </AdminLayout.Desktop>
      </PaymentGate>
    </AdminLayout>
  );
}
