import { MessageCircle, Mail, Printer } from 'lucide-react';
import SectionCard from '@/components/ui/SectionCard';
import Button from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// ShareCard — WhatsApp, Email, Print sharing options
// ---------------------------------------------------------------------------

interface ShareCardProps {
  eventUrl: string;
  eventTitle: string;
}

export default function ShareCard({ eventUrl, eventTitle }: ShareCardProps) {
  const shareText = `Unete al evento "${eventTitle}" y comparte tus fotos: ${eventUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const mailUrl = `mailto:?subject=${encodeURIComponent(`Invitacion: ${eventTitle}`)}&body=${encodeURIComponent(shareText)}`;

  function handlePrint() {
    window.print();
  }

  return (
    <SectionCard>
      <SectionCard.Header title="Compartir" />
      <SectionCard.Body>
        <div className="space-y-2">
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            icon={<MessageCircle className="w-4 h-4" />}
            onClick={() => window.open(whatsappUrl, '_blank')}
          >
            WhatsApp
          </Button>
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            icon={<Mail className="w-4 h-4" />}
            onClick={() => window.open(mailUrl, '_blank')}
          >
            Email
          </Button>
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            icon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Imprimir tarjetas de mesa
          </Button>
        </div>
      </SectionCard.Body>
    </SectionCard>
  );
}
