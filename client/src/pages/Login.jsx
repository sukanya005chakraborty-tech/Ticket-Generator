import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import BugForgeLogo from '../components/ui/BugForgeLogo';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data) => {
    await login(data);
  };

  const fillDemo = () => {
    setValue('email', 'demo@ticketai.com');
    setValue('password', 'Demo@123');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 relative overflow-hidden flex-col justify-between p-12">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-primary-400/20 rounded-full blur-3xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <BugForgeLogo className="w-9 h-9" />
          <span className="text-2xl font-bold text-white">BugForge</span>
        </div>

        {/* Hero text */}
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Generate perfect
            <br />
            Jira tickets with AI
          </h1>
          <p className="text-primary-200 text-lg mb-8 leading-relaxed">
            Describe your issue in plain English and let AI create well-structured,
            detailed tickets with acceptance criteria, test cases, and more.
          </p>
          <div className="flex flex-col gap-3">
            {[
              'AI-powered ticket generation in seconds',
              'Automatic priority & severity detection',
              'Test cases & acceptance criteria included',
              'Full JSON export for Jira import',
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-3 text-primary-100">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-primary-300 text-sm">
          &copy; {new Date().getFullYear()} BugForge. All rights reserved.
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 dark:bg-secondary-900">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <BugForgeLogo className="w-7 h-7" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">BugForge</span>
          </div>

          <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-gray-200 dark:border-secondary-700 shadow-sm p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                Welcome back
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Sign in to your account to continue
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

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                icon={Lock}
                placeholder="Your password"
                error={errors.password?.message}
                autoComplete="current-password"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                {...register('password')}
              />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isLoading}
                size="lg"
              >
                Sign In
              </Button>
            </form>

            {/* Demo credentials */}
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">
                Demo credentials
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Email: demo@ticketai.com &nbsp;|&nbsp; Password: Demo@123
              </p>
              <button
                type="button"
                onClick={fillDemo}
                className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 underline"
              >
                Fill demo credentials
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Don&apos;t have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              >
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
