import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Type,
  Calendar,
  Trash2,
  MapPin,
  Clock,
  ImagePlus,
  Plus,
  X,
  Eye,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import PaymentGate from '@/components/admin/PaymentGate';
import SectionCard from '@/components/ui/SectionCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import { useEvent } from '@/hooks/useEvent';
import { useAuthStore } from '@/stores/authStore';
import * as api from '@/services/api';
import type { ScheduleItem } from '@/services/api';

// ---------------------------------------------------------------------------
// TextArea — MUST be outside the component to avoid focus loss on re-render
// ---------------------------------------------------------------------------
function TextArea({
  label,
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  disabled,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-body text-sm font-medium text-primary mb-1.5">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        className={[
          'w-full border rounded-card px-3 py-2.5 font-body text-sm text-primary',
          'placeholder:text-tertiary bg-white resize-y',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-accent-light focus:border-accent',
          'border-border-strong',
          'disabled:opacity-50',
        ].join(' ')}
      />
      {maxLength && (
        <p className="font-body text-xs text-tertiary text-right mt-1">
          {value.length}/{maxLength}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LobbyPreview — mini preview of how the guest lobby will look
// ---------------------------------------------------------------------------
function LobbyPreview({
  title,
  coverUrl,
  startDate,
  location,
  hostName,
}: {
  title: string;
  coverUrl?: string | null;
  startDate: string;
  location: string;
  hostName?: string;
}) {
  const formattedDate = startDate
    ? new Date(startDate).toLocaleDateString('es-GT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <div className="relative w-full aspect-[9/16] max-h-80 rounded-modal overflow-hidden bg-muted shadow-card">
      {coverUrl ? (
        <img
          src={coverUrl}
          alt="Portada del evento"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent-light to-muted flex items-center justify-center">
          <ImagePlus className="w-12 h-12 text-border-strong" aria-hidden="true" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="font-heading text-lg font-bold text-white leading-tight truncate">
          {title || 'Título del evento'}
        </h3>
        {formattedDate && (
          <p className="font-body text-xs text-white/80 mt-1">{formattedDate}</p>
        )}
        {location && (
          <p className="font-body text-xs text-white/70 mt-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3" aria-hidden="true" />
            {location}
          </p>
        )}
        {hostName && (
          <p className="font-body text-[11px] text-white/60 mt-0.5 italic">
            Hosted by {hostName}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScheduleEditor — add/remove schedule items with time picker
// ---------------------------------------------------------------------------
function ScheduleEditor({
  items,
  onChange,
  disabled,
}: {
  items: ScheduleItem[];
  onChange: (items: ScheduleItem[]) => void;
  disabled: boolean;
}) {
  function addItem() {
    onChange([...items, { time: '', label: '', icon: 'clock' }]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ScheduleItem, value: string) {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item,
    );
    onChange(updated);
  }

  // Format 24h time to display string like "4:00 PM"
  function formatTime(time24: string): string {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    if (h === undefined || m === undefined) return time24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-start gap-2">
          <div className="flex-shrink-0 pt-2">
            <button
              type="button"
              onClick={() =>
                updateItem(idx, 'icon', item.icon === 'clock' ? 'location' : 'clock')
              }
              disabled={disabled}
              className="flex items-center justify-center w-8 h-8 rounded-card bg-accent-light text-accent hover:bg-accent hover:text-white transition-colors"
              title={item.icon === 'clock' ? 'Hora' : 'Lugar'}
            >
              {item.icon === 'location' ? (
                <MapPin className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Clock className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <div className="flex-1 grid grid-cols-[110px_1fr] gap-2">
            <input
              type="time"
              value={item.time}
              onChange={(e) => updateItem(idx, 'time', e.target.value)}
              disabled={disabled}
              className="border border-border-strong rounded-card px-2 py-1.5 font-body text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-light focus:border-accent disabled:opacity-50"
            />
            <input
              type="text"
              value={item.label}
              onChange={(e) => updateItem(idx, 'label', e.target.value)}
              placeholder="Ceremonia"
              disabled={disabled}
              className="border border-border-strong rounded-card px-2 py-1.5 font-body text-sm text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-light focus:border-accent disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            onClick={() => removeItem(idx)}
            disabled={disabled}
            className="flex-shrink-0 mt-2 text-tertiary hover:text-accent-coral transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      {items.length > 0 && items.some((i) => i.time) && (
        <p className="font-body text-xs text-tertiary ml-10">
          {items.filter((i) => i.time).map((i) => `${formatTime(i.time)} — ${i.label || '...'}`).join(' · ')}
        </p>
      )}
      <button
        type="button"
        onClick={addItem}
        disabled={disabled}
        className="flex items-center gap-1.5 font-body text-sm text-accent hover:underline focus:outline-none disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        Agregar horario
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Duration options (for "Recibir fotos durante...")
// ---------------------------------------------------------------------------
const DURATION_OPTIONS = [
  { label: '24 horas', hours: 24 },
  { label: '36 horas', hours: 36 },
  { label: '48 horas', hours: 48 },
  { label: '3 días', hours: 72 },
  { label: '7 días', hours: 168 },
];

function computeEndDate(startDate: string, hours: number): string {
  if (!startDate) return '';
  const d = new Date(startDate);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function detectDuration(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 24;
  const diffMs = new Date(endDate).getTime() - new Date(startDate).getTime();
  const diffH = Math.round(diffMs / (1000 * 60 * 60));
  const match = DURATION_OPTIONS.find((o) => o.hours === diffH);
  return match ? match.hours : 24;
}

// ---------------------------------------------------------------------------
// EditEventPage — /e/:eventId/admin/edit
// ---------------------------------------------------------------------------
export default function EditEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuthStore();

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated() || role !== 'host') {
      navigate('/auth/host', { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  const { data: event, isLoading: eventLoading } = useEvent(eventId);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [footerText, setFooterText] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [location, setLocation] = useState('');
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState(24);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill form when event data loads
  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setFooterText(event.footerText || '');
      setWelcomeMessage(event.welcomeMessage || '');
      setLocation(event.location || '');
      setSchedule(event.schedule || []);
      setStartDate(event.startDate ? event.startDate.slice(0, 16) : '');
      setDuration(detectDuration(event.startDate, event.endDate));
      setCoverUrl(event.coverUrl || null);
    }
  }, [event]);

  // Cover image upload
  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !eventId) return;

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes para la portada.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen de portada debe ser menor a 10MB.');
      return;
    }

    setIsUploadingCover(true);
    setError('');

    try {
      const { uploadUrl, s3Key } = await api.getUploadUrl(eventId, {
        fileType: file.type,
        fileSize: file.size,
        type: 'cover',
      });

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      await api.updateEvent(eventId, { coverUrl: s3Key } as Partial<api.EventData>);
      setCoverUrl(URL.createObjectURL(file));
      setSuccess('Portada actualizada.');
    } catch {
      setError('Error al subir la portada. Intenta de nuevo.');
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId) return;

    if (!title.trim()) {
      setError('El título del evento es obligatorio.');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const endDate = computeEndDate(startDate, duration);

      const data: Partial<api.EventData> = {
        title: title.trim(),
        description: description.trim() || undefined,
        footerText: footerText.trim() || undefined,
        welcomeMessage: welcomeMessage.trim() || undefined,
        location: location.trim() || undefined,
        schedule: schedule.filter((s) => s.time && s.label),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      await api.updateEvent(eventId, data);
      setSuccess('Cambios guardados correctamente.');
    } catch (err) {
      const apiErr = err as api.ApiError;
      setError(apiErr.message || 'No se pudieron guardar los cambios. Intenta más tarde.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!eventId) return;
    setIsDeleting(true);
    setError('');

    try {
      await api.deleteEvent(eventId);
      navigate('/', { replace: true });
    } catch (err) {
      const apiErr = err as api.ApiError;
      setError(apiErr.message || 'No se pudo eliminar el evento. Intenta más tarde.');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  }

  if (eventLoading) {
    return (
      <AdminLayout
        title="Editar evento"
        onBack={() => navigate(`/e/${eventId}/admin`)}
      >
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AdminLayout>
    );
  }

  // Cover upload section
  const coverSection = (
    <div>
      <label className="block font-body text-sm font-medium text-primary mb-1.5">
        Imagen de portada
      </label>
      <div
        className={[
          'relative w-full aspect-video rounded-card overflow-hidden border-2 border-dashed',
          coverUrl ? 'border-accent' : 'border-border-strong',
          'bg-muted transition-colors',
        ].join(' ')}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt="Portada del evento"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-tertiary">
            <ImagePlus className="w-8 h-8 mb-2" aria-hidden="true" />
            <span className="font-body text-sm">Sube una imagen de portada</span>
          </div>
        )}
        {isUploadingCover && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Spinner size="md" />
          </div>
        )}
      </div>
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        onChange={handleCoverUpload}
        className="hidden"
        id="cover-upload"
      />
      <div className="flex gap-2 mt-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<ImagePlus className="w-4 h-4" />}
          onClick={() => coverInputRef.current?.click()}
          disabled={isUploadingCover}
          loading={isUploadingCover}
        >
          {coverUrl ? 'Cambiar portada' : 'Subir portada'}
        </Button>
      </div>
    </div>
  );

  // Form fields
  const eventDetailsFields = (
    <>
      {coverSection}
      <Input
        label="Título del evento"
        type="text"
        id="event-title"
        placeholder="Mi evento especial"
        icon={<Type className="w-4 h-4" aria-hidden="true" />}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={isSaving}
      />
      <TextArea
        label="Descripción"
        id="event-description"
        placeholder="Describe tu evento: qué se celebra, dónde será, qué esperar..."
        value={description}
        onChange={setDescription}
        rows={5}
        maxLength={2000}
        disabled={isSaving}
      />
      <Input
        label="Ubicación"
        type="text"
        id="event-location"
        placeholder="Antigua Guatemala, Sacatepéquez"
        icon={<MapPin className="w-4 h-4" aria-hidden="true" />}
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        disabled={isSaving}
      />
    </>
  );

  const scheduleSection = (
    <div>
      <label className="block font-body text-sm font-medium text-primary mb-1.5">
        Horario del evento
      </label>
      <ScheduleEditor items={schedule} onChange={setSchedule} disabled={isSaving} />
    </div>
  );

  const messageFields = (
    <>
      <TextArea
        label="Mensaje de bienvenida"
        id="event-welcome"
        placeholder="Bienvenidos! Explora la galería, sube tus fotos y deja mensajes para nosotros..."
        value={welcomeMessage}
        onChange={setWelcomeMessage}
        rows={4}
        maxLength={1000}
        disabled={isSaving}
      />
      <TextArea
        label="Texto del pie de página"
        id="event-footer"
        placeholder="Gracias por celebrar con nosotros. ¡Sube tus fotos favoritas!"
        value={footerText}
        onChange={setFooterText}
        rows={3}
        maxLength={500}
        disabled={isSaving}
      />
    </>
  );

  const dateFields = (
    <div className="space-y-4">
      <Input
        label="Fecha y hora de inicio"
        type="datetime-local"
        id="event-start"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        icon={<Calendar className="w-4 h-4" aria-hidden="true" />}
        disabled={isSaving}
      />
      <div>
        <label htmlFor="event-duration" className="block font-body text-sm font-medium text-primary mb-1.5">
          Recibir fotos durante
        </label>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.hours}
              type="button"
              onClick={() => setDuration(opt.hours)}
              disabled={isSaving}
              className={[
                'px-3 py-1.5 rounded-pill font-body text-sm transition-colors',
                'border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                duration === opt.hours
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white text-secondary border-border-strong hover:border-accent hover:text-primary',
                'disabled:opacity-50',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {startDate && (
          <p className="font-body text-xs text-tertiary mt-2">
            Fotos se recibirán hasta{' '}
            {new Date(computeEndDate(startDate, duration)).toLocaleDateString('es-GT', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </div>
  );

  // Messages + save button
  const formActions = (
    <>
      {error && (
        <p className="font-body text-sm text-accent-coral" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="font-body text-sm text-accent" role="status">
          {success}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={isSaving}
        disabled={isSaving}
      >
        {isSaving ? 'Guardando...' : 'Guardar cambios'}
      </Button>
    </>
  );

  // Danger zone
  const dangerZone = (
    <SectionCard variant="danger">
      <SectionCard.Header title="Zona peligrosa" />
      <SectionCard.Body>
        <p className="font-body text-sm text-secondary mb-4">
          Eliminar el evento borrará todas las fotos y datos asociados. Esta acción no se puede deshacer.
        </p>

        {!showDeleteConfirm ? (
          <Button
            type="button"
            variant="danger"
            size="md"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
          >
            Eliminar evento
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="font-body text-sm font-medium text-accent-coral">
              ¿Estás seguro? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="danger"
                size="md"
                loading={isDeleting}
                disabled={isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? 'Eliminando...' : 'Confirmar eliminación'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </SectionCard.Body>
    </SectionCard>
  );

  return (
    <AdminLayout
      title="Editar evento"
      onBack={() => navigate(`/e/${eventId}/admin`)}
      tier={event?.tier}
    >
      <PaymentGate eventId={eventId!} paymentStatus={event?.paymentStatus} tier={event?.tier ?? 'basic'}>
      {/* Mobile: stacked */}
      <AdminLayout.Mobile>
        {/* Preview toggle */}
        <div className="mb-4">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Eye className="w-4 h-4" />}
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? 'Ocultar vista previa' : 'Vista previa del lobby'}
          </Button>
        </div>

        {showPreview && (
          <div className="mb-6 flex justify-center">
            <div className="w-48">
              <LobbyPreview
                title={title}
                coverUrl={coverUrl}
                startDate={startDate}
                location={location}
                hostName={event?.hostName}
              />
            </div>
          </div>
        )}

        <form onSubmit={handleSave} noValidate className="space-y-4 mb-4">
          {eventDetailsFields}
          {scheduleSection}
          {messageFields}
          {dateFields}
          {formActions}
        </form>
        <div className="mt-4">{dangerZone}</div>
      </AdminLayout.Mobile>

      {/* Desktop: three-column */}
      <AdminLayout.Desktop cols={5} gap={8}>
        <form onSubmit={handleSave} noValidate className="contents">
          <AdminLayout.Column span={3}>
            <SectionCard>
              <SectionCard.Header title="Detalles del evento" />
              <SectionCard.Body className="space-y-4">
                {eventDetailsFields}
                {scheduleSection}
              </SectionCard.Body>
            </SectionCard>
            <SectionCard className="mt-6">
              <SectionCard.Header title="Mensajes" />
              <SectionCard.Body className="space-y-4">
                {messageFields}
                {formActions}
              </SectionCard.Body>
            </SectionCard>
          </AdminLayout.Column>
          <AdminLayout.Column span={2}>
            <SectionCard>
              <SectionCard.Header title="Vista previa del lobby" />
              <SectionCard.Body>
                <LobbyPreview
                  title={title}
                  coverUrl={coverUrl}
                  startDate={startDate}
                  location={location}
                  hostName={event?.hostName}
                />
              </SectionCard.Body>
            </SectionCard>
            <SectionCard className="mt-6">
              <SectionCard.Header title="Fechas del evento" />
              <SectionCard.Body>
                {dateFields}
              </SectionCard.Body>
            </SectionCard>
            {dangerZone}
          </AdminLayout.Column>
        </form>
      </AdminLayout.Desktop>
      </PaymentGate>
    </AdminLayout>
  );
}
