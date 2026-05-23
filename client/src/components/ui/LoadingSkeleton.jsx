import { cn } from '../../utils/helpers';

export function Skeleton({ className, rounded = 'rounded-md' }) {
  return (
    <div
      className={cn(
        'skeleton',
        rounded,
        className
      )}
    />
  );
}

export function CardSkeleton({ className }) {
  return (
    <div className={cn('bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 shadow-sm p-5', className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-20" />
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6 mb-2" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  );
}

export function TicketCardSkeleton() {
  return (
    <div className="bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 shadow-sm p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-14" />
          </div>
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex gap-1 shrink-0">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function TicketListSkeleton({ count = 5 }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <TicketCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-56 mb-2" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 shadow-sm p-5">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 shadow-sm p-5">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>

      {/* Recent tickets */}
      <div className="bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 shadow-sm p-5">
        <Skeleton className="h-5 w-36 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-14 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TicketDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-5 w-32" />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
            <Skeleton className="h-5 w-24 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6 mb-2" />
            <Skeleton className="h-4 w-4/6" />
          </div>
          <div className="bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
            <Skeleton className="h-5 w-36 mb-3" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 mb-2">
                <Skeleton className="h-4 w-4 rounded-full shrink-0 mt-0.5" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 p-5">
            <Skeleton className="h-5 w-20 mb-4" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between mb-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
      <Skeleton className="h-9 w-24 mb-2" />
      <Skeleton className="h-3 w-36" />
    </div>
  );
}
