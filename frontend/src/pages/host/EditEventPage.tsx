import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Type,
  AlignLeft,
  MessageSquare,
  Calendar,
  Lock,
  Trash2,
  FileText,
} from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import { useEvent } from '@/hooks/useEvent';
import { useAuthStore } from '@/stores/authStore';
import * as api from '@/services/api';

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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [guestPassword, setGuestPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Pre-fill form when event data loads
  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setFooterText(event.footerText || '');
      setWelcomeMessage(event.welcomeMessage || '');
      setStartDate(event.startDate ? event.startDate.slice(0, 16) : '');
      setEndDate(event.endDate ? event.endDate.slice(0, 16) : '');
    }
  }, [event]);

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
      const data: Partial<api.EventData> = {
        title: title.trim(),
        description: description.trim() || undefined,
        footerText: footerText.trim() || undefined,
        welcomeMessage: welcomeMessage.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      await api.updateEvent(eventId, data);

      // If password was provided, include it separately (not part of EventData but sent to API)
      if (guestPassword.trim()) {
        await api.updateEvent(eventId, { guestPassword: guestPassword.trim() } as Partial<api.EventData>);
      }

      setSuccess('Cambios guardados correctamente.');
      setGuestPassword('');
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
      <PageLayout
        title="Editar evento"
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
      title="Editar evento"
      showBack
      onBack={() => navigate(`/e/${eventId}/admin`)}
    >
      <form onSubmit={handleSave} noValidate className="space-y-4 mb-8">
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

        <Input
          label="Descripción"
          type="text"
          id="event-description"
          placeholder="Describe tu evento..."
          icon={<AlignLeft className="w-4 h-4" aria-hidden="true" />}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSaving}
        />

        <Input
          label="Mensaje de bienvenida"
          type="text"
          id="event-welcome"
          placeholder="Bienvenidos a nuestro evento"
          icon={<MessageSquare className="w-4 h-4" aria-hidden="true" />}
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          disabled={isSaving}
        />

        <Input
          label="Texto del pie de página"
          type="text"
          id="event-footer"
          placeholder="Texto opcional al pie"
          icon={<FileText className="w-4 h-4" aria-hidden="true" />}
          value={footerText}
          onChange={(e) => setFooterText(e.target.value)}
          disabled={isSaving}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Fecha de inicio"
            type="datetime-local"
            id="event-start"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            icon={<Calendar className="w-4 h-4" aria-hidden="true" />}
            disabled={isSaving}
          />

          <Input
            label="Fecha de fin"
            type="datetime-local"
            id="event-end"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            icon={<Calendar className="w-4 h-4" aria-hidden="true" />}
            disabled={isSaving}
          />
        </div>

        <Input
          label="Nueva contraseña de invitados (dejar vacío para no cambiar)"
          type="text"
          id="event-password"
          placeholder="Nueva contraseña..."
          icon={<Lock className="w-4 h-4" aria-hidden="true" />}
          value={guestPassword}
          onChange={(e) => setGuestPassword(e.target.value)}
          disabled={isSaving}
        />

        {/* Messages */}
        {error && (
          <p className="font-body text-sm text-accent-coral" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="font-body text-sm text-accent-green" role="status">
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
      </form>

      {/* Danger zone */}
      <Card padding="lg" className="border border-accent-coral/30">
        <h2 className="font-heading text-base font-semibold text-accent-coral mb-2">
          Zona peligrosa
        </h2>
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
              ¿Estás seguro? Escribe el nombre del evento para confirmar.
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
      </Card>
    </PageLayout>
  );
}
