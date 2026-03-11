import { LogOut } from 'lucide-react';
import SectionCard from '@/components/ui/SectionCard';
import Button from '@/components/ui/Button';
import type { EventData } from '@/services/api';

// ---------------------------------------------------------------------------
// AccountCard — host account info + sign-out
// ---------------------------------------------------------------------------

interface AccountCardProps {
  event: EventData;
  onSignOut: () => void;
}

const tierLabels: Record<string, string> = {
  basic: 'Basico',
  paid: 'Estandar',
  premium: 'Premium',
};

const tierBadgeStyles: Record<string, string> = {
  basic: 'bg-muted text-secondary',
  paid: 'bg-accent-light text-accent-dark',
  premium: 'bg-accent-gold/10 text-accent-gold',
};

export default function AccountCard({ event, onSignOut }: AccountCardProps) {
  const initial = (event.hostName ?? event.hostEmail ?? 'H').charAt(0).toUpperCase();
  const tier = event.tier ?? 'basic';

  return (
    <SectionCard>
      <SectionCard.Body className="pt-4">
        <div className="flex items-center gap-3 mb-4">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
            <span className="font-heading text-lg font-bold text-white">{initial}</span>
          </div>
          <div className="min-w-0 flex-1">
            {event.hostName && (
              <p className="font-body text-sm font-medium text-primary truncate">
                {event.hostName}
              </p>
            )}
            {event.hostEmail && (
              <p className="font-body text-xs text-secondary truncate">
                {event.hostEmail}
              </p>
            )}
          </div>
          <span
            className={[
              'px-2 py-0.5 rounded-pill text-xs font-semibold font-body shrink-0',
              tierBadgeStyles[tier] ?? tierBadgeStyles.basic,
            ].join(' ')}
          >
            {tierLabels[tier] ?? tier}
          </span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          fullWidth
          icon={<LogOut className="w-4 h-4" />}
          onClick={onSignOut}
        >
          Cerrar sesion
        </Button>
      </SectionCard.Body>
    </SectionCard>
  );
}
