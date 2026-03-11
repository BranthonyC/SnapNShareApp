import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Image,
  Users,
  Heart,
  HardDrive,
  Eye,
  QrCode,
  Pencil,
  Settings,
  ShieldCheck,
  FolderOpen,
  MapPin,
  ImagePlus,
  Sparkles,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import PaymentGate from '@/components/admin/PaymentGate';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { useEvent } from '@/hooks/useEvent';
import { useStats } from '@/hooks/useStats';
import { useMedia } from '@/hooks/useMedia';
import { useAuthStore } from '@/stores/authStore';
import type { MediaItem } from '@/services/api';

// ---------------------------------------------------------------------------
// StatCard — single stat display
// ---------------------------------------------------------------------------
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
}

function StatCard({ icon, label, value, subtitle }: StatCardProps) {
  return (
    <Card padding="md" className="flex flex-col items-center text-center">
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-card bg-accent-light mb-2">
        {icon}
      </span>
      <p className="font-heading text-xl font-bold text-primary">{value}</p>
      <p className="font-body text-xs text-secondary">{label}</p>
      {subtitle && (
        <p className="font-body text-xs text-tertiary mt-0.5">{subtitle}</p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// formatBytes — human-readable file size
// ---------------------------------------------------------------------------
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ---------------------------------------------------------------------------
// LobbyPreviewCard — mini preview of the guest lobby
// ---------------------------------------------------------------------------
function LobbyPreviewCard({
  coverUrl,
  title,
  startDate,
  location,
  onEdit,
}: {
  coverUrl?: string | null;
  title: string;
  startDate: string;
  location?: string;
  onEdit: () => void;
}) {
  const formattedDate = startDate
    ? new Date(startDate).toLocaleDateString('es-GT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="bg-card rounded-card shadow-card overflow-hidden">
      {/* Preview image */}
      <div className="relative w-full aspect-video bg-muted">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt="Portada"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-accent-light to-muted">
            <ImagePlus className="w-10 h-10 text-border-strong mb-2" aria-hidden="true" />
            <p className="font-body text-xs text-tertiary">Sin imagen de portada</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-heading text-base font-bold text-white leading-tight truncate">
            {title}
          </h3>
          {formattedDate && (
            <p className="font-body text-xs text-white/80 mt-0.5">{formattedDate}</p>
          )}
          {location && (
            <p className="font-body text-xs text-white/70 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" aria-hidden="true" />
              {location}
            </p>
          )}
        </div>
      </div>
      <div className="p-3 flex items-center justify-between">
        <p className="font-body text-xs text-secondary">
          Así ven tus invitados el evento
        </p>
        <Button variant="secondary" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={onEdit}>
          Editar
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DashboardPage — /e/:eventId/admin
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuthStore();

  // Auth guard: redirect to host login if not authenticated as host
  useEffect(() => {
    if (!isAuthenticated() || role !== 'host') {
      navigate('/auth/host', { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  const { data: event, isLoading: eventLoading } = useEvent(eventId);
  const { data: stats, isLoading: statsLoading } = useStats(eventId);
  const { items: mediaItems, isLoading: mediaLoading } = useMedia(eventId);

  const isLoading = eventLoading || statsLoading;

  const headerTitle = eventLoading ? 'Cargando...' : event?.title ?? 'Panel de administración';

  // Recent uploads (last 6)
  const recentMedia = mediaItems.slice(0, 6);

  if (isLoading) {
    return (
      <AdminLayout
        title={headerTitle}
        onBack={() => navigate('/')}
        tier={event?.tier}
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
      onBack={() => navigate('/')}
      tier={event?.tier}
    >
      <PaymentGate eventId={eventId!} paymentStatus={event?.paymentStatus} tier={event?.tier ?? 'basic'}>
      {/* Lobby preview */}
      <div className="mb-6">
        <h2 className="font-heading text-base font-semibold text-primary mb-3">
          Lobby del evento
        </h2>
        <LobbyPreviewCard
          coverUrl={event?.coverUrl}
          title={event?.title ?? ''}
          startDate={event?.startDate ?? ''}
          location={event?.location}
          onEdit={() => navigate(`/e/${eventId}/admin/edit`)}
        />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={<Image className="w-5 h-5 text-accent" aria-hidden="true" />}
          label="Fotos subidas"
          value={`${stats?.uploads.count ?? event?.uploadCount ?? 0}`}
          subtitle={`de ${stats?.uploads.limit ?? event?.uploadLimit ?? 0}`}
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-accent" aria-hidden="true" />}
          label="Invitados"
          value={`${stats?.guests.total ?? 0}`}
          subtitle={stats?.guests.verified ? `${stats.guests.verified} verificados` : undefined}
        />
        <StatCard
          icon={<Heart className="w-5 h-5 text-accent" aria-hidden="true" />}
          label="Reacciones"
          value={`${stats?.reactions.total ?? 0}`}
        />
        <StatCard
          icon={<HardDrive className="w-5 h-5 text-accent" aria-hidden="true" />}
          label="Almacenamiento"
          value={formatBytes(stats?.storage.totalBytes ?? 0)}
        />
      </div>

      {/* Recent uploads — with uploader name */}
      <div className="mb-6">
        <h2 className="font-heading text-base font-semibold text-primary mb-3">
          Fotos recientes
        </h2>
        {mediaLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : recentMedia.length === 0 ? (
          <Card padding="lg">
            <p className="font-body text-sm text-secondary text-center">
              Aún no hay fotos en este evento.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
            {recentMedia.map((item: MediaItem) => (
              <button
                key={item.mediaId}
                type="button"
                onClick={() => navigate(`/e/${eventId}/media/${item.mediaId}`, { state: { from: 'admin' } })}
                className="group block w-full overflow-hidden rounded-card bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={`Foto subida por ${item.uploadedBy}`}
              >
                <div className="relative aspect-square">
                  <img
                    src={item.thumbnailUrl ?? item.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  {/* Uploader overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <p className="font-body text-[10px] text-white truncate">
                      {item.uploadedBy}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {recentMedia.length > 0 && (
          <button
            type="button"
            onClick={() => navigate(`/e/${eventId}/gallery`)}
            className="font-body text-sm text-accent hover:underline focus:outline-none mt-3 block mx-auto"
          >
            Ver todas las fotos
          </button>
        )}
      </div>

      {/* Quick actions */}
      <div className="mb-6">
        <h2 className="font-heading text-base font-semibold text-primary mb-3">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Button
            variant="secondary"
            size="md"
            fullWidth
            icon={<Eye className="w-4 h-4" />}
            onClick={() => navigate(`/e/${eventId}/gallery`)}
          >
            Ver galería
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            icon={<QrCode className="w-4 h-4" />}
            onClick={() => navigate(`/e/${eventId}/admin/qr`)}
          >
            Código QR
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            icon={<Pencil className="w-4 h-4" />}
            onClick={() => navigate(`/e/${eventId}/admin/edit`)}
          >
            Editar evento
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            icon={<Settings className="w-4 h-4" />}
            onClick={() => navigate(`/e/${eventId}/admin/settings`)}
          >
            Configuración
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            icon={<ShieldCheck className="w-4 h-4" />}
            onClick={() => navigate(`/e/${eventId}/admin/moderation`)}
          >
            Moderación
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            icon={<FolderOpen className="w-4 h-4" />}
            onClick={() => navigate(`/e/${eventId}/admin/gallery`)}
          >
            Gestionar galería
          </Button>
          {event?.tier !== 'premium' && (
            <Button
              variant="secondary"
              size="md"
              fullWidth
              icon={<Sparkles className="w-4 h-4" />}
              onClick={() => navigate(`/e/${eventId}/admin/upgrade`)}
            >
              Mejorar plan
            </Button>
          )}
        </div>
      </div>
      </PaymentGate>
    </AdminLayout>
  );
}
