import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Save, Lock, User, Calendar, TicketIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import * as userService from '../services/userService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/LoadingSkeleton';
import { formatDate, getInitials, getAvatarColor, cn } from '../utils/helpers';
import { useOverview } from '../hooks/useAnalytics';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default function Profile() {
  const queryClient = useQueryClient();
  const storeUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: overview } = useOverview();

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: userService.getProfile,
    select: (d) => d?.data?.user,
  });

  const user = profileData || storeUser;

  const { mutateAsync: updateProfile, isPending: isSavingProfile } = useMutation({
    mutationFn: userService.updateProfile,
    onSuccess: (res) => {
      const updated = res?.data?.user;
      if (updated) {
        setUser(updated);
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      }
      toast.success('Profile updated successfully');
    },
    onError: (err) => toast.error(err.message || 'Failed to update profile'),
  });

  const { mutateAsync: updatePassword, isPending: isSavingPassword } = useMutation({
    mutationFn: userService.updatePassword,
    onSuccess: () => toast.success('Password changed successfully'),
    onError: (err) => toast.error(err.message || 'Failed to change password'),
  });

  const {
    register: regProfile,
    handleSubmit: handleProfile,
    reset: resetProfile,
    formState: { errors: profileErrors, isDirty: profileDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '' },
  });

  const {
    register: regPassword,
    handleSubmit: handlePassword,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (user) {
      resetProfile({ name: user.name || '', email: user.email || '' });
    }
  }, [user, resetProfile]);

  const onProfileSubmit = async (data) => {
    await updateProfile(data);
    resetProfile(data); // Reset dirty state after successful save
  };

  const onPasswordSubmit = async (data) => {
    await updatePassword({
      currentPassword:  data.currentPassword,
      newPassword:      data.newPassword,
      confirmPassword:  data.confirmPassword,
    });
    resetPassword();
  };

  const initials = getInitials(user?.name || 'U');
  const avatarColor = getAvatarColor(user?.name || '');

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-36" />
        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 p-6">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="w-20 h-20 rounded-full" rounded="rounded-full" />
            <div>
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-10 w-full mb-3" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your account information
        </p>
      </div>

      {/* Avatar + account info */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0',
              avatarColor
            )}
          >
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {user?.name || 'User'}
              </h2>
              <Badge variant={user?.role === 'admin' ? 'purple' : 'info'} size="sm">
                {user?.role || 'user'}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
          </div>

          {/* Stats */}
          <div className="flex gap-6 shrink-0">
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center mb-0.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Joined</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {formatDate(user?.createdAt, 'MMM yyyy')}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center mb-0.5">
                <TicketIcon className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Tickets</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {overview?.totalTickets || 0}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Edit profile */}
      <Card
        title="Personal Information"
        action={<User className="w-5 h-5 text-gray-400" />}
      >
        <form onSubmit={handleProfile(onProfileSubmit)} className="space-y-4">
          <Input
            label="Full name"
            type="text"
            error={profileErrors.name?.message}
            placeholder="Your full name"
            {...regProfile('name')}
          />
          <Input
            label="Email address"
            type="email"
            error={profileErrors.email?.message}
            placeholder="your@email.com"
            {...regProfile('email')}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              icon={Save}
              loading={isSavingProfile}
              disabled={!profileDirty}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Change password */}
      <Card
        title="Change Password"
        subtitle="Update your account password"
        action={<Lock className="w-5 h-5 text-gray-400" />}
      >
        <form onSubmit={handlePassword(onPasswordSubmit)} className="space-y-4">
          <Input
            label="Current password"
            type={showCurrent ? 'text' : 'password'}
            error={passwordErrors.currentPassword?.message}
            placeholder="Your current password"
            rightElement={
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            {...regPassword('currentPassword')}
          />
          <Input
            label="New password"
            type={showNew ? 'text' : 'password'}
            error={passwordErrors.newPassword?.message}
            placeholder="New strong password"
            rightElement={
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            {...regPassword('newPassword')}
          />
          <Input
            label="Confirm new password"
            type={showConfirm ? 'text' : 'password'}
            error={passwordErrors.confirmPassword?.message}
            placeholder="Repeat new password"
            rightElement={
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            {...regPassword('confirmPassword')}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              icon={Lock}
              loading={isSavingPassword}
            >
              Update Password
            </Button>
          </div>
        </form>
      </Card>

      {/* Danger zone */}
      <Card title="Account">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Account ID</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
              {user?._id || user?.id || '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Member since</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {formatDate(user?.createdAt, 'MMMM d, yyyy')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
