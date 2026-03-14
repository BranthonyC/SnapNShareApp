import { Camera } from 'lucide-react';

type LogoSize = 'sm' | 'md' | 'lg';

interface LogoProps {
  size?: LogoSize;
  showText?: boolean;
  className?: string;
}

const iconSize: Record<LogoSize, string> = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

const textSize: Record<LogoSize, string> = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-xl',
};

export default function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  return (
    <div className={['flex items-center gap-2', className].filter(Boolean).join(' ')}>
      <span className="inline-flex items-center justify-center rounded-card bg-accent-light p-1.5">
        <Camera className={`${iconSize[size]} text-accent`} aria-hidden="true" />
      </span>
      {showText && (
        <span className={`font-heading font-bold text-primary ${textSize[size]}`}>
          snapNshare
        </span>
      )}
    </div>
  );
}
