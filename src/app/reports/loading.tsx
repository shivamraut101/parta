function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-200 ${className}`} />;
}

export default function ReportsLoading() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-4">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="mt-2 h-8 w-52" />
        <Skeleton className="mt-1.5 h-4 w-40" />
      </div>

      {/* Generate snapshot card */}
      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
        <Skeleton className="mb-3 h-5 w-44" />
        <div className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>

      {/* Monthly snapshot cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-3 w-36 rounded-full" />
                <Skeleton className="h-3 w-28 rounded-full" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="mt-3 h-11 w-full" />
          </div>
        ))}
      </div>
    </main>
  );
}
