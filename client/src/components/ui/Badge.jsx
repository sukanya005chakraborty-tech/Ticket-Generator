import { cn } from '../../utils/helpers';

const variantClasses = {
  success: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800',
  warning: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
  danger: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
  info: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800',
  default: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  purple: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800',
  orange: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800',
};

const priorityVariants = {
  Critical: 'danger',
  High: 'orange',
  Medium: 'warning',
  Low: 'success',
};

const severityVariants = {
  Blocker: 'danger',
  Critical: 'danger',
  Major: 'orange',
  Minor: 'info',
  Trivial: 'default',
};

const statusVariants = {
  draft: 'default',
  open: 'info',
  'in-progress': 'warning',
  resolved: 'success',
  closed: 'default',
};

const sizeClasses = {
  xs: 'text-xs px-1.5 py-0.5 rounded',
  sm: 'text-xs px-2 py-0.5 rounded-md',
  md: 'text-sm px-2.5 py-1 rounded-md',
};

function resolveVariant(variant, value) {
  if (variant && variantClasses[variant]) return variant;
  if (value) {
    return (
      priorityVariants[value] ||
      severityVariants[value] ||
      statusVariants[value] ||
      'default'
    );
  }
  return 'default';
}

export default function Badge({
  variant,
  value,
  size = 'sm',
  children,
  className,
  dot = false,
}) {
  const resolvedVariant = resolveVariant(variant, value || children);
  const label = children || value;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium border',
        variantClasses[resolvedVariant] || variantClasses.default,
        sizeClasses[size] || sizeClasses.sm,
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            resolvedVariant === 'success' && 'bg-green-500',
            resolvedVariant === 'warning' && 'bg-amber-500',
            resolvedVariant === 'danger' && 'bg-red-500',
            resolvedVariant === 'info' && 'bg-blue-500',
            resolvedVariant === 'orange' && 'bg-orange-500',
            resolvedVariant === 'default' && 'bg-gray-400'
          )}
        />
      )}
      {label}
    </span>
  );
}
