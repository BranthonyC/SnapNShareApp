import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// TabBar — compound component for status/category filtering
// ---------------------------------------------------------------------------

interface TabBarProps {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

function TabBar({ value, onChange, children, className = '' }: TabBarProps) {
  return (
    <div
      className={[
        'flex gap-1 overflow-x-auto pb-1 scrollbar-hide',
        className,
      ].filter(Boolean).join(' ')}
      role="tablist"
    >
      {/* Clone children to inject active state */}
      {Array.isArray(children)
        ? children.map((child) => {
            if (child && typeof child === 'object' && 'props' in child) {
              return { ...child, props: { ...child.props, _active: value, _onChange: onChange } };
            }
            return child;
          })
        : children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabBar.Tab
// ---------------------------------------------------------------------------
interface TabProps {
  value: string;
  label: string;
  count?: number;
  // Injected by TabBar parent (not used directly)
  _active?: string;
  _onChange?: (value: string) => void;
}

function Tab({ value, label, count, _active, _onChange }: TabProps) {
  const isActive = _active === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => _onChange?.(value)}
      className={[
        'flex items-center gap-1.5 px-3 py-1.5 rounded-pill whitespace-nowrap shrink-0',
        'font-body text-xs font-medium transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        isActive
          ? 'bg-accent text-white'
          : 'bg-muted text-secondary hover:bg-border-subtle hover:text-primary',
      ].join(' ')}
    >
      {label}
      {count !== undefined && (
        <span
          className={[
            'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-semibold',
            isActive ? 'bg-white/20 text-white' : 'bg-border-subtle text-secondary',
          ].join(' ')}
        >
          {count}
        </span>
      )}
    </button>
  );
}

TabBar.Tab = Tab;

export default TabBar;
