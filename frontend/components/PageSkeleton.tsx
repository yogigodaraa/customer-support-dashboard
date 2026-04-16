export function ThreePanelSkeleton() {
  return (
    <div className="flex h-full">
      {/* List panel */}
      <div className="w-72 border-r border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="h-8 w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          </div>
        ))}
      </div>
      {/* Detail panel */}
      <div className="flex-1 p-6 space-y-4">
        <div className="h-6 w-1/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="space-y-3 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 w-full rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
      {/* Right panel */}
      <div className="w-60 border-l border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse mx-auto" />
        <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mx-auto" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-3 w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm space-y-3">
            <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-8 w-1/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-16 w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          </div>
        ))}
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm">
          <div className="h-4 w-1/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-4" />
          <div className="h-48 w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm">
          <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-4" />
          <div className="h-48 w-48 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse mx-auto" />
        </div>
      </div>
    </div>
  );
}
