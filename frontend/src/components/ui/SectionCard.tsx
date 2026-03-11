import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// SectionCard — compound component for grouped content sections
// Variants: default, danger (red border)
// ---------------------------------------------------------------------------

type Variant = 'default' | 'danger';

interface SectionCardProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-card rounded-card shadow-card',
  danger: 'bg-card rounded-card shadow-card border-2 border-accent-coral',
};

function SectionCard({ children, variant = 'default', className = '' }: SectionCardProps) {
  return (
    <div
      className={[variantClasses[variant], className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionCard.Header
// ---------------------------------------------------------------------------
interface HeaderProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
}

function Header({ title, icon, action }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <div className="flex items-center gap-2">
        {icon && (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-card bg-accent-light shrink-0">
            {icon}
          </span>
        )}
        <h2 className="font-heading text-base font-semibold text-primary">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionCard.Body
// ---------------------------------------------------------------------------
interface BodyProps {
  children: ReactNode;
  className?: string;
}

function Body({ children, className = '' }: BodyProps) {
  return (
    <div className={['px-4 pb-4', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionCard.Footer
// ---------------------------------------------------------------------------
interface FooterProps {
  children: ReactNode;
  className?: string;
}

function Footer({ children, className = '' }: FooterProps) {
  return (
    <div
      className={[
        'px-4 py-3 border-t border-border-subtle',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}

// Attach sub-components
SectionCard.Header = Header;
SectionCard.Body = Body;
SectionCard.Footer = Footer;

export default SectionCard;
