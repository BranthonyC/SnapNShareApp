import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import Sidebar from './Sidebar';
import AdminNav from './AdminNav';

// ---------------------------------------------------------------------------
// AdminLayout — compound component
// Renders sidebar (desktop) + AdminNav (mobile) + content area.
// Children are rendered ONCE. Desktop/Mobile wrappers use CSS visibility only.
// ---------------------------------------------------------------------------

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  tier?: string;
}

function AdminLayout({ children, title, subtitle, onBack, tier }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-page">
      {/* Desktop sidebar */}
      <Sidebar>
        <Sidebar.Logo />
        <Sidebar.Nav />
        <Sidebar.Upgrade tier={tier} />
      </Sidebar>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-10 bg-card shadow-card border-b border-border-subtle">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Volver"
              className={[
                'flex items-center justify-center w-8 h-8 -ml-1 rounded-pill',
                'text-secondary hover:text-primary hover:bg-muted',
                'transition-colors duration-150 ease-in-out',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
              ].join(' ')}
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
          <h1 className="font-heading text-lg font-semibold text-primary truncate">
            {title}
          </h1>
        </div>
      </header>

      {/* Desktop header bar */}
      <div className="hidden lg:block lg:ml-60">
        <header className="sticky top-0 z-10 bg-card border-b border-border-subtle">
          <div className="px-8 h-16 flex items-center gap-4">
            <div>
              <h1 className="font-heading text-xl font-bold text-primary">{title}</h1>
              {subtitle && (
                <p className="font-body text-sm text-secondary">{subtitle}</p>
              )}
            </div>
          </div>
        </header>
      </div>

      {/* Content — rendered ONCE; pages use AdminLayout.Desktop / .Mobile internally */}
      <div className="lg:ml-60">
        {/* Mobile AdminNav pills (hidden on desktop) */}
        <div className="lg:hidden mx-auto max-w-3xl px-4 pt-6">
          <AdminNav />
        </div>

        {/* Single content area with responsive padding */}
        <div className="mx-auto max-w-3xl px-4 pb-6 lg:max-w-none lg:px-8 lg:py-6">
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminLayout.Desktop — visible on lg:+ only
// ---------------------------------------------------------------------------

// Static class maps so Tailwind can detect them at build time
const gridColsMap: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
};

const gapMap: Record<number, string> = {
  4: 'lg:gap-4',
  6: 'lg:gap-6',
  8: 'lg:gap-8',
};

interface DesktopProps {
  children: ReactNode;
  cols?: number;
  gap?: number;
}

function Desktop({ children, cols = 5, gap = 8 }: DesktopProps) {
  return (
    <div className={`hidden lg:grid ${gridColsMap[cols] ?? 'lg:grid-cols-5'} ${gapMap[gap] ?? 'lg:gap-8'}`}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminLayout.Mobile — visible below lg: only
// ---------------------------------------------------------------------------
interface MobileProps {
  children: ReactNode;
}

function Mobile({ children }: MobileProps) {
  return <div className="lg:hidden">{children}</div>;
}

// ---------------------------------------------------------------------------
// AdminLayout.Column — grid column with span
// ---------------------------------------------------------------------------

const colSpanMap: Record<number, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
};

interface ColumnProps {
  children: ReactNode;
  span?: number;
  className?: string;
}

function Column({ children, span = 1, className = '' }: ColumnProps) {
  return (
    <div className={[colSpanMap[span] ?? 'lg:col-span-1', 'space-y-6', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

// Attach sub-components
AdminLayout.Desktop = Desktop;
AdminLayout.Mobile = Mobile;
AdminLayout.Column = Column;

export default AdminLayout;
