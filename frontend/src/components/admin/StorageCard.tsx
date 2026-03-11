import { useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import SectionCard from '@/components/ui/SectionCard';
import ProgressBar from '@/components/ui/ProgressBar';
import StatRow from '@/components/ui/StatRow';
import * as api from '@/services/api';

// ---------------------------------------------------------------------------
// StorageCard — shows storage usage with progress bar + breakdown by type
// ---------------------------------------------------------------------------

interface StorageCardProps {
  eventId: string;
  uploadLimit?: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function StorageCard({ eventId, uploadLimit }: StorageCardProps) {
  const [storage, setStorage] = useState<api.StorageResponse | null>(null);

  useEffect(() => {
    if (!eventId) return;
    api.getStorage(eventId).then(setStorage).catch(() => {});
  }, [eventId]);

  const totalMB = storage ? Math.round(storage.totalBytes / (1024 * 1024)) : 0;
  const limitMB = storage?.limit ? Math.round(storage.limit / (1024 * 1024)) : 500;

  return (
    <SectionCard>
      <SectionCard.Header
        title="Almacenamiento"
        icon={<HardDrive className="w-4 h-4 text-accent" aria-hidden="true" />}
      />
      <SectionCard.Body>
        <ProgressBar
          value={totalMB}
          max={limitMB}
          unit=" MB"
          color={totalMB / limitMB > 0.9 ? 'coral' : 'green'}
        />

        {storage?.byType && Object.keys(storage.byType).length > 0 && (
          <div className="mt-3 divide-y divide-border-subtle">
            {Object.entries(storage.byType).map(([type, bytes]) => (
              <StatRow key={type} label={type} value={formatBytes(bytes)} />
            ))}
          </div>
        )}

        <div className="mt-2">
          <StatRow label="Total" value={formatBytes(storage?.totalBytes ?? 0)} bold />
          {uploadLimit !== undefined && (
            <StatRow label="Limite de fotos" value={`${uploadLimit}`} />
          )}
        </div>
      </SectionCard.Body>
    </SectionCard>
  );
}
