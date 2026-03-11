import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, Check, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import AdminLayout from '@/components/layout/AdminLayout';
import PaymentGate from '@/components/admin/PaymentGate';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import ShareCard from '@/components/admin/ShareCard';
import QRStatsCard from '@/components/admin/QRStatsCard';
import { useEvent } from '@/hooks/useEvent';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// QRPage — /e/:eventId/admin/qr
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env.VITE_FRONTEND_URL || window.location.origin;

export default function QRPage() {
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

  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const eventUrl = `${BASE_URL}/e/${eventId}`;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  }

  function handleDownloadQR() {
    const svgEl = qrRef.current?.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new window.Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx?.scale(2, 2);
      ctx?.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `qr-${eventId}.png`;
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  }

  if (eventLoading) {
    return (
      <AdminLayout
        title="Código QR"
        onBack={() => navigate(`/e/${eventId}/admin`)}
      >
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AdminLayout>
    );
  }

  // QR card content (shared)
  const qrContent = (
    <Card padding="lg">
      {/* Event title */}
      <div className="text-center mb-4">
        <h2 className="font-heading text-xl font-bold text-primary mb-1">
          {event?.title ?? 'Evento'}
        </h2>
        <p className="font-body text-sm text-secondary">
          Comparte este enlace con tus invitados para que accedan al evento.
        </p>
      </div>

      <div ref={qrRef} className="flex items-center justify-center mb-4 p-4 bg-white rounded-card">
        <QRCodeSVG
          value={eventUrl}
          size={220}
          level="H"
          includeMargin
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>

      {/* URL text */}
      <div className="bg-muted rounded-card px-4 py-3 mb-4">
        <p className="font-body text-sm text-primary text-center break-all select-all">
          {eventUrl}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="primary"
          size="md"
          fullWidth
          icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          onClick={handleCopyLink}
        >
          {copied ? 'Copiado' : 'Copiar enlace'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="md"
          fullWidth
          icon={<Download className="w-4 h-4" />}
          onClick={handleDownloadQR}
        >
          Descargar QR
        </Button>
      </div>
    </Card>
  );

  return (
    <AdminLayout
      title="Código QR"
      onBack={() => navigate(`/e/${eventId}/admin`)}
      tier={event?.tier}
    >
      <PaymentGate eventId={eventId!} paymentStatus={event?.paymentStatus} tier={event?.tier ?? 'basic'}>
      {/* Mobile: stacked */}
      <AdminLayout.Mobile>
        <div className="space-y-4">
          {qrContent}
          <ShareCard eventUrl={eventUrl} eventTitle={event?.title ?? 'Evento'} />

          <QRStatsCard eventId={eventId!} />
        </div>
      </AdminLayout.Mobile>

      {/* Desktop: two-column */}
      <AdminLayout.Desktop cols={5} gap={8}>
        <AdminLayout.Column span={3}>
          {qrContent}
        </AdminLayout.Column>
        <AdminLayout.Column span={2}>
          <ShareCard eventUrl={eventUrl} eventTitle={event?.title ?? 'Evento'} />

          <QRStatsCard eventId={eventId!} />
        </AdminLayout.Column>
      </AdminLayout.Desktop>
      </PaymentGate>
    </AdminLayout>
  );
}
