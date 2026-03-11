import { Link } from 'react-router-dom';
import { QrCode, Upload, Share2, Check, Camera } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const HOW_IT_WORKS = [
  {
    icon: <QrCode className="w-8 h-8 text-accent-green" aria-hidden="true" />,
    title: 'Crea tu evento',
    description:
      'Registra el nombre, fecha y contraseña. Obtienes un código QR único al instante.',
    image: '/images/qr-table.png',
  },
  {
    icon: <Upload className="w-8 h-8 text-accent-green" aria-hidden="true" />,
    title: 'Comparte el QR',
    description:
      'Los invitados escanean el código, ingresan la contraseña y suben sus fotos directamente.',
    image: '/images/guests-uploading.png',
  },
  {
    icon: <Share2 className="w-8 h-8 text-accent-green" aria-hidden="true" />,
    title: 'Revive cada momento',
    description:
      'Todos los recuerdos en un solo lugar. Descarga el álbum completo cuando quieras.',
    image: '/images/album-download.png',
  },
];

interface PricingTier {
  id: string;
  name: string;
  price: string;
  currency: string;
  badge?: string;
  badgeStyle?: string;
  highlighted: boolean;
  features: string[];
  cta: string;
  ctaLink: string;
}

const PRICING: PricingTier[] = [
  {
    id: 'basic',
    name: 'Básico',
    price: '$1',
    currency: 'USD',
    highlighted: false,
    features: [
      '50 fotos por evento',
      'Galería privada con contraseña',
      'Código QR incluido',
      'Álbum activo por 30 días',
    ],
    cta: 'Crea tu evento',
    ctaLink: '/create',
  },
  {
    id: 'paid',
    name: 'Estándar',
    price: '$15',
    currency: 'USD',
    badge: 'Popular',
    badgeStyle: 'bg-accent-green text-white',
    highlighted: true,
    features: [
      '500 fotos por evento',
      'Verificación OTP por SMS / Email',
      'Álbum activo por 90 días',
      'Descargas habilitadas',
      'Soporte prioritario',
    ],
    cta: 'Elegir Estándar',
    ctaLink: '/checkout?tier=paid',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$30',
    currency: 'USD',
    badge: 'Premium',
    badgeStyle: 'bg-accent-gold text-white',
    highlighted: false,
    features: [
      '1 000 fotos por evento',
      'Moderación automática de contenido',
      'Álbum activo por 2 años (Glacier)',
      'Videos incluidos',
      'Verificación OTP + moderación NSFW',
      'Soporte prioritario 24/7',
    ],
    cta: 'Elegir Premium',
    ctaLink: '/checkout?tier=premium',
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-accent-green-light via-white to-white py-16 px-4 lg:py-24">
      <div className="mx-auto max-w-6xl flex flex-col items-center gap-10 lg:flex-row lg:gap-16">
        {/* Text */}
        <div className="flex-1 text-center lg:text-left">
          <div className="mb-6 flex justify-center lg:justify-start">
            <span className="inline-flex items-center justify-center w-16 h-16 rounded-card bg-accent-green shadow-card">
              <Camera className="w-8 h-8 text-white" aria-hidden="true" />
            </span>
          </div>

          <h1 className="font-heading text-4xl font-bold text-primary leading-tight md:text-5xl lg:text-6xl">
            Captura cada <span className="text-accent-green">momento</span>
          </h1>
          <p className="mt-4 font-body text-lg text-secondary md:text-xl">
            Crea un álbum privado para tu evento en segundos. Comparte el QR y deja que tus
            invitados suban recuerdos desde sus celulares.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link to="/create">
              <Button size="lg" variant="primary">
                Crea tu evento
              </Button>
            </Link>
            <a href="#como-funciona">
              <Button size="lg" variant="secondary">
                Cómo funciona
              </Button>
            </a>
          </div>
        </div>

        {/* Hero image */}
        <div className="flex-1 flex justify-center lg:justify-end">
          <img
            src="/images/hero-mockup.png"
            alt="Loving Memory — galería de fotos en un celular"
            className="w-full max-w-sm rounded-2xl shadow-modal"
            loading="eager"
          />
        </div>
      </div>

      {/* Decorative circles */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-accent-green opacity-5"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-16 w-60 h-60 rounded-full bg-accent-gold opacity-5"
      />
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="como-funciona" className="py-16 px-4 bg-page">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-heading text-3xl font-bold text-center text-primary mb-2">
          ¿Cómo funciona?
        </h2>
        <p className="font-body text-secondary text-center mb-10">
          En tres pasos tienes tu álbum listo para compartir.
        </p>
        <div className="grid gap-8 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, idx) => (
            <Card key={step.title} padding="lg" className="text-center overflow-hidden">
              <img
                src={step.image}
                alt={step.title}
                className="w-full h-40 object-cover rounded-lg mb-4"
                loading="lazy"
              />
              <div className="flex justify-center mb-3">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-card bg-accent-green-light">
                  {step.icon}
                </span>
              </div>
              <span className="inline-block mb-1 font-body text-xs font-semibold text-accent-green uppercase tracking-widest">
                Paso {idx + 1}
              </span>
              <h3 className="font-heading text-lg font-semibold text-primary mb-2">
                {step.title}
              </h3>
              <p className="font-body text-sm text-secondary leading-relaxed">
                {step.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="precios" className="py-16 px-4 bg-white">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-heading text-3xl font-bold text-center text-primary mb-2">
          Precios sencillos
        </h2>
        <p className="font-body text-secondary text-center mb-10">
          Paga por evento, sin suscripciones ni sorpresas.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          {PRICING.map((tier) => (
            <div
              key={tier.id}
              className={[
                'relative flex flex-col rounded-card shadow-card bg-card border-2 overflow-hidden transition-shadow hover:shadow-modal',
                tier.highlighted ? 'border-accent-green' : 'border-border-subtle',
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

              <div className="p-6 flex-1">
                <h3 className="font-heading text-xl font-bold text-primary mb-1">
                  {tier.name}
                </h3>
                <div className="flex items-end gap-1 mb-6">
                  <span className="font-heading text-4xl font-bold text-primary">
                    {tier.price}
                  </span>
                  <span className="font-body text-sm text-secondary mb-1">
                    {tier.currency} / evento
                  </span>
                </div>

                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check
                        className="w-4 h-4 text-accent-green shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span className="font-body text-sm text-secondary">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-6 pb-6">
                <Link to={tier.ctaLink}>
                  <Button
                    fullWidth
                    variant={tier.highlighted ? 'primary' : 'secondary'}
                    size="md"
                  >
                    {tier.cta}
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-card border-t border-border-subtle py-8 px-4">
      <div className="mx-auto max-w-4xl flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-card bg-accent-green">
            <Camera className="w-4 h-4 text-white" aria-hidden="true" />
          </span>
          <span className="font-heading text-lg font-bold text-primary">Loving Memory</span>
        </div>

        {/* Links */}
        <nav aria-label="Footer" className="flex items-center gap-6">
          <a
            href="/privacy"
            className="font-body text-sm text-secondary hover:text-primary transition-colors"
          >
            Privacidad
          </a>
          <a
            href="/terms"
            className="font-body text-sm text-secondary hover:text-primary transition-colors"
          >
            Términos
          </a>
          <a
            href="mailto:hola@snapnshare.app"
            className="font-body text-sm text-secondary hover:text-primary transition-colors"
          >
            Contacto
          </a>
        </nav>

        <p className="font-body text-xs text-tertiary">
          &copy; {new Date().getFullYear()} Loving Memory. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-page">
      <HeroSection />
      <HowItWorksSection />
      <PricingSection />
      <Footer />
    </div>
  );
}
