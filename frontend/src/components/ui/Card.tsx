import type { ReactNode } from 'react';

type Padding = 'sm' | 'md' | 'lg';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: Padding;
}

const paddingClasses: Record<Padding, string> = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export default function Card({ children, className = '', padding = 'md' }: CardProps) {
  return (
    <div
      className={[
        'bg-card rounded-card shadow-card',
        paddingClasses[padding],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
