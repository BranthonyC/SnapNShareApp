import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-dark focus-visible:ring-accent',
  secondary:
    'bg-white border border-border-subtle text-primary hover:bg-muted focus-visible:ring-border-strong',
  danger:
    'bg-accent-coral text-white hover:bg-accent-coral-dark focus-visible:ring-accent-coral',
};

const sizeClasses: Record<Size, string> = {
  sm: 'py-2 px-4 text-sm gap-1.5',
  md: 'py-3 px-6 text-base gap-2',
  lg: 'py-4 px-8 text-lg gap-2.5',
};

const spinnerSizeClasses: Record<Size, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      disabled = false,
      icon,
      children,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          'inline-flex items-center justify-center font-body font-medium rounded-pill',
          'transition-colors duration-150 ease-in-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? 'w-full' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {loading ? (
          <Loader
            className={`${spinnerSizeClasses[size]} animate-spin shrink-0`}
            aria-hidden="true"
          />
        ) : (
          icon && (
            <span className={`${spinnerSizeClasses[size]} shrink-0`} aria-hidden="true">
              {icon}
            </span>
          )
        )}
        {children && <span>{children}</span>}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
