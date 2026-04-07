function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-200 ${className}`} />;
}

function SectionCard({ rows = 2 }: { rows?: number }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
      <Skeleton className="mb-4 h-5 w-40" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function AdminLoading() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-4">
        <Skeleton className="h-3 w-12 rounded-full" />
        <Skeleton className="mt-2 h-8 w-44" />
        <Skeleton className="mt-1.5 h-4 w-56" />
      </div>

      <section className="space-y-4">
        {/* Day Lock */}
        <SectionCard rows={2} />
        {/* Brand Profile */}
        <SectionCard rows={3} />
        {/* Financial Settings */}
        <SectionCard rows={4} />
        {/* Team Management */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
          <Skeleton className="mb-4 h-5 w-44" />
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </section>
    </main>
  );
}
