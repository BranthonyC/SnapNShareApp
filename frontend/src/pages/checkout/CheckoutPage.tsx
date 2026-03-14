import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  Mail,
  Calendar,
  FileText,
  Check,
  Tag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import Logo from '@/components/ui/Logo';
import * as api from '@/services/api';
import type { ApiError } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// CheckoutPage — /checkout
// 3-step wizard: Contact -> Event Details -> Plan Selection + Payment
// ---------------------------------------------------------------------------

type Currency = 'USD' | 'GTQ';

interface TierInfo {
  id: string;
  name: string;
  priceUSD: number;
  priceGTQ: number;
  uploads: number;
  duration: string;
  features: string[];
  badge?: string;
  badgeStyle?: string;
  highlighted: boolean;
}

const TIERS: TierInfo[] = [
  {
    id: 'basic',
    name: 'Básico',
    priceUSD: 1,
    priceGTQ: 8,
    uploads: 150,
    duration: '15 días',
    features: [
      '150 fotos por evento',
      'Galería con código QR',
      'Fotos aceptadas por 24 horas',
      'Álbum activo por 15 días',
      'Solo imágenes',
    ],
    highlighted: false,
  },
  {
    id: 'paid',
    name: 'Estándar',
    priceUSD: 15,
    priceGTQ: 116,
    uploads: 500,
    duration: '6 meses',
    badge: 'Popular',
    badgeStyle: 'bg-accent text-white',
    highlighted: true,
    features: [
      '500 fotos por evento',
      'Imágenes + video',
      'Verificación OTP por email / SMS',
      'Descargas habilitadas',
      'Álbum activo por 6 meses',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    priceUSD: 30,
    priceGTQ: 232,
    uploads: 1000,
    duration: '1 año',
    badge: 'Premium',
    badgeStyle: 'bg-accent-gold text-white',
    highlighted: false,
    features: [
      '1 000 fotos por evento',
      'Todas las funciones de Estándar',
      'Moderación automática de contenido',
      'Videos incluidos',
      'Álbum activo por 1 año',
      'Almacenamiento Glacier por 2 años',
    ],
  },
];

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------
function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { num: 1, label: 'Contacto' },
    { num: 2, label: 'Evento' },
    { num: 3, label: 'Plan y pago' },
  ] as const;

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, idx) => (
        <div key={s.num} className="flex items-center gap-2">
          <div
            className={[
              'flex items-center justify-center w-8 h-8 rounded-full font-body text-sm font-semibold transition-colors',
              current >= s.num
                ? 'bg-accent text-white'
                : 'bg-muted text-tertiary',
            ].join(' ')}
          >
            {current > s.num ? (
              <Check className="w-4 h-4" aria-hidden="true" />
            ) : (
              s.num
            )}
          </div>
          <span
            className={[
              'font-body text-xs hidden sm:inline',
              current >= s.num ? 'text-primary font-medium' : 'text-tertiary',
            ].join(' ')}
          >
            {s.label}
          </span>
          {idx < steps.length - 1 && (
            <div
              className={[
                'w-8 h-0.5 rounded-full',
                current > s.num ? 'bg-accent' : 'bg-border-subtle',
              ].join(' ')}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setHostAuth } = useAuthStore();

  const preselectedTier = searchParams.get('tier') || '';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Step 1 — Contact
  const [hostName, setHostName] = useState('');
  const [hostEmail, setHostEmail] = useState('');

  // Step 2 — Event details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');

  // Step 3 — Plan
  const [selectedTier, setSelectedTier] = useState(
    TIERS.find((t) => t.id === preselectedTier)?.id ?? 'paid',
  );
  const [currency, setCurrency] = useState<Currency>('USD');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoDiscount, setPromoDiscount] = useState<{ type: string; value: number } | null>(null);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  function validateStep1(): boolean {
    if (!hostName.trim()) {
      setError('Por favor ingresa tu nombre.');
      return false;
    }
    if (!hostEmail.trim()) {
      setError('Por favor ingresa tu correo electrónico.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hostEmail.trim())) {
      setError('Por favor ingresa un correo electrónico válido.');
      return false;
    }
    return true;
  }

  function validateStep2(): boolean {
    if (!title.trim()) {
      setError('Por favor ingresa el nombre del evento.');
      return false;
    }
    if (!startDate) {
      setError('Por favor selecciona la fecha del evento.');
      return false;
    }
    return true;
  }

  function handleNext() {
    setError('');
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  }

  function handleBack() {
    setError('');
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  // ---------------------------------------------------------------------------
  // Promo code
  // ---------------------------------------------------------------------------
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  async function handleApplyPromo() {
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      setPromoError('Ingresa un código promocional.');
      return;
    }
    setIsValidatingPromo(true);
    setPromoError('');
    try {
      // validatePromo backend doesn't use eventId, pass placeholder
      const res = await api.validatePromo('_', code, selectedTier, currency);
      if (!res.valid) {
        setPromoError(res.reason || 'Código no válido.');
        setPromoApplied(false);
        setPromoDiscount(null);
      } else {
        setPromoApplied(true);
        setPromoDiscount(res.type && res.value != null ? { type: res.type, value: res.value } : null);
      }
    } catch {
      setPromoError('No se pudo validar el código. Intenta de nuevo.');
      setPromoApplied(false);
      setPromoDiscount(null);
    } finally {
      setIsValidatingPromo(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Create event
  // ---------------------------------------------------------------------------
  async function handleCreateEvent() {
    setIsLoading(true);
    setError('');

    try {
      // Build ISO string with timezone offset from the datetime-local value
      const localDate = new Date(startDate);
      const offsetMinutes = localDate.getTimezoneOffset();
      const sign = offsetMinutes <= 0 ? '+' : '-';
      const absH = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
      const absM = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
      const startDateISO = `${startDate}:00${sign}${absH}:${absM}`;

      const res = await api.createEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        hostEmail: hostEmail.trim(),
        hostName: hostName.trim(),
        startDate: startDateISO,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        tier: selectedTier,
      });

      // Store the JWT token so the user is authenticated
      setHostAuth(res.token, res.eventId);

      try {
        const checkout = await api.createCheckout(res.eventId, {
          tier: selectedTier,
          currency,
          discountCode: promoApplied ? promoCode.trim().toUpperCase() : undefined,
        });

        // If 100% discount — event already activated, go straight to admin
        if (checkout.activated) {
          navigate(`/e/${res.eventId}/admin?payment=success`, { replace: true });
          return;
        }

        // Redirect to Recurrente checkout page
        window.location.href = checkout.checkoutUrl!;
      } catch (checkoutErr) {
        // If checkout creation fails, send to admin — PaymentGate will block access until paid
        const apiErr = checkoutErr as ApiError;
        console.warn('Checkout creation failed:', apiErr.message);
        setError('No se pudo iniciar el pago. Tu evento fue creado — puedes intentar el pago desde el panel.');
        navigate(`/e/${res.eventId}/admin`, { replace: true });
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'No se pudo crear el evento. Intenta más tarde.');
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const currentTier = TIERS.find((t) => t.id === selectedTier)!;
  const originalPrice = currency === 'USD' ? currentTier.priceUSD : currentTier.priceGTQ;
  const currencySymbol = currency === 'USD' ? '$' : 'Q';

  // Calculate discounted price
  let finalPrice = originalPrice;
  if (promoApplied && promoDiscount) {
    if (promoDiscount.type === 'percent') {
      finalPrice = originalPrice - Math.floor(originalPrice * (promoDiscount.value / 100));
    } else if (promoDiscount.type === 'fixed') {
      // Fixed discount is in cents, convert to display currency
      const fixedInDisplay = promoDiscount.value / 100;
      finalPrice = Math.max(0, originalPrice - fixedInDisplay);
    }
    if (finalPrice < 0) finalPrice = 0;
  }

  const price = `${currencySymbol}${finalPrice}`;
  const hasDiscount = promoApplied && promoDiscount && finalPrice < originalPrice;

  // Promo + summary card (reused in both mobile step 3 and desktop sidebar)
  const promoSection = (
    <Card padding="md" className="mb-6 lg:mb-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label="Código promocional"
            type="text"
            id="promo-code"
            placeholder="Ej. EVENTO2026"
            icon={<Tag className="w-4 h-4" aria-hidden="true" />}
            value={promoCode}
            onChange={(e) => {
              setPromoCode(e.target.value);
              setPromoError('');
              setPromoApplied(false);
            }}
            error={promoError || undefined}
            disabled={isLoading}
          />
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={handleApplyPromo}
          disabled={isLoading || isValidatingPromo}
          loading={isValidatingPromo}
          className="mb-0"
        >
          Aplicar
        </Button>
      </div>
      {promoApplied && (
        <p className="mt-2 font-body text-xs text-accent">
          {promoDiscount?.type === 'percent' && promoDiscount.value === 100
            ? '¡Código aplicado — 100% de descuento!'
            : promoDiscount?.type === 'percent'
              ? `Código aplicado — ${promoDiscount.value}% de descuento.`
              : 'Código aplicado correctamente.'}
        </p>
      )}
    </Card>
  );

  const summarySection = (
    <Card padding="lg" className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-heading text-base font-semibold text-primary">
            Plan {currentTier.name}
          </p>
          <p className="font-body text-sm text-secondary">
            {currentTier.uploads} fotos &middot; {currentTier.duration}
          </p>
        </div>
        <div className="text-right">
          {hasDiscount && (
            <p className="font-body text-sm text-tertiary line-through">
              {currencySymbol}{originalPrice}
            </p>
          )}
          <p className={`font-heading text-2xl font-bold ${hasDiscount ? 'text-accent' : 'text-primary'}`}>
            {price}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button
          variant="secondary"
          size="md"
          onClick={handleBack}
          icon={<ChevronLeft className="w-4 h-4" />}
          className="lg:hidden"
        >
          Atrás
        </Button>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={isLoading}
          disabled={isLoading}
          onClick={handleCreateEvent}
        >
          {isLoading ? 'Procesando...' : `Crear evento y pagar ${price}`}
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card shadow-card border-b border-border-subtle">
        <div className="mx-auto max-w-5xl px-4 md:px-8 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => (step === 1 ? navigate('/') : handleBack())}
            aria-label="Volver"
            className={[
              'flex items-center justify-center w-8 h-8 -ml-1 rounded-pill',
              'text-secondary hover:text-primary hover:bg-muted',
              'transition-colors duration-150 ease-in-out',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
              'lg:hidden',
            ].join(' ')}
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <Logo size="md" showText className="hidden lg:flex" />
          <h1 className="font-heading text-lg font-semibold text-primary truncate lg:hidden">
            Crear evento
          </h1>
          {/* Desktop step indicator in header */}
          <div className="hidden lg:flex lg:flex-1 lg:justify-center">
            <StepIndicator current={step} />
          </div>
          <div className="hidden lg:block lg:w-32" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 md:px-8 py-6">
        {/* Mobile step indicator */}
        <div className="lg:hidden">
          <StepIndicator current={step} />
        </div>

        {/* Global error */}
        {error && (
          <div className="mb-4 p-3 rounded-card bg-red-50 border border-accent-coral" role="alert">
            <p className="font-body text-sm text-accent-coral">{error}</p>
          </div>
        )}

        {/* ---- Step 1: Contact ---- */}
        {step === 1 && (
          <div className="lg:grid lg:grid-cols-5 lg:gap-8">
            <div className="lg:col-span-3">
              <Card padding="lg">
                <h2 className="font-heading text-xl font-bold text-primary mb-1">
                  Datos de contacto
                </h2>
                <p className="font-body text-sm text-secondary mb-6">
                  Usaremos esta información para enviarte los accesos de tu evento.
                </p>

                <div className="space-y-4">
                  <Input
                    label="Tu nombre"
                    type="text"
                    id="host-name"
                    placeholder="Nombre completo"
                    icon={<User className="w-4 h-4" aria-hidden="true" />}
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    autoComplete="name"
                    autoFocus
                    disabled={isLoading}
                  />
                  <Input
                    label="Correo electrónico"
                    type="email"
                    id="host-email"
                    placeholder="tu@email.com"
                    icon={<Mail className="w-4 h-4" aria-hidden="true" />}
                    value={hostEmail}
                    onChange={(e) => setHostEmail(e.target.value)}
                    autoComplete="email"
                    disabled={isLoading}
                  />
                </div>

                <div className="mt-6 flex justify-end">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleNext}
                    icon={<ChevronRight className="w-4 h-4" />}
                  >
                    Siguiente
                  </Button>
                </div>
              </Card>
            </div>
            {/* Desktop right column: plan preview */}
            <div className="hidden lg:block lg:col-span-2">
              <Card padding="lg">
                <h3 className="font-heading text-base font-semibold text-primary mb-3">
                  Resumen del plan
                </h3>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-body text-sm text-secondary">Plan seleccionado</span>
                  <span className="font-body text-sm font-medium text-primary">{currentTier.name}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-body text-sm text-secondary">Fotos</span>
                  <span className="font-body text-sm font-medium text-primary">{currentTier.uploads}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-secondary">Duración</span>
                  <span className="font-body text-sm font-medium text-primary">{currentTier.duration}</span>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ---- Step 2: Event Details ---- */}
        {step === 2 && (
          <div className="lg:grid lg:grid-cols-5 lg:gap-8">
            <div className="lg:col-span-3">
              <Card padding="lg">
                <h2 className="font-heading text-xl font-bold text-primary mb-1">
                  Detalles del evento
                </h2>
                <p className="font-body text-sm text-secondary mb-6">
                  Tus invitados podrán subir fotos una vez tu evento inicie y durante las siguientes 24 horas.
                </p>

                <div className="space-y-4">
                  <Input
                    label="Nombre del evento"
                    type="text"
                    id="event-title"
                    placeholder="Ej. Boda de Ana y Luis"
                    icon={<FileText className="w-4 h-4" aria-hidden="true" />}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                    disabled={isLoading}
                  />
                  <Input
                    label="Descripción (opcional)"
                    type="text"
                    id="event-description"
                    placeholder="Una breve descripción del evento"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isLoading}
                  />
                  <Input
                    label="Fecha y hora del evento"
                    type="datetime-local"
                    id="event-start"
                    icon={<Calendar className="w-4 h-4" aria-hidden="true" />}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="mt-6 flex justify-between">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleBack}
                    icon={<ChevronLeft className="w-4 h-4" />}
                  >
                    Atrás
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleNext}
                    icon={<ChevronRight className="w-4 h-4" />}
                  >
                    Siguiente
                  </Button>
                </div>
              </Card>
            </div>
            {/* Desktop right column: plan preview */}
            <div className="hidden lg:block lg:col-span-2">
              <Card padding="lg">
                <h3 className="font-heading text-base font-semibold text-primary mb-3">
                  Resumen del plan
                </h3>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-body text-sm text-secondary">Plan seleccionado</span>
                  <span className="font-body text-sm font-medium text-primary">{currentTier.name}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-body text-sm text-secondary">Precio</span>
                  <span className="font-body text-sm font-medium text-primary">{price}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-secondary">Duración</span>
                  <span className="font-body text-sm font-medium text-primary">{currentTier.duration}</span>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ---- Step 3: Plan Selection + Payment ---- */}
        {step === 3 && (
          <div className="lg:grid lg:grid-cols-5 lg:gap-8">
            <div className="lg:col-span-3">
              <h2 className="font-heading text-xl font-bold text-primary mb-1">
                Elige tu plan
              </h2>
              <p className="font-body text-sm text-secondary mb-4">
                Selecciona el plan que mejor se adapte a tu evento.
              </p>

              {/* Currency toggle */}
              <div className="flex items-center gap-2 mb-6">
                <span className="font-body text-sm text-secondary">Moneda:</span>
                <div className="inline-flex rounded-pill border border-border-subtle overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setCurrency('USD'); setPromoApplied(false); setPromoDiscount(null); }}
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
                    onClick={() => { setCurrency('GTQ'); setPromoApplied(false); setPromoDiscount(null); }}
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

              {/* Tier cards */}
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                {TIERS.map((tier) => {
                  const isSelected = selectedTier === tier.id;
                  const displayPrice = currency === 'USD'
                    ? `$${tier.priceUSD}`
                    : `Q${tier.priceGTQ}`;

                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => { setSelectedTier(tier.id); setPromoApplied(false); setPromoDiscount(null); }}
                      className={[
                        'relative flex flex-col text-left rounded-card shadow-card bg-card border-2 overflow-hidden transition-all',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                        isSelected
                          ? 'border-accent ring-1 ring-accent'
                          : 'border-border-subtle hover:border-border-strong',
                      ].join(' ')}
                    >
                      {/* Badge */}
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
                        {/* Selected indicator */}
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

                        <div className="flex items-end gap-1 mb-4">
                          <span className="font-heading text-3xl font-bold text-primary">
                            {displayPrice}
                          </span>
                          <span className="font-body text-sm text-secondary mb-1">
                            / evento
                          </span>
                        </div>

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

              {/* Mobile only: promo + summary inline */}
              <div className="lg:hidden">
                {promoSection}
                {summarySection}
              </div>
            </div>

            {/* Desktop right column: promo + summary */}
            <div className="hidden lg:block lg:col-span-2">
              {promoSection}
              {summarySection}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
