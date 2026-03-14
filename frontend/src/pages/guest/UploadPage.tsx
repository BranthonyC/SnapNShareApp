import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Camera, Upload, X, CheckCircle, AlertCircle, ImagePlus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import PageLayout from '@/components/layout/PageLayout';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { useEvent } from '@/hooks/useEvent';
import { useAuthStore } from '@/stores/authStore';
import { compressImage } from '@/services/compression';
import * as api from '@/services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FileStatus = 'pending' | 'compressing' | 'uploading' | 'done' | 'error';

interface FileEntry {
  id: string;
  file: File;
  previewUrl: string;
  status: FileStatus;
  progress: number;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusLabel(status: FileStatus): string {
  switch (status) {
    case 'compressing': return 'Comprimiendo...';
    case 'uploading':   return 'Subiendo...';
    case 'done':        return 'Listo!';
    case 'error':       return 'Error';
    default:            return 'Pendiente';
  }
}

function StatusIcon({ status }: { status: FileStatus }) {
  switch (status) {
    case 'compressing':
    case 'uploading':
      return <Spinner size="sm" />;
    case 'done':
      return <CheckCircle className="w-4 h-4 text-accent" aria-hidden="true" />;
    case 'error':
      return <AlertCircle className="w-4 h-4 text-accent-coral" aria-hidden="true" />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// UploadPage — /e/:eventId/upload
// ---------------------------------------------------------------------------

export default function UploadPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const { isAuthenticated, eventId: storedEventId, verified, role } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: event } = useEvent(eventId);

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated() || storedEventId !== eventId) {
      navigate(`/e/${eventId}`, { replace: true });
      return;
    }
    // Redirect unverified guests to gallery (which shows OTP sheet inline)
    if (!verified && role === 'guest') {
      navigate(`/e/${eventId}/gallery`, { replace: true });
    }
  }, [isAuthenticated, storedEventId, eventId, navigate, verified, role]);

  // OTP verification is required for all guests before uploading
  const needsOtp = !verified && role === 'guest';

  // ---------------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------------

  const [limitError, setLimitError] = useState('');

  function addFiles(files: FileList | File[]) {
    setLimitError('');
    const remaining = uploadLimit - uploadCount - entries.length;
    const accepted = Array.from(files).slice(0, Math.max(0, remaining));

    if (accepted.length < files.length) {
      setLimitError(`Solo puedes subir ${Math.max(0, remaining)} foto${remaining === 1 ? '' : 's'} más.`);
    }
    if (accepted.length === 0) return;

    // Filter by allowed types
    const allowedTypes = event?.allowVideo
      ? ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm']
      : ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

    const validFiles = accepted.filter(
      (f) => f.type !== 'image/svg+xml' && allowedTypes.some((t) => f.type.startsWith(t.split('/')[0] ?? '')),
    );

    const newEntries: FileEntry[] = validFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      progress: 0,
    }));
    setEntries((prev) => [...prev, ...newEntries]);
  }

  function removeEntry(id: string) {
    setEntries((prev) => {
      const entry = prev.find((e) => e.id === id);
      if (entry) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((e) => e.id !== id);
    });
  }

  // ---------------------------------------------------------------------------
  // Drag & drop
  // ---------------------------------------------------------------------------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  function updateEntry(id: string, patch: Partial<FileEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  async function uploadEntry(entry: FileEntry) {
    if (!eventId) return;

    try {
      // Step 1: compress
      updateEntry(entry.id, { status: 'compressing' });
      const compressed = await compressImage(entry.file);

      // Step 2: get presigned URL
      updateEntry(entry.id, { status: 'uploading', progress: 10 });
      const { uploadUrl } = await api.getUploadUrl(eventId, {
        fileType: compressed.type,
        fileSize: compressed.size,
      });

      // Step 3: PUT to S3
      updateEntry(entry.id, { progress: 40 });
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': compressed.type },
        body: compressed,
      });

      if (!res.ok) {
        throw new Error(`S3 error: ${res.status}`);
      }

      updateEntry(entry.id, { status: 'done', progress: 100 });
    } catch (err) {
      updateEntry(entry.id, {
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Error al subir',
      });
    }
  }

  async function handleUploadAll() {
    if (!eventId || isUploading) return;
    const pending = entries.filter((e) => e.status === 'pending' || e.status === 'error');
    if (pending.length === 0) return;

    setIsUploading(true);
    // Process in batches of 3 to avoid overwhelming the browser
    const MAX_CONCURRENT = 3;
    for (let i = 0; i < pending.length; i += MAX_CONCURRENT) {
      const batch = pending.slice(i, i + MAX_CONCURRENT);
      await Promise.all(batch.map(uploadEntry));
    }
    setIsUploading(false);
    // Invalidate gallery + event cache so new photos appear without reload
    queryClient.invalidateQueries({ queryKey: ['media', eventId] });
    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const hasPending = entries.some((e) => e.status === 'pending' || e.status === 'error');
  const allDone = entries.length > 0 && entries.every((e) => e.status === 'done');
  const uploadCount = event?.uploadCount ?? 0;
  const uploadLimit = event?.uploadLimit ?? 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PageLayout
      title="Subir fotos"
      showBack
      onBack={() => navigate(`/e/${eventId}/gallery`)}
    >
      {/* Counter */}
      {event && (
        <p className="font-body text-xs text-secondary text-right mb-4">
          {uploadCount}/{uploadLimit} fotos
        </p>
      )}

      {/* Upload limit error */}
      {limitError && (
        <div className="mb-4 p-3 rounded-card bg-red-50 border border-accent-coral" role="alert">
          <p className="font-body text-sm text-accent-coral">{limitError}</p>
        </div>
      )}

      {/* OTP gate */}
      {needsOtp && (
        <div className="mb-6 rounded-card border border-accent-gold bg-amber-50 p-4">
          <p className="font-body text-sm text-primary font-medium mb-1">
            Verificacion requerida
          </p>
          <p className="font-body text-xs text-secondary mb-3">
            Este evento requiere verificar tu identidad antes de poder subir fotos.
          </p>
          <Link
            to={`/e/${eventId}/verify`}
            className="inline-flex items-center gap-1 font-body text-sm font-semibold text-accent hover:underline focus:outline-none"
          >
            Verificar ahora →
          </Link>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Zona de carga de archivos"
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center gap-3',
          'rounded-card border-2 border-dashed p-8 cursor-pointer',
          'transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          dragOver
            ? 'border-accent bg-accent-light'
            : 'border-border-strong bg-muted hover:border-accent hover:bg-accent-light',
          isUploading ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-card bg-white shadow-card">
          <ImagePlus className="w-6 h-6 text-accent" aria-hidden="true" />
        </span>
        <div className="text-center">
          <p className="font-body text-sm font-medium text-primary">
            Arrastra fotos aquí o toca para seleccionar
          </p>
          <p className="font-body text-xs text-secondary mt-1">
            JPEG, PNG, WebP — máx. 20 MB por archivo
          </p>
        </div>

        {/* Camera capture button (prominent on mobile) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            cameraInputRef.current?.click();
          }}
          className="inline-flex items-center gap-2 font-body text-sm font-medium text-accent hover:underline focus:outline-none"
          disabled={isUploading}
        >
          <Camera className="w-4 h-4" aria-hidden="true" />
          Tomar foto con cámara
        </button>
      </div>

      {/* Hidden file input — gallery/file picker (no capture) */}
      <input
        ref={fileInputRef}
        type="file"
        accept={event?.allowVideo ? 'image/*,video/*' : 'image/*'}
        multiple
        className="sr-only"
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {/* Hidden camera input — direct camera capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Preview grid */}
      {entries.length > 0 && (
        <div className="mt-6">
          <h2 className="font-heading text-base font-semibold text-primary mb-3">
            Seleccionadas ({entries.length})
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {entries.map((entry) => (
              <div key={entry.id} className="relative aspect-square">
                <img
                  src={entry.previewUrl}
                  alt=""
                  className="w-full h-full object-cover rounded-card"
                />

                {/* Status overlay */}
                <div
                  className={[
                    'absolute inset-0 flex flex-col items-center justify-center rounded-card',
                    entry.status === 'done'
                      ? 'bg-black/30'
                      : entry.status === 'error'
                      ? 'bg-accent-coral/40'
                      : entry.status !== 'pending'
                      ? 'bg-black/40'
                      : 'bg-transparent',
                  ].join(' ')}
                >
                  {entry.status !== 'pending' && (
                    <div className="flex flex-col items-center gap-1">
                      <StatusIcon status={entry.status} />
                      <span className="font-body text-xs font-medium text-white drop-shadow">
                        {statusLabel(entry.status)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Remove button — only for pending/error */}
                {(entry.status === 'pending' || entry.status === 'error') && (
                  <button
                    type="button"
                    aria-label="Eliminar imagen"
                    onClick={() => removeEntry(entry.id)}
                    className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-pill bg-black/60 text-white hover:bg-black/80 focus:outline-none"
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                )}

                {/* Error tooltip */}
                {entry.status === 'error' && entry.errorMessage && (
                  <p
                    title={entry.errorMessage}
                    className="absolute bottom-1 left-1 right-1 truncate font-body text-xs text-white drop-shadow"
                  >
                    {entry.errorMessage}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {entries.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          {allDone ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate(`/e/${eventId}/gallery`)}
              icon={<CheckCircle className="w-4 h-4" aria-hidden="true" />}
            >
              Ver galería
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="md"
                disabled={isUploading}
                onClick={() => {
                  entries.forEach((e) => URL.revokeObjectURL(e.previewUrl));
                  setEntries([]);
                }}
              >
                Limpiar
              </Button>
              <Button
                variant="primary"
                size="md"
                loading={isUploading}
                disabled={isUploading || !hasPending || needsOtp}
                onClick={handleUploadAll}
                icon={<Upload className="w-4 h-4" aria-hidden="true" />}
              >
                {isUploading ? 'Subiendo...' : `Subir ${entries.filter((e) => e.status === 'pending' || e.status === 'error').length} foto${entries.length === 1 ? '' : 's'}`}
              </Button>
            </>
          )}
        </div>
      )}
    </PageLayout>
  );
}
