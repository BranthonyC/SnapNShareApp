import type { ReactNode } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  QrCode,
  Pencil,
  FolderOpen,
  ShieldCheck,
  Settings,
  Sparkles,
} from 'lucide-react';
import Logo from '@/components/ui/Logo';

// ---------------------------------------------------------------------------
// Sidebar — compound component (desktop only, hidden on mobile)
// ---------------------------------------------------------------------------

interface SidebarProps {
  children: ReactNode;
}

function Sidebar({ children }: SidebarProps) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-60 bg-card border-r border-border-subtle z-20">
      {children}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Sidebar.Logo
// ---------------------------------------------------------------------------
function SidebarLogo() {
  const navigate = useNavigate();

  return (
    <div className="px-5 h-16 flex items-center border-b border-border-subtle">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-card"
      >
        <Logo size="md" showText />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar.Nav
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { label: 'Panel', icon: LayoutDashboard, path: '' },
  { label: 'Código QR', icon: QrCode, path: '/qr' },
  { label: 'Editar evento', icon: Pencil, path: '/edit' },
  { label: 'Galería', icon: FolderOpen, path: '/gallery' },
  { label: 'Moderación', icon: ShieldCheck, path: '/moderation' },
  { label: 'Configuración', icon: Settings, path: '/settings' },
];

function SidebarNav() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = `/e/${eventId}/admin`;

  return (
    <nav className="flex-1 overflow-y-auto py-4 px-3" aria-label="Navegación de administración">
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const fullPath = `${basePath}${item.path}`;
          const isActive = location.pathname === fullPath;
          const Icon = item.icon;

          return (
            <li key={item.path}>
              <button
                type="button"
                onClick={() => navigate(fullPath)}
                className={[
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-card text-left',
                  'font-body text-sm font-medium transition-colors duration-150',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  isActive
                    ? 'bg-accent-light text-primary border-l-[3px] border-accent'
                    : 'text-secondary hover:bg-muted hover:text-primary',
                ].join(' ')}
              >
                <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-accent' : ''}`} aria-hidden="true" />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Sidebar.Upgrade — CTA card shown when tier !== 'premium'
// ---------------------------------------------------------------------------
interface UpgradeProps {
  tier?: string;
}

function SidebarUpgrade({ tier }: UpgradeProps) {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  if (tier === 'premium') return null;

  return (
    <div className="px-3 pb-4">
      <div className="rounded-card bg-accent-dark p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-accent-light" aria-hidden="true" />
          <p className="font-heading text-sm font-semibold text-white">
            Mejora tu plan
          </p>
        </div>
        <p className="font-body text-xs text-white/80 mb-3">
          Desbloquea más fotos, videos y funciones avanzadas.
        </p>
        <button
          type="button"
          onClick={() => navigate(`/e/${eventId}/admin/upgrade`)}
          className={[
            'w-full py-2 px-3 rounded-pill text-center',
            'font-body text-xs font-semibold',
            'bg-white text-accent-dark hover:bg-accent-light',
            'transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-accent-dark',
          ].join(' ')}
        >
          Mejorar plan
        </button>
      </div>
    </div>
  );
}

// Attach sub-components
Sidebar.Logo = SidebarLogo;
Sidebar.Nav = SidebarNav;
Sidebar.Upgrade = SidebarUpgrade;

export default Sidebar;
