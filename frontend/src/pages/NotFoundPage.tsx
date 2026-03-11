import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="text-center max-w-md">
        <h1 className="font-heading text-8xl font-bold text-accent mb-2">404</h1>
        <h2 className="font-heading text-2xl font-bold text-primary mb-2">
          Pagina no encontrada
        </h2>
        <p className="font-body text-secondary mb-8">
          La pagina que buscas no existe o fue movida.
        </p>
        <Link to="/">
          <Button
            variant="primary"
            size="md"
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Volver al inicio
          </Button>
        </Link>
      </div>
    </div>
  );
}
