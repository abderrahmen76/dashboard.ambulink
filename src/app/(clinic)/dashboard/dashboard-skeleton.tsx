export function DashboardSkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 animate-pulse flex-col bg-surface">
        <div className="border-b border-line/80 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="h-2.5 w-32 rounded bg-surface-strong" />
              <div className="h-4 w-48 rounded bg-surface-strong" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-24 rounded-full bg-surface-strong" />
              <div className="h-10 w-[9.75rem] rounded-full bg-surface-strong" />
              <div className="h-10 w-28 rounded-full bg-surface-strong" />
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[104px] rounded-2xl border border-line/70 bg-white"
              />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="h-[520px] rounded-2xl border border-line/70 bg-white" />
            <div className="h-[520px] rounded-2xl border border-line/70 bg-white" />
          </div>
          <div className="h-28 rounded-2xl border border-line/70 bg-white" />
        </div>
      </div>
  );
}
