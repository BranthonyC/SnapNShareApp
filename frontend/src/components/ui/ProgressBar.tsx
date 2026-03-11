type BarColor = 'green' | 'coral' | 'gold' | 'blue';

interface ProgressBarProps {
  value: number;
  max: number;
  unit?: string;
  color?: BarColor;
  showLabel?: boolean;
}

const barColors: Record<BarColor, string> = {
  green: 'bg-accent',
  coral: 'bg-accent-coral',
  gold: 'bg-accent-gold',
  blue: 'bg-blue-500',
};

export default function ProgressBar({
  value,
  max,
  unit = '',
  color = 'green',
  showLabel = true,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div>
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="font-body text-xs text-secondary">
            {value}{unit} de {max}{unit}
          </span>
          <span className="font-body text-xs font-medium text-primary">
            {Math.round(pct)}%
          </span>
        </div>
      )}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColors[color]}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}
