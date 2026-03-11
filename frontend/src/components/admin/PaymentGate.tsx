import { useState } from 'react';
import { CreditCard, AlertCircle, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import * as api from '@/services/api';

interface PaymentGateProps {
  eventId: string;
  paymentStatus: string | undefined;
  tier: string;
  children: React.ReactNode;
}

/**
 * Wraps admin page content. If paymentStatus is not 'paid' or 'free',
 * shows a payment-required screen instead of the children.
 */
export default function PaymentGate({ eventId, paymentStatus, tier, children }: PaymentGateProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState('');

  // Allow access if paid or manually set to free (test events)
  if (paymentStatus === 'paid' || paymentStatus === 'free') {
    return <>{children}</>;
  }

  async function handleRetryCheckout() {
    setIsRetrying(true);
    setError('');
    try {
      const checkout = await api.createCheckout(eventId, {
        tier,
        currency: 'USD',
      });
      window.location.href = checkout.checkoutUrl;
    } catch (err) {
      const apiErr = err as api.ApiError;
      setError(apiErr.message || 'No se pudo crear el checkout. Intenta más tarde.');
      setIsRetrying(false);
    }
  }

  const isPending = paymentStatus === 'pending';

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card padding="lg" className="max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50">
            {isPending ? (
              <CreditCard className="w-7 h-7 text-amber-500" />
            ) : (
              <AlertCircle className="w-7 h-7 text-amber-500" />
            )}
          </span>
        </div>

        <h2 className="font-heading text-xl font-bold text-primary mb-2">
          {isPending ? 'Pago en proceso' : 'Pago requerido'}
        </h2>

        <p className="font-body text-sm text-secondary mb-6">
          {isPending
            ? 'Tu pago está siendo procesado. Si ya completaste el pago, espera unos segundos y recarga la página.'
            : 'Tu evento fue creado pero el pago no se ha completado. Completa el pago para acceder al panel de administración.'}
        </p>

        {error && (
          <p className="font-body text-sm text-red-600 mb-4">{error}</p>
        )}

        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleRetryCheckout}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <Spinner size="sm" />
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                {isPending ? 'Reintentar pago' : 'Completar pago'}
              </>
            )}
          </Button>

          {isPending && (
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recargar página
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
