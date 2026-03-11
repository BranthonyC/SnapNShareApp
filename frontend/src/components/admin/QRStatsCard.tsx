import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import SectionCard from '@/components/ui/SectionCard';
import StatRow from '@/components/ui/StatRow';
import * as api from '@/services/api';

// ---------------------------------------------------------------------------
// QRStatsCard — QR scan statistics
// ---------------------------------------------------------------------------

interface QRStatsCardProps {
  eventId: string;
}

export default function QRStatsCard({ eventId }: QRStatsCardProps) {
  const [stats, setStats] = useState<api.QrStatsResponse | null>(null);

  useEffect(() => {
    if (!eventId) return;
    api.getQrStats(eventId).then(setStats).catch(() => {});
  }, [eventId]);

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-GT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <SectionCard>
      <SectionCard.Header
        title="Estadisticas del QR"
        icon={<BarChart3 className="w-4 h-4 text-accent" aria-hidden="true" />}
      />
      <SectionCard.Body>
        <div className="divide-y divide-border-subtle">
          <StatRow label="Escaneos totales" value={`${stats?.totalScans ?? 0}`} bold />
          <StatRow label="Visitantes unicos" value={`${stats?.uniqueVisitors ?? 0}`} />
          <StatRow label="Ultimo escaneo" value={formatDate(stats?.lastScannedAt ?? null)} />
        </div>
      </SectionCard.Body>
    </SectionCard>
  );
}
