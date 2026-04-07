function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-200 ${className}`} />;
}

export default function HomeLoading() {
  return (
    <main className="relative isolate min-h-[100dvh] overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-20 h-60 w-60 rounded-full bg-teal-200/30 blur-3xl" />
        <div className="absolute -right-20 top-48 h-56 w-56 rounded-full bg-sky-200/25 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <section className="mb-5 rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="w-full max-w-xl space-y-2">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-8 w-full max-w-[420px]" />
              <Skeleton className="h-4 w-full max-w-[340px]" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1 text-center">
                  <Skeleton className="h-12 w-8 rounded-md" />
                  <Skeleton className="h-2.5 w-8 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-1 h-4 w-5/6" />
              <Skeleton className="mt-4 h-3 w-20 rounded-full" />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
