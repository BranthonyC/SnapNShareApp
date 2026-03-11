import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'otp';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  variant?: Variant;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, variant = 'default', className = '', id, ...rest }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const baseInputClasses = [
      'block w-full border rounded-card px-3 py-3 font-body text-base text-primary',
      'placeholder:text-tertiary bg-white',
      'transition-colors duration-150 ease-in-out',
      'focus:outline-none focus:ring-2 focus:ring-accent-light focus:border-accent',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      error
        ? 'border-accent-coral focus:ring-red-100 focus:border-accent-coral'
        : 'border-border-strong',
      icon ? 'pl-10' : '',
      variant === 'otp'
        ? 'text-center tracking-widest text-xl font-heading font-semibold'
        : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block font-body text-xs font-medium text-primary mb-1"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span
              className="absolute inset-y-0 left-0 flex items-center pl-3 text-tertiary pointer-events-none"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
          <input ref={ref} id={inputId} className={baseInputClasses} {...rest} />
        </div>
        {error && (
          <p className="mt-1 font-body text-xs text-accent-coral" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
