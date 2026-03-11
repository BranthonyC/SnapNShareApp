import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  QrCode,
  Pencil,
  Settings,
  ShieldCheck,
  FolderOpen,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Panel', icon: LayoutDashboard, path: '' },
  { label: 'QR', icon: QrCode, path: '/qr' },
  { label: 'Editar', icon: Pencil, path: '/edit' },
  { label: 'Galería', icon: FolderOpen, path: '/gallery' },
  { label: 'Moderación', icon: ShieldCheck, path: '/moderation' },
  { label: 'Ajustes', icon: Settings, path: '/settings' },
];

export default function AdminNav() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const basePath = `/e/${eventId}/admin`;

  return (
    <nav
      className="flex gap-1 overflow-x-auto pb-1 mb-4 -mt-2 scrollbar-hide"
      aria-label="Navegación de administración"
    >
      {NAV_ITEMS.map((item) => {
        const fullPath = `${basePath}${item.path}`;
        const isActive = location.pathname === fullPath;
        const Icon = item.icon;

        return (
          <button
            key={item.path}
            type="button"
            onClick={() => navigate(fullPath)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-pill whitespace-nowrap shrink-0',
              'font-body text-xs font-medium transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              isActive
                ? 'bg-accent text-white'
                : 'bg-muted text-secondary hover:bg-border-subtle hover:text-primary',
            ].join(' ')}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
