import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Sparkles, List, Kanban, BarChart2,
  Settings, User, LogOut, ChevronLeft, ChevronRight,
  FolderOpen, ChevronDown, Plus, Check, Activity,
} from 'lucide-react';
import { useUiStore }      from '../../store/uiStore';
import { useAuthStore }    from '../../store/authStore';
import { useProjectStore } from '../../store/projectStore';
import { useProjects }     from '../../hooks/useProjects';
import { useAuth }         from '../../hooks/useAuth';
import { cn, getInitials, getAvatarColor } from '../../utils/helpers';
import BugForgeLogo from '../ui/BugForgeLogo';

const NAV_ITEMS = [
  { label: 'Dashboard',      icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Generate Ticket',icon: Sparkles,        to: '/generate' },
  { label: 'Ticket History', icon: List,            to: '/tickets' },
  { label: 'Kanban Board',   icon: Kanban,          to: '/board' },
  { label: 'Analytics',      icon: BarChart2,       to: '/analytics' },
  { label: 'Projects',       icon: FolderOpen,      to: '/projects',       adminOnly: true },
  { label: 'Activity Logs', icon: Activity,        to: '/activity-logs', adminOnly: true },
  { label: 'Settings',       icon: Settings,        to: '/settings' },
  { label: 'Profile',        icon: User,            to: '/profile' },
];

function ProjectSelector({ collapsed, isAdmin }) {
  const navigate                            = useNavigate();
  const { selectedProject, setSelectedProject, clearProject } = useProjectStore();
  const { data: projects = [] }             = useProjects();
  const [open, setOpen]                     = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex justify-center px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-secondary-700 transition-colors"
        title="Switch project"
      >
        <FolderOpen className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="relative px-2 mb-1">
      <button
        onClick={() => setOpen((p) => !p)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
          'border-gray-200 dark:border-secondary-700',
          'bg-gray-50 dark:bg-secondary-700/50',
          'text-gray-700 dark:text-gray-300 hover:border-primary-300'
        )}
      >
        <FolderOpen className="w-4 h-4 text-primary-500 shrink-0" />
        <span className="flex-1 truncate text-left font-medium">
          {selectedProject?.name || 'All Projects'}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full mt-1 z-50 bg-white dark:bg-secondary-800 border border-gray-200 dark:border-secondary-600 rounded-lg shadow-lg overflow-hidden">
          <button
            onClick={() => { clearProject(); setOpen(false); }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-secondary-700 transition-colors border-b border-gray-100 dark:border-secondary-700',
              !selectedProject && 'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-400'
            )}
          >
            <span className="flex-1 truncate font-medium">All Projects</span>
            {!selectedProject && <Check className="w-3.5 h-3.5 text-primary-500 shrink-0" />}
          </button>
          {projects.map((p) => {
            const pid = p._id || p.id;
            const isSelected = pid === (selectedProject?._id || selectedProject?.id);
            return (
              <button
                key={pid}
                onClick={() => { setSelectedProject(p); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-secondary-700 transition-colors',
                  isSelected && 'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-400'
                )}
              >
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-xs text-gray-400 font-mono">{p.key}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-primary-500 shrink-0" />}
              </button>
            );
          })}
          {isAdmin && (
            <button
              onClick={() => { navigate('/projects'); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950 border-t border-gray-100 dark:border-secondary-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Manage projects
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const user        = useAuthStore((s) => s.user);
  const { logout }  = useAuth();
  const isAdmin     = user?.role === 'admin';
  const visibleNav  = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const initials    = getInitials(user?.name || 'U');
  const avatarColor = getAvatarColor(user?.name || '');

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-secondary-700 shrink-0">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <BugForgeLogo className="w-7 h-7 shrink-0" />
            <span className="font-bold text-gray-900 dark:text-white text-lg leading-tight truncate">
              BugForge
            </span>
          </div>
        )}
        {sidebarCollapsed && <BugForgeLogo className="w-7 h-7 mx-auto" />}
        <button
          onClick={toggleSidebar}
          className={cn(
            'p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100',
            'dark:hover:text-gray-200 dark:hover:bg-secondary-700 transition-colors',
            sidebarCollapsed && 'hidden md:flex'
          )}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Project selector */}
      <div className="px-0 pt-3 pb-1 border-b border-gray-100 dark:border-secondary-700/50 shrink-0">
        <ProjectSelector collapsed={sidebarCollapsed} isAdmin={isAdmin} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {visibleNav.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group',
                'text-sm font-medium',
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-secondary-700 hover:text-gray-900 dark:hover:text-gray-100'
              )
            }
            title={sidebarCollapsed ? label : undefined}
          >
            {({ isActive }) => (
              <>
                <Icon className={cn(
                  'w-5 h-5 shrink-0',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                )} />
                {!sidebarCollapsed && <span className="truncate">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="shrink-0 border-t border-gray-200 dark:border-secondary-700 p-2 space-y-1">
        <div className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300',
          sidebarCollapsed && 'justify-center'
        )}>
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0', avatarColor)}>
            {initials}
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || ''}</p>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium',
            'text-gray-600 dark:text-gray-400',
            'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400',
            'transition-colors duration-150',
            sidebarCollapsed && 'justify-center'
          )}
          title={sidebarCollapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!sidebarCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}
