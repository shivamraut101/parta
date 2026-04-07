function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-200 ${className}`} />;
}

export default function DebtEngineLoading() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-4">
        <Skeleton className="h-3 w-12 rounded-full" />
        <Skeleton className="mt-2 h-8 w-44" />
        <Skeleton className="mt-1.5 h-4 w-52" />
      </div>

      {/* 2 stat cards */}
      <section className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100 space-y-2">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-16 rounded-full" />
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100 space-y-2">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-24 rounded-full" />
        </div>
      </section>

      {/* Optimizer recommendation card */}
      <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
        <Skeleton className="mb-3 h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-3/4" />
        <Skeleton className="mt-3 h-12 w-full" />
      </div>

      {/* Debt account cards */}
      <Skeleton className="mb-2 h-3 w-28 rounded-full" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
            <div className="flex items-center justify-between mb-3">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3 w-24 rounded-full" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="mt-4 h-12 w-full" />
    </main>
  );
}
