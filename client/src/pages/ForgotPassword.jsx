import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import * as authService from '../services/authService';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import BugForgeLogo from '../components/ui/BugForgeLogo';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export default function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async ({ email }) => {
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSubmitted(true);
    } catch (error) {
      toast.error(error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-secondary-900">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <BugForgeLogo className="w-8 h-8" />
          <span className="text-xl font-bold text-gray-900 dark:text-white">BugForge</span>
        </div>

        <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-gray-200 dark:border-secondary-700 shadow-sm p-8">
          {submitted ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Check your inbox</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                If an account with that email exists, we&apos;ve sent a password reset link. Check your spam folder if you don&apos;t see it.
              </p>
              <Link
                to="/login"
                className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Back to login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Forgot password?</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Enter your email and we&apos;ll send a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  icon={Mail}
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  autoComplete="email"
                  {...register('email')}
                />

                <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
                  Send reset link
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                <Link
                  to="/login"
                  className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
