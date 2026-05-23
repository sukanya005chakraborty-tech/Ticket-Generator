import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Sun,
  Moon,
  Bell,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Trash2,
  CheckCheck,
} from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { useAuth } from '../../hooks/useAuth';
import { cn, getInitials, getAvatarColor, formatRelativeTime } from '../../utils/helpers';
import { useNotifications, useMarkRead, useMarkAllRead, useDeleteNotification, useClearAllNotifications } from '../../hooks/useNotifications';

const ROUTE_LABELS = {
  '/dashboard': 'Dashboard',
  '/generate': 'Generate Ticket',
  '/tickets': 'Ticket History',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
  '/profile': 'Profile',
};

const TYPE_ICON = {
  ticket_assigned:      '🎫',
  ticket_status_changed: '🔄',
  comment_added:        '💬',
  invite_accepted:      '✅',
};

export default function Navbar() {
  const { toggleSidebar } = useUiStore();
  const { theme, toggleTheme } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const dropdownRef = useRef(null);
  const bellRef = useRef(null);

  const { data: notifData } = useNotifications();
  const notifications = notifData?.notifications ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;
  const { mutate: markRead } = useMarkRead();
  const { mutate: markAllRead } = useMarkAllRead();
  const { mutate: deleteNotif } = useDeleteNotification();
  const { mutate: clearAll } = useClearAllNotifications();

  const pageTitle =
    ROUTE_LABELS[location.pathname] ||
    (location.pathname.startsWith('/tickets/') ? 'Ticket Details' : 'BugForge');

  const initials = getInitials(user?.name || 'U');
  const avatarColor = getAvatarColor(user?.name || '');

  useEffect(() => {
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotifClick = (n) => {
    if (!n.read) markRead(n.id || n._id);
    if (n.ticketId) navigate(`/tickets/${n.ticketId}`);
    setBellOpen(false);
  };

  return (
    <header className="bg-white dark:bg-secondary-800 border-b border-gray-200 dark:border-secondary-700 px-4 md:px-6 py-3 flex items-center gap-4 shrink-0 z-10">
      {/* Hamburger (mobile) */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-secondary-700 transition-colors md:hidden"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title */}
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 truncate">
        {pageTitle}
      </h1>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-secondary-700 transition-colors"
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notification bell */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen((v) => !v)}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-secondary-700 transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 shadow-lg z-50 animate-fade-in overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-secondary-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  Notifications {unreadCount > 0 && <span className="text-primary-600 dark:text-primary-400">({unreadCount})</span>}
                </span>
                {notifications.length > 0 && (
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllRead()}
                        className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={() => clearAll()}
                      className="flex items-center gap-1 text-xs text-red-500 hover:underline font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-secondary-700">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => {
                    const nid = n.id || n._id;
                    return (
                      <div
                        key={nid}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-secondary-700 transition-colors group',
                          !n.read && 'bg-primary-50/60 dark:bg-primary-950/30'
                        )}
                        onClick={() => handleNotifClick(n)}
                      >
                        <span className="text-base mt-0.5 shrink-0">{TYPE_ICON[n.type] || '🔔'}</span>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm leading-snug', n.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100 font-medium')}>
                            {n.message}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {formatRelativeTime(n.createdAt)}
                            {isAdmin && n.recipientId?.name && (
                              <span className="ml-2 text-primary-400 dark:text-primary-500">→ {n.recipientId.name}</span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotif(nid); }}
                          className="p-1 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {!n.read && (
                          <span className="w-2 h-2 bg-primary-500 rounded-full shrink-0 mt-1.5" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-secondary-700 transition-colors"
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold',
                avatarColor
              )}
            >
              {initials}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block max-w-[100px] truncate">
              {user?.name}
            </span>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-gray-400 transition-transform hidden sm:block',
                dropdownOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 shadow-lg py-1 z-50 animate-fade-in">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-secondary-700">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-secondary-700 transition-colors"
              >
                <User className="w-4 h-4" />
                Profile
              </button>
              <button
                onClick={() => { setDropdownOpen(false); navigate('/settings'); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-secondary-700 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <div className="border-t border-gray-100 dark:border-secondary-700 mt-1 pt-1">
                <button
                  onClick={() => { setDropdownOpen(false); logout(); }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
