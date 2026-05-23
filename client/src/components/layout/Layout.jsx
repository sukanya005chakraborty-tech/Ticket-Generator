import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useUiStore } from '../../store/uiStore';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import ErrorBoundary from '../ErrorBoundary';
import { cn } from '../../utils/helpers';

export default function Layout() {
  const { sidebarCollapsed, setSidebarCollapsed } = useUiStore();

  // Close sidebar on mobile resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarCollapsed]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-secondary-900 overflow-hidden">
      {/* Mobile overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:relative z-30 h-full transition-all duration-300 ease-in-out',
          'bg-white dark:bg-secondary-800 border-r border-gray-200 dark:border-secondary-700',
          sidebarCollapsed
            ? '-translate-x-full md:translate-x-0 md:w-16'
            : 'translate-x-0 w-64'
        )}
      >
        <Sidebar />
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
