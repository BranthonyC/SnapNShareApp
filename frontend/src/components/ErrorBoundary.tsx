import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-page px-4">
          <div className="text-center max-w-md">
            <div className="mb-6 flex justify-center">
              <span className="inline-flex items-center justify-center w-16 h-16 rounded-card bg-accent-coral/10">
                <AlertTriangle className="w-8 h-8 text-accent-coral" aria-hidden="true" />
              </span>
            </div>
            <h1 className="font-heading text-3xl font-bold text-primary mb-2">
              Algo salio mal
            </h1>
            <p className="font-body text-secondary mb-6">
              Ocurrio un error inesperado. Por favor intenta de nuevo.
            </p>
            <Button variant="primary" size="md" onClick={this.handleReset}>
              Intentar de nuevo
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
