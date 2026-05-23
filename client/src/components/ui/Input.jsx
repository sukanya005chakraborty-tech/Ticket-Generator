import { forwardRef } from 'react';
import { cn } from '../../utils/helpers';

const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    icon: Icon,
    rightElement,
    className,
    containerClassName,
    multiline = false,
    rows = 3,
    disabled = false,
    required = false,
    ...rest
  },
  ref
) {
  const baseInputClass = cn(
    'w-full rounded-lg border bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100',
    'placeholder:text-gray-400 dark:placeholder:text-gray-500',
    'transition-colors duration-150',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    disabled && 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-secondary-900',
    error
      ? 'border-red-400 dark:border-red-600 focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-900'
      : 'border-gray-300 dark:border-secondary-600 focus:border-primary-400 focus:ring-primary-100 dark:focus:ring-primary-900/30',
    Icon ? 'pl-10' : 'px-3',
    rightElement ? 'pr-10' : 'pr-3',
    multiline ? 'py-2.5 resize-y' : 'py-2',
    className
  );

  return (
    <div className={cn('flex flex-col gap-1', containerClassName)}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>
        )}
        {multiline ? (
          <textarea
            ref={ref}
            rows={rows}
            disabled={disabled}
            className={baseInputClass}
            {...rest}
          />
        ) : (
          <input
            ref={ref}
            disabled={disabled}
            className={baseInputClass}
            {...rest}
          />
        )}
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
      )}
    </div>
  );
});

export default Input;
