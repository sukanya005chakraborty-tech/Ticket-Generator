import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, User, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { cn } from '../utils/helpers';
import BugForgeLogo from '../components/ui/BugForgeLogo';

const schema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^a-zA-Z0-9]/, 'Must contain a special character'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

function PasswordStrength({ password }) {
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /[0-9]/.test(password) },
    { label: 'Special character', ok: /[^a-zA-Z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][score];
  const strengthColor = [
    '',
    'text-red-500',
    'text-orange-500',
    'text-yellow-500',
    'text-green-500',
  ][score];
  const barColor = [
    '',
    'bg-red-400',
    'bg-orange-400',
    'bg-yellow-400',
    'bg-green-500',
  ][score];

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-300',
              i <= score ? barColor : 'bg-gray-200 dark:bg-secondary-600'
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {checks.map((c) => (
            <span
              key={c.label}
              className={cn(
                'text-xs flex items-center gap-1',
                c.ok ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
              )}
            >
              <span>{c.ok ? '✓' : '○'}</span>
              {c.label}
            </span>
          ))}
        </div>
        {strengthLabel && (
          <span className={cn('text-xs font-medium shrink-0 ml-2', strengthColor)}>
            {strengthLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { register: registerUser, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const password = watch('password');

  const onSubmit = async (data) => {
    await registerUser({
      name: data.name,
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
    });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-primary-400/20 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-3">
          <BugForgeLogo className="w-9 h-9" />
          <span className="text-2xl font-bold text-white">BugForge</span>
        </div>

        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Start generating
            <br />
            tickets in seconds
          </h1>
          <p className="text-primary-200 text-lg mb-8 leading-relaxed">
            Join thousands of developers and QA engineers who use BugForge
            to create high-quality Jira tickets effortlessly.
          </p>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <p className="text-white text-sm italic leading-relaxed mb-3">
              &ldquo;BugForge saves me at least 30 minutes every day. The AI understands
              exactly what I mean and creates perfectly structured tickets.&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center text-white text-sm font-bold">
                A
              </div>
              <div>
                <p className="text-white text-xs font-semibold">Alex M.</p>
                <p className="text-primary-300 text-xs">Senior QA Engineer</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative text-primary-300 text-sm">
          &copy; {new Date().getFullYear()} BugForge. All rights reserved.
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 dark:bg-secondary-900 overflow-y-auto">
        <div className="w-full max-w-md py-6">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <BugForgeLogo className="w-7 h-7" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">BugForge</span>
          </div>

          <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-gray-200 dark:border-secondary-700 shadow-sm p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                Create your account
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Free forever. No credit card required.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Full name"
                type="text"
                icon={User}
                placeholder="John Doe"
                error={errors.name?.message}
                autoComplete="name"
                {...register('name')}
              />

              <Input
                label="Email address"
                type="email"
                icon={Mail}
                placeholder="you@example.com"
                error={errors.email?.message}
                autoComplete="email"
                {...register('email')}
              />

              <div>
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  icon={Lock}
                  placeholder="Create a strong password"
                  error={errors.password?.message}
                  autoComplete="new-password"
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
                <PasswordStrength password={password} />
              </div>

              <Input
                label="Confirm password"
                type={showConfirm ? 'text' : 'password'}
                icon={Lock}
                placeholder="Repeat your password"
                error={errors.confirmPassword?.message}
                autoComplete="new-password"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                {...register('confirmPassword')}
              />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isLoading}
                size="lg"
                icon={Sparkles}
              >
                Create Account
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
