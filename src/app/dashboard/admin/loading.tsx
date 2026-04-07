function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-200 ${className}`} />;
}

export default function AdminDashboardLoading() {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-stone-200 bg-white px-6 py-4 lg:px-8">
        <Skeleton className="h-3 w-28 rounded-full" />
        <Skeleton className="mt-2 h-8 w-48" />
        <Skeleton className="mt-1.5 h-4 w-80" />
      </div>

      <div className="flex-1 overflow-auto p-6 lg:p-8">
        {/* Command summary */}
        <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full">
              <Skeleton className="h-3 w-28 rounded-full" />
              <Skeleton className="mt-3 h-8 w-full max-w-[520px]" />
              <Skeleton className="mt-2 h-4 w-full max-w-[420px]" />
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <Skeleton className="h-16 w-6 rounded-md" />
                  <Skeleton className="h-2.5 w-8 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="w-full space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-36" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-12 w-12 rounded-xl" />
              </div>
              <Skeleton className="mt-4 h-3 w-20 rounded-full" />
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-2 h-4 w-full" />
                <Skeleton className="mt-1 h-4 w-4/5" />
                <Skeleton className="mt-4 h-3 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
