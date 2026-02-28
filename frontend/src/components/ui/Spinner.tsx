import { Loader } from 'lucide-react';

type Size = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: Size;
  className?: string;
}

const sizeClasses: Record<Size, string> = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <Loader
      className={[
        'animate-spin text-accent-green shrink-0',
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Loading"
      role="status"
    />
  );
}
