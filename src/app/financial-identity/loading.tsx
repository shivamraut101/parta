function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-200 ${className}`} />;
}

export default function FinancialIdentityLoading() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-4">
        <Skeleton className="h-3 w-12 rounded-full" />
        <Skeleton className="mt-2 h-8 w-48" />
        <Skeleton className="mt-1.5 h-4 w-48" />
      </div>

      {/* 2 stat cards */}
      <section className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100 space-y-2">
          <Skeleton className="h-3 w-28 rounded-full" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100 space-y-2">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="h-8 w-24" />
        </div>
      </section>

      {/* Form card */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
        <Skeleton className="mb-4 h-5 w-44" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-36 rounded-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ))}
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </main>
  );
}
