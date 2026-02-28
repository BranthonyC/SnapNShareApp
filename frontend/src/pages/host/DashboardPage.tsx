import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Image, Users, Heart, HardDrive, Eye, QrCode, Pencil, Settings } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
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
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-card bg-accent-green-light mb-2">
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
      <PageLayout
        title={headerTitle}
        showBack
        onBack={() => navigate('/')}
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
      onBack={() => navigate('/')}
    >
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          icon={<Image className="w-5 h-5 text-accent-green" aria-hidden="true" />}
          label="Fotos subidas"
          value={`${stats?.uploads.count ?? event?.uploadCount ?? 0}`}
          subtitle={`de ${stats?.uploads.limit ?? event?.uploadLimit ?? 0}`}
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-accent-green" aria-hidden="true" />}
          label="Invitados"
          value={`${stats?.guests.total ?? 0}`}
          subtitle={stats?.guests.verified ? `${stats.guests.verified} verificados` : undefined}
        />
        <StatCard
          icon={<Heart className="w-5 h-5 text-accent-green" aria-hidden="true" />}
          label="Reacciones"
          value={`${stats?.reactions.total ?? 0}`}
        />
        <StatCard
          icon={<HardDrive className="w-5 h-5 text-accent-green" aria-hidden="true" />}
          label="Almacenamiento"
          value={formatBytes(stats?.storage.totalBytes ?? 0)}
        />
      </div>

      {/* Recent uploads */}
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
          <div className="grid grid-cols-3 gap-2">
            {recentMedia.map((item: MediaItem) => (
              <button
                key={item.mediaId}
                type="button"
                onClick={() => navigate(`/e/${eventId}/media/${item.mediaId}`)}
                className="block w-full aspect-square overflow-hidden rounded-card bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green"
                aria-label={`Foto subida por ${item.uploadedBy}`}
              >
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-200 hover:scale-105"
                />
              </button>
            ))}
          </div>
        )}

        {recentMedia.length > 0 && (
          <button
            type="button"
            onClick={() => navigate(`/e/${eventId}/gallery`)}
            className="font-body text-sm text-accent-green hover:underline focus:outline-none mt-3 block mx-auto"
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
        <div className="grid grid-cols-2 gap-3">
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
        </div>
      </div>
    </PageLayout>
  );
}
