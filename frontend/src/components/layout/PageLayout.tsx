import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  className?: string;
}

export default function PageLayout({
  children,
  title,
  showBack = false,
  onBack,
  className = '',
}: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-page">
      {(title || showBack) && (
        <header className="sticky top-0 z-10 bg-card shadow-card border-b border-border-subtle">
          <div className="mx-auto max-w-3xl px-4 md:px-8 h-14 flex items-center gap-3">
            {showBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Go back"
                className={[
                  'flex items-center justify-center w-8 h-8 -ml-1 rounded-pill',
                  'text-secondary hover:text-primary hover:bg-muted',
                  'transition-colors duration-150 ease-in-out',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-green focus-visible:ring-offset-1',
                ].join(' ')}
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
            {title && (
              <h1 className="font-heading text-lg font-semibold text-primary truncate">
                {title}
              </h1>
            )}
          </div>
        </header>
      )}

      <main
        className={[
          'mx-auto max-w-3xl px-4 md:px-8 py-6',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </main>
    </div>
  );
}
