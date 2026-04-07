function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-200 ${className}`} />;
}

export default function SupplierWallLoading() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-4">
        <Skeleton className="h-3 w-14 rounded-full" />
        <Skeleton className="mt-2 h-8 w-40" />
        <Skeleton className="mt-1.5 h-4 w-52" />
      </div>

      {/* Search + Add button */}
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="h-12 w-24" />
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>

      {/* Supplier list rows */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-stone-100">
            <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
            <div className="text-right space-y-1.5">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-14 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
