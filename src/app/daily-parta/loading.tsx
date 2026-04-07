function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-200 ${className}`} />;
}

export default function DailyPartaLoading() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-4">
        <Skeleton className="h-3 w-12 rounded-full" />
        <Skeleton className="mt-2 h-8 w-40" />
        <Skeleton className="mt-1.5 h-4 w-56" />
      </div>

      {/* Today form card */}
      <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
        <Skeleton className="mb-4 h-5 w-36" />
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-12" />
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>

      {/* History label */}
      <Skeleton className="mb-2 h-3 w-24 rounded-full" />

      {/* 7 history rows */}
      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-100">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    </main>
  );
}
