interface StatRowProps {
  label: string;
  value: string;
  bold?: boolean;
}

export default function StatRow({ label, value, bold = false }: StatRowProps) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="font-body text-sm text-secondary">{label}</span>
      <span
        className={[
          'font-body text-sm text-primary',
          bold ? 'font-semibold' : 'font-medium',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
