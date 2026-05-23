import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { Skeleton } from './LoadingSkeleton';

const colorClasses = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    icon: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-100 dark:border-blue-900',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-950',
    icon: 'text-green-600 dark:text-green-400',
    border: 'border-green-100 dark:border-green-900',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950',
    icon: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-100 dark:border-amber-900',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950',
    icon: 'text-red-600 dark:text-red-400',
    border: 'border-red-100 dark:border-red-900',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950',
    icon: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-100 dark:border-purple-900',
  },
  teal: {
    bg: 'bg-teal-50 dark:bg-teal-950',
    icon: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-100 dark:border-teal-900',
  },
};

export default function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  color = 'blue',
  loading = false,
  className,
  suffix,
}) {
  const colors = colorClasses[color] || colorClasses.blue;

  if (loading) {
    return (
      <div className={cn('bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 shadow-sm p-5', className)}>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-24 mb-2" />
        <Skeleton className="h-3 w-32" />
      </div>
    );
  }

  const isPositive = change > 0;
  const isNeutral = change === 0 || change === null || change === undefined;

  return (
    <div
      className={cn(
        'bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 shadow-sm p-5 hover:shadow-md transition-shadow',
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        {Icon && (
          <div className={cn('p-2.5 rounded-lg', colors.bg)}>
            <Icon className={cn('w-5 h-5', colors.icon)} />
          </div>
        )}
      </div>

      <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
        {value ?? 0}
        {suffix && <span className="text-lg font-medium text-gray-500 dark:text-gray-400 ml-1">{suffix}</span>}
      </p>

      {(change !== null && change !== undefined) || changeLabel ? (
        <div className="flex items-center gap-1">
          {!isNeutral && (
            <span
              className={cn(
                'flex items-center text-xs font-medium',
                isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
              )}
            >
              {isPositive ? (
                <TrendingUp className="w-3 h-3 mr-0.5" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-0.5" />
              )}
              {Math.abs(change)}%
            </span>
          )}
          {isNeutral && <Minus className="w-3 h-3 text-gray-400" />}
          {changeLabel && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{changeLabel}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
