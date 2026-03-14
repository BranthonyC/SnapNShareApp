import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
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
 *
 * When ?payment=success is in the URL and status is pending/unpaid,
 * auto-verifies the payment with the backend (fallback for webhooks).
 */
export default function PaymentGate({ eventId, paymentStatus, tier, children }: PaymentGateProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const verifyAttempted = useRef(false);

  const paymentSuccess = searchParams.get('payment') === 'success';

  // Auto-verify when returning from Recurrente with ?payment=success
  useEffect(() => {
    if (
      paymentSuccess &&
      paymentStatus !== 'paid' &&
      paymentStatus !== 'free' &&
      !verifyAttempted.current
    ) {
      verifyAttempted.current = true;
      setIsVerifying(true);

      api.verifyPayment(eventId)
        .then((res) => {
          if (res.paymentStatus === 'paid') {
            setVerified(true);
            // Clean up the URL param
            searchParams.delete('payment');
            setSearchParams(searchParams, { replace: true });
            // Reload to get fresh event data
            setTimeout(() => window.location.reload(), 500);
          } else {
            setIsVerifying(false);
          }
        })
        .catch(() => {
          setIsVerifying(false);
        });
    }
  }, [paymentSuccess, paymentStatus, eventId, searchParams, setSearchParams]);

  // Allow access if paid or manually set to free (test events)
  if (paymentStatus === 'paid' || paymentStatus === 'free') {
    return <>{children}</>;
  }

  // Show verifying state
  if (isVerifying || verified) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card padding="lg" className="max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-50">
              {verified ? (
                <CheckCircle className="w-7 h-7 text-green-500" />
              ) : (
                <Spinner size="lg" />
              )}
            </span>
          </div>
          <h2 className="font-heading text-xl font-bold text-primary mb-2">
            {verified ? 'Pago confirmado' : 'Verificando pago...'}
          </h2>
          <p className="font-body text-sm text-secondary">
            {verified
              ? 'Tu pago fue verificado. Cargando tu panel...'
              : 'Estamos confirmando tu pago con el procesador. Espera un momento.'}
          </p>
        </Card>
      </div>
    );
  }

  async function handleRetryCheckout() {
    setIsRetrying(true);
    setError('');
    try {
      const checkout = await api.createCheckout(eventId, {
        tier,
        currency: 'USD',
      });
      window.location.href = checkout.checkoutUrl!;
    } catch (err) {
      const apiErr = err as api.ApiError;
      setError(apiErr.message || 'No se pudo crear el checkout. Intenta más tarde.');
      setIsRetrying(false);
    }
  }

  async function handleVerifyPayment() {
    setIsVerifying(true);
    setError('');
    try {
      const res = await api.verifyPayment(eventId);
      if (res.paymentStatus === 'paid') {
        setVerified(true);
        setTimeout(() => window.location.reload(), 500);
      } else {
        setIsVerifying(false);
        setError('El pago aún no ha sido confirmado. Intenta de nuevo en unos segundos.');
      }
    } catch {
      setIsVerifying(false);
      setError('No se pudo verificar el pago. Intenta de nuevo.');
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
            ? 'Tu pago está siendo procesado. Si ya completaste el pago, verifica el estado o espera unos segundos y recarga la página.'
            : 'Tu evento fue creado pero el pago no se ha completado. Completa el pago para acceder al panel de administración.'}
        </p>

        {error && (
          <p className="font-body text-sm text-red-600 mb-4">{error}</p>
        )}

        <div className="flex flex-col gap-3">
          {isPending && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleVerifyPayment}
              disabled={isRetrying}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Verificar pago
            </Button>
          )}

          <Button
            variant={isPending ? 'secondary' : 'primary'}
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
