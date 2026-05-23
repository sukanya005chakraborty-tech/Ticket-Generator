import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sun, Moon, Bell, Zap, Save, Palette, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import * as userService from '../services/userService';
import { useThemeStore } from '../store/themeStore';
import { useOverview } from '../hooks/useAnalytics';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Skeleton } from '../components/ui/LoadingSkeleton';
import { PRIORITY_OPTIONS, SEVERITY_OPTIONS } from '../utils/constants';
import { cn } from '../utils/helpers';

const schema = z.object({
  defaultPriority: z.string(),
  defaultSeverity: z.string(),
  emailNotifications: z.boolean(),
  browserNotifications: z.boolean(),
  autoSaveTickets: z.boolean(),
  compactView: z.boolean(),
});

export default function Settings() {
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useThemeStore();
  const { data: overview } = useOverview();
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';

  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAllUsers,
    select: (d) => d?.data?.users,
    enabled: isAdmin,
  });

  const { mutate: changeRole } = useMutation({
    mutationFn: userService.updateUserRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User role updated');
    },
    onError: (err) => toast.error(err.message || 'Failed to update role'),
  });

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: userService.getSettings,
    select: (d) => d?.data?.settings,
  });

  const { mutateAsync: saveSettings, isPending: isSaving } = useMutation({
    mutationFn: userService.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved successfully');
    },
    onError: (err) => toast.error(err.message || 'Failed to save settings'),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      defaultPriority: 'Medium',
      defaultSeverity: 'Major',
      emailNotifications: true,
      browserNotifications: false,
      autoSaveTickets: true,
      compactView: false,
    },
  });

  useEffect(() => {
    if (settingsData) {
      reset({
        defaultPriority: settingsData.defaultPriority || 'Medium',
        defaultSeverity: settingsData.defaultSeverity || 'Major',
        emailNotifications: settingsData.emailNotifications ?? true,
        browserNotifications: settingsData.browserNotifications ?? false,
        autoSaveTickets: settingsData.autoSaveTickets ?? true,
        compactView: settingsData.compactView ?? false,
      });
    }
  }, [settingsData, reset]);

  const onSubmit = async (data) => {
    await saveSettings(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
            <Skeleton className="h-5 w-32 mb-4" />
            <Skeleton className="h-10 w-full mb-3" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your preferences and application settings
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Appearance */}
        <Card
          title="Appearance"
          subtitle="Customize how BugForge looks"
          action={<Palette className="w-5 h-5 text-gray-400" />}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Switch between light and dark mode
                </p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg border font-medium text-sm transition-all',
                  theme === 'dark'
                    ? 'bg-secondary-700 border-secondary-600 text-white'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                )}
              >
                {theme === 'dark' ? (
                  <>
                    <Moon className="w-4 h-4" />
                    Dark Mode
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4" />
                    Light Mode
                  </>
                )}
              </button>
            </div>

            <ToggleRow
              label="Compact View"
              description="Show more content with less spacing"
              name="compactView"
              register={register}
              watch={watch}
            />
          </div>
        </Card>

        {/* Default Ticket Settings */}
        <Card
          title="Default Ticket Settings"
          subtitle="Set defaults for newly generated tickets"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Default Priority
              </label>
              <select
                {...register('defaultPriority')}
                className="w-full rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Default Severity
              </label>
              <select
                {...register('defaultSeverity')}
                className="w-full rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
              >
                {SEVERITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <ToggleRow
              label="Auto-save Tickets"
              description="Automatically save generated tickets to history"
              name="autoSaveTickets"
              register={register}
              watch={watch}
            />
          </div>
        </Card>

        {/* Notifications */}
        <Card
          title="Notifications"
          subtitle="Manage how you receive notifications"
          action={<Bell className="w-5 h-5 text-gray-400" />}
        >
          <div className="space-y-4">
            <ToggleRow
              label="Email Notifications"
              description="Receive updates via email"
              name="emailNotifications"
              register={register}
              watch={watch}
            />
            <ToggleRow
              label="Browser Notifications"
              description="Show desktop notifications in your browser"
              name="browserNotifications"
              register={register}
              watch={watch}
            />
          </div>
        </Card>

        {/* API Usage */}
        <Card
          title="API Usage"
          subtitle="Your AI token consumption"
          action={<Zap className="w-5 h-5 text-amber-400" />}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total tokens used</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {(overview?.totalTokensUsed || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Avg. generation time</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {Math.round(overview?.averageGenerationTime || 0)}ms
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Tickets this month</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {overview?.ticketsThisMonth || 0}
              </span>
            </div>
          </div>
        </Card>

        {/* User Management – admin only */}
        {isAdmin && (
          <Card
            title="User Management"
            subtitle="Manage platform roles for all users"
            action={<ShieldCheck className="w-5 h-5 text-primary-500" />}
          >
            <div className="space-y-3">
              {(allUsers || [])
                .filter((u) => u._id !== currentUser?._id)
                .map((u) => (
                  <div key={u._id} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-xs font-semibold text-primary-700 dark:text-primary-300 shrink-0">
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{u.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                      </div>
                    </div>
                    <select
                      value={u.role || 'user'}
                      onChange={(e) => changeRole({ userId: u._id, role: e.target.value })}
                      className="shrink-0 rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                ))}
              {allUsers?.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">No other users found.</p>
              )}
            </div>
          </Card>
        )}

        {/* Save button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            icon={Save}
            loading={isSaving}
            disabled={!isDirty}
          >
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}

function ToggleRow({ label, description, name, register, watch }) {
  const value = watch(name);

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input type="checkbox" className="sr-only peer" {...register(name)} />
        <div
          className={cn(
            'w-11 h-6 rounded-full transition-colors duration-200 peer-focus:outline-none',
            value
              ? 'bg-primary-600'
              : 'bg-gray-200 dark:bg-secondary-600'
          )}
        >
          <div
            className={cn(
              'w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 absolute top-1',
              value ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </div>
      </label>
    </div>
  );
}
