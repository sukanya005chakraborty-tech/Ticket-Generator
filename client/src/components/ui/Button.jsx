import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/helpers';

const variants = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus:ring-primary-500 border-transparent',
  secondary:
    'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 focus:ring-gray-400 border-gray-200 dark:bg-secondary-700 dark:text-gray-200 dark:hover:bg-secondary-600 dark:border-secondary-600',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500 border-transparent',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200 focus:ring-gray-400 border-transparent dark:text-gray-400 dark:hover:bg-secondary-700',
  outline:
    'bg-transparent text-primary-600 border-primary-600 hover:bg-primary-50 active:bg-primary-100 focus:ring-primary-500 dark:text-primary-400 dark:border-primary-400 dark:hover:bg-primary-950',
  success:
    'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 focus:ring-green-500 border-transparent',
};

const sizes = {
  xs: 'text-xs px-2 py-1 rounded',
  sm: 'text-sm px-3 py-1.5 rounded-md',
  md: 'text-sm px-4 py-2 rounded-lg',
  lg: 'text-base px-6 py-3 rounded-lg',
  xl: 'text-lg px-8 py-4 rounded-xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  children,
  className,
  type = 'button',
  ...rest
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium border transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        Icon && iconPosition === 'left' && <Icon className="w-4 h-4 shrink-0" />
      )}
      {children}
      {!loading && Icon && iconPosition === 'right' && <Icon className="w-4 h-4 shrink-0" />}
    </button>
  );
}
