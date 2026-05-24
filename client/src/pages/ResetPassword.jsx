import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import * as authService from '../services/authService';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import BugForgeLogo from '../components/ui/BugForgeLogo';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).+$/,
        'Must contain uppercase, lowercase, number, and special character'
      ),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default function ResetPassword() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-secondary-900">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Invalid or missing reset token.</p>
          <Link to="/forgot-password" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async ({ password, confirmPassword }) => {
    setLoading(true);
    try {
      await authService.resetPassword(token, password, confirmPassword);
      toast.success('Password reset successfully. Please log in.');
      navigate('/login');
    } catch (error) {
      toast.error(error.message || 'Reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const eyeToggle = (show, setShow) => (
    <button
      type="button"
      onClick={() => setShow((v) => !v)}
      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      tabIndex={-1}
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-secondary-900">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <BugForgeLogo className="w-8 h-8" />
          <span className="text-xl font-bold text-gray-900 dark:text-white">BugForge</span>
        </div>

        <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-gray-200 dark:border-secondary-700 shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Set new password</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Choose a strong password for your account.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="New password"
              type={showPassword ? 'text' : 'password'}
              icon={Lock}
              placeholder="New password"
              error={errors.password?.message}
              autoComplete="new-password"
              rightElement={eyeToggle(showPassword, setShowPassword)}
              {...register('password')}
            />

            <Input
              label="Confirm new password"
              type={showConfirm ? 'text' : 'password'}
              icon={Lock}
              placeholder="Confirm password"
              error={errors.confirmPassword?.message}
              autoComplete="new-password"
              rightElement={eyeToggle(showConfirm, setShowConfirm)}
              {...register('confirmPassword')}
            />

            <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
              Reset password
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Remembered it?{' '}
            <Link to="/login" className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
