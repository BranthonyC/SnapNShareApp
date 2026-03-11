import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, Sparkles } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import PaymentGate from '@/components/admin/PaymentGate';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { useEvent } from '@/hooks/useEvent';
import * as api from '@/services/api';
import type { ApiError } from '@/services/api';

type Currency = 'USD' | 'GTQ';

interface UpgradeTier {
  id: string;
  name: string;
  priceUSD: number;
  priceGTQ: number;
  upgradePriceUSD: number;
  upgradePriceGTQ: number;
  uploads: number;
  duration: string;
  features: string[];
  badge?: string;
  badgeStyle?: string;
}

// Full tier definitions
const ALL_TIERS: Record<string, {
  name: string;
  priceUSD: number;
  priceGTQ: number;
  uploads: number;
  duration: string;
  features: string[];
  badge?: string;
  badgeStyle?: string;
}> = {
  basic: {
    name: 'Básico',
    priceUSD: 1,
    priceGTQ: 8,
    uploads: 150,
    duration: '15 días',
    features: [
      '150 fotos por evento',
      'Galería con código QR',
      'Solo imágenes',
      'Álbum activo por 15 días',
    ],
  },
  paid: {
    name: 'Estándar',
    priceUSD: 15,
    priceGTQ: 116,
    uploads: 500,
    duration: '6 meses',
    badge: 'Popular',
    badgeStyle: 'bg-accent text-white',
    features: [
      '500 fotos por evento',
      'Imágenes + video',
      'Verificación OTP por email / SMS',
      'Descargas habilitadas',
      'Álbum activo por 6 meses',
    ],
  },
  premium: {
    name: 'Premium',
    priceUSD: 30,
    priceGTQ: 232,
    uploads: 1000,
    duration: '1 año',
    badge: 'Premium',
    badgeStyle: 'bg-accent-gold text-white',
    features: [
      '1 000 fotos por evento',
      'Todas las funciones de Estándar',
      'Moderación automática de contenido',
      'Videos incluidos',
      'Álbum activo por 1 año',
      'Almacenamiento Glacier por 2 años',
    ],
  },
};

const TIER_ORDER: Record<string, number> = { basic: 0, paid: 1, premium: 2 };

function getUpgradeTiers(currentTier: string): UpgradeTier[] {
  const currentRank = TIER_ORDER[currentTier] ?? 0;
  const currentPriceUSD = ALL_TIERS[currentTier]?.priceUSD ?? 0;
  const currentPriceGTQ = ALL_TIERS[currentTier]?.priceGTQ ?? 0;

  return Object.entries(ALL_TIERS)
    .filter(([id]) => (TIER_ORDER[id] ?? 0) > currentRank)
    .map(([id, tier]) => ({
      id,
      ...tier,
      upgradePriceUSD: tier.priceUSD - currentPriceUSD,
      upgradePriceGTQ: tier.priceGTQ - currentPriceGTQ,
    }));
}

export default function UpgradePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const eventQuery = useEvent(eventId);
  const event = eventQuery.data;
  const isLoading = eventQuery.isLoading;

  const [currency, setCurrency] = useState<Currency>('USD');
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  if (isLoading) {
    return (
      <AdminLayout title="Mejorar plan" onBack={() => navigate(`/e/${eventId}/admin`)} tier={event?.tier}>
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AdminLayout>
    );
  }

  const currentTier = event?.tier ?? 'basic';
  const currentTierInfo = ALL_TIERS[currentTier];
  const upgradeTiers = getUpgradeTiers(currentTier);

  // Premium events can't upgrade
  if (currentTier === 'premium' || upgradeTiers.length === 0) {
    return (
      <AdminLayout title="Mejorar plan" onBack={() => navigate(`/e/${eventId}/admin`)} tier={event?.tier}>
        <PaymentGate eventId={eventId!} paymentStatus={event?.paymentStatus} tier={currentTier}>
          <div className="flex items-center justify-center min-h-[40vh]">
            <Card padding="lg" className="max-w-md w-full text-center">
              <Sparkles className="w-10 h-10 text-accent mx-auto mb-4" />
              <h2 className="font-heading text-xl font-bold text-primary mb-2">
                Ya tienes el plan más alto
              </h2>
              <p className="font-body text-sm text-secondary mb-6">
                Tu evento ya tiene el plan Premium con todas las funciones disponibles.
              </p>
              <Button variant="secondary" size="md" onClick={() => navigate(`/e/${eventId}/admin`)}>
                Volver al panel
              </Button>
            </Card>
          </div>
        </PaymentGate>
      </AdminLayout>
    );
  }

  // Auto-select the first upgrade tier if none selected
  const activeTier = selectedTier ?? upgradeTiers[0]!.id;

  async function handleUpgrade() {
    if (!activeTier || !eventId) return;
    setIsProcessing(true);
    setError('');

    try {
      const checkout = await api.createCheckout(eventId, {
        tier: activeTier,
        currency,
        isUpgrade: true,
      });
      window.location.href = checkout.checkoutUrl;
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'No se pudo iniciar el pago. Intenta más tarde.');
      setIsProcessing(false);
    }
  }

  const activeUpgrade = upgradeTiers.find((t) => t.id === activeTier)!;
  const upgradePrice = currency === 'USD'
    ? `$${activeUpgrade.upgradePriceUSD}`
    : `Q${activeUpgrade.upgradePriceGTQ}`;

  return (
    <AdminLayout title="Mejorar plan" onBack={() => navigate(`/e/${eventId}/admin`)} tier={event?.tier}>
      <PaymentGate eventId={eventId!} paymentStatus={event?.paymentStatus} tier={currentTier}>
        {/* Current plan */}
        <Card padding="md" className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body text-xs text-secondary">Tu plan actual</p>
              <p className="font-heading text-lg font-bold text-primary">
                {currentTierInfo?.name ?? currentTier}
              </p>
            </div>
            <span className="font-body text-sm text-secondary">
              {currentTierInfo?.uploads} fotos &middot; {currentTierInfo?.duration}
            </span>
          </div>
        </Card>

        <h2 className="font-heading text-base font-semibold text-primary mb-2">
          Elige tu nuevo plan
        </h2>
        <p className="font-body text-sm text-secondary mb-4">
          Solo pagas la diferencia. Tu evento se actualizará de inmediato.
        </p>

        {/* Currency toggle */}
        <div className="flex items-center gap-2 mb-6">
          <span className="font-body text-sm text-secondary">Moneda:</span>
          <div className="inline-flex rounded-pill border border-border-subtle overflow-hidden">
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={[
                'px-4 py-1.5 font-body text-sm font-medium transition-colors',
                currency === 'USD'
                  ? 'bg-accent text-white'
                  : 'bg-white text-secondary hover:bg-muted',
              ].join(' ')}
            >
              USD
            </button>
            <button
              type="button"
              onClick={() => setCurrency('GTQ')}
              className={[
                'px-4 py-1.5 font-body text-sm font-medium transition-colors',
                currency === 'GTQ'
                  ? 'bg-accent text-white'
                  : 'bg-white text-secondary hover:bg-muted',
              ].join(' ')}
            >
              GTQ
            </button>
          </div>
        </div>

        {/* Upgrade tier cards */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {upgradeTiers.map((tier) => {
            const isSelected = activeTier === tier.id;
            const displayPrice = currency === 'USD'
              ? `$${tier.upgradePriceUSD}`
              : `Q${tier.upgradePriceGTQ}`;
            const fullPrice = currency === 'USD'
              ? `$${tier.priceUSD}`
              : `Q${tier.priceGTQ}`;

            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => setSelectedTier(tier.id)}
                className={[
                  'relative flex flex-col text-left rounded-card shadow-card bg-card border-2 overflow-hidden transition-all',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                  isSelected
                    ? 'border-accent ring-1 ring-accent'
                    : 'border-border-subtle hover:border-border-strong',
                ].join(' ')}
              >
                {tier.badge && (
                  <div className="absolute top-3 right-3">
                    <span
                      className={[
                        'inline-block px-2 py-0.5 rounded-pill text-xs font-semibold font-body',
                        tier.badgeStyle ?? '',
                      ].join(' ')}
                    >
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className="p-5 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={[
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'border-accent bg-accent'
                          : 'border-border-strong bg-white',
                      ].join(' ')}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 text-white" aria-hidden="true" />
                      )}
                    </div>
                    <h3 className="font-heading text-lg font-bold text-primary">
                      {tier.name}
                    </h3>
                  </div>

                  <div className="flex items-end gap-1 mb-1">
                    <span className="font-heading text-3xl font-bold text-primary">
                      {displayPrice}
                    </span>
                  </div>
                  <p className="font-body text-xs text-tertiary mb-4">
                    Precio total: {fullPrice} &minus; tu plan actual = {displayPrice}
                  </p>

                  <ul className="space-y-2">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check
                          className="w-4 h-4 text-accent shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span className="font-body text-sm text-secondary">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-card bg-red-50 border border-accent-coral" role="alert">
            <p className="font-body text-sm text-accent-coral">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="secondary"
            size="md"
            icon={<ChevronLeft className="w-4 h-4" />}
            onClick={() => navigate(`/e/${eventId}/admin`)}
          >
            Volver
          </Button>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isProcessing}
            disabled={isProcessing}
            onClick={handleUpgrade}
            icon={<Sparkles className="w-4 h-4" />}
          >
            {isProcessing ? 'Procesando...' : `Mejorar a ${activeUpgrade.name} por ${upgradePrice}`}
          </Button>
        </div>
      </PaymentGate>
    </AdminLayout>
  );
}
