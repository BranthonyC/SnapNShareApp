import { useState } from 'react';
import { Lock, Copy, Check } from 'lucide-react';
import SectionCard from '@/components/ui/SectionCard';

// ---------------------------------------------------------------------------
// PasswordCard — guest password display + copy button
// ---------------------------------------------------------------------------

interface PasswordCardProps {
  password?: string;
}

export default function PasswordCard({ password }: PasswordCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  return (
    <SectionCard>
      <SectionCard.Header
        title="Contrasena de invitados"
        icon={<Lock className="w-4 h-4 text-accent" aria-hidden="true" />}
      />
      <SectionCard.Body>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-card px-3 py-2">
            <p className="font-body text-sm font-medium text-primary tracking-wider">
              {password ?? '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!password}
            aria-label={copied ? 'Copiado' : 'Copiar contrasena'}
            className={[
              'flex items-center justify-center w-9 h-9 rounded-card shrink-0',
              'transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              copied
                ? 'bg-accent-light text-accent'
                : 'bg-muted text-secondary hover:bg-border-subtle hover:text-primary',
            ].join(' ')}
          >
            {copied ? (
              <Check className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Copy className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </SectionCard.Body>
    </SectionCard>
  );
}
