import { cn } from '../../utils/helpers';

export default function Card({
  title,
  subtitle,
  action,
  children,
  className,
  noPadding = false,
  hoverable = false,
}) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 shadow-sm',
        hoverable && 'hover:shadow-md transition-shadow duration-200',
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-start justify-between px-5 pt-5 pb-0">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="ml-4 shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(!noPadding && 'p-5', title && !noPadding && 'pt-4')}>{children}</div>
    </div>
  );
}
